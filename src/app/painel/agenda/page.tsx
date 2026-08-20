"use client";

import { useState } from "react";
import {
  cancelarAgendamento,
  confirmarAgendamento,
  getAgendamentos,
  getBarbearia,
  getBarbeiros,
} from "@/lib/db";
import { useSession } from "@/lib/use-session";
import { useAsync } from "@/lib/use-async";
import { WeekAgenda } from "@/components/WeekAgenda";

export default function AgendaPage() {
  const session = useSession();
  const [filtroBarbeiro, setFiltroBarbeiro] = useState<string>("todos");
  const dono = session?.role === "dono";

  const { dados, carregando, recarregar } = useAsync(
    async () => {
      const id = session!.barbeariaId;
      const [barbearia, barbeiros, agendamentos] = await Promise.all([
        getBarbearia(id),
        getBarbeiros(id),
        getAgendamentos(id),
      ]);
      return { barbearia, barbeiros, agendamentos };
    },
    [session?.barbeariaId],
    { pular: !dono },
  );

  if (!session || !dono) return null;

  const barbearia = dados?.barbearia;
  const barbeiros = dados?.barbeiros ?? [];
  const agendamentos = (dados?.agendamentos ?? []).filter(
    (a) =>
      a.status !== "cancelado" &&
      (filtroBarbeiro === "todos" || a.barbeiroId === filtroBarbeiro),
  );

  async function handleConfirmar(id: string) {
    await confirmarAgendamento(id);
    recarregar();
  }

  async function handleCancelar(id: string) {
    await cancelarAgendamento(id);
    recarregar();
  }

  return (
    <div>
      <p className="font-accent text-xs uppercase tracking-[0.2em] text-gold-bright">
        Agenda
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-bone">
        Agenda da semana
      </h1>
      <p className="mt-1 font-body text-sm text-bone-dim">
        Horários com cliente marcado, semana a semana — filtre por barbeiro
        pra ver a agenda individual.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => setFiltroBarbeiro("todos")}
          className={`rounded-full border px-4 py-1.5 font-body text-xs transition-colors ${
            filtroBarbeiro === "todos"
              ? "border-gold-bright/50 bg-gold-bright/10 text-gold-bright"
              : "border-line text-bone-dim hover:border-line-strong"
          }`}
        >
          Todos
        </button>
        {barbeiros.map((b) => (
          <button
            key={b.id}
            onClick={() => setFiltroBarbeiro(b.id)}
            className={`rounded-full border px-4 py-1.5 font-body text-xs transition-colors ${
              filtroBarbeiro === b.id
                ? "border-gold-bright/50 bg-gold-bright/10 text-gold-bright"
                : "border-line text-bone-dim hover:border-line-strong"
            }`}
          >
            {b.nome}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {carregando && !barbearia ? (
          <p className="rounded-2xl border border-dashed border-line-strong px-4 py-12 text-center font-body text-sm text-bone-dim">
            Carregando a agenda…
          </p>
        ) : barbearia ? (
          <WeekAgenda
            barbearia={barbearia}
            agendamentos={agendamentos}
            barbeiros={filtroBarbeiro === "todos" ? barbeiros : []}
            accent="gold"
            onConfirmar={handleConfirmar}
            onCancelar={handleCancelar}
          />
        ) : null}
      </div>
    </div>
  );
}
