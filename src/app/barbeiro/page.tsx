"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  cancelarAgendamento,
  confirmarAgendamento,
  getAgendamentosPorBarbeiro,
  getBarbeariaById,
  getBarbeiros,
  logout,
} from "@/lib/mock-db";
import { useSession } from "@/lib/use-session";
import { usePendingAlerts } from "@/lib/use-pending-alerts";
import { WeekAgenda } from "@/components/WeekAgenda";
import { PendentesPopover } from "@/components/PendentesPopover";

export default function PainelBarbeiroPage() {
  const router = useRouter();
  const session = useSession();
  const [, forceRefresh] = useState(0);

  const perfil =
    session?.role === "barbeiro"
      ? getBarbeiros(session.barbeariaId).find((b) => b.usuarioId === session.userId)
      : undefined;
  const { pendentes, flash } = usePendingAlerts(
    session?.role === "barbeiro" ? session.barbeariaId : undefined,
    perfil?.id,
  );

  useEffect(() => {
    if (session === null) {
      router.replace("/login");
    } else if (session.role !== "barbeiro") {
      router.replace("/painel");
    }
  }, [session, router]);

  if (!session || session.role !== "barbeiro") {
    return <div className="flex flex-1 items-center justify-center bg-ink" />;
  }

  const barbearia = getBarbeariaById(session.barbeariaId);
  // Cancelados não aparecem mais na agenda do dia a dia.
  const agenda = perfil
    ? getAgendamentosPorBarbeiro(perfil.id).filter((a) => a.status !== "cancelado")
    : [];

  function handleConfirmar(id: string) {
    confirmarAgendamento(id);
    forceRefresh((k) => k + 1);
  }

  function handleCancelar(id: string) {
    cancelarAgendamento(id);
    forceRefresh((k) => k + 1);
  }

  return (
    <div className="grain flex flex-1 flex-col bg-ink">
      {flash && (
        <div className="animate-toast-in fixed left-1/2 top-4 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-400/40 bg-[#1a1408] px-4 py-2.5 shadow-[0_0_30px_-8px_rgba(251,191,36,0.6)]">
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span className="font-body text-sm font-medium text-amber-200">
            Novo agendamento aguardando confirmação
          </span>
        </div>
      )}

      <header className="flex items-center justify-between border-b border-line px-6 py-4 md:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan/40 bg-cyan/10 text-cyan-bright">
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
          <span className="font-display text-lg font-semibold text-bone">
            Navalha
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-40">
            <PendentesPopover
              barbeariaId={session.barbeariaId}
              barbeiroId={perfil?.id}
              pendentes={pendentes}
              flash={flash}
              accent="cyan"
            />
          </div>
          <button
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="rounded-full border border-line-strong px-4 py-2 font-body text-xs text-bone-dim hover:border-cyan-bright/40 hover:text-cyan-bright"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <p className="font-accent text-xs uppercase tracking-[0.2em] text-cyan-bright">
          Painel do barbeiro
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-bone">
          Olá, {session.nome.split(" ")[0]}
        </h1>
        <p className="mt-1 font-body text-sm text-bone-dim">
          {session.barbeariaNome} — sua agenda da semana
        </p>

        {barbearia && (
          <div className="mt-8">
            <WeekAgenda
              barbearia={barbearia}
              agendamentos={agenda}
              barbeiros={[]}
              accent="cyan"
              onConfirmar={handleConfirmar}
              onCancelar={handleCancelar}
            />
          </div>
        )}
      </main>
    </div>
  );
}
