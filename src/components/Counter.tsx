"use client";

import { useEffect, useRef, useState } from "react";

/** Número que sobe até o valor final quando entra na tela — só uma vez. */
export function Counter({ valor, className = "" }: { valor: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [exibido, setExibido] = useState(0);
  const rodou = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setExibido(valor));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || rodou.current) return;
        rodou.current = true;
        observer.disconnect();

        const duracao = 900;
        const inicio = performance.now();

        function passo(agora: number) {
          const t = Math.min(1, (agora - inicio) / duracao);
          // ease-out: rápido no começo, acomoda no fim — combina com o
          // resto da página em vez de contar em velocidade constante.
          const suavizado = 1 - Math.pow(1 - t, 3);
          setExibido(Math.round(valor * suavizado));
          if (t < 1) requestAnimationFrame(passo);
        }
        requestAnimationFrame(passo);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [valor]);

  return (
    <span ref={ref} className={className}>
      {exibido}
    </span>
  );
}
