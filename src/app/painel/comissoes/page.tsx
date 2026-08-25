"use client";

import { useState } from "react";
import Link from "next/link";
import { getBarbeiros } from "@/lib/db";
import { getLancamentos } from "@/lib/caixa";
import {
  calcularComissoes,
  getFechamentos,
  jaFechado,
  registrarFechamento,
  totalizar,
  type ComissaoBarbeiro,
} from "@/lib/comissao";
import { addDays, toISODate } from "@/lib/date";
import { useSession } from "@/lib/use-session";
import { useAsync } from "@/lib/use-async";

/**
 * Quanto pagar pra cada barbeiro no período.
 *
 * A tela responde uma pergunta prática de fim de semana: "quanto sai da
 * gaveta hoje". Por isso o número grande é o total a pagar, e cada linha
 * abre mostrando de onde ele veio.
 *
 * A comissão incide só sobre serviço. Produto vendido junto aparece na
 * linha, mas fora da conta: o estoque é da barbearia, e a margem dele
 * também.
 */

function dinheiro(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

const HOJE = toISODate(new Date());

/** Períodos que a barbearia realmente usa pra fechar comissão. */
const PERIODOS = [
  { id: "semana", label: "Últimos 7 dias", de: () => addDays(HOJE, -6), ate: () => HOJE },
  { id: "quinzena", label: "Últimos 15 dias", de: () => addDays(HOJE, -14), ate: () => HOJE },
  { id: "mes", label: "Últimos 30 dias", de: () => addDays(HOJE, -29), ate: () => HOJE },
] as const;

export default function ComissoesPage() {
  const session = useSession();
  const dono = session?.role === "dono";

  const [periodo, setPeriodo] = useState<string>("semana");
  const [de, setDe] = useState(addDays(HOJE, -6));
  const [ate, setAte] = useState(HOJE);
  const [aberto, setAberto] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);

  const { dados, carregando, recarregar } = useAsync(
    async () => {
      const id = session!.barbeariaId;
      const [lancamentos, barbeiros, fechamentos] = await Promise.all([
        getLancamentos(id, de, ate),
        getBarbeiros(id),
        getFechamentos(id),
      ]);
      return { lancamentos, barbeiros, fechamentos };
    },
    [session?.barbeariaId, de, ate],
    { pular: !dono },
  );

  if (!session || !dono) return null;

  const barbeiros = (dados?.barbeiros ?? []).filter((b) => b.ativo);
  const linhas = calcularComissoes(dados?.lancamentos ?? [], barbeiros);
  const totais = totalizar(linhas);
  const fechamentos = dados?.fechamentos ?? [];

  // Sem percentual configurado a tela não tem o que calcular — é o primeiro
  // aviso que o dono precisa ver, antes de qualquer número.
  const semPercentual = barbeiros.filter((b) => !b.comissaoPercentual);

  function escolher(p: (typeof PERIODOS)[number]) {
    setPeriodo(p.id);
    setDe(p.de());
    setAte(p.ate());
    setMensagem(null);
  }

  async function fechar(linha: ComissaoBarbeiro) {
    if (linha.total <= 0) return;
    if (
      !window.confirm(
        `Registrar o pagamento de ${dinheiro(linha.total)} pra ${linha.nome}?\n\n` +
          `Período de ${de.split("-").reverse().join("/")} a ${ate
            .split("-")
            .reverse()
            .join("/")}.`,
      )
    ) {
      return;
    }

    setSalvando(linha.barbeiroId);
    setMensagem(null);
    const r = await registrarFechamento({
      barbeariaId: session!.barbeariaId,
      linha,
      de,
      ate,
    });
    setSalvando(null);

    if (!r.ok) setMensagem({ tipo: "erro", texto: r.error });
    else {
      setMensagem({ tipo: "ok", texto: `Comissão de ${linha.nome} marcada como paga.` });
      recarregar();
    }
  }

  return (
    <div>
      <p className="font-accent text-xs uppercase tracking-[0.2em] text-gold-bright">
        Comissões
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-bone">
        Quanto pagar pra equipe
      </h1>
      <p className="mt-1 max-w-xl font-body text-sm text-bone-dim">
        A comissão é sobre o <strong className="text-bone">serviço</strong>, e só entra
        atendimento <strong className="text-bone">concluído</strong>. O que está
        confirmado mas ainda não aconteceu aparece como previsto — se a pessoa faltar,
        você não pagou por nada.
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

      {semPercentual.length > 0 && (
        <div className="mt-6 max-w-2xl rounded-2xl border border-warn-line bg-warn-soft p-5">
          <p className="font-display text-base font-semibold text-bone">
            {semPercentual.length === barbeiros.length
              ? "Nenhum percentual configurado ainda"
              : `${semPercentual.length} barbeiro(s) sem percentual`}
          </p>
          <p className="mt-1 font-body text-sm text-bone-dim">
            Enquanto o percentual for zero, a comissão dá zero.{" "}
            {semPercentual.map((b) => b.nome).join(", ")}.
          </p>
          <Link
            href="/painel/barbeiros"
            className="mt-3 inline-block rounded-full bg-gold-bright px-5 py-2 font-body text-xs font-semibold text-ink transition-transform hover:scale-105"
          >
            Configurar na equipe
          </Link>
        </div>
      )}

      {mensagem && (
        <p
          className={`mt-6 max-w-2xl rounded-xl border px-4 py-3 font-body text-sm ${
            mensagem.tipo === "ok"
              ? "border-ok-line bg-ok-soft text-ok"
              : "border-off-line bg-off-soft text-off"
          }`}
        >
          {mensagem.texto}
        </p>
      )}

      {/* ---------- Resumo ---------- */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-gold-bright/30 bg-gold-bright/[0.06] p-6">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-gold-bright">
            A pagar no período
          </p>
          <p className="mt-2 font-accent text-3xl text-bone">{dinheiro(totais.aPagar)}</p>
          <p className="mt-1 font-body text-xs text-bone-dim">
            {totais.atendimentos} atendimento(s) concluído(s)
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-ink-elev p-6">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-bone-dim">
            Produção da equipe
          </p>
          <p className="mt-2 font-accent text-3xl text-bone">{dinheiro(totais.producao)}</p>
          <p className="mt-1 font-body text-xs text-bone-dim">
            Serviços e produtos dos atendimentos concluídos
          </p>
        </div>

        <div className="rounded-2xl border border-ok-line bg-ok-soft p-6">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-ok">
            Fica com a barbearia
          </p>
          <p className="mt-2 font-accent text-3xl text-bone">{dinheiro(totais.liquido)}</p>
          <p className="mt-1 font-body text-xs text-bone-dim">
            {totais.previsto > 0
              ? `${dinheiro(totais.previsto)} de comissão ainda prevista`
              : "Depois de pagar as comissões"}
          </p>
        </div>
      </div>

      {/* ---------- Por barbeiro ---------- */}
      {carregando ? (
        <p className="mt-8 font-body text-sm text-bone-dim">Carregando…</p>
      ) : linhas.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-line bg-ink-elev px-6 py-10 text-center font-body text-sm text-muted">
          Nenhum barbeiro ativo na equipe.
        </p>
      ) : (
        <div className="mt-8 space-y-2">
          {linhas.map((l) => {
            const fechado = jaFechado(fechamentos, l.barbeiroId, de, ate);
            const expandido = aberto === l.barbeiroId;

            return (
              <div
                key={l.barbeiroId}
                className="overflow-hidden rounded-2xl border border-line bg-ink-elev"
              >
                <button
                  onClick={() => setAberto(expandido ? null : l.barbeiroId)}
                  className="flex w-full flex-wrap items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-bone/[0.02]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-body text-sm font-semibold text-bone">
                      {l.nome}
                      {fechado && (
                        <span className="ml-2 rounded-full border border-ok-line bg-ok-soft px-2 py-0.5 font-body text-[10px] text-ok">
                          pago
                        </span>
                      )}
                    </p>
                    <p className="font-body text-xs text-muted">
                      {l.atendimentos} atendimento(s) · {l.percentualServicos}% sobre serviço
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-accent text-xl text-gold-bright">
                      {dinheiro(l.total)}
                    </p>
                    <p className="font-body text-[11px] text-muted">
                      de {dinheiro(l.baseServicos)} em serviço
                    </p>
                  </div>
                </button>

                {expandido && (
                  <div className="border-t border-line px-5 py-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="font-body text-xs font-medium uppercase tracking-wide text-muted">
                          Serviços prestados
                        </p>
                        <p className="mt-1 font-body text-sm text-bone-dim">
                          {dinheiro(l.baseServicos)} × {l.percentualServicos}% ={" "}
                          <span className="text-bone">{dinheiro(l.total)}</span>
                        </p>
                      </div>
                      <div>
                        <p className="font-body text-xs font-medium uppercase tracking-wide text-muted">
                          Produtos vendidos
                        </p>
                        <p className="mt-1 font-body text-sm text-bone-dim">
                          {dinheiro(l.baseProdutos)}{" "}
                          <span className="text-muted">— não entra na comissão</span>
                        </p>
                      </div>
                    </div>

                    {l.previsto > 0 && (
                      <p className="mt-4 rounded-lg border border-warn-line bg-warn-soft px-3 py-2 font-body text-xs text-warn">
                        Mais {dinheiro(l.previsto)} previstos em atendimentos confirmados
                        que ainda não aconteceram.
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      {fechado ? (
                        <p className="font-body text-xs text-ok">
                          Pago em{" "}
                          {new Date(fechado.pagoEm).toLocaleDateString("pt-BR")} —{" "}
                          {dinheiro(fechado.valor)}
                        </p>
                      ) : (
                        <button
                          onClick={() => fechar(l)}
                          disabled={l.total <= 0 || salvando === l.barbeiroId}
                          className="rounded-full bg-gold-bright px-5 py-2 font-body text-xs font-semibold text-ink transition-transform hover:scale-105 disabled:opacity-40"
                        >
                          {salvando === l.barbeiroId
                            ? "Registrando…"
                            : "Registrar como paga"}
                        </button>
                      )}
                      <p className="font-body text-[11px] text-muted">
                        Registrar não move dinheiro — é a anotação de que você pagou.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ---------- Histórico ---------- */}
      {fechamentos.length > 0 && (
        <div className="mt-10">
          <h2 className="font-display text-xl font-semibold text-bone">
            Comissões já pagas
          </h2>
          <div className="mt-4 space-y-1.5">
            {fechamentos.slice(0, 12).map((f) => {
              const barbeiro = barbeiros.find((b) => b.id === f.barbeiroId);
              return (
                <div
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-ink-elev px-4 py-2.5 font-body text-xs"
                >
                  <span className="text-bone-dim">
                    {barbeiro?.nome ?? "Barbeiro removido"}
                    <span className="text-muted">
                      {" "}
                      · {f.periodoDe.split("-").reverse().join("/")} a{" "}
                      {f.periodoAte.split("-").reverse().join("/")}
                    </span>
                  </span>
                  <span className="text-bone">{dinheiro(f.valor)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
