"use client";

import { useState } from "react";
import {
  cancelarAgendamento,
  confirmarAgendamento,
  getAgendamentos,
  getBarbeariaById,
  getBarbeiros,
} from "@/lib/mock-db";
import { useSession } from "@/lib/use-session";
import { WeekAgenda } from "@/components/WeekAgenda";

export default function AgendaPage() {
  const session = useSession();
  const [filtroBarbeiro, setFiltroBarbeiro] = useState<string>("todos");
  const [, forceRefresh] = useState(0);

  if (!session || session.role !== "dono") return null;

  const barbearia = getBarbeariaById(session.barbeariaId);
  const barbeiros = getBarbeiros(session.barbeariaId);
  const agendamentos = getAgendamentos(session.barbeariaId).filter(
    (a) =>
      a.status !== "cancelado" &&
      (filtroBarbeiro === "todos" || a.barbeiroId === filtroBarbeiro),
  );

  if (!barbearia) return null;

  function handleConfirmar(id: string) {
    confirmarAgendamento(id);
    forceRefresh((k) => k + 1);
  }

  function handleCancelar(id: string) {
    cancelarAgendamento(id);
    forceRefresh((k) => k + 1);
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
        <WeekAgenda
          barbearia={barbearia}
          agendamentos={agendamentos}
          barbeiros={filtroBarbeiro === "todos" ? barbeiros : []}
          accent="gold"
          onConfirmar={handleConfirmar}
          onCancelar={handleCancelar}
        />
      </div>
    </div>
  );
}
