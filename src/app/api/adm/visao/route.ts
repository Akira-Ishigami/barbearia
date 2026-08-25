import { NextResponse, type NextRequest } from "next/server";
import { autenticarPlataforma } from "@/lib/plataforma";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";
import { PLANS } from "@/lib/plans";
import { faixaDeUso } from "@/lib/privacidade";

/**
 * O estado da plataforma inteira, numa resposta só.
 *
 * O QUE ESTA ROTA NÃO LÊ, em nenhuma hipótese (ver `lib/privacidade.ts`):
 *
 *   — nome, telefone ou e-mail de quem agendou
 *   — valor de venda, de pedido ou faturamento, de UMA barbearia ou da
 *     soma de todas
 *
 * O dinheiro que o cliente paga à barbearia nunca passa pela Navalha e não
 * é receita dela: é faturamento de outra empresa. Saber quanto cada uma
 * ganha não ajuda a cobrar, a dar suporte nem a saber se o produto está
 * funcionando — e esses três são os únicos motivos que a plataforma tem
 * pra ler dado de quem usa. O que sobra é contagem, que responde "está
 * sendo usada?" sem responder "quanto ela ganha?".
 *
 * A receita que aparece aqui é a da própria Navalha: a mensalidade das
 * assinaturas. Essa é dela.
 *
 * A conta pesada fica no servidor porque o navegador não tem permissão de
 * ler a base inteira — e, mesmo que tivesse, mandar tudo pra ele somar
 * seria espalhar dado à toa.
 */

const DIA = 24 * 60 * 60 * 1000;
const JANELA_DIAS = 120;
const SEMANAS_NA_LINHA = 10;

/** Barbearia parada há mais que isso é candidata a cancelar. */
const DIAS_SEM_PEDIDO_PRA_ALERTAR = 21;

function diasAtras(n: number): string {
  return new Date(Date.now() - n * DIA).toISOString();
}

type Status = "trial" | "ativa" | "vencida";

