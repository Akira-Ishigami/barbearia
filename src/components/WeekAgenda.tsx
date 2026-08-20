"use client";

import { useState } from "react";
import {
  addDays,
  formatDayLabel,
  formatWeekRangeLabel,
  generateTimeSlots,
  startOfWeek,
  toISODate,
  weekDates,
  weekdayOf,
} from "@/lib/date";
import { WEEKDAYS } from "@/lib/types";
import type { Agendamento, Barbearia, BarbeiroPerfil } from "@/lib/types";

const STATUS_DOT: Record<Agendamento["status"], string> = {
  pendente: "border-amber-400/50 bg-amber-400/15 text-amber-200",
  confirmado: "",
  concluido: "border-line-strong bg-white/5 text-muted",
  cancelado: "",
};

export function WeekAgenda({
  barbearia,
  agendamentos,
  barbeiros,
  accent = "gold",
  onConfirmar,
  onCancelar,
}: {
  barbearia: Barbearia;
  agendamentos: Agendamento[];
  barbeiros: BarbeiroPerfil[];
  accent?: "gold" | "cyan";
  onConfirmar: (id: string) => void;
  onCancelar: (id: string) => void;
}) {
  const today = toISODate(new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));

  const dias = weekDates(weekStart, barbearia.diasFuncionamento);
  const horarios = generateTimeSlots(barbearia.horarioAbertura, barbearia.horarioFechamento);

  const accentText = accent === "gold" ? "text-gold-bright" : "text-cyan-bright";
  const accentBg = accent === "gold" ? "bg-gold-bright" : "bg-cyan-bright";
  const accentBorder = accent === "gold" ? "border-gold-bright/40" : "border-cyan-bright/40";
  const accentBgSoft = accent === "gold" ? "bg-gold-bright/10" : "bg-cyan-bright/10";

  function nomeBarbeiro(id: string) {
    return barbeiros.find((b) => b.id === id)?.nome ?? "";
  }

  function agendamentosNoSlot(data: string, hora: string) {
    return agendamentos.filter((a) => a.data === data && a.hora === hora);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            aria-label="Semana anterior"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong text-bone-dim hover:border-line-strong hover:text-bone"
          >
            ‹
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(today))}
            className="rounded-lg border border-line-strong px-3 py-1.5 font-body text-xs text-bone-dim hover:text-bone"
          >
            Hoje
          </button>
          <button
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            aria-label="Próxima semana"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong text-bone-dim hover:border-line-strong hover:text-bone"
          >
            ›
          </button>
        </div>
        <p className="font-accent text-sm text-bone-dim">
          {formatWeekRangeLabel(weekStart)}
        </p>
      </div>

      <div className="mt-4 max-h-[70vh] overflow-auto rounded-2xl border border-line bg-ink-elev/40">
        <div
          className="grid min-w-[640px]"
          style={{ gridTemplateColumns: `72px repeat(${dias.length}, minmax(120px, 1fr))` }}
        >
          {/* header row */}
          <div className="sticky left-0 top-0 z-30 border-b border-r border-line bg-ink-elev" />
          {dias.map((dia) => {
            const isToday = dia === today;
            const label = WEEKDAYS.find((w) => w.id === weekdayOf(dia))?.label ?? "";
            return (
              <div
                key={dia}
                className={`sticky top-0 z-20 border-b border-line bg-ink-elev px-2 py-2.5 text-center ${
                  isToday ? accentBgSoft : ""
                }`}
              >
                <p
                  className={`font-body text-[11px] uppercase tracking-wide ${
                    isToday ? accentText : "text-muted"
                  }`}
                >
                  {label}
                </p>
                <p className={`font-accent text-sm ${isToday ? accentText : "text-bone-dim"}`}>
                  {formatDayLabel(dia)}
                </p>
              </div>
            );
          })}

          {/* time rows */}
          {horarios.map((hora) => (
            <div key={hora} className="contents">
              <div className="sticky left-0 z-10 flex items-start justify-end border-r border-t border-line bg-ink-elev px-2 py-2 font-accent text-[11px] text-muted">
                {hora}
              </div>
              {dias.map((dia) => {
                const itens = agendamentosNoSlot(dia, hora);
                return (
                  <div
                    key={dia + hora}
                    className={`min-h-12 border-t border-line/60 px-1.5 py-1.5 ${
                      dia === today ? accentBgSoft : ""
                    }`}
                  >
                    {itens.map((a) => (
                      <div
                        key={a.id}
                        className={`mb-1 rounded-lg border px-2 py-1 last:mb-0 ${
                          a.status === "pendente"
                            ? STATUS_DOT.pendente
                            : a.status === "concluido"
                              ? STATUS_DOT.concluido
                              : `${accentBorder} ${accentBgSoft} ${accentText}`
                        }`}
                      >
                        <p className="truncate font-body text-xs font-medium">
                          {a.clienteNome}
                        </p>
                        {barbeiros.length > 1 && (
                          <p className="truncate font-body text-[10px] text-muted">
                            {nomeBarbeiro(a.barbeiroId)}
                          </p>
                        )}
                        {a.status === "pendente" && (
                          <div className="mt-1 flex gap-1">
                            <button
                              onClick={() => onConfirmar(a.id)}
                              title="Confirmar"
                              className={`flex h-5 w-5 items-center justify-center rounded ${accentBg} text-[10px] font-bold text-ink`}
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => onCancelar(a.id)}
                              title="Cancelar"
                              className="flex h-5 w-5 items-center justify-center rounded border border-line-strong text-[10px] text-bone-dim hover:border-rose-400/40 hover:text-rose-300"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
