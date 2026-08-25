import { NextResponse, type NextRequest } from "next/server";
import { autenticarPlataforma } from "@/lib/plataforma";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";
import { PLANS } from "@/lib/plans";

/**
 * Visão geral da Navalha inteira: quantas barbearias existem, quantas estão
 * pagando, quanto isso dá por mês e quanto de dinheiro passou pelo sistema.
 *
 * Roda com service role de propósito — é a única forma de somar dados de
 * todas as barbearias, já que a RLS existe justamente pra impedir isso.
 * Quem chega aqui já passou por `autenticarPlataforma`.
 */

function inicioDoMes(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

function diasAtras(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

/** Status de verdade da assinatura, aplicando o vencimento na data de hoje. */
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

  const [barbeariasRes, pedidosMesRes, pedidos30Res, contasRes, clientesRes] =
    await Promise.all([
      db
        .from("barbearias")
        .select("id, nome, plano, assinatura_status, trial_termina_em, assinatura_ate, criada_em"),
      db
        .from("pedidos")
        .select("total, status_pagamento, forma_pagamento")
        .gte("criado_em", inicioDoMes()),
      db.from("pedidos").select("id", { count: "exact", head: true }).gte("criado_em", diasAtras(30)),
      db.from("mp_contas").select("barbearia_id"),
      db.from("clientes").select("id", { count: "exact", head: true }),
    ]);

  const barbearias = barbeariasRes.data ?? [];
  const comMp = new Set((contasRes.data ?? []).map((c) => c.barbearia_id as string));

  // Pix direto é tabela separada; a consulta acima não a cobre.
  const { data: pixContas } = await db.from("pix_contas").select("barbearia_id").eq("ativo", true);
  const comPix = new Set((pixContas ?? []).map((c) => c.barbearia_id as string));

  const porStatus = { trial: 0, ativa: 0, vencida: 0 };
  const porPlano: Record<string, number> = { basico: 0, pro: 0 };
  let receitaMensal = 0;
  let trialAcabandoEm3Dias = 0;

  const limite3Dias = Date.now() + 3 * 24 * 60 * 60 * 1000;

  for (const b of barbearias) {
    const status = statusReal(b as never);
    porStatus[status] += 1;
    porPlano[b.plano as string] = (porPlano[b.plano as string] ?? 0) + 1;

    if (status === "ativa") {
      const plano = PLANS.find((p) => p.id === b.plano);
      receitaMensal += plano?.valor ?? 0;
    }
    if (
      status === "trial" &&
      b.trial_termina_em &&
      new Date(b.trial_termina_em).getTime() <= limite3Dias
    ) {
      trialAcabandoEm3Dias += 1;
    }
  }

  // Movimentado ≠ receita da Navalha: é o dinheiro que os clientes pagaram
  // às barbearias. Só entra o que consta como pago.
  const pedidosMes = pedidosMesRes.data ?? [];
  const movimentadoMes = pedidosMes
    .filter((p) => p.status_pagamento === "pago")
    .reduce((t, p) => t + Number(p.total ?? 0), 0);

  const novasEm30Dias = barbearias.filter(
    (b) => new Date(b.criada_em as string).getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).length;

  return NextResponse.json({
    nivel: quem.nivel,
    barbearias: {
      total: barbearias.length,
      ...porStatus,
      novasEm30Dias,
      trialAcabandoEm3Dias,
    },
    planos: porPlano,
    pagamentos: {
      comMercadoPago: comMp.size,
      comPixDireto: comPix.size,
      semRecebimentoOnline: barbearias.filter(
        (b) => !comMp.has(b.id as string) && !comPix.has(b.id as string),
      ).length,
    },
    receita: {
      // MRR: soma da mensalidade de quem está com assinatura ativa hoje.
      mensalRecorrente: Math.round(receitaMensal * 100) / 100,
      movimentadoNoMes: Math.round(movimentadoMes * 100) / 100,
    },
    uso: {
      pedidos30Dias: pedidos30Res.count ?? 0,
      clientes: clientesRes.count ?? 0,
    },
  });
}
