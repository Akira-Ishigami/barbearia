"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { LojaProvider, useLoja } from "@/lib/loja-context";

function NaoEncontrada() {
  return (
    <div className="grain grid-field relative flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="font-display text-3xl font-semibold text-bone">
        Barbearia não encontrada
      </h1>
      <Link
        href="/"
        className="mt-8 rounded-full border border-line-strong px-6 py-3 font-body text-sm font-semibold text-bone hover:border-gold-bright hover:text-gold-bright"
      >
        Voltar pra home
      </Link>
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
