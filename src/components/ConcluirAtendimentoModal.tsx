"use client";

import { useState } from "react";
import type { Agendamento, Produto } from "@/lib/types";

/**
 * Fecha o atendimento e, se o cliente levou produtos, já dá baixa no estoque —
 * é o que liga a agenda ao controle de estoque sem digitação dupla.
 */
export function ConcluirAtendimentoModal({
  agendamento,
  produtos,
  onClose,
  onConcluir,
}: {
  agendamento: Agendamento;
  produtos: Produto[];
  onClose: () => void;
  onConcluir: (vendidos: { produtoId: string; quantidade: number }[]) => void;
}) {
  const [qtds, setQtds] = useState<Record<string, number>>({});

  const disponiveis = produtos.filter((p) => p.ativo && p.estoque > 0);
  const vendidos = Object.entries(qtds)
    .filter(([, q]) => q > 0)
    .map(([produtoId, quantidade]) => ({ produtoId, quantidade }));

  const totalProdutos = vendidos.reduce((sum, v) => {
    const p = produtos.find((x) => x.id === v.produtoId);
    return sum + (p ? p.preco * v.quantidade : 0);
  }, 0);
  const total = agendamento.preco + totalProdutos;

  function ajustar(p: Produto, delta: number) {
    setQtds((prev) => {
      const atual = prev[p.id] ?? 0;
      const novo = Math.min(p.estoque, Math.max(0, atual + delta));
      return { ...prev, [p.id]: novo };
    });
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line-strong bg-ink-elev p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
      >
        <p className="font-display text-lg font-semibold text-bone">
          Concluir atendimento
        </p>
        <p className="mt-1 font-body text-sm text-bone-dim">
          {agendamento.clienteNome} · {agendamento.servicoNome} ·{" "}
          {agendamento.hora}
        </p>

        {disponiveis.length > 0 && (
          <>
            <p className="mt-6 font-accent text-xs uppercase tracking-widest text-muted">
              Levou algum produto?
            </p>
            <div className="mt-3 space-y-2">
              {disponiveis.map((p) => {
                const q = qtds[p.id] ?? 0;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 ${
                      q > 0 ? "border-gold-bright/40 bg-gold-bright/5" : "border-line"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-body text-sm text-bone">{p.nome}</p>
                      <p className="font-body text-[11px] text-muted">
                        R$ {p.preco.toFixed(2).replace(".", ",")} · {p.estoque} em
                        estoque
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => ajustar(p, -1)}
                        aria-label={`Menos ${p.nome}`}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-line-strong text-bone-dim hover:border-gold-bright/40"
                      >
                        −
                      </button>
                      <span className="min-w-6 text-center font-accent text-sm text-bone">
                        {q}
                      </span>
                      <button
                        onClick={() => ajustar(p, 1)}
                        aria-label={`Mais ${p.nome}`}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-line-strong text-bone-dim hover:border-gold-bright/40"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="mt-6 rounded-xl border border-line bg-bone/[0.02] p-4">
          <div className="flex justify-between font-body text-sm text-bone-dim">
            <span>Serviço</span>
            <span>R$ {agendamento.preco.toFixed(2).replace(".", ",")}</span>
          </div>
          {totalProdutos > 0 && (
            <div className="mt-1 flex justify-between font-body text-sm text-bone-dim">
              <span>Produtos</span>
              <span>R$ {totalProdutos.toFixed(2).replace(".", ",")}</span>
            </div>
          )}
          <div className="mt-3 flex justify-between border-t border-line pt-3 font-body text-sm font-semibold text-bone">
            <span>Total</span>
            <span className="font-accent text-gold-bright">
              R$ {total.toFixed(2).replace(".", ",")}
            </span>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={() => onConcluir(vendidos)}
            className="flex-1 rounded-xl bg-gold-bright px-4 py-3 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.02]"
          >
            Concluir
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-line-strong px-4 py-3 font-body text-sm text-bone-dim hover:text-bone"
          >
            Cancelar
          </button>
        </div>
        {vendidos.length > 0 && (
          <p className="mt-3 text-center font-body text-[11px] text-muted">
            O estoque desses produtos será baixado automaticamente.
          </p>
        )}
      </div>
    </div>
  );
}
