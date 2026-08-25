import { NextResponse, type NextRequest } from "next/server";
import { autenticarPlataforma } from "@/lib/plataforma";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";
import { PLANS } from "@/lib/plans";
import { faixaDeUso } from "@/lib/privacidade";

/**
 * Tudo que está acontecendo na Navalha, numa resposta só.
 *
 * Roda com service role de propósito — é a única forma de somar dados de
 * todas as barbearias, já que a RLS existe justamente pra impedir isso.
 * Quem chega aqui já passou por `autenticarPlataforma`.
 *
 * A conta pesada fica aqui e não na tela: o navegador não tem permissão pra
 * ler a base inteira e, mesmo que tivesse, mandar todos os pedidos pra ele
 * somar seria jogar dado de cliente na rede à toa.
 *
 * A LINHA DA PRIVACIDADE (ver `lib/privacidade.ts`): somar TODAS as
 * barbearias é o negócio da Navalha; abrir UMA e ler a vida dela não é.
 * Por isso o dinheiro só aparece agregado — a resposta não traz quanto cada
 * barbearia faturou, nem quem agendou nela, nem por quanto. O ranking é por
 * QUANTIDADE de pedidos, que responde "quem está usando" sem responder
 * "quem está ganhando".
 *
 * Um limite honesto disso: com pouquíssimo movimento, o agregado deixa de
 * esconder. Havendo um único pedido pago na plataforma inteira, o total do
 * mês É aquele pedido. Não dá pra saber de qual barbearia ele veio — o
 * ranking não traz valor —, mas se só uma tiver pedido, a conta se fecha.
 * Some sozinho conforme a base cresce; suprimir o total agora custaria ao
 * dono da plataforma a métrica principal do próprio negócio, o que é pior.
 */

const DIA = 24 * 60 * 60 * 1000;

/** Janela dos dados de movimento. Fora dela nada é somado — e a tela diz isso. */
const JANELA_DIAS = 120;
const SEMANAS_NA_LINHA = 10;

/** Barbearia parada há mais que isso é candidata a cancelar. */
const DIAS_SEM_PEDIDO_PRA_ALERTAR = 21;

function diasAtras(n: number): string {
  return new Date(Date.now() - n * DIA).toISOString();
}

