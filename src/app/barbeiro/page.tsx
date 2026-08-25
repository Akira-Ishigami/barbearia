"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  cancelarAgendamento,
  concluirAgendamento,
  confirmarAgendamento,
  getAgendamentosPorBarbeiro,
  getBarbearia,
  getBarbeiros,
} from "@/lib/db";
import { sair, useSession } from "@/lib/use-session";
import { useAsync } from "@/lib/use-async";
import { usePendingAlerts } from "@/lib/use-pending-alerts";
import { useTheme, themeClass } from "@/lib/use-theme";
import { addDays, formatDayLabel, toISODate } from "@/lib/date";
import { WeekAgenda } from "@/components/WeekAgenda";
import { PendentesPopover } from "@/components/PendentesPopover";
import { ThemeToggle } from "@/components/ThemeToggle";
import { METODO_LABEL, type Agendamento } from "@/lib/types";

const STATUS_LABEL: Record<Agendamento["status"], string> = {
  aguardando_pagamento: "Pagamento não concluído",
  pendente: "Aguardando confirmação",
  confirmado: "Confirmado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const STATUS_CLASS: Record<Agendamento["status"], string> = {
  aguardando_pagamento: "bg-bone/5 text-muted",
  pendente: "bg-warn-soft text-warn",
  confirmado: "bg-ok-soft text-ok",
  concluido: "bg-bone/5 text-muted",
  cancelado: "bg-off-soft text-off",
};

