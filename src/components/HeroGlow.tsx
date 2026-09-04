"use client";

import { useEffect, useRef } from "react";

/**
 * Brilho radial que segue o cursor no hero — um toque de profundidade que
 * some sozinho no celular (não há mousemove no touch, então fica parado no
 * centro, o que também é uma composição válida).
 *
 * Fica atrás do conteúdo (pointer-events-none) e não usa React state pra
 * atualizar 60x/s: escreve direto na custom property via ref, sem re-render.
 */
export function HeroGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(pointer: coarse)").matches) return;

    let frame = 0;
    function mover(e: PointerEvent) {
      const rect = el!.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el!.style.setProperty("--mx", `${x}%`);
        el!.style.setProperty("--my", `${y}%`);
      });
    }

    window.addEventListener("pointermove", mover);
    return () => {
      window.removeEventListener("pointermove", mover);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-700 motion-reduce:hidden [--mx:50%] [--my:15%] sm:opacity-100"
      style={{
        background:
          "radial-gradient(480px circle at var(--mx) var(--my), rgba(255,207,107,0.10), transparent 70%)",
      }}
    />
  );
}
