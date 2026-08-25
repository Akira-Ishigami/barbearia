import { NextResponse, type NextRequest } from "next/server";
import { autenticarPlataforma } from "@/lib/plataforma";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";
import { faixaDeUso } from "@/lib/privacidade";

/**
 * Lista de barbearias pro suporte e pro admin.
 *
 * Sem `?id`: a lista, com o que dá pra decidir de bate-pronto. Com `?id`: o
 * detalhe de uma, pra quando alguém liga com problema.
 *
 * O QUE ESTA ROTA NÃO DEVOLVE, de propósito (ver `lib/privacidade.ts`):
 *   — nome de cliente que agendou naquela barbearia
 *   — valor de venda ou faturamento dela
 *   — nome e e-mail da equipe dela
 *   — chave Pix, nem mascarada, nem o nome do beneficiário
 *   — apelido da conta do Mercado Pago
 *
 * Nada disso é preciso pra cobrar, pra dar suporte ou pra saber se o
 * produto está funcionando — e esses três são os únicos motivos que a
 * Navalha tem pra abrir a barbearia de alguém.
 */

function statusReal(b: {
  assinatura_status: string;
  trial_termina_em: string | null;
  assinatura_ate: string | null;
}): "trial" | "ativa" | "vencida" {
  const agora = Date.now();
  if (b.assinatura_status === "ativa") {
    return !b.assinatura_ate || new Date(b.assinatura_ate).getTime() > agora
      ? "ativa"
      : "vencida";
  }
  if (b.assinatura_status === "trial" && b.trial_termina_em) {
    return new Date(b.trial_termina_em).getTime() > agora ? "trial" : "vencida";
  }
  return "vencida";
}

export async function GET(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  const quem = await autenticarPlataforma(request);
  if (!quem) return NextResponse.json({ erro: "Sem acesso." }, { status: 403 });

  const db = supabaseAdmin();
  const id = request.nextUrl.searchParams.get("id");

  // ---------- Detalhe de uma barbearia ----------
  if (id) {
    const { data: b } = await db
      .from("barbearias")
      .select(
        "id, nome, slug, telefone, endereco, plano, criada_em, assinatura_status, trial_termina_em, assinatura_ate",
      )
      .eq("id", id)
      .maybeSingle();
    if (!b) return NextResponse.json({ erro: "Barbearia não encontrada." }, { status: 404 });

    const trintaDias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [equipe, mp, pix, servicos, produtos, pedidosTotal, pedidos30, ultimo] =
      await Promise.all([
        // Só o papel. Nome e e-mail da equipe não interessam pra cobrar
        // nem pra dar suporte à conta da barbearia.
        db.from("usuarios").select("role").eq("barbearia_id", id),
        db
          .from("mp_contas")
          .select("ambiente, expira_em, conectado_em, aceita_pix, aceita_cartao")
          .eq("barbearia_id", id)
          .maybeSingle(),
        // Só se existe e de que tipo é — a chave em si nunca sai daqui.
        db.from("pix_contas").select("tipo, ativo").eq("barbearia_id", id).maybeSingle(),
        db.from("servicos").select("id", { count: "exact", head: true }).eq("barbearia_id", id),
        db.from("produtos").select("id", { count: "exact", head: true }).eq("barbearia_id", id),
        db.from("pedidos").select("id", { count: "exact", head: true }).eq("barbearia_id", id),
        db
          .from("pedidos")
          .select("id", { count: "exact", head: true })
          .eq("barbearia_id", id)
          .gte("criado_em", trintaDias),
        // A data do último pedido responde "ela está usando?". O conteúdo
        // do pedido — quem, quanto — não é da conta da Navalha.
        db
          .from("pedidos")
          .select("criado_em")
          .eq("barbearia_id", id)
          .order("criado_em", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    const papeis = (equipe.data ?? []) as { role: string }[];
    const em30 = pedidos30.count ?? 0;

    return NextResponse.json({
      barbearia: {
        id: b.id,
        nome: b.nome,
        slug: b.slug,
        // Telefone e endereço já estão na página pública da barbearia — é
        // por eles que o suporte liga de volta.
        telefone: b.telefone,
        endereco: b.endereco,
        plano: b.plano,
        criadaEm: b.criada_em,
        status: statusReal(b as never),
        trialTerminaEm: b.trial_termina_em,
        assinaturaAte: b.assinatura_ate,
      },

      equipe: {
        total: papeis.length,
        donos: papeis.filter((u) => u.role === "dono").length,
        barbeiros: papeis.filter((u) => u.role === "barbeiro").length,
      },

      recebimento: {
        mercadoPago: mp.data
          ? {
              ambiente: mp.data.ambiente,
              conectadoEm: mp.data.conectado_em,
              expiraEm: mp.data.expira_em,
              aceitaPix: mp.data.aceita_pix,
              aceitaCartao: mp.data.aceita_cartao,
            }
          : null,
        pix: pix.data?.ativo ? { tipo: pix.data.tipo } : null,
      },

      // Saúde da conta: dá pra ver se ela montou a loja e se está rodando,
      // sem abrir nem um centavo do que ela fatura.
      saude: {
        servicos: servicos.count ?? 0,
        produtos: produtos.count ?? 0,
        pedidosTotal: pedidosTotal.count ?? 0,
        pedidos30Dias: em30,
        uso: faixaDeUso(em30),
        ultimoPedidoEm: ultimo.data?.criado_em ?? null,
      },
    });
  }

  // ---------- Lista ----------
  const { data: barbearias } = await db
    .from("barbearias")
    .select(
      "id, nome, slug, telefone, plano, assinatura_status, trial_termina_em, assinatura_ate, criada_em",
    )
    .order("criada_em", { ascending: false });

  const [contasMp, contasPix] = await Promise.all([
    db.from("mp_contas").select("barbearia_id"),
    db.from("pix_contas").select("barbearia_id").eq("ativo", true),
  ]);

  const comMp = new Set((contasMp.data ?? []).map((c) => c.barbearia_id as string));
  const comPix = new Set((contasPix.data ?? []).map((c) => c.barbearia_id as string));

  return NextResponse.json({
    nivel: quem.nivel,
    barbearias: (barbearias ?? []).map((b) => ({
      id: b.id,
      nome: b.nome,
      slug: b.slug,
      telefone: b.telefone,
      plano: b.plano,
      criadaEm: b.criada_em,
      status: statusReal(b as never),
      trialTerminaEm: b.trial_termina_em,
      assinaturaAte: b.assinatura_ate,
      mercadoPago: comMp.has(b.id as string),
      pixDireto: comPix.has(b.id as string),
    })),
  });
}
