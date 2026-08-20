"use client";

import { useState } from "react";

const OLHO = "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z";
const OLHO_PUPILA = "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z";
const OLHO_CORTADO =
  "M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.4 5.2A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.2 6.2A17 17 0 0 0 2 12s3.6 7 10 7c1.3 0 2.5-.3 3.6-.7";

/**
 * Campo de senha com botão de ver/esconder.
 *
 * Senha digitada às cegas é fonte de erro — principalmente no celular. O
 * padrão continua escondido; quem quiser confere antes de enviar.
 */
export function SenhaField({
  label = "Senha",
  value,
  onChange,
  placeholder = "••••••••",
  autoComplete = "current-password",
  required = false,
  dica,
  className = "",
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  dica?: string;
  className?: string;
}) {
  const [visivel, setVisivel] = useState(false);

  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      <div className="relative">
        <input
          type={visivel ? "text" : "password"}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full rounded-xl border border-line-strong bg-bone/[0.03] px-4 py-3 pr-12 font-body text-sm text-bone outline-none transition-colors placeholder:text-muted focus:border-gold-bright"
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? "Esconder senha" : "Mostrar senha"}
          title={visivel ? "Esconder senha" : "Mostrar senha"}
          className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition-colors hover:text-bone"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4.5 w-4.5"
          >
            {visivel ? (
              <path d={OLHO_CORTADO} />
            ) : (
              <>
                <path d={OLHO} />
                <path d={OLHO_PUPILA} />
              </>
            )}
          </svg>
        </button>
      </div>
      {dica && (
        <span className="mt-1.5 block font-body text-[11px] text-muted">{dica}</span>
      )}
    </label>
  );
}
