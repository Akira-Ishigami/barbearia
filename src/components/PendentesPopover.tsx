"use client";

import { useEffect, useRef, useState } from "react";
import { cancelarAgendamento, confirmarAgendamento, getAgendamentos } from "@/lib/db";
import { useAsync } from "@/lib/use-async";
import { formatDayLabel } from "@/lib/date";
import { METODO_LABEL, type Agendamento } from "@/lib/types";
import { agruparEmVisitas } from "@/lib/agrupar";

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
  const ref = useRef<HTMLDivElement>(null);

  // A lista só é buscada quando o popover abre — não faz sentido carregar
  // agendamento a cada render só pra manter um contador.
  const { dados, recarregar } = useAsync(
    () => getAgendamentos(barbeariaId),
    [barbeariaId],
    { pular: !open },
  );

  const pendentesDoBanco: Agendamento[] = (dados ?? []).filter(
    (a) => a.status === "pendente" && (!barbeiroId || a.barbeiroId === barbeiroId),
  );
  // Um cliente que marcou corte + barba são duas linhas no banco, mas uma
  // visita só — vira um card com um par de botões.
  const itens = agruparEmVisitas(pendentesDoBanco);

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

  // A visita é aceita ou recusada inteira: não faz sentido confirmar o corte
  // e deixar a barba do mesmo cliente pendurada.
  async function aceitar(ids: string[]) {
    await Promise.all(ids.map((id) => confirmarAgendamento(id)));
    recarregar();
  }

  async function rejeitar(ids: string[]) {
    await Promise.all(ids.map((id) => cancelarAgendamento(id)));
    recarregar();
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
          // No desktop passa da largura da barra de propósito: cabe o nome do
          // cliente e o total sem cortar nenhum dos dois.
          className={`absolute left-0 right-0 z-50 max-h-80 overflow-y-auto rounded-xl border border-line-strong bg-ink-elev p-2 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.9)] md:right-auto md:w-80 ${
            direction === "up" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {itens.length === 0 ? (
            <p className="px-3 py-6 text-center font-body text-xs text-muted">
              Nenhum agendamento aguardando confirmação.
            </p>
          ) : (
            itens.map((v) => (
              <div
                key={v.chave}
                className="rounded-lg border border-warn-line bg-warn-soft px-3 py-2.5 [&+&]:mt-2"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="min-w-0 truncate font-body text-sm text-bone">
                    {v.clienteNome}
                  </p>
                  <span className="shrink-0 font-accent text-[11px] text-bone-dim">
                    R$ {v.total.toFixed(2).replace(".", ",")}
                  </span>
                </div>
                <p className="font-body text-[11px] text-bone-dim">
                  {formatDayLabel(v.data)} · {v.hora} · {v.servicos.join(" + ")}
                </p>
                <p
                  className={`font-body text-[11px] ${
                    v.formaPagamento === "pix_direto" ? "text-warn" : "text-muted"
                  }`}
                >
                  {v.formaPagamento === "online"
                    ? `pago via ${v.metodoPagamento ? METODO_LABEL[v.metodoPagamento] : "online"}`
                    : v.formaPagamento === "pix_direto"
                      ? // Aqui o dono precisa conferir o extrato antes de
                        // confirmar — o sistema não tem como saber sozinho.
                        "Pix na sua chave · confira o extrato antes de confirmar"
                      : "paga no local"}
                </p>
                {v.produtos.length > 0 && (
                  <p className="font-body text-[11px] text-cyan-bright">
                    + {v.produtos.map((p) => p.produtoNome).join(", ")}
                  </p>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => aceitar(v.ids)}
                    className={`flex-1 rounded-md px-2 py-1.5 font-body text-[11px] font-semibold text-ink transition-transform hover:scale-[1.02] ${
                      accent === "gold" ? "bg-gold-bright" : "bg-cyan-bright"
                    }`}
                  >
                    Aceitar
                  </button>
                  <button
                    onClick={() => rejeitar(v.ids)}
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
