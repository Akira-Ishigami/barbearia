"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAsync } from "@/lib/use-async";
import { cabecalhosPlataforma, usePlataforma } from "@/lib/use-plataforma";
import {
  Alerta,
  BarrasSemana,
  Numero,
  curto,
  data,
  dinheiro,
  quando,
  type Semana,
} from "@/components/adm/Painel";

/**
 * A tela que responde "o que anda acontecendo".
 *
 * A ordem é proposital e não é a ordem dos dados: primeiro o que precisa de
 * ação hoje (trial vencendo, barbearia parada, cadastro que nunca saiu do
 * papel), depois o dinheiro, depois a forma das últimas semanas e só no fim
 * o movimento cru. Dashboard que abre com contagem de tabela obriga a
 * pessoa a caçar o problema; este abre com o problema.
 */

interface Item {
  id: string;
  nome: string;
  dias?: number;
  diasParada?: number | null;
  plano?: string;
  barbeiros?: number;
}

interface Visao {
  nivel: string;
  janelaDias: number;
  barbearias: {
    total: number;
    trial: number;
    ativa: number;
    vencida: number;
    novasEm7Dias: number;
    novasEm30Dias: number;
  };
  planos: Record<string, number>;
  receita: {
    mensalRecorrente: number;
    movimentadoNoMes: number;
    movimentadoEm30Dias: number;
    ticketMedio: number;
  };
  conversao: { jaPagaram: number; saiuDoTeste: number; taxa: number | null };
  pagamentos: { comMercadoPago: number; comPixDireto: number; semRecebimentoOnline: number };
  uso: {
    pedidos30Dias: number;
    pedidosPagos30Dias: number;
    clientes: number;
    agendamentos30Dias: number;
    statusAgenda: Record<string, number>;
  };
  atencao: {
    trialAcabando: Item[];
    vencidas: Item[];
    semRecebimento: Item[];
    semCatalogo: Item[];
    paradas: Item[];
    tokenMpVencendo: Item[];
  };
  semanas: Semana[];
  ranking: {
    id: string;
    nome: string;
    status: string;
    plano: string;
    pedidos: number;
    uso: { rotulo: string; nivel: 0 | 1 | 2 | 3 };
    ultimoPedido: string | null;
  }[];
  movimento: {
    pedidos24h: number;
    pedidos7Dias: number;
    barbeariasAtivas7Dias: number;
    porForma: Record<string, number>;
  };
  ultimosCadastros: {
    id: string;
    nome: string;
    plano: string;
    status: string;
    criadaEm: string;
  }[];
  log: { id: string; email: string; acao: string; detalhe: string; criado_em: string }[];
}

const ROTULO_STATUS: Record<string, { texto: string; classe: string }> = {
  ativa: { texto: "Pagando", classe: "border-ok-line bg-ok-soft text-ok" },
  trial: { texto: "Em teste", classe: "border-warn-line bg-warn-soft text-warn" },
  vencida: { texto: "Vencida", classe: "border-off-line bg-off-soft text-off" },
};

const ROTULO_FORMA: Record<string, string> = {
  online: "Mercado Pago",
  pix_direto: "Pix direto",
  local: "no balcão",
};

const ACAO_LABEL: Record<string, string> = {
  estender_trial: "estendeu o teste",
  marcar_paga: "marcou assinatura paga",
  mudar_plano: "mudou o plano",
  bloquear: "bloqueou",
  desconectar_mp: "soltou o Mercado Pago",
  equipe_salvar: "liberou acesso",
  equipe_remover: "removeu acesso",
};

