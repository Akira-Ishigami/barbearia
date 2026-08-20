"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Carrossel horizontal: arrasta no celular, setas no desktop.
 * O fade nas bordas some quando chega no fim, então dá pra saber
 * de relance que ainda tem conteúdo pro lado.
 */
export function ScrollRail({
  children,
  ariaLabel,
}: {
  children: React.ReactNode;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function sync() {
      const node = ref.current;
      if (!node) return;
      const max = node.scrollWidth - node.clientWidth;
      setAtStart(node.scrollLeft <= 2);
      setAtEnd(node.scrollLeft >= max - 2);
    }

    // ResizeObserver já dispara uma vez ao observar, então ele também
    // faz a medição inicial — sem precisar chamar sync() no corpo do efeito.
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    el.addEventListener("scroll", sync, { passive: true });

    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", sync);
    };
  }, []);

  function nudge(dir: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(280, el.clientWidth * 0.75), behavior: "smooth" });
  }

  const arrowBase =
    "pointer-events-auto hidden h-10 w-10 place-items-center rounded-full border border-line-strong bg-ink-elev text-bone shadow-sm transition-[opacity,transform] hover:scale-105 disabled:pointer-events-none disabled:opacity-0 md:grid";

  return (
    <div className="relative">
      <div
        ref={ref}
        role="region"
        aria-label={ariaLabel}
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1"
      >
        {children}
      </div>

      {/* fades das bordas */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-ink to-transparent transition-opacity duration-200 ${
          atStart ? "opacity-0" : "opacity-100"
        }`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-ink to-transparent transition-opacity duration-200 ${
          atEnd ? "opacity-0" : "opacity-100"
        }`}
      />

      {/* setas */}
      <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-1">
        <button
          onClick={() => nudge(-1)}
          disabled={atStart}
          aria-label="Voltar"
          className={`${arrowBase} -translate-x-4`}
        >
          <span aria-hidden>←</span>
        </button>
        <button
          onClick={() => nudge(1)}
          disabled={atEnd}
          aria-label="Avançar"
          className={`${arrowBase} translate-x-4`}
        >
          <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}
