"use client";

import { supabase } from "./supabase-browser";
import type { Lancamento } from "./caixa";
import type { BarbeiroPerfil } from "./types";

/**
 * Comissão dos barbeiros.
 *
 * Quase toda barbearia paga o profissional por porcentagem do que ele
 * produziu, e o percentual do serviço quase nunca é o mesmo do produto:
 * corte costuma ser 40–50%, pomada vendida no balcão fica em 5–10%. Por
 * isso cada barbeiro tem dois percentuais.
 *
 * REGRA DO QUE CONTA: só entra atendimento **concluído**. Confirmado ainda
 * pode virar falta, e comissão paga em cima de falta é dinheiro que sai
 * duas vezes — o dono já pagou e não recebeu. O que está confirmado mas
 * ainda não aconteceu aparece separado, como "previsto".
 */

export interface ComissaoBarbeiro {
  barbeiroId: string;
  nome: string;
  percentualServicos: number;
  percentualProdutos: number;
  /** Atendimentos concluídos no período. */
  atendimentos: number;
  baseServicos: number;
  baseProdutos: number;
  comissaoServicos: number;
  comissaoProdutos: number;
  /** O que há pra pagar: comissão de serviço + comissão de produto. */
  total: number;
  /** Já confirmado mas ainda não atendido — não entra no total. */
  previsto: number;
  /** Quanto ficou pra barbearia depois de pagar a comissão. */
  liquidoBarbearia: number;
}

function arredondar(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Fecha a comissão do período a partir dos lançamentos do caixa.
 *
 * Recebe os lançamentos prontos (getLancamentos) em vez de consultar de
 * novo: a tela de comissões e a de caixa olham exatamente o mesmo período,
 * e duas consultas diferentes acabariam divergindo em algum detalhe.
 */
export function calcularComissoes(
  lancamentos: Lancamento[],
  barbeiros: BarbeiroPerfil[],
): ComissaoBarbeiro[] {
  const porId = new Map<string, ComissaoBarbeiro>();

  for (const b of barbeiros) {
    porId.set(b.id, {
      barbeiroId: b.id,
      nome: b.nome,
      percentualServicos: b.comissaoPercentual ?? 0,
      percentualProdutos: b.comissaoProdutosPercentual ?? 0,
      atendimentos: 0,
      baseServicos: 0,
      baseProdutos: 0,
      comissaoServicos: 0,
      comissaoProdutos: 0,
      total: 0,
      previsto: 0,
      liquidoBarbearia: 0,
    });
  }

  for (const l of lancamentos) {
    const linha = porId.get(l.barbeiroId);
    // Barbeiro excluído da equipe ainda tem histórico no caixa; sem linha
    // pra ele, o valor simplesmente não gera comissão.
    if (!linha) continue;

    if (l.status === "concluido") {
      linha.atendimentos += 1;
      linha.baseServicos += l.totalServicos;
      linha.baseProdutos += l.totalProdutos;
    } else if (l.status === "confirmado") {
      linha.previsto +=
        (l.totalServicos * linha.percentualServicos) / 100 +
        (l.totalProdutos * linha.percentualProdutos) / 100;
    }
  }

  return Array.from(porId.values())
    .map((c) => {
      const comissaoServicos = arredondar((c.baseServicos * c.percentualServicos) / 100);
      const comissaoProdutos = arredondar((c.baseProdutos * c.percentualProdutos) / 100);
      const total = arredondar(comissaoServicos + comissaoProdutos);
      return {
        ...c,
        baseServicos: arredondar(c.baseServicos),
        baseProdutos: arredondar(c.baseProdutos),
        comissaoServicos,
        comissaoProdutos,
        total,
        previsto: arredondar(c.previsto),
        liquidoBarbearia: arredondar(c.baseServicos + c.baseProdutos - total),
      };
    })
    .sort((a, b) => b.total - a.total);
}

export interface TotaisComissao {
  producao: number;
  aPagar: number;
  previsto: number;
  liquido: number;
  atendimentos: number;
}

export function totalizar(linhas: ComissaoBarbeiro[]): TotaisComissao {
  return linhas.reduce<TotaisComissao>(
    (t, l) => ({
      producao: arredondar(t.producao + l.baseServicos + l.baseProdutos),
      aPagar: arredondar(t.aPagar + l.total),
      previsto: arredondar(t.previsto + l.previsto),
      liquido: arredondar(t.liquido + l.liquidoBarbearia),
      atendimentos: t.atendimentos + l.atendimentos,
    }),
    { producao: 0, aPagar: 0, previsto: 0, liquido: 0, atendimentos: 0 },
  );
}

// ---------- Fechamentos (o que já foi pago) ----------

export interface Fechamento {
  id: string;
  barbeiroId: string;
  periodoDe: string;
  periodoAte: string;
  baseServicos: number;
  baseProdutos: number;
  valor: number;
  observacao: string;
  pagoEm: string;
}

function paraFechamento(l: Record<string, unknown>): Fechamento {
  return {
    id: l.id as string,
    barbeiroId: l.barbeiro_id as string,
    periodoDe: l.periodo_de as string,
    periodoAte: l.periodo_ate as string,
    baseServicos: Number(l.base_servicos ?? 0),
    baseProdutos: Number(l.base_produtos ?? 0),
    valor: Number(l.valor ?? 0),
    observacao: (l.observacao as string) ?? "",
    pagoEm: l.pago_em as string,
  };
}

export async function getFechamentos(barbeariaId: string): Promise<Fechamento[]> {
  const { data, error } = await supabase()
    .from("comissao_fechamentos")
    .select("*")
    .eq("barbearia_id", barbeariaId)
    .order("pago_em", { ascending: false })
    .limit(60);

  if (error) throw new Error(error.message);
  return (data ?? []).map(paraFechamento);
}

/**
 * Registra que a comissão daquele período foi paga.
 *
 * O banco tem índice único em (barbeiro, período): fechar o mesmo intervalo
 * duas vezes falha em vez de duplicar o pagamento.
 */
export async function registrarFechamento(input: {
  barbeariaId: string;
  linha: ComissaoBarbeiro;
  de: string;
  ate: string;
  observacao?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase().from("comissao_fechamentos").insert({
    barbearia_id: input.barbeariaId,
    barbeiro_id: input.linha.barbeiroId,
    periodo_de: input.de,
    periodo_ate: input.ate,
    base_servicos: input.linha.baseServicos,
    base_produtos: input.linha.baseProdutos,
    valor: input.linha.total,
    observacao: input.observacao ?? "",
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Esse período já foi fechado pra esse barbeiro." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Esse período já foi pago pra esse barbeiro? */
export function jaFechado(
  fechamentos: Fechamento[],
  barbeiroId: string,
  de: string,
  ate: string,
): Fechamento | undefined {
  return fechamentos.find(
    (f) => f.barbeiroId === barbeiroId && f.periodoDe === de && f.periodoAte === ate,
  );
}