function dinheiro(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

export default function PainelBarbeiroPage() {
  const router = useRouter();
  const session = useSession();
  const theme = useTheme();
  const [aba, setAba] = useState<"hoje" | "semana">("hoje");
  const ehBarbeiro = session?.role === "barbeiro";

  const { dados, recarregar } = useAsync(
    async () => {
      const id = session!.barbeariaId;
      const [barbearia, equipe] = await Promise.all([getBarbearia(id), getBarbeiros(id)]);
      const perfil = equipe.find((b) => b.usuarioId === session!.userId);
      const agenda = perfil ? await getAgendamentosPorBarbeiro(perfil.id) : [];
      return { barbearia, perfil, agenda };
    },
    [session?.barbeariaId, session?.userId],
    { pular: !ehBarbeiro },
  );

  const perfil = dados?.perfil;
  const { pendentes, flash } = usePendingAlerts(
    ehBarbeiro ? session!.barbeariaId : undefined,
    perfil?.id,
  );

  useEffect(() => {
    if (session === null) {
      router.replace("/login");
    } else if (session && session.role !== "barbeiro") {
      router.replace("/painel");
    }
  }, [session, router]);

  if (!session || !ehBarbeiro) {
    return <div className={`${themeClass(theme)} flex flex-1 items-center justify-center bg-ink`} />;
  }

  const barbearia = dados?.barbearia;
  // Cancelados não aparecem na agenda do dia a dia.
  const agenda = (dados?.agenda ?? []).filter((a) => a.status !== "cancelado");

  const hoje = toISODate(new Date());
  const amanha = addDays(hoje, 1);
  const doDia = agenda.filter((a) => a.data === hoje);
  const deAmanha = agenda.filter((a) => a.data === amanha);
  const agoraHora = new Date().toTimeString().slice(0, 5);

  const aFazer = doDia.filter((a) => a.status === "pendente" || a.status === "confirmado");
  const concluidosHoje = doDia.filter((a) => a.status === "concluido");

  // ---------- Comissão do mês ----------
  // Mesma regra da tela do dono: só conta atendimento concluído. Mostrar
  // o confirmado aqui daria um número que encolhe quando o cliente falta,
  // e ninguém gosta de ver o próprio ganho diminuir.
  const pctServicos = perfil?.comissaoPercentual ?? 0;
  const temComissao = pctServicos > 0;

  const mesAtual = hoje.slice(0, 7);
  const concluidosNoMes = agenda.filter(
    (a) => a.status === "concluido" && a.data.startsWith(mesAtual),
  );
  // Só serviço: produto vendido no balcão é da barbearia, que comprou o
  // estoque — a margem dele não entra na comissão.
  const baseServicosMes = concluidosNoMes.reduce((s, a) => s + a.preco, 0);
  const comissaoMes = (baseServicosMes * pctServicos) / 100;
  const ganhoHoje = doDia
    .filter((a) => a.status !== "pendente")
    .reduce((sum, a) => sum + a.preco, 0);
  const proximo = doDia.find((a) => a.status === "confirmado" && a.hora >= agoraHora);

  async function handleConfirmar(id: string) {
    await confirmarAgendamento(id);
    recarregar();
  }

  async function handleCancelar(id: string) {
    await cancelarAgendamento(id);
    recarregar();
  }

  async function handleConcluir(id: string) {
    await concluirAgendamento(id, session!.barbeariaId);
    recarregar();
  }

  return (
    <div className={`${themeClass(theme)} grain flex flex-1 flex-col bg-ink`}>
      {flash && (
        <div className="animate-toast-in fixed left-1/2 top-4 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full border border-warn-line bg-warn-solid px-4 py-2.5 shadow-lg">
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-warn" />
          <span className="font-body text-sm font-medium text-warn">
            Novo agendamento aguardando confirmação
          </span>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-3.5">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan/40 bg-cyan/10 text-cyan-bright">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.5 8.5l11 11M20 4 8.5 15.5" />
              </svg>
            </span>
            <span className="truncate font-display text-base font-semibold text-bone">
              {session.barbeariaNome}
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden w-40 sm:block">
              <PendentesPopover
                barbeariaId={session.barbeariaId}
                barbeiroId={perfil?.id}
                pendentes={pendentes}
                flash={flash}
                accent="cyan"
              />
            </div>
            <ThemeToggle compact />
            <button
              onClick={async () => {
                await sair();
                router.push("/login");
              }}
              className="rounded-lg border border-line-strong px-3.5 py-2 font-body text-xs text-bone-dim transition-colors hover:border-cyan-bright/40 hover:text-cyan-bright"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <p className="font-accent text-xs uppercase tracking-[0.2em] text-cyan-bright">
          Painel do barbeiro
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-bone">
          Olá, {session.nome.split(" ")[0]}
        </h1>
        <p className="mt-1 font-body text-sm text-bone-dim">
          {proximo
            ? `Seu próximo cliente é ${proximo.clienteNome}, às ${proximo.hora}.`
            : aFazer.length > 0
              ? "Você ainda tem atendimentos hoje."
              : "Nada mais na agenda de hoje."}
        </p>

        {/* NÚMEROS DO DIA */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Hoje", String(doDia.length), "atendimentos"],
            ["A fazer", String(aFazer.length), "restantes"],
            ["Concluídos", String(concluidosHoje.length), "hoje"],
            ["Faturamento", dinheiro(ganhoHoje), "do dia"],
          ].map(([label, valor, sub]) => (
            <div key={label} className="rounded-2xl border border-line bg-ink-elev/60 p-4">
              <p className="font-body text-[11px] uppercase tracking-wide text-muted">{label}</p>
              <p className="mt-1 font-accent text-xl text-bone">{valor}</p>
              <p className="font-body text-[11px] text-muted">{sub}</p>
            </div>
          ))}
        </div>

        {/* COMISSÃO DO MÊS */}
        {temComissao && (
          <div className="mt-4 rounded-2xl border border-cyan/30 bg-cyan/[0.06] p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-body text-xs font-semibold uppercase tracking-wide text-cyan-bright">
                  Sua comissão neste mês
                </p>
                <p className="mt-1.5 font-accent text-3xl text-bone">
                  {dinheiro(comissaoMes)}
                </p>
                <p className="mt-1 font-body text-xs text-bone-dim">
                  {concluidosNoMes.length} atendimento(s) concluído(s) ·{" "}
                  {dinheiro(baseServicosMes)} em serviço
                </p>
              </div>
              <div className="font-body text-xs text-muted">
                <p>{pctServicos}% sobre serviço</p>
              </div>
            </div>
            <p className="mt-3 font-body text-[11px] text-muted">
              Só entra o que você já concluiu. Quem confirma o pagamento é a barbearia.
            </p>
          </div>
        )}

        {/* ABAS */}
        <div className="mt-8 flex gap-1 rounded-xl border border-line-strong p-1">
          {(
            [
              ["hoje", "Hoje"],
              ["semana", "Semana"],
            ] as const
          ).map(([valor, label]) => (
            <button
              key={valor}
              onClick={() => setAba(valor)}
              className={`flex-1 rounded-lg px-4 py-2 font-body text-sm font-medium transition-colors ${
                aba === valor ? "bg-cyan-bright text-ink" : "text-bone-dim hover:text-bone"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {aba === "hoje" ? (
          <div className="mt-6 space-y-8">
            <section>
              <h2 className="font-display text-lg font-semibold text-bone">
                Agenda de hoje
              </h2>
              {doDia.length === 0 ? (
                <p className="mt-3 rounded-2xl border border-dashed border-line-strong px-4 py-10 text-center font-body text-sm text-bone-dim">
                  Nenhum cliente marcado pra hoje.
                </p>
              ) : (
                <div className="mt-3 space-y-2.5">
                  {doDia.map((a) => (
                    <div
                      key={a.id}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 ${
                        a.status === "pendente"
                          ? "border-warn-line bg-warn-soft"
                          : "border-line bg-ink-elev/60"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <span
                          className={`font-accent text-base ${
                            a.status === "concluido" ? "text-muted" : "text-cyan-bright"
                          }`}
                        >
                          {a.hora}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-body text-sm font-medium text-bone">
                            {a.clienteNome}
                          </p>
                          <p className="truncate font-body text-xs text-bone-dim">
                            {a.servicoNome} · {dinheiro(a.preco)}
                            {a.metodoPagamento && (
                              <span className="ml-1.5 rounded bg-ok-soft px-1.5 py-0.5 font-body text-[10px] font-medium text-ok">
                                {METODO_LABEL[a.metodoPagamento]} pago
                              </span>
                            )}
                          </p>
                          {a.clienteTelefone && (
                            <a
                              href={`tel:${a.clienteTelefone.replace(/\D/g, "")}`}
                              className="font-body text-[11px] text-cyan-bright hover:underline"
                            >
                              {a.clienteTelefone}
                            </a>
                          )}
                          {a.produtosComprados && a.produtosComprados.length > 0 && (
                            <p className="font-body text-[11px] text-cyan-bright">
                              Levar: {a.produtosComprados.map((p) => p.produtoNome).join(", ")}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {a.status === "pendente" && (
                          <>
                            <button
                              onClick={() => handleConfirmar(a.id)}
                              className="rounded-full bg-cyan-bright px-4 py-1.5 font-body text-xs font-semibold text-ink transition-transform hover:scale-[1.03]"
                            >
                              Aceitar
                            </button>
                            <button
                              onClick={() => handleCancelar(a.id)}
                              className="rounded-full border border-line-strong px-4 py-1.5 font-body text-xs text-bone-dim transition-colors hover:border-off-line hover:text-off"
                            >
                              Recusar
                            </button>
                          </>
                        )}
                        {a.status === "confirmado" && (
                          <button
                            onClick={() => handleConcluir(a.id)}
                            className="rounded-full border border-cyan-bright/50 px-4 py-1.5 font-body text-xs font-semibold text-cyan-bright transition-colors hover:bg-cyan-bright/10"
                          >
                            Concluir
                          </button>
                        )}
                        <span
                          className={`rounded-full px-3 py-1 font-body text-[11px] font-medium ${STATUS_CLASS[a.status]}`}
                        >
                          {STATUS_LABEL[a.status]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-bone">
                Amanhã · {formatDayLabel(amanha)}
              </h2>
              {deAmanha.length === 0 ? (
                <p className="mt-3 font-body text-sm text-bone-dim">
                  Nada marcado pra amanhã ainda.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {deAmanha.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-4 rounded-xl border border-line px-4 py-2.5"
                    >
                      <span className="font-accent text-sm text-bone-dim">{a.hora}</span>
                      <div className="min-w-0">
                        <p className="truncate font-body text-sm text-bone">{a.clienteNome}</p>
                        <p className="truncate font-body text-xs text-muted">{a.servicoNome}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          barbearia && (
            <div className="mt-6">
              <WeekAgenda
                barbearia={barbearia}
                agendamentos={agenda}
                barbeiros={[]}
                accent="cyan"
                onConfirmar={handleConfirmar}
                onCancelar={handleCancelar}
              />
            </div>
          )
        )}
      </main>
    </div>
  );
}