function inicioDoMes(): number {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

type Status = "trial" | "ativa" | "vencida";

/** Status de verdade da assinatura, aplicando o vencimento na data de hoje. */
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

const centavos = (v: number) => Math.round(v * 100) / 100;

interface LinhaBarbearia {
  id: string;
  nome: string;
  slug: string | null;
  plano: string;
  assinatura_status: string;
  trial_termina_em: string | null;
  assinatura_ate: string | null;
  criada_em: string;
}

interface LinhaPedido {
  id: string;
  barbearia_id: string;
  total: number | string;
  status_pagamento: string;
  forma_pagamento: string;
  criado_em: string;
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
      .select(
        "id, nome, slug, plano, assinatura_status, trial_termina_em, assinatura_ate, criada_em",
      )
      .order("criada_em", { ascending: false }),
    db
      .from("pedidos")
      .select(
        // Sem `cliente_nome`: o nome de quem agendou não é lido aqui em
        // nenhuma hipótese. O total entra só pra somar o agregado da
        // plataforma, e nunca sai por barbearia.
        "id, barbearia_id, total, status_pagamento, forma_pagamento, criado_em",
      )
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
      .limit(8),
  ]);

  const barbearias = (barbeariasRes.data ?? []) as LinhaBarbearia[];
  const pedidos = (pedidosRes.data ?? []) as LinhaPedido[];

  const comMp = new Map(
    (contasMpRes.data ?? []).map((c) => [c.barbearia_id as string, c.expira_em as string]),
  );
  const comPix = new Set((contasPixRes.data ?? []).map((c) => c.barbearia_id as string));

  const contarPorBarbearia = (linhas: { barbearia_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const l of linhas ?? []) m.set(l.barbearia_id, (m.get(l.barbearia_id) ?? 0) + 1);
    return m;
  };
  const servicosPor = contarPorBarbearia(
    servicosRes.data as { barbearia_id: string }[] | null,
  );
  const barbeirosPor = contarPorBarbearia(
    barbeirosRes.data as { barbearia_id: string }[] | null,
  );

  // ---------- Movimento por barbearia ----------
  const pagos = pedidos.filter((p) => p.status_pagamento === "pago");
  const uso = new Map<
    string,
    { pedidos: number; pagos: number; movimentado: number; ultimoPedido: string | null }
  >();
  for (const b of barbearias) {
    uso.set(b.id, { pedidos: 0, pagos: 0, movimentado: 0, ultimoPedido: null });
  }
  for (const p of pedidos) {
    const linha = uso.get(p.barbearia_id);
    if (!linha) continue;
    linha.pedidos += 1;
    if (p.status_pagamento === "pago") {
      linha.pagos += 1;
      linha.movimentado += Number(p.total ?? 0);
    }
    // A consulta veio do mais novo pro mais velho: o primeiro é o último pedido.
    if (!linha.ultimoPedido) linha.ultimoPedido = p.criado_em;
  }

  // ---------- Assinatura e listas de atenção ----------
  const porStatus: Record<Status, number> = { trial: 0, ativa: 0, vencida: 0 };
  const porPlano: Record<string, number> = { basico: 0, pro: 0 };
  let mrr = 0;

  const trialAcabando: { id: string; nome: string; dias: number }[] = [];
  const vencidas: { id: string; nome: string; plano: string }[] = [];
  const semRecebimento: { id: string; nome: string }[] = [];
  const semCatalogo: { id: string; nome: string; barbeiros: number }[] = [];
  const paradas: { id: string; nome: string; diasParada: number | null }[] = [];
  const tokenMpVencendo: { id: string; nome: string; dias: number }[] = [];

  // "Já pagou alguma vez" = tem data de assinatura. É o denominador honesto
  // pra conversão: quem ainda está em teste não deu resposta nenhuma.
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
    // Sem serviço a página pública não vende nada: é cadastro que nunca saiu
    // do papel, e a melhor hora de ligar pra essa pessoa é agora.
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

  // ---------- Dinheiro ----------
  const desdeMes = inicioDoMes();
  const movimentadoMes = pagos
    .filter((p) => new Date(p.criado_em).getTime() >= desdeMes)
    .reduce((t, p) => t + Number(p.total ?? 0), 0);

  const desde30 = Date.now() - 30 * DIA;
  const pagos30 = pagos.filter((p) => new Date(p.criado_em).getTime() >= desde30);
  const pedidos30 = pedidos.filter((p) => new Date(p.criado_em).getTime() >= desde30);
  const movimentado30 = pagos30.reduce((t, p) => t + Number(p.total ?? 0), 0);

  // ---------- Linha do tempo, semana a semana ----------
  // Semanas fechadas de 7 dias contadas pra trás a partir de hoje: é o
  // recorte que responde "está crescendo?" sem depender de dia da semana.
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
      movimentado: centavos(
        pagos
          .filter((p) => noIntervalo(p.criado_em, inicio, fim))
          .reduce((s, p) => s + Number(p.total ?? 0), 0),
      ),
    };
  });

  // ---------- Ranking ----------
  // Ranking por QUANTOS pedidos, não por quanto entrou. Saber quem está
  // usando o produto é conta da Navalha; saber quanto cada barbearia fatura
  // não é — e a contagem já responde a pergunta que interessa.
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

    receita: {
      mensalRecorrente: centavos(mrr),
      movimentadoNoMes: centavos(movimentadoMes),
      movimentadoEm30Dias: centavos(movimentado30),
      ticketMedio: pagos30.length ? centavos(movimentado30 / pagos30.length) : 0,
    },

    conversao: {
      jaPagaram,
      saiuDoTeste,
      // Quantos dos que terminaram o teste viraram cliente pagante.
      taxa: saiuDoTeste ? Math.round((jaPagaram / saiuDoTeste) * 100) : null,
    },

    pagamentos: {
      comMercadoPago: comMp.size,
      comPixDireto: comPix.size,
      semRecebimentoOnline: semRecebimento.length,
    },

    uso: {
      pedidos30Dias: pedidos30.length,
      pedidosPagos30Dias: pagos30.length,
      clientes: clientesRes.count ?? 0,
      agendamentos30Dias: (agendamentosRes.data ?? []).length,
      statusAgenda,
    },

    atencao: {
      trialAcabando,
      vencidas,
      semRecebimento,
      semCatalogo,
      paradas,
      tokenMpVencendo,
    },

    semanas,
    ranking,

    ultimosCadastros: barbearias.slice(0, 6).map((b) => ({
      id: b.id,
      nome: b.nome,
      plano: b.plano,
      status: statusReal(b),
      criadaEm: b.criada_em,
    })),

    // Movimento das últimas 24h/7d por contagem. A lista de pedidos com
    // nome de quem agendou e valor da venda saiu daqui: isso é a agenda da
    // barbearia com o cliente dela, não painel de plataforma.
    movimento: {
      pedidos24h: pedidos.filter(
        (p) => new Date(p.criado_em).getTime() >= Date.now() - DIA,
      ).length,
      pedidos7Dias: pedidos.filter(
        (p) => new Date(p.criado_em).getTime() >= Date.now() - 7 * DIA,
      ).length,
      barbeariasAtivas7Dias: new Set(
        pedidos
          .filter((p) => new Date(p.criado_em).getTime() >= Date.now() - 7 * DIA)
          .map((p) => p.barbearia_id),
      ).size,
      porForma: pedidos
        .filter((p) => new Date(p.criado_em).getTime() >= desde30)
        .reduce<Record<string, number>>((acc, p) => {
          acc[p.forma_pagamento] = (acc[p.forma_pagamento] ?? 0) + 1;
          return acc;
        }, {}),
    },

    log: logRes.data ?? [],
  });
}