function statusReal(b: {
  assinatura_status: string;
  trial_termina_em: string | null;
  assinatura_ate: string | null;
}): Status {
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

interface LinhaBarbearia {
  id: string;
  nome: string;
  plano: string;
  assinatura_status: string;
  trial_termina_em: string | null;
  assinatura_ate: string | null;
  criada_em: string;
}

export async function GET(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  const quem = await autenticarPlataforma(request);
  if (!quem) return NextResponse.json({ erro: "Sem acesso." }, { status: 403 });

  const db = supabaseAdmin();

  const [
    barbeariasRes,
    pedidosRes,
    contasMpRes,
    contasPixRes,
    servicosRes,
    barbeirosRes,
    clientesRes,
    agendamentosRes,
    logRes,
  ] = await Promise.all([
    db
      .from("barbearias")
      .select("id, nome, plano, assinatura_status, trial_termina_em, assinatura_ate, criada_em")
      .order("criada_em", { ascending: false }),
    // Sem `total` e sem `cliente_nome`: nem o valor nem a pessoa entram. O
    // que se lê do pedido é que ele existiu, quando, e como foi pago.
    db
      .from("pedidos")
      .select("barbearia_id, status_pagamento, forma_pagamento, criado_em")
      .gte("criado_em", diasAtras(JANELA_DIAS))
      .order("criado_em", { ascending: false })
      .limit(5000),
    db.from("mp_contas").select("barbearia_id, expira_em"),
    db.from("pix_contas").select("barbearia_id").eq("ativo", true),
    db.from("servicos").select("barbearia_id").eq("ativo", true),
    db.from("barbeiros").select("barbearia_id").eq("ativo", true),
    db.from("clientes").select("id", { count: "exact", head: true }),
    db.from("agendamentos").select("status").gte("criado_em", diasAtras(30)).limit(5000),
    db
      .from("plataforma_log")
      .select("id, email, acao, barbearia_id, detalhe, criado_em")
      .order("criado_em", { ascending: false })
      .limit(6),
  ]);

  const barbearias = (barbeariasRes.data ?? []) as LinhaBarbearia[];
  const pedidos = (pedidosRes.data ?? []) as {
    barbearia_id: string;
    status_pagamento: string;
    forma_pagamento: string;
    criado_em: string;
  }[];

  const comMp = new Map(
    (contasMpRes.data ?? []).map((c) => [c.barbearia_id as string, c.expira_em as string]),
  );
  const comPix = new Set((contasPixRes.data ?? []).map((c) => c.barbearia_id as string));

  const contarPor = (linhas: { barbearia_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const l of linhas ?? []) m.set(l.barbearia_id, (m.get(l.barbearia_id) ?? 0) + 1);
    return m;
  };
  const servicosPor = contarPor(servicosRes.data as { barbearia_id: string }[] | null);
  const barbeirosPor = contarPor(barbeirosRes.data as { barbearia_id: string }[] | null);

  // ---------- Uso por barbearia (contagem, nunca valor) ----------
  const uso = new Map<string, { pedidos: number; ultimoPedido: string | null }>();
  for (const b of barbearias) uso.set(b.id, { pedidos: 0, ultimoPedido: null });
  for (const p of pedidos) {
    const linha = uso.get(p.barbearia_id);
    if (!linha) continue;
    linha.pedidos += 1;
    // A consulta veio do mais novo pro mais velho: o primeiro é o último.
    if (!linha.ultimoPedido) linha.ultimoPedido = p.criado_em;
  }

  // ---------- Assinatura e pendências ----------
  const porStatus: Record<Status, number> = { trial: 0, ativa: 0, vencida: 0 };
  const porPlano: Record<string, number> = { basico: 0, pro: 0 };
  let mrr = 0;

  const trialAcabando: { id: string; nome: string; dias: number }[] = [];
  const vencidas: { id: string; nome: string; plano: string }[] = [];
  const semRecebimento: { id: string; nome: string }[] = [];
  const semCatalogo: { id: string; nome: string; barbeiros: number }[] = [];
  const paradas: { id: string; nome: string; diasParada: number | null }[] = [];
  const tokenMpVencendo: { id: string; nome: string; dias: number }[] = [];

  let jaPagaram = 0;
  let saiuDoTeste = 0;

  for (const b of barbearias) {
    const status = statusReal(b);
    porStatus[status] += 1;
    porPlano[b.plano] = (porPlano[b.plano] ?? 0) + 1;

    if (status === "ativa") mrr += PLANS.find((p) => p.id === b.plano)?.valor ?? 0;
    if (b.assinatura_ate) jaPagaram += 1;
    if (status !== "trial") saiuDoTeste += 1;

    if (status === "trial" && b.trial_termina_em) {
      const dias = Math.ceil((new Date(b.trial_termina_em).getTime() - Date.now()) / DIA);
      if (dias <= 7) trialAcabando.push({ id: b.id, nome: b.nome, dias });
    }
    if (status === "vencida") vencidas.push({ id: b.id, nome: b.nome, plano: b.plano });

    if (!comMp.has(b.id) && !comPix.has(b.id)) {
      semRecebimento.push({ id: b.id, nome: b.nome });
    }

    const servicos = servicosPor.get(b.id) ?? 0;
    if (servicos === 0) {
      semCatalogo.push({ id: b.id, nome: b.nome, barbeiros: barbeirosPor.get(b.id) ?? 0 });
    }

    const linhaUso = uso.get(b.id);
    const idadeDias = Math.floor((Date.now() - new Date(b.criada_em).getTime()) / DIA);
    // Barbearia criada ontem ainda não teve tempo de ficar parada.
    if (idadeDias >= DIAS_SEM_PEDIDO_PRA_ALERTAR && servicos > 0) {
      const dias = linhaUso?.ultimoPedido
        ? Math.floor((Date.now() - new Date(linhaUso.ultimoPedido).getTime()) / DIA)
        : null;
      if (dias === null || dias >= DIAS_SEM_PEDIDO_PRA_ALERTAR) {
        paradas.push({ id: b.id, nome: b.nome, diasParada: dias });
      }
    }

    const expira = comMp.get(b.id);
    if (expira) {
      const dias = Math.ceil((new Date(expira).getTime() - Date.now()) / DIA);
      if (dias <= 30) tokenMpVencendo.push({ id: b.id, nome: b.nome, dias });
    }
  }

  trialAcabando.sort((a, b) => a.dias - b.dias);
  paradas.sort((a, b) => (b.diasParada ?? 9999) - (a.diasParada ?? 9999));
  tokenMpVencendo.sort((a, b) => a.dias - b.dias);

  // ---------- Linha do tempo ----------
  const noIntervalo = (iso: string, inicio: number, fim: number) => {
    const t = new Date(iso).getTime();
    return t >= inicio && t < fim;
  };

  const semanas = Array.from({ length: SEMANAS_NA_LINHA }, (_, i) => {
    const fim = Date.now() - (SEMANAS_NA_LINHA - 1 - i) * 7 * DIA;
    const inicio = fim - 7 * DIA;
    return {
      inicio: new Date(inicio).toISOString(),
      cadastros: barbearias.filter((b) => noIntervalo(b.criada_em, inicio, fim)).length,
      pedidos: pedidos.filter((p) => noIntervalo(p.criado_em, inicio, fim)).length,
    };
  });

  // ---------- Ranking de uso ----------
  const ranking = barbearias
    .map((b) => {
      const linha = uso.get(b.id)!;
      return {
        id: b.id,
        nome: b.nome,
        status: statusReal(b),
        plano: b.plano,
        pedidos: linha.pedidos,
        uso: faixaDeUso(linha.pedidos),
        ultimoPedido: linha.ultimoPedido,
      };
    })
    .sort((a, b) => b.pedidos - a.pedidos);

  // ---------- Agenda ----------
  const statusAgenda: Record<string, number> = {};
  for (const a of agendamentosRes.data ?? []) {
    const s = a.status as string;
    statusAgenda[s] = (statusAgenda[s] ?? 0) + 1;
  }

  const desde30 = Date.now() - 30 * DIA;
  const novasEm = (dias: number) =>
    barbearias.filter((b) => new Date(b.criada_em).getTime() >= Date.now() - dias * DIA).length;

  return NextResponse.json({
    nivel: quem.nivel,
    janelaDias: JANELA_DIAS,

    barbearias: {
      total: barbearias.length,
      ...porStatus,
      novasEm7Dias: novasEm(7),
      novasEm30Dias: novasEm(30),
    },

    planos: porPlano,

    // Só a mensalidade das assinaturas — receita da própria Navalha.
    receita: { mensalRecorrente: Math.round(mrr * 100) / 100 },

    conversao: {
      jaPagaram,
      saiuDoTeste,
      taxa: saiuDoTeste ? Math.round((jaPagaram / saiuDoTeste) * 100) : null,
    },

    pagamentos: {
      comMercadoPago: comMp.size,
      comPixDireto: comPix.size,
      semRecebimentoOnline: semRecebimento.length,
    },

    uso: {
      pedidos24h: pedidos.filter((p) => new Date(p.criado_em).getTime() >= Date.now() - DIA)
        .length,
      pedidos7Dias: pedidos.filter((p) => new Date(p.criado_em).getTime() >= Date.now() - 7 * DIA)
        .length,
      pedidos30Dias: pedidos.filter((p) => new Date(p.criado_em).getTime() >= desde30).length,
      barbeariasAtivas7Dias: new Set(
        pedidos
          .filter((p) => new Date(p.criado_em).getTime() >= Date.now() - 7 * DIA)
          .map((p) => p.barbearia_id),
      ).size,
      clientes: clientesRes.count ?? 0,
      agendamentos30Dias: (agendamentosRes.data ?? []).length,
      statusAgenda,
      porForma: pedidos
        .filter((p) => new Date(p.criado_em).getTime() >= desde30)
        .reduce<Record<string, number>>((acc, p) => {
          acc[p.forma_pagamento] = (acc[p.forma_pagamento] ?? 0) + 1;
          return acc;
        }, {}),
    },

    atencao: { trialAcabando, vencidas, semRecebimento, semCatalogo, paradas, tokenMpVencendo },

    semanas,
    ranking,

    ultimosCadastros: barbearias.slice(0, 6).map((b) => ({
      id: b.id,
      nome: b.nome,
      plano: b.plano,
      status: statusReal(b),
      criadaEm: b.criada_em,
    })),

    log: logRes.data ?? [],
  });
}
