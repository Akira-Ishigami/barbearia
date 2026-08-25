"use client";

import { supabase } from "./supabase-browser";
import type { AgendamentoStatus, FormaPagamento, MetodoPagamento } from "./types";

/**
 * O caixa da barbearia, pedido por pedido.
 *
 * O painel soma `agendamentos.preco`, que é só o serviço — produto levado
 * junto mora em `pedido_produtos` e ficava de fora da conta. Aqui os dois
 * entram, porque pro dono o que importa é quanto entrou, não em qual
 * tabela o valor foi parar.
 *
 * O período é pela data do atendimento, não pela data do pedido: quem
 * agendou na terça pra sexta aparece na sexta, que é quando o dinheiro
 * encosta no balcão.
 */

export interface ItemCaixa {
  nome: string;
  quantidade: number;
  /** Preço unitário. */
  preco: number;
}

export interface Lancamento {
  chave: string;
  clienteNome: string;
  clienteTelefone?: string;
  data: string;
  hora: string;
  barbeiroId: string;
  servicos: ItemCaixa[];
  produtos: ItemCaixa[];
  totalServicos: number;
  totalProdutos: number;
  total: number;
  formaPagamento: FormaPagamento;
  metodoPagamento?: MetodoPagamento;
  /** Status do atendimento; "pendente" ainda nem foi confirmado pelo dono. */
  status: AgendamentoStatus;
}

function erro(e: { message: string } | null) {
  if (e) throw new Error(e.message);
}

/** Linha crua do banco. O select tem join, que o client não infere sozinho. */
interface LinhaCaixa {
  id: string;
  pedido_id: string | null;
  barbeiro_id: string;
  servico_nome: string;
  preco: number | string;
  data: string;
  hora: string;
  status: AgendamentoStatus;
  pedidos: {
    cliente_nome?: string;
    cliente_telefone?: string;
    forma_pagamento?: string;
    metodo_pagamento?: string;
  } | null;
}

interface LinhaItem {
  pedido_id: string;
  produto_nome: string;
  quantidade: number | string;
  preco: number | string;
}

/** Lançamentos entre duas datas (ISO, inclusivas). */
export async function getLancamentos(
  barbeariaId: string,
  de: string,
  ate: string,
): Promise<Lancamento[]> {
  const db = supabase();

  const { data: linhas, error } = await db
    .from("agendamentos")
    .select(
      "id, pedido_id, barbeiro_id, servico_nome, preco, data, hora, status, " +
        "pedidos(cliente_nome, cliente_telefone, forma_pagamento, metodo_pagamento)",
    )
    .eq("barbearia_id", barbeariaId)
    .gte("data", de)
    .lte("data", ate)
    .order("data")
    .order("hora");
  erro(error);

  const agendamentos = (linhas ?? []) as unknown as LinhaCaixa[];
  if (agendamentos.length === 0) return [];

  // Produtos são do pedido, não do agendamento: busca só os pedidos que
  // apareceram no período em vez de varrer a tabela inteira.
  const pedidoIds = Array.from(
    new Set(agendamentos.map((a) => a.pedido_id).filter(Boolean)),
  ) as string[];

  const { data: itensCrus } = pedidoIds.length
    ? await db
        .from("pedido_produtos")
        .select("pedido_id, produto_nome, quantidade, preco")
        .in("pedido_id", pedidoIds)
    : { data: [] };
  const itens = (itensCrus ?? []) as unknown as LinhaItem[];

  // Cada serviço é uma linha, mas o cliente é um só: agrupa por pedido pra
  // o caixa mostrar uma venda por pessoa, e não uma por tesourada.
  const grupos = new Map<string, LinhaCaixa[]>();
  for (const a of agendamentos) {
    const chave = a.pedido_id ?? a.id;
    const atual = grupos.get(chave);
    if (atual) atual.push(a);
    else grupos.set(chave, [a]);
  }

  return Array.from(grupos.entries())
    .map(([chave, linhasDoGrupo]) => {
      const ordenados = [...linhasDoGrupo].sort((x, y) => x.hora.localeCompare(y.hora));
      const primeiro = ordenados[0];
      const pedido = primeiro.pedidos;

      const servicos: ItemCaixa[] = ordenados.map((a) => ({
        nome: a.servico_nome,
        quantidade: 1,
        preco: Number(a.preco),
      }));

      const produtos: ItemCaixa[] = itens
        .filter((i) => i.pedido_id === chave)
        .map((i) => ({
          nome: i.produto_nome,
          quantidade: Number(i.quantidade),
          preco: Number(i.preco),
        }));

      const totalServicos = servicos.reduce((t, s) => t + s.preco, 0);
      const totalProdutos = produtos.reduce((t, p) => t + p.preco * p.quantidade, 0);

      return {
        chave,
        // Agendamento sem pedido é lançamento antigo; o nome vive no pedido.
        clienteNome: pedido?.cliente_nome ?? "Cliente",
        clienteTelefone: pedido?.cliente_telefone || undefined,
        data: primeiro.data,
        hora: primeiro.hora.slice(0, 5),
        barbeiroId: primeiro.barbeiro_id,
        servicos,
        produtos,
        totalServicos,
        totalProdutos,
        total: totalServicos + totalProdutos,
        formaPagamento: (pedido?.forma_pagamento as FormaPagamento) ?? "local",
        metodoPagamento: (pedido?.metodo_pagamento as MetodoPagamento) ?? undefined,
        // O status da visita é o do primeiro serviço: eles andam juntos,
        // já que confirmar/cancelar mexe no pedido inteiro.
        status: primeiro.status,
      };
    })
    .sort((a, b) => (b.data + b.hora).localeCompare(a.data + a.hora));
}

