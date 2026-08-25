"use client";

import { useState, type FormEvent } from "react";
import { useAsync } from "@/lib/use-async";
import { cabecalhosPlataforma, usePlataforma } from "@/lib/use-plataforma";
import { BarrasSemana, Numero, quando, type Semana } from "@/components/adm/Painel";

/**
 * Quem agenda — os clientes das barbearias.
 *
 * O topo é contagem, que é o que a Navalha precisa saber: a base cresce?
 * as pessoas voltam? A lista embaixo vem mascarada de propósito — serve pra
 * confirmar que é a pessoa certa quando ela liga, não pra virar uma base de
 * contatos. Em qual barbearia ela foi atendida não aparece: isso é a agenda
 * dela com a barbearia, não métrica de plataforma.
 */

interface Resposta {
  resumo: {
    total: number;
    comConta: number;
    semConta: number;
    agendaram: number;
    voltaram: number;
    ativosEm30: number;
    novosEm7Dias: number;
    novosEm30Dias: number;
    taxaRetorno: number | null;
    mediaVisitas: number;
  };
  semanas: Semana[];
  lista: {
    id: string;
    nome: string;
    email: string;
    telefone: string;
    temConta: boolean;
    criadoEm: string;
    visitas: number;
    ultimaVisita: string | null;
  }[];
  naLista: number;
  totalFiltrado: number;
  busca: string;
}

export default function AdmClientesPage() {
  const acesso = usePlataforma();
  const [campo, setCampo] = useState("");
  const [busca, setBusca] = useState("");

  const { dados: d, carregando, erro } = useAsync<Resposta>(
    async () => {
      const url = busca
        ? `/api/adm/clientes?busca=${encodeURIComponent(busca)}`
        : "/api/adm/clientes";
      const r = await fetch(url, { headers: await cabecalhosPlataforma() });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro ?? "Falha ao carregar.");
      return r.json();
    },
    [acesso?.email, busca],
    { pular: !acesso },
  );

  if (!acesso) return null;

  function procurar(e: FormEvent) {
    e.preventDefault();
    setBusca(campo.trim());
  }

  const r = d?.resumo;

  return (
    <div>
      <p className="font-accent text-xs uppercase tracking-[0.2em] text-cyan-bright">
        Plataforma
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-bone">
        Quem agenda
      </h1>
      <p className="mt-1 max-w-xl font-body text-sm text-bone-dim">
        Os clientes das barbearias. O que interessa aqui é se a base cresce e se
        as pessoas voltam — não quem elas são.
      </p>

      {erro && (
        <p className="mt-6 rounded-xl border border-off-line bg-off-soft px-4 py-3 font-body text-sm text-off">
          {erro}
        </p>
      )}
      {carregando && !d && <p className="mt-6 font-body text-sm text-bone-dim">Carregando…</p>}

      {d && r && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Numero
              tom="cyan"
              titulo="Contas de cliente"
              valor={String(r.total)}
              detalhe={`+${r.novosEm7Dias} nesta semana · +${r.novosEm30Dias} em 30 dias`}
            />
            <Numero
              tom="ok"
              titulo="Voltam a agendar"
              valor={r.taxaRetorno === null ? "—" : `${r.taxaRetorno}%`}
              detalhe={
                r.agendaram === 0
                  ? "Ninguém agendou ainda"
                  : `${r.voltaram} de ${r.agendaram} que agendaram voltaram`
              }
            />
            <Numero
              titulo="Ativos em 30 dias"
              valor={String(r.ativosEm30)}
              detalhe="Agendaram pelo menos uma vez no período"
            />
            <Numero
              titulo="Média de visitas"
              valor={String(r.mediaVisitas)}
              detalhe="Por cliente que já agendou"
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-line bg-ink-elev p-5">
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-bone-dim">
                Agendam com conta?
              </p>
              <p className="mt-1 font-body text-[11px] text-muted">
                Dá pra marcar sem criar conta — a conta só guarda o histórico.
              </p>
              <div className="mt-4 space-y-2">
                {(
                  [
                    ["Com conta", r.comConta, "bg-cyan"],
                    ["Sem conta", r.semConta, "bg-bone/30"],
                  ] as const
                ).map(([label, qtd, cor]) => {
                  const pct = r.total ? Math.round((qtd / r.total) * 100) : 0;
                  return (
                    <div key={label}>
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

            <BarrasSemana
              titulo="Contas novas"
              semanas={d.semanas}
              campo="cadastros"
              formatar={(v) => String(v)}
            />
            <BarrasSemana
              titulo="Agendamentos"
              semanas={d.semanas}
              campo="pedidos"
              formatar={(v) => String(v)}
            />
          </div>

          {/* ---------- Lista ---------- */}
          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold text-bone">
              Procurar uma pessoa
            </h2>
            <p className="mt-1 max-w-2xl font-body text-xs text-muted">
              Os dados aparecem parcialmente escondidos: dá pra conferir que é a
              pessoa certa quando ela liga, não pra copiar uma base de contatos.
              Pra achar alguém específico, digite o e-mail inteiro ou o telefone —
              busca por pedaço não devolve nada, e toda busca fica registrada.
            </p>

            <form onSubmit={procurar} className="mt-4 flex flex-wrap gap-2">
              <input
                value={campo}
                onChange={(e) => setCampo(e.target.value)}
                placeholder="e-mail completo ou telefone"
                className="min-w-56 flex-1 rounded-full border border-line-strong bg-bone/[0.03] px-4 py-2.5 font-body text-sm text-bone outline-none placeholder:text-muted focus:border-cyan"
              />
              <button
                type="submit"
                className="rounded-full bg-cyan px-5 py-2.5 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.02]"
              >
                Procurar
              </button>
              {busca && (
                <button
                  type="button"
                  onClick={() => {
                    setCampo("");
                    setBusca("");
                  }}
                  className="rounded-full border border-line-strong px-5 py-2.5 font-body text-sm text-bone-dim hover:text-bone"
                >
                  Limpar
                </button>
              )}
            </form>

            {busca && (
              <p className="mt-3 font-body text-xs text-bone-dim">
                {d.totalFiltrado === 0
                  ? "Ninguém com esse e-mail ou telefone."
                  : `${d.totalFiltrado} resultado(s).`}
              </p>
            )}

            <div className="mt-4 space-y-1.5">
              {d.lista.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-ink-elev px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-body text-sm text-bone">
                      {c.nome}
                      {!c.temConta && (
                        <span className="ml-2 rounded-full border border-line-strong px-1.5 py-0.5 font-body text-[10px] text-muted">
                          sem conta
                        </span>
                      )}
                    </p>
                    <p className="truncate font-accent text-[11px] text-muted">
                      {c.email} · {c.telefone}
                    </p>
                  </div>
                  <div className="shrink-0 text-right font-body text-[11px]">
                    <p className="text-bone-dim">
                      {c.visitas === 0
                        ? "nunca agendou"
                        : `${c.visitas} visita${c.visitas > 1 ? "s" : ""}`}
                    </p>
                    <p className="text-muted">
                      {c.ultimaVisita
                        ? `última ${quando(c.ultimaVisita)}`
                        : `entrou ${quando(c.criadoEm)}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {!busca && d.totalFiltrado > d.naLista && (
              <p className="mt-3 font-body text-xs text-muted">
                Mostrando os {d.naLista} mais recentes de {d.totalFiltrado}. A lista
                não carrega a base inteira de propósito — pra achar alguém, use a
                busca.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
