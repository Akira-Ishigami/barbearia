"use client";

import { useEffect } from "react";
import { getPlan } from "@/lib/plans";

/**
 * Mostra o que muda ao virar Pro sem tirar o dono do painel.
 *
 * O botão antes mandava pra landing (`/#planos`): a pessoa saía do sistema,
 * caía numa página de venda e perdia o contexto do que estava fazendo.
 */
export function ModalUpgrade({ onClose }: { onClose: () => void }) {
  const pro = getPlan("pro");
  const basico = getPlan("basico");

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEsc);
    // Trava a rolagem do fundo enquanto o modal está aberto.
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = antes;
    };
  }, [onClose]);

  // O que o Pro tem a mais — sai direto da lista dos planos, então
  // acompanha qualquer mudança de preço ou de recurso sem duplicar texto.
  const extras = pro.features.filter(
    (f) => !basico.features.includes(f) && !f.toLowerCase().startsWith("tudo do"),
  );

  const diferenca = pro.valor - basico.valor;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Mudar para o plano Pro"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line-strong bg-ink-elev p-6 shadow-2xl sm:rounded-3xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-accent text-[11px] uppercase tracking-[0.2em] text-gold-bright">
              Plano {pro.name}
            </p>
            <h2 className="mt-1.5 font-display text-2xl font-bold text-bone">
              Libere a barbearia inteira
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-bone/5 hover:text-bone"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              className="h-4 w-4"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <ul className="mt-6 space-y-3">
          {extras.map((f) => (
            <li key={f} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-bright/15">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3 w-3 text-gold-bright"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              <span className="font-body text-sm text-bone-dim">{f}</span>
            </li>
          ))}
        </ul>

        <div className="mt-7 rounded-2xl border border-line bg-bone/[0.02] p-5">
          <div className="flex items-baseline justify-between">
            <span className="font-body text-sm text-bone-dim">Plano Pro</span>
            <span className="font-accent text-2xl text-bone">
              R$ {pro.valor.toFixed(2).replace(".", ",")}
              <span className="font-body text-sm text-muted">/mês</span>
            </span>
          </div>
          <p className="mt-1.5 text-right font-body text-xs text-muted">
            R$ {diferenca.toFixed(2).replace(".", ",")} a mais que o Básico
          </p>
        </div>

        <a
          href="mailto:contato@navalha.app?subject=Quero%20mudar%20pro%20plano%20Pro"
          className="mt-6 block rounded-full bg-gold-bright py-3.5 text-center font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.02]"
        >
          Quero mudar pro Pro
        </a>
        <p className="mt-3 text-center font-body text-xs text-muted">
          A troca vale a partir da próxima cobrança. Nada muda nos seus dados.
        </p>
      </div>
    </div>
  );
}