/**
 * Resumo do período.
 *
 * "Pendente" é quem ainda nem foi confirmado pelo dono — fica fora de todo
 * faturamento, senão a tela contaria dinheiro que pode nunca aparecer.
 */
/**
 * Esse lançamento vira dinheiro no caixa?
 *
 * Fica de fora quem foi pro checkout do Mercado Pago e abandonou
 * ("aguardando_pagamento" — o horário ficou preso, mas ninguém pagou),
 * quem ainda não foi confirmado pelo dono e quem cancelou.
 */
export function contaNoCaixa(status: AgendamentoStatus): boolean {
  return status === "confirmado" || status === "concluido";
}

export interface ResumoCaixa {
  recebido: number;
  aReceber: number;
  total: number;
  emServicos: number;
  emProdutos: number;
  clientes: number;
  ticketMedio: number;
  pix: number;
  cartao: number;
  balcao: number;
  atendidos: number;
  aAtender: number;
  pendentes: number;
  valorPendente: number;
  cancelados: number;
  /** Checkout do MP aberto e nunca pago — horário preso, dinheiro nenhum. */
  naoPagos: number;
  valorNaoPago: number;
}

export function resumirCaixa(lancamentos: Lancamento[]): ResumoCaixa {
  const validos = lancamentos.filter((l) => contaNoCaixa(l.status));
  const soma = (lista: Lancamento[]) => lista.reduce((t, l) => t + l.total, 0);

  // Pix direto entra junto com o online: quando o dono confirmou, é porque
  // ele viu o valor no extrato — o dinheiro está lá, não no balcão.
  const online = validos.filter(
    (l) => l.formaPagamento === "online" || l.formaPagamento === "pix_direto",
  );
  const local = validos.filter((l) => l.formaPagamento === "local");
  const naFila = lancamentos.filter((l) => l.status === "pendente");
  const naoPagos = lancamentos.filter((l) => l.status === "aguardando_pagamento");

  const recebido = soma(online);
  const aReceber = soma(local);

  return {
    recebido,
    aReceber,
    total: recebido + aReceber,
    emServicos: validos.reduce((t, l) => t + l.totalServicos, 0),
    emProdutos: validos.reduce((t, l) => t + l.totalProdutos, 0),
    clientes: validos.length,
    ticketMedio: validos.length ? (recebido + aReceber) / validos.length : 0,
    pix: soma(online.filter((l) => l.metodoPagamento === "pix")),
    cartao: soma(online.filter((l) => l.metodoPagamento === "cartao")),
    balcao: aReceber,
    atendidos: validos.filter((l) => l.status === "concluido").length,
    aAtender: validos.filter((l) => l.status === "confirmado").length,
    pendentes: naFila.length,
    valorPendente: soma(naFila),
    cancelados: lancamentos.filter((l) => l.status === "cancelado").length,
    naoPagos: naoPagos.length,
    valorNaoPago: soma(naoPagos),
  };
}

export interface LinhaRanking {
  nome: string;
  quantidade: number;
  total: number;
}

/** O que saiu no período, do que mais rendeu pro que menos rendeu. */
export function ranking(
  lancamentos: Lancamento[],
  campo: "servicos" | "produtos",
): LinhaRanking[] {
  const mapa = new Map<string, LinhaRanking>();

  for (const l of lancamentos) {
    if (!contaNoCaixa(l.status)) continue;
    for (const item of l[campo]) {
      const atual = mapa.get(item.nome) ?? { nome: item.nome, quantidade: 0, total: 0 };
      atual.quantidade += item.quantidade;
      atual.total += item.preco * item.quantidade;
      mapa.set(item.nome, atual);
    }
  }

  return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
}

/** Quanto cada barbeiro produziu no período. */
export function porBarbeiro(lancamentos: Lancamento[]): Map<string, LinhaRanking> {
  const mapa = new Map<string, LinhaRanking>();
  for (const l of lancamentos) {
    if (!contaNoCaixa(l.status)) continue;
    const atual = mapa.get(l.barbeiroId) ?? { nome: l.barbeiroId, quantidade: 0, total: 0 };
    atual.quantidade += 1;
    atual.total += l.total;
    mapa.set(l.barbeiroId, atual);
  }
  return mapa;
}
