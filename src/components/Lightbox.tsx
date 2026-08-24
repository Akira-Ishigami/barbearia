"use client";

import { useEffect } from "react";

/**
 * Visualizador de foto em tela cheia.
 *
 * A galeria mostra as fotos em miniatura, onde não dá pra ver o corte nem o
 * ambiente direito — clicar abre a foto grande, com setas pra passar pelas
 * outras sem precisar fechar e abrir de novo.
 */
export function Lightbox({
  fotos,
  indice,
  onFechar,
  onNavegar,
}: {
  fotos: string[];
  indice: number;
  onFechar: () => void;
  onNavegar: (novo: number) => void;
}) {
  const total = fotos.length;

  useEffect(() => {
    function onTecla(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
      // Circular: da última volta pra primeira, sem beco sem saída.
      if (e.key === "ArrowRight") onNavegar((indice + 1) % total);
      if (e.key === "ArrowLeft") onNavegar((indice - 1 + total) % total);
    }
    document.addEventListener("keydown", onTecla);

    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onTecla);
      document.body.style.overflow = antes;
    };
  }, [indice, total, onFechar, onNavegar]);

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/90 p-4"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label={`Foto ${indice + 1} de ${total}`}
    >
      <button
        onClick={onFechar}
        aria-label="Fechar"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          className="h-5 w-5"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      {total > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavegar((indice - 1 + total) % total);
            }}
            aria-label="Foto anterior"
            className="absolute left-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:left-6"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavegar((indice + 1) % total);
            }}
            aria-label="Próxima foto"
            className="absolute right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:right-6"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={fotos[indice]}
        alt={`Foto ${indice + 1}`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-full rounded-2xl object-contain"
      />

      {total > 1 && (
        <p className="absolute bottom-5 font-accent text-xs text-white/70">
          {indice + 1} / {total}
        </p>
      )}
    </div>
  );
}
