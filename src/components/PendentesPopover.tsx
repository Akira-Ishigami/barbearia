"use client";

import { useEffect, useRef, useState } from "react";
import { cancelarAgendamento, confirmarAgendamento, getAgendamentos } from "@/lib/mock-db";
import { formatDayLabel } from "@/lib/date";
import { METODO_LABEL, type Agendamento } from "@/lib/types";

/**
 * Sino de pendentes: fica no painel inteiro, então dá pra aceitar ou rejeitar
 * um agendamento de qualquer tela, sem precisar voltar pra Visão geral.
 */
export function PendentesPopover({
  barbeariaId,
  barbeiroId,
  pendentes,
  flash,
  direction = "down",
  accent = "gold",
}: {
  barbeariaId: string;
  /** Passe pra listar só os pendentes desse barbeiro. */
  barbeiroId?: string;
  pendentes: number;
  flash: boolean;
  direction?: "down" | "up";
  accent?: "gold" | "cyan";
}) {
  const [open, setOpen] = useState(false);
  // Contador local só pra forçar releitura depois de aceitar/rejeitar; a lista
  // em si é lida direto no render, sem espelhar o mock-db em estado.
  const [, forceRefresh] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const itens: Agendamento[] = open
    ? getAgendamentos(barbeariaId).filter(
        (a) => a.status === "pendente" && (!barbeiroId || a.barbeiroId === barbeiroId),
      )
    : [];

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  function aceitar(id: string) {
    confirmarAgendamento(id);
    forceRefresh((k) => k + 1);
  }

  function rejeitar(id: string) {
    cancelarAgendamento(id);
    forceRefresh((k) => k + 1);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`${pendentes} agendamento(s) aguardando confirmação`}
        className={`relative flex h-10 w-full items-center justify-center gap-2 rounded-lg border px-3 font-body text-sm transition-colors ${
          pendentes > 0
            ? "border-warn-line bg-warn-soft text-warn hover:bg-warn-soft"
            : "border-line-strong text-bone-dim hover:text-bone"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        <span>Pendentes</span>
        {pendentes > 0 && (
          <span
            className={`ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-warn px-1 font-accent text-[11px] font-semibold text-ink ${
              flash ? "pulse-badge" : ""
            }`}
          >
            {pendentes}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute left-0 right-0 z-50 max-h-80 overflow-y-auto rounded-xl border border-line-strong bg-ink-elev p-2 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.9)] md:w-72 ${
            direction === "up" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {itens.length === 0 ? (
            <p className="px-3 py-6 text-center font-body text-xs text-muted">
              Nenhum agendamento aguardando confirmação.
            </p>
          ) : (
            itens.map((a) => (
              <div
                key={a.id}
                className="rounded-lg border border-warn-line bg-warn-soft px-3 py-2.5 [&+&]:mt-2"
              >
                <p className="font-body text-sm text-bone">{a.clienteNome}</p>
                <p className="font-body text-[11px] text-bone-dim">
                  {formatDayLabel(a.data)} · {a.hora} · {a.servicoNome}
                </p>
                <p className="font-body text-[11px] text-muted">
                  {a.formaPagamento === "online"
                    ? `pago via ${a.metodoPagamento ? METODO_LABEL[a.metodoPagamento] : "online"}`
                    : "paga no local"}
                </p>
                {a.produtosComprados && a.produtosComprados.length > 0 && (
                  <p className="font-body text-[11px] text-cyan-bright">
                    + {a.produtosComprados.map((p) => p.produtoNome).join(", ")}
                  </p>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => aceitar(a.id)}
                    className={`flex-1 rounded-md px-2 py-1.5 font-body text-[11px] font-semibold text-ink transition-transform hover:scale-[1.02] ${
                      accent === "gold" ? "bg-gold-bright" : "bg-cyan-bright"
                    }`}
                  >
                    Aceitar
                  </button>
                  <button
                    onClick={() => rejeitar(a.id)}
                    className="flex-1 rounded-md border border-line-strong px-2 py-1.5 font-body text-[11px] text-bone-dim hover:border-off-line hover:text-off"
                  >
                    Rejeitar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
