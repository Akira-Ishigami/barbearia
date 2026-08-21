import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { buscarPagamento, metodoDoTipo, renovarToken } from "@/lib/mercadopago";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";

/**
 * Webhook do Mercado Pago — é ISTO que confirma um pagamento, não a volta
 * do cliente pelo navegador (que pode ser forjada ou simplesmente não
 * acontecer se a pessoa fechar a aba).
 */

/** Confere a assinatura `x-signature` do MP. Sem isso dá pra forjar "pago". */
function assinaturaValida(request: NextRequest, dataId: string): boolean {
  const segredo = process.env.MP_WEBHOOK_SECRET;
  // Sem segredo configurado não dá pra validar — recusamos, em vez de
  // confiar cegamente em quem bateu na porta.
  if (!segredo) return false;

  const assinatura = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id");
  if (!assinatura || !requestId) return false;

  const partes = Object.fromEntries(
    assinatura.split(",").map((p) => p.split("=").map((s) => s.trim()) as [string, string]),
  );
  const ts = partes["ts"];
  const v1 = partes["v1"];
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const esperado = createHmac("sha256", segredo).update(manifest).digest("hex");

  const a = Buffer.from(esperado, "hex");
  const b = Buffer.from(v1, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Devolve um access token válido, renovando se estiver perto de vencer. */
async function tokenDaBarbearia(barbeariaId: string): Promise<string | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("mp_contas")
    .select("access_token, refresh_token, expira_em")
    .eq("barbearia_id", barbeariaId)
    .maybeSingle();

  if (!data) return null;

  const vencendo = new Date(data.expira_em).getTime() - Date.now() < 24 * 60 * 60 * 1000;
  if (!vencendo) return data.access_token;

  try {
    const novos = await renovarToken(data.refresh_token);
    await db
      .from("mp_contas")
      .update({
        access_token: novos.access_token,
        refresh_token: novos.refresh_token,
        expira_em: new Date(Date.now() + novos.expires_in * 1000).toISOString(),
      })
      .eq("barbearia_id", barbeariaId);
    return novos.access_token;
  } catch {
    return data.access_token;
  }
}

export async function POST(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tipo = params.get("type") ?? params.get("topic");

  let corpo: { data?: { id?: string }; type?: string } = {};
  try {
    corpo = await request.json();
  } catch {
    /* o MP às vezes manda corpo vazio em ping */
  }

  const paymentId = corpo?.data?.id ?? params.get("data.id") ?? params.get("id");
  const evento = corpo?.type ?? tipo;

  // Só nos interessa pagamento; qualquer outro evento é respondido com 200
  // pra o MP não ficar reenviando.
  if (evento !== "payment" || !paymentId) {
    return NextResponse.json({ ok: true, ignorado: evento ?? "sem-tipo" });
  }

  if (!assinaturaValida(request, String(paymentId))) {
    return NextResponse.json({ erro: "Assinatura inválida." }, { status: 401 });
  }

  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  const db = supabaseAdmin();

  try {
    // Achamos o pedido pelo external_reference; pra consultar o pagamento
    // precisamos do token da barbearia dona dele.
    const { data: pedido } = await db
      .from("pedidos")
      .select("id, barbearia_id, status_pagamento")
      .eq("mp_payment_id", String(paymentId))
      .maybeSingle();

    // Primeira notificação: ainda não sabemos de qual pedido é. Consultamos
    // com o token da Navalha só pra ler o external_reference.
    let barbeariaId = pedido?.barbearia_id as string | undefined;
    let pedidoId = pedido?.id as string | undefined;

    if (!barbeariaId) {
      const tokenNavalha = process.env.MP_ACCESS_TOKEN;
      if (!tokenNavalha) {
        return NextResponse.json({ erro: "MP_ACCESS_TOKEN ausente." }, { status: 503 });
      }
      const pagamentoBruto = await buscarPagamento(String(paymentId), tokenNavalha);
      const ref = pagamentoBruto.external_reference ?? "";

      // Assinatura da Navalha: formato "assinatura:<barbeariaId>". Se aprovada,
      // libera a barbearia por +30 dias.
      if (ref.startsWith("assinatura:")) {
        const assinaturaBarbearia = ref.split(":")[1];
        if (pagamentoBruto.status === "approved" && assinaturaBarbearia) {
          await db.rpc("marcar_assinatura_paga", { p_barbearia: assinaturaBarbearia });
        }
        return NextResponse.json({ ok: true, tipo: "assinatura", status: pagamentoBruto.status });
      }

      pedidoId = ref.replace("pedido:", "");
      const { data: p } = await db
        .from("pedidos")
        .select("id, barbearia_id")
        .eq("id", pedidoId)
        .maybeSingle();
      barbeariaId = p?.barbearia_id as string | undefined;
      if (!barbeariaId || !p) {
        return NextResponse.json({ ok: true, ignorado: "pedido-desconhecido" });
      }
    }

    const token = await tokenDaBarbearia(barbeariaId);
    if (!token) {
      return NextResponse.json({ erro: "Barbearia sem conta conectada." }, { status: 409 });
    }

    const pagamento = await buscarPagamento(String(paymentId), token);
    const aprovado = pagamento.status === "approved";

    await db
      .from("pedidos")
      .update({
        status_pagamento: aprovado
          ? "pago"
          : pagamento.status === "rejected"
            ? "recusado"
            : "pendente",
        mp_payment_id: String(paymentId),
        metodo_pagamento: metodoDoTipo(pagamento.payment_type_id),
        pago_em: aprovado ? new Date().toISOString() : null,
      })
      .eq("id", pedidoId);

    // Só depois de aprovado o horário vira confirmado de verdade.
    if (aprovado) {
      await db
        .from("agendamentos")
        .update({ status: "confirmado" })
        .eq("pedido_id", pedidoId)
        .eq("status", "aguardando_pagamento");
    } else if (pagamento.status === "rejected") {
      await db
        .from("agendamentos")
        .update({ status: "cancelado" })
        .eq("pedido_id", pedidoId)
        .eq("status", "aguardando_pagamento");
    }

    return NextResponse.json({ ok: true, status: pagamento.status });
  } catch (e) {
    // Devolver 500 faz o MP tentar de novo — é o que queremos numa falha real.
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha ao processar." },
      { status: 500 },
    );
  }
}
