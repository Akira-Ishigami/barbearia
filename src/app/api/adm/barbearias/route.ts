import { NextResponse, type NextRequest } from "next/server";
import { autenticarPlataforma } from "@/lib/plataforma";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";

/**
 * Lista de barbearias pro suporte e pro admin.
 *
 * Sem `?id`: a lista, com o que dá pra decidir de bate-pronto (status da
 * assinatura, plano, se recebe online). Com `?id`: o detalhe de uma, pra
 * quando alguém liga com problema.
 *
 * Nunca devolve token do Mercado Pago nem chave Pix crua — o suporte
 * precisa saber SE está conectado, não QUAL é a credencial.
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

/** Mostra só o começo e o fim da chave — o suficiente pra conferir. */
function mascarar(chave: string): string {
  if (chave.length <= 6) return "•".repeat(chave.length);
  return `${chave.slice(0, 3)}${"•".repeat(Math.max(3, chave.length - 6))}${chave.slice(-3)}`;
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
    const { data: b } = await db.from("barbearias").select("*").eq("id", id).maybeSingle();
    if (!b) return NextResponse.json({ erro: "Barbearia não encontrada." }, { status: 404 });

    const [equipe, mp, pix, servicos, produtos, pedidos, ultimos] = await Promise.all([
      db.from("usuarios").select("id, nome, email, role, criado_em").eq("barbearia_id", id),
      db
        .from("mp_contas")
        .select("apelido, ambiente, expira_em, conectado_em, aceita_pix, aceita_cartao")
        .eq("barbearia_id", id)
        .maybeSingle(),
      db.from("pix_contas").select("tipo, chave, beneficiario, cidade, ativo").eq("barbearia_id", id).maybeSingle(),
      db.from("servicos").select("id", { count: "exact", head: true }).eq("barbearia_id", id),
      db.from("produtos").select("id", { count: "exact", head: true }).eq("barbearia_id", id),
      db.from("pedidos").select("total, status_pagamento").eq("barbearia_id", id),
      db
        .from("pedidos")
        .select("id, cliente_nome, total, forma_pagamento, status_pagamento, criado_em")
        .eq("barbearia_id", id)
        .order("criado_em", { ascending: false })
        .limit(10),
    ]);

    const todosPedidos = pedidos.data ?? [];
    const pagos = todosPedidos.filter((p) => p.status_pagamento === "pago");

    return NextResponse.json({
      barbearia: {
        id: b.id,
        nome: b.nome,
        slug: b.slug,
        telefone: b.telefone,
        endereco: b.endereco,
        plano: b.plano,
        criadaEm: b.criada_em,
        status: statusReal(b as never),
        trialTerminaEm: b.trial_termina_em,
        assinaturaAte: b.assinatura_ate,
        comissaoPadrao: Number(b.comissao_padrao ?? 0),
      },
      equipe: equipe.data ?? [],
      mercadoPago: mp.data
        ? {
            apelido: mp.data.apelido,
            ambiente: mp.data.ambiente,
            conectadoEm: mp.data.conectado_em,
            expiraEm: mp.data.expira_em,
            aceitaPix: mp.data.aceita_pix,
            aceitaCartao: mp.data.aceita_cartao,
          }
        : null,
      pix: pix.data
        ? {
            tipo: pix.data.tipo,
            // Mascarada: pode ser o CPF do dono. Suporte confere, não copia.
            chave: mascarar(pix.data.chave as string),
            beneficiario: pix.data.beneficiario,
            cidade: pix.data.cidade,
            ativo: pix.data.ativo,
          }
        : null,
      numeros: {
        servicos: servicos.count ?? 0,
        produtos: produtos.count ?? 0,
        pedidos: todosPedidos.length,
        pedidosPagos: pagos.length,
        movimentado:
          Math.round(pagos.reduce((t, p) => t + Number(p.total ?? 0), 0) * 100) / 100,
      },
      ultimosPedidos: ultimos.data ?? [],
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