export default function AdmVisaoPage() {
  const acesso = usePlataforma();
  const router = useRouter();

  const { dados: d, carregando, erro, recarregar } = useAsync<Visao>(
    async () => {
      const r = await fetch("/api/adm/visao", { headers: await cabecalhosPlataforma() });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro ?? "Falha ao carregar.");
      return r.json();
    },
    [acesso?.email],
    { pular: !acesso },
  );

  if (!acesso) return null;

  /** Abre a barbearia na tela de detalhe, já selecionada. */
  const abrir = (id: string) => router.push(`/adm/barbearias?abrir=${id}`);

  const totalAtencao = d
    ? d.atencao.trialAcabando.length +
      d.atencao.vencidas.length +
      d.atencao.semCatalogo.length +
      d.atencao.paradas.length +
      d.atencao.semRecebimento.length +
      d.atencao.tokenMpVencendo.length
    : 0;

  const agenda = d?.uso.statusAgenda ?? {};
  const maiorUso = Math.max(1, ...(d?.ranking ?? []).map((r) => r.pedidos));

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-accent text-xs uppercase tracking-[0.2em] text-cyan-bright">
            Plataforma
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-bone">
            O que anda acontecendo
          </h1>
          <p className="mt-1 max-w-xl font-body text-sm text-bone-dim">
            Olá, {acesso.nome.split(" ")[0]}. Aqui é a <strong className="text-bone">soma</strong>{" "}
            de todas as barbearias. Quanto cada uma fatura e quem agenda nelas
            fica de fora de propósito — isso é a vida delas, não métrica da
            Navalha.
          </p>
        </div>
        <button
          onClick={recarregar}
          disabled={carregando}
          className="shrink-0 rounded-full border border-line-strong px-4 py-2 font-body text-sm text-bone-dim transition-colors hover:border-cyan/50 hover:text-cyan-bright disabled:opacity-50"
        >
          {carregando ? "Atualizando…" : "Atualizar"}
        </button>
      </div>

      {erro && (
        <p className="mt-6 rounded-xl border border-off-line bg-off-soft px-4 py-3 font-body text-sm text-off">
          {erro}
        </p>
      )}
      {carregando && !d && (
        <p className="mt-6 font-body text-sm text-bone-dim">Carregando…</p>
      )}

      {d && (
        <>
          {/* ================= PRECISA DE VOCÊ ================= */}
          <section className="mt-8">
            <h2 className="font-display text-xl font-semibold text-bone">
              Precisa de você{" "}
              {totalAtencao > 0 && (
                <span className="ml-1 rounded-full bg-off px-2 py-0.5 align-middle font-body text-xs font-semibold text-white">
                  {totalAtencao}
                </span>
              )}
            </h2>

            {totalAtencao === 0 ? (
              <p className="mt-3 rounded-2xl border border-ok-line bg-ok-soft px-4 py-4 font-body text-sm text-ok">
                ✓ Nada pendente. Nenhum teste vencendo, nenhuma barbearia parada.
              </p>
            ) : (
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <Alerta
                  icone="⏳"
                  tom="warn"
                  titulo="Teste acabando"
                  explicacao="Vence em até 7 dias. É a hora de falar com essas pessoas."
                  aoAbrir={abrir}
                  itens={d.atencao.trialAcabando.map((i) => ({
                    id: i.id,
                    nome: i.nome,
                    nota: (i.dias ?? 0) <= 0 ? "hoje" : `${i.dias}d`,
                  }))}
                />
                <Alerta
                  icone="🔒"
                  tom="off"
                  titulo="Sem acesso"
                  explicacao="Teste acabou ou o pagamento não veio. O painel delas está bloqueado."
                  aoAbrir={abrir}
                  itens={d.atencao.vencidas.map((i) => ({
                    id: i.id,
                    nome: i.nome,
                    nota: i.plano,
                  }))}
                />
                <Alerta
                  icone="📭"
                  tom="off"
                  titulo="Cadastrou e parou"
                  explicacao="Nenhum serviço cadastrado — a página pública dela não vende nada."
                  aoAbrir={abrir}
                  itens={d.atencao.semCatalogo.map((i) => ({
                    id: i.id,
                    nome: i.nome,
                    nota: `${i.barbeiros ?? 0} barbeiro(s)`,
                  }))}
                />
                <Alerta
                  icone="💤"
                  tom="warn"
                  titulo="Sem movimento"
                  explicacao="Tem catálogo, mas nenhum pedido há 3 semanas ou mais."
                  aoAbrir={abrir}
                  itens={d.atencao.paradas.map((i) => ({
                    id: i.id,
                    nome: i.nome,
                    nota: i.diasParada === null ? "nunca" : `${i.diasParada}d`,
                  }))}
                />
                <Alerta
                  icone="💳"
                  tom="neutro"
                  titulo="Só recebe no balcão"
                  explicacao="Sem Mercado Pago e sem Pix — não dá pra cobrar adiantado."
                  aoAbrir={abrir}
                  itens={d.atencao.semRecebimento}
                />
                <Alerta
                  icone="🔑"
                  tom="warn"
                  titulo="Mercado Pago vencendo"
                  explicacao="A autorização expira em até 30 dias; renova sozinha, mas vale olhar."
                  aoAbrir={abrir}
                  itens={d.atencao.tokenMpVencendo.map((i) => ({
                    id: i.id,
                    nome: i.nome,
                    nota: `${i.dias}d`,
                  }))}
                />
              </div>
            )}
          </section>

          {/* ================= DINHEIRO ================= */}
          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold text-bone">
              Dinheiro
            </h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Numero
                tom="ok"
                titulo="Receita recorrente"
                valor={dinheiro(d.receita.mensalRecorrente)}
                detalhe={`${d.barbearias.ativa} barbearia(s) com assinatura em dia`}
              />
              <Numero
                tom="cyan"
                titulo="Convertem depois do teste"
                valor={d.conversao.taxa === null ? "—" : `${d.conversao.taxa}%`}
                detalhe={
                  d.conversao.saiuDoTeste === 0
                    ? "Ninguém terminou o teste ainda"
                    : `${d.conversao.jaPagaram} de ${d.conversao.saiuDoTeste} que saíram do teste já pagaram`
                }
              />
              <Numero
                titulo="Movimentado no mês"
                valor={dinheiro(d.receita.movimentadoNoMes)}
                detalhe="O que os clientes pagaram às barbearias"
              />
              <Numero
                titulo="Ticket médio"
                valor={dinheiro(d.receita.ticketMedio)}
                detalhe={`${d.uso.pedidosPagos30Dias} pedido(s) pago(s) em 30 dias`}
              />
            </div>
          </section>

          {/* ================= FORMA DAS SEMANAS ================= */}
          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold text-bone">
              Últimas 10 semanas
            </h2>
            <p className="mt-1 font-body text-xs text-muted">
              Três medidas diferentes, três desenhos. Passe o mouse numa barra pra
              ver a semana.
            </p>
            <div className="mt-3 grid gap-4 lg:grid-cols-3">
              <BarrasSemana
                titulo="Barbearias novas"
                semanas={d.semanas}
                campo="cadastros"
                formatar={(v) => String(v)}
              />
              <BarrasSemana
                titulo="Pedidos"
                semanas={d.semanas}
                campo="pedidos"
                formatar={(v) => String(v)}
              />
              <BarrasSemana
                titulo="Movimentado"
                semanas={d.semanas}
                campo="movimentado"
                formatar={(v) => `R$ ${curto(v)}`}
              />
            </div>
          </section>

          {/* ================= A BASE ================= */}
          <section className="mt-10 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-line bg-ink-elev p-5">
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-bone-dim">
                Barbearias
              </p>
              <p className="mt-2 font-accent text-3xl leading-none text-bone">
                {d.barbearias.total}
              </p>
              <p className="mt-1.5 font-body text-xs text-bone-dim">
                +{d.barbearias.novasEm7Dias} nesta semana · +{d.barbearias.novasEm30Dias} em
                30 dias
              </p>

              <div className="mt-4 space-y-2">
                {(
                  [
                    ["ativa", "Pagando", "bg-ok"],
                    ["trial", "Em teste", "bg-warn"],
                    ["vencida", "Vencida", "bg-off"],
                  ] as const
                ).map(([chave, label, cor]) => {
                  const qtd = d.barbearias[chave];
                  const pct = d.barbearias.total
                    ? Math.round((qtd / d.barbearias.total) * 100)
                    : 0;
                  return (
                    <div key={chave}>
                      <div className="flex items-center justify-between font-body text-xs">
                        <span className="flex items-center gap-1.5 text-bone-dim">
                          <span className={`h-2 w-2 rounded-full ${cor}`} />
                          {label}
                        </span>
                        <span className="text-bone">
                          {qtd} <span className="text-muted">({pct}%)</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bone/10">
                        <div className={`h-full rounded-full ${cor}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-ink-elev p-5">
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-bone-dim">
                Como elas recebem
              </p>
              <p className="mt-1 font-body text-[11px] text-muted">
                Dá pra ter os dois ligados ao mesmo tempo.
              </p>
              <div className="mt-4 space-y-2.5 font-body text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-bone-dim">Mercado Pago</span>
                  <span className="text-bone">{d.pagamentos.comMercadoPago}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-bone-dim">Pix direto</span>
                  <span className="text-bone">{d.pagamentos.comPixDireto}</span>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-2.5">
                  <span className="text-bone-dim">Só no balcão</span>
                  <span
                    className={d.pagamentos.semRecebimentoOnline > 0 ? "text-warn" : "text-bone"}
                  >
                    {d.pagamentos.semRecebimentoOnline}
                  </span>
                </div>
              </div>

              <p className="mt-5 font-body text-xs font-semibold uppercase tracking-wide text-bone-dim">
                Planos
              </p>
              <div className="mt-2 space-y-2 font-body text-sm">
                {[
                  ["basico", "Básico"],
                  ["pro", "Pro"],
                ].map(([id, label]) => (
                  <div key={id} className="flex items-center justify-between">
                    <span className="text-bone-dim">{label}</span>
                    <span className="text-bone">{d.planos[id] ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-ink-elev p-5">
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-bone-dim">
                Agenda em 30 dias
              </p>
              <p className="mt-2 font-accent text-3xl leading-none text-bone">
                {d.uso.agendamentos30Dias}
              </p>
              <p className="mt-1.5 font-body text-xs text-bone-dim">
                horários marcados em toda a plataforma
              </p>

              <div className="mt-4 space-y-1.5 font-body text-xs">
                {(
                  [
                    ["concluido", "Concluídos", "text-ok"],
                    ["confirmado", "Confirmados", "text-bone-dim"],
                    ["pendente", "Aguardando o dono", "text-warn"],
                    ["aguardando_pagamento", "Checkout abandonado", "text-muted"],
                    ["cancelado", "Cancelados", "text-off"],
                  ] as const
                ).map(([chave, label, cor]) => (
                  <div key={chave} className="flex items-center justify-between">
                    <span className={cor}>{label}</span>
                    <span className="text-bone">{agenda[chave] ?? 0}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-line pt-3 font-body text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-bone-dim">Clientes cadastrados</span>
                  <span className="text-bone">{d.uso.clientes}</span>
                </div>
              </div>
            </div>
          </section>

          {/* ================= RANKING ================= */}
          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold text-bone">
              Quem mais usa
            </h2>
            <p className="mt-1 font-body text-xs text-muted">
              Quantidade de pedidos nos últimos {d.janelaDias} dias — quem está
              rodando e quem parou. O valor de cada barbearia não entra nesta conta.
            </p>

            <div className="mt-3 space-y-1.5">
              {d.ranking.slice(0, 10).map((r) => (
                <button
                  key={r.id}
                  onClick={() => abrir(r.id)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-line bg-ink-elev px-4 py-2.5 text-left transition-colors hover:border-cyan/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-body text-sm text-bone">{r.nome}</span>
                      <span
                        className={`shrink-0 rounded-full border px-1.5 py-0.5 font-body text-[10px] ${
                          ROTULO_STATUS[r.status]?.classe ?? ""
                        }`}
                      >
                        {ROTULO_STATUS[r.status]?.texto ?? r.status}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bone/10">
                      <div
                        className="h-full rounded-full bg-cyan transition-colors group-hover:bg-cyan-bright"
                        style={{ width: `${Math.max(1, (r.pedidos / maiorUso) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-accent text-sm text-bone">{r.pedidos}</p>
                    <p className="font-body text-[10px] text-muted">
                      {r.uso.rotulo} · último {data(r.ultimoPedido)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* ================= MOVIMENTO ================= */}
          <section className="mt-10 grid gap-4 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-xl font-semibold text-bone">
                Movimento
              </h2>
              <p className="mt-1 font-body text-xs text-muted">
                Quantos agendamentos entraram na plataforma. Quem agendou e por
                quanto não aparece aqui — isso é a agenda da barbearia com o
                cliente dela.
              </p>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <Numero
                  tom="cyan"
                  titulo="Últimas 24h"
                  valor={String(d.movimento.pedidos24h)}
                  detalhe="pedidos em toda a plataforma"
                />
                <Numero
                  titulo="Últimos 7 dias"
                  valor={String(d.movimento.pedidos7Dias)}
                  detalhe={`${d.movimento.barbeariasAtivas7Dias} barbearia(s) com movimento`}
                />
              </div>

              <div className="mt-3 rounded-2xl border border-line bg-ink-elev p-5">
                <p className="font-body text-xs font-semibold uppercase tracking-wide text-bone-dim">
                  Como pagaram · 30 dias
                </p>
                <div className="mt-3 space-y-2.5 font-body text-sm">
                  {Object.keys(ROTULO_FORMA).map((forma) => {
                    const qtd = d.movimento.porForma[forma] ?? 0;
                    const total = Object.values(d.movimento.porForma).reduce(
                      (a, b) => a + b,
                      0,
                    );
                    const pct = total ? Math.round((qtd / total) * 100) : 0;
                    return (
                      <div key={forma}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-bone-dim">{ROTULO_FORMA[forma]}</span>
                          <span className="text-bone">
                            {qtd} <span className="text-muted">({pct}%)</span>
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bone/10">
                          <div
                            className="h-full rounded-full bg-cyan"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <h2 className="font-display text-xl font-semibold text-bone">
                Entraram por último
              </h2>
              <p className="mt-1 font-body text-xs text-muted">
                Cadastros novos e o que o suporte andou fazendo.
              </p>

              <div className="mt-3 space-y-1.5">
                {d.ultimosCadastros.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => abrir(b.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-ink-elev px-4 py-2.5 text-left transition-colors hover:border-cyan/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-body text-sm text-bone">{b.nome}</p>
                      <p className="font-body text-[11px] text-muted">
                        plano {b.plano} · {quando(b.criadaEm)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 font-body text-[10px] ${
                        ROTULO_STATUS[b.status]?.classe ?? ""
                      }`}
                    >
                      {ROTULO_STATUS[b.status]?.texto ?? b.status}
                    </span>
                  </button>
                ))}
              </div>

              {d.log.length > 0 && (
                <div className="mt-4 rounded-2xl border border-line bg-ink-elev p-4">
                  <p className="font-body text-xs font-semibold uppercase tracking-wide text-bone-dim">
                    Ações do suporte
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {d.log.slice(0, 5).map((l) => (
                      <p key={l.id} className="font-body text-[11px] text-muted">
                        <span className="text-bone-dim">{l.email.split("@")[0]}</span>{" "}
                        {ACAO_LABEL[l.acao] ?? l.acao}
                        <span className="text-muted"> · {quando(l.criado_em)}</span>
                      </p>
                    ))}
                  </div>
                  <Link
                    href="/adm/equipe"
                    className="mt-2 inline-block font-body text-[11px] text-cyan-bright hover:underline"
                  >
                    ver tudo →
                  </Link>
                </div>
              )}
            </div>
          </section>

          <Link
            href="/adm/barbearias"
            className="mt-10 inline-block rounded-full bg-cyan px-6 py-3 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.02]"
          >
            Abrir a lista de barbearias
          </Link>
        </>
      )}
    </div>
  );
}
