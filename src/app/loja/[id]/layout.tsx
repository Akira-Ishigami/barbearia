"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { LojaProvider, useLoja } from "@/lib/loja-context";

/**
 * Link errado ou barbearia que saiu do ar. Em vez de um beco sem saída,
 * oferece o caminho pro que a pessoa queria: achar uma barbearia.
 */
function NaoEncontrada() {
  return (
    <div className="grain grid-field relative flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line-strong bg-ink-elev">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6 text-muted"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </span>

      <h1 className="mt-6 font-display text-3xl font-semibold text-bone">
        Essa barbearia não existe
      </h1>
      <p className="mt-3 max-w-sm font-body text-sm text-bone-dim">
        O link pode estar errado ou a página saiu do ar. Confira o endereço com
        a barbearia, ou procure uma perto de você.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/barbearias"
          className="rounded-full bg-gold-bright px-6 py-3 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.03]"
        >
          Ver barbearias perto de mim
        </Link>
        <Link
          href="/"
          className="rounded-full border border-line-strong px-6 py-3 font-body text-sm font-semibold text-bone-dim hover:border-gold-bright/40 hover:text-gold-bright"
        >
          Ir pra home
        </Link>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { barbearia, loaded } = useLoja();

  if (loaded && !barbearia) return <NaoEncontrada />;
  if (!barbearia) return <div className="flex flex-1 bg-ink" />;

  return <div className="flex flex-1 flex-col">{children}</div>;
}

// Área do cliente é clara — o resto do site (painel, home) continua escuro.
export default function LojaLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  return (
    <div className="theme-light loja-light grain flex flex-1 flex-col bg-ink text-bone">
      <LojaProvider id={id ?? ""}>
        <Shell>{children}</Shell>
      </LojaProvider>
    </div>
  );
}
