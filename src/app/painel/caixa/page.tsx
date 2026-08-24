"use client";

import { useState } from "react";
import { getBarbeiros } from "@/lib/db";
import { contaNoCaixa, getLancamentos, porBarbeiro, ranking, resumirCaixa } from "@/lib/caixa";
import type { Lancamento } from "@/lib/caixa";
import { addDays, toISODate } from "@/lib/date";
import { useSession } from "@/lib/use-session";
import { useAsync } from "@/lib/use-async";
import { METODO_LABEL } from "@/lib/types";

function dinheiro(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

function dataCurta(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

const HOJE = toISODate(new Date());

/** Períodos prontos — o dono quase nunca quer uma data solta. */
const PERIODOS = [
  { id: "hoje", label: "Hoje", de: () => HOJE, ate: () => HOJE },
  { id: "ontem", label: "Ontem", de: () => addDays(HOJE, -1), ate: () => addDays(HOJE, -1) },
  { id: "7d", label: "7 dias", de: () => addDays(HOJE, -6), ate: () => HOJE },
  { id: "30d", label: "30 dias", de: () => addDays(HOJE, -29), ate: () => HOJE },
] as const;

type PeriodoId = (typeof PERIODOS)[number]["id"] | "custom";

export default function CaixaPage() {
  const session = useSession();
  const dono = session?.role === "dono";

  const [periodo, setPeriodo] = useState<PeriodoId>("hoje");
  const [de, setDe] = useState(HOJE);
  const [ate, setAte] = useState(HOJE);
  const [aberto, setAberto] = useState<string | null>(null);

  const { dados, carregando } = useAsync(
    async () => {
      const id = session!.barbeariaId;
      const [lancamentos, barbeiros] = await Promise.all([
        getLancamentos(id, de, ate),
        getBarbeiros(id),
      ]);
      return { lancamentos, barbeiros };
    },
    [session?.barbeariaId, de, ate],
    { pular: !dono },
  );

  if (!session || !dono) return null;

  const lancamentos = dados?.lancamentos ?? [];
  const barbeiros = dados?.barbeiros ?? [];
  const r = resumirCaixa(lancamentos);
  const servicos = ranking(lancamentos, "servicos");
  const produtos = ranking(lancamentos, "produtos");
  const equipe = porBarbeiro(lancamentos);
  const maiorBarbeiro = Math.max(1, ...Array.from(equipe.values()).map((v) => v.total));

  function escolher(p: (typeof PERIODOS)[number]) {
    setPeriodo(p.id);
    setDe(p.de());
    setAte(p.ate());
  }

  const contabilizados = lancamentos.filter((l) => contaNoCaixa(l.status));
  const naFila = lancamentos.filter((l) => l.status === "pendente");

  return (
    <div>
      <p className="font-accent text-xs uppercase tracking-[0.2em] text-gold-bright">
        Caixa
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-bone">
        O que entrou e o que foi vendido
      </h1>
      <p className="mt-1 max-w-xl font-body text-sm text-bone-dim">
        Serviços prestados, produtos vendidos e onde o dinheiro está —
        separando o que já caiu na conta do que ainda é pra cobrar no balcão.
      </p>

      {/* ---------- Período ---------- */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {PERIODOS.map((p) => (
          <button
            key={p.id}
            onClick={() => escolher(p)}
            className={`rounded-full border px-4 py-2 font-body text-sm font-semibold transition-colors ${
              periodo === p.id
                ? "border-gold-bright bg-gold-bright/10 text-gold-bright"
                : "border-line-strong text-bone-dim hover:border-gold-bright/40 hover:text-bone"
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className="flex items-center gap-2 rounded-full border border-line-strong px-3 py-1.5">
          <input
            type="date"
            value={de}
            max={ate}
            onChange={(e) => {
              setDe(e.target.value);
              setPeriodo("custom");
            }}
            className="bg-transparent font-body text-xs text-bone outline-none"
          />
          <span className="font-body text-xs text-muted">até</span>
          <input
            type="date"
            value={ate}
            min={de}
            onChange={(e) => {
              setAte(e.target.value);
              setPeriodo("custom");
            }}
            className="bg-transparent font-body text-xs text-bone outline-none"
          />
        </div>
      </div>

      {/* ---------- Os três números que importam ---------- */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-ok-line bg-ok-soft p-6">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-ok">
            Já caiu na conta
          </p>
          <p className="mt-2 font-accent text-3xl text-bone">{dinheiro(r.recebido)}</p>
          <p className="mt-1 font-body text-xs text-bone-dim">
            {r.recebido === 0
              ? "Nenhum pagamento online no período"
              : [
                  r.pix > 0 ? `Pix ${dinheiro(r.pix)}` : null,
                  r.cartao > 0 ? `Cartão ${dinheiro(r.cartao)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </p>
        </div>

        <div className="rounded-2xl border border-warn-line bg-warn-soft p-6">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-warn">
            A receber no balcão
          </p>
          <p className="mt-2 font-accent text-3xl text-bone">{dinheiro(r.aReceber)}</p>
          <p className="mt-1 font-body text-xs text-bone-dim">
            {r.aReceber > 0
              ? "Cobrar na hora do atendimento"
              : "Nenhuma cobrança no balcão no período"}
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-ink-elev/60 p-6">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Total do período
          </p>
          <p className="mt-2 font-accent text-3xl text-gold-bright">{dinheiro(r.total)}</p>
          <p className="mt-1 font-body text-xs text-bone-dim">
            {r.clientes} cliente(s) · ticket médio {dinheiro(r.ticketMedio)}
          </p>
        </div>
      </div>

      {/* ---------- Composição ---------- */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [
            "Em serviços",
            dinheiro(r.emServicos),
            `${servicos.reduce((t, s) => t + s.quantidade, 0)} prestado(s)`,
          ],
          [
            "Em produtos",
            dinheiro(r.emProdutos),
            `${produtos.reduce((t, p) => t + p.quantidade, 0)} unidade(s)`,
          ],
          ["Já atendidos", String(r.atendidos), `${r.aAtender} ainda por atender`],
          [
            "Fora da conta",
            dinheiro(r.valorPendente + r.valorNaoPago),
            `${r.pendentes} a confirmar · ${r.naoPagos} não pago(s)`,
          ],
        ].map(([label, valor, nota]) => (
          <div key={label} className="rounded-2xl border border-line bg-ink-elev/60 p-5">
            <p className="font-body text-xs text-muted">{label}</p>
            <p className="mt-1 font-accent text-2xl text-bone">{valor}</p>
            <p className="mt-1 font-body text-[11px] text-muted">{nota}</p>
          </div>
        ))}
      </div>

      {/* ---------- O que foi vendido ---------- */}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Ranking
          titulo="Serviços prestados"
          vazio="Nenhum serviço no período."
          linhas={servicos}
          unidade="x"
        />
        <Ranking
          titulo="Produtos vendidos"
          vazio="Nenhum produto vendido no período."
          linhas={produtos}
          unidade=" un"
        />
      </div>

      {/* ---------- Por barbeiro ---------- */}
      {equipe.size > 0 && (
        <div className="mt-4 rounded-2xl border border-line bg-ink-elev/60 p-6">
          <p className="font-display text-lg font-semibold text-bone">Por barbeiro</p>
          <div className="mt-4 space-y-3">
            {Array.from(equipe.entries())
              .sort((a, b) => b[1].total - a[1].total)
              .map(([id, linha]) => (
                <div key={id}>
                  <div className="flex items-center justify-between font-body text-sm">
                    <span className="text-bone">
                      {barbeiros.find((b) => b.id === id)?.nome ?? "Barbeiro"}
                    </span>
                    <span className="text-gold-bright">
                      {dinheiro(linha.total)} · {linha.quantidade} atend.
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-bone/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-gold to-gold-bright"
                      style={{ width: `${(linha.total / maiorBarbeiro) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ---------- Lançamentos ---------- */}
      <div className="mt-8">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-lg font-semibold text-bone">
            Lançamentos do período
          </p>
          <p className="font-body text-xs text-muted">
            {contabilizados.length} venda(s)
            {r.cancelados > 0 && ` · ${r.cancelados} cancelada(s)`}
          </p>
        </div>

        <div className="mt-3 space-y-2">
          {carregando && (
            <p className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center font-body text-sm text-muted">
              Carregando…
            </p>
          )}
          {!carregando && lancamentos.length === 0 && (
            <p className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center font-body text-sm text-bone-dim">
              Nenhum movimento nesse período.
            </p>
          )}
          {lancamentos.map((l) => (
            <LinhaLancamento
              key={l.chave}
              lancamento={l}
              barbeiro={barbeiros.find((b) => b.id === l.barbeiroId)?.nome}
              aberto={aberto === l.chave}
              onToggle={() => setAberto(aberto === l.chave ? null : l.chave)}
            />
          ))}
        </div>

        {r.naoPagos > 0 && (
          <p className="mt-3 rounded-xl border border-line-strong bg-bone/[0.03] px-4 py-3 font-body text-xs text-bone-dim">
            {r.naoPagos} pedido(s) foram pro checkout do Mercado Pago e nunca
            foram pagos, somando {dinheiro(r.valorNaoPago)}. O horário fica
            preso até o pagamento cair, mas esse dinheiro não é seu — por isso
            não entra no caixa.
          </p>
        )}

        {naFila.length > 0 && (
          <p className="mt-3 rounded-xl border border-warn-line bg-warn-soft px-4 py-3 font-body text-xs text-warn">
            {naFila.length} agendamento(s) aguardando sua confirmação, somando{" "}
            {dinheiro(r.valorPendente)}. Enquanto não confirmar, esse valor fica
            fora do caixa.
          </p>
        )}
      </div>
    </div>
  );
}

function Ranking({
  titulo,
  vazio,
  linhas,
  unidade,
}: {
  titulo: string;
  vazio: string;
  linhas: { nome: string; quantidade: number; total: number }[];
  unidade: string;
}) {
  const maior = Math.max(1, ...linhas.map((l) => l.total));
  return (
    <div className="rounded-2xl border border-line bg-ink-elev/60 p-6">
      <p className="font-display text-lg font-semibold text-bone">{titulo}</p>
      {linhas.length === 0 ? (
        <p className="mt-3 font-body text-sm text-bone-dim">{vazio}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {linhas.map((l) => (
            <div key={l.nome}>
              <div className="flex items-center justify-between gap-3 font-body text-sm">
                <span className="min-w-0 truncate text-bone">
                  {l.nome}
                  <span className="ml-1.5 text-muted">
                    {l.quantidade}
                    {unidade}
                  </span>
                </span>
                <span className="shrink-0 font-accent text-cyan-bright">
                  {dinheiro(l.total)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bone/5">
                <div
                  className="h-full rounded-full bg-cyan-bright/60"
                  style={{ width: `${(l.total / maior) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<Lancamento["status"], string> = {
  aguardando_pagamento: "Pagamento não concluído",
  pendente: "Aguardando confirmação",
  confirmado: "Confirmado",
  concluido: "Atendido",
  cancelado: "Cancelado",
};

const STATUS_CLASS: Record<Lancamento["status"], string> = {
  aguardando_pagamento: "bg-bone/5 text-muted",
  pendente: "bg-warn-soft text-warn",
  confirmado: "bg-ok-soft text-ok",
  concluido: "bg-bone/5 text-muted",
  cancelado: "bg-off-soft text-off",
};

function LinhaLancamento({
  lancamento: l,
  barbeiro,
  aberto,
  onToggle,
}: {
  lancamento: Lancamento;
  barbeiro?: string;
  aberto: boolean;
  onToggle: () => void;
}) {
  const online = l.formaPagamento === "online";
  return (
    <div
      className={`rounded-2xl border border-line bg-ink-elev/60 ${
        l.status === "cancelado" ? "opacity-60" : ""
      }`}
    >
      <button
        onClick={onToggle}
        className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 font-accent text-sm text-bone-dim">
            {dataCurta(l.data)} · {l.hora}
          </span>
          <div className="min-w-0">
            <p className="truncate font-body text-sm font-medium text-bone">
              {l.clienteNome}
            </p>
            <p className="truncate font-body text-xs text-muted">
              {[...l.servicos.map((s) => s.nome), ...l.produtos.map((p) => p.nome)].join(
                ", ",
              )}
              {barbeiro && ` · ${barbeiro}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span
            className={`rounded-full px-2.5 py-1 font-body text-[11px] ${STATUS_CLASS[l.status]}`}
          >
            {STATUS_LABEL[l.status]}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 font-body text-[11px] ${
              online ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"
            }`}
          >
            {online
              ? `Pago · ${l.metodoPagamento ? METODO_LABEL[l.metodoPagamento] : "online"}`
              : "No balcão"}
          </span>
          <span className="font-accent text-base text-gold-bright">
            {dinheiro(l.total)}
          </span>
          <span className="font-body text-xs text-muted">{aberto ? "▲" : "▼"}</span>
        </div>
      </button>

      {aberto && (
        <div className="border-t border-line px-5 py-4">
          <ul className="space-y-1.5">
            {l.servicos.map((s, i) => (
              <li
                key={`s${i}`}
                className="flex items-center justify-between gap-3 font-body text-sm"
              >
                <span className="min-w-0 truncate text-bone-dim">{s.nome}</span>
                <span className="shrink-0 font-accent text-bone">{dinheiro(s.preco)}</span>
              </li>
            ))}
            {l.produtos.map((p, i) => (
              <li
                key={`p${i}`}
                className="flex items-center justify-between gap-3 font-body text-sm"
              >
                <span className="min-w-0 truncate text-bone-dim">
                  {p.nome}
                  {p.quantidade > 1 && ` (${p.quantidade}x)`}
                  <span className="ml-1.5 rounded bg-cyan-bright/10 px-1.5 py-0.5 text-[10px] text-cyan-bright">
                    produto
                  </span>
                </span>
                <span className="shrink-0 font-accent text-bone">
                  {dinheiro(p.preco * p.quantidade)}
                </span>
              </li>
            ))}
          </ul>
          {l.clienteTelefone && (
            <p className="mt-3 font-body text-xs text-muted">
              Contato: {l.clienteTelefone}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
