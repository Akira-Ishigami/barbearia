"use client";

import { setTheme, useTheme } from "@/lib/use-theme";

const ICONE_SOL =
  "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4";
const ICONE_LUA = "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z";

/** Troca entre claro e escuro. O padrão do sistema é claro. */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useTheme();
  const claro = theme === "claro";

  if (compact) {
    return (
      <button
        onClick={() => setTheme(claro ? "escuro" : "claro")}
        aria-label={claro ? "Ativar tema escuro" : "Ativar tema claro"}
        title={claro ? "Tema escuro" : "Tema claro"}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-line-strong text-bone-dim transition-colors hover:border-gold-bright/50 hover:text-gold-bright"
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
          <path d={claro ? ICONE_LUA : ICONE_SOL} />
        </svg>
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label="Tema da interface"
      className="flex items-center gap-1 rounded-lg border border-line-strong p-1"
    >
      {(
        [
          ["claro", "Claro", ICONE_SOL],
          ["escuro", "Escuro", ICONE_LUA],
        ] as const
      ).map(([valor, label, icone]) => {
        const ativo = theme === valor;
        return (
          <button
            key={valor}
            onClick={() => setTheme(valor)}
            aria-pressed={ativo}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 font-body text-xs font-medium transition-colors ${
              ativo ? "bg-gold-bright text-ink" : "text-bone-dim hover:text-bone"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <path d={icone} />
            </svg>
            {label}
          </button>
        );
      })}
    </div>
  );
}
