"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Revela o conteúdo com um fade + subida quando entra na tela.
 *
 * A landing inteira aparecia de uma vez só ao carregar — rolar a página
 * não tinha nenhum ritmo. `once: true` porque uma seção que já apareceu
 * não devia sumir de novo só porque o visitante rolou pra cima.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  /** ms de atraso — usado pra escalonar itens de uma mesma grade. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Sem IntersectionObserver (navegador muito antigo): mostra direto em
    // vez de arriscar conteúdo que nunca aparece. `requestAnimationFrame`
    // em vez de chamar setState direto no corpo do efeito, que o lint dos
    // hooks recusa por poder encadear renders.
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setVisivel(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisivel(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
        visivel ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
      style={{ transitionDelay: visivel ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
