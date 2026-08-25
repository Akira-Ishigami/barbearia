"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { sair } from "@/lib/use-session";
import { usePlataforma } from "@/lib/use-plataforma";

/**
 * Área da plataforma — Navalha olhando pra si mesma, não pra uma barbearia.
 *
 * Fica em cyan de propósito: o painel da barbearia é dourado, e quem tem os
 * dois acessos precisa saber num relance em qual dos dois está antes de
 * clicar em alguma coisa.
 *
 * Esta camada é só de conveniência — quem realmente barra é a API. Cada
 * rota confere o nível de novo, então esconder um botão aqui não é a
 * proteção, é só não mostrar o que não vai funcionar.
 */

const NAV = [
  { href: "/adm", label: "Visão geral", soAdmin: false },
  { href: "/adm/barbearias", label: "Barbearias", soAdmin: false },
  { href: "/adm/clientes", label: "Clientes", soAdmin: false },
  { href: "/adm/equipe", label: "Equipe", soAdmin: true },
];

export default function AdmLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const acesso = usePlataforma();

  useEffect(() => {
    // `undefined` = ainda verificando; só decide quando a resposta chega.
    if (acesso === null) router.replace("/login?motivo=sem-acesso");
  }, [acesso, router]);

  if (acesso === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center bg-ink">
        <p className="font-body text-sm text-muted">Verificando acesso…</p>
      </div>
    );
  }

  if (!acesso) return <div className="flex-1 bg-ink" />;

  const admin = acesso.nivel === "admin";

  return (
    <div className="grain flex flex-1 flex-col bg-ink md:flex-row">
      <aside className="flex border-b border-line bg-ink-elev/60 px-5 py-6 md:sticky md:top-0 md:max-h-screen md:w-60 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
        <div className="hidden md:block">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan/40 bg-cyan/10 font-accent text-xs text-cyan-bright">
              N
            </span>
            <span className="font-display text-lg font-semibold text-bone">Navalha</span>
          </Link>

          <div className="mt-4 rounded-lg border border-cyan/30 bg-cyan/5 px-3 py-2">
            <p className="font-body text-xs font-semibold text-cyan-bright">
              {admin ? "Administrador" : "Suporte"}
            </p>
            <p className="truncate font-body text-[11px] text-muted">{acesso.email}</p>
          </div>
        </div>

        <span className="mr-2 flex shrink-0 items-center rounded-lg border border-cyan/30 bg-cyan/5 px-2.5 font-body text-[11px] font-semibold text-cyan-bright md:hidden">
          {admin ? "Admin" : "Suporte"}
        </span>

        <nav className="flex min-w-0 gap-2 overflow-x-auto md:mt-4 md:w-full md:flex-col md:gap-1 md:overflow-visible">
          {NAV.filter((item) => !item.soAdmin || admin).map((item) => {
            const ativo =
              item.href === "/adm" ? pathname === "/adm" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-lg px-3.5 py-2.5 text-left font-body text-sm transition-colors ${
                  ativo
                    ? "bg-cyan/10 text-cyan-bright"
                    : "text-bone-dim hover:bg-bone/5 hover:text-bone"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* No celular a barra vira uma linha só: estes botões precisam ficar
            nela, senão quem abre a área pelo telefone não tem como voltar
            pro painel nem sair. */}
        <div className="ml-auto flex shrink-0 items-center gap-2 pl-2 md:ml-0 md:mt-auto md:block md:space-y-2 md:pl-0 md:pt-8">
          <Link
            href="/painel"
            className="whitespace-nowrap rounded-lg border border-line-strong px-3.5 py-2.5 font-body text-sm text-bone-dim transition-colors hover:border-cyan/40 hover:text-cyan-bright md:block"
          >
            <span className="md:hidden">Painel</span>
            <span className="hidden md:inline">Ir pro painel</span>
          </Link>
          <button
            onClick={async () => {
              await sair();
              router.push("/login");
            }}
            className="whitespace-nowrap rounded-lg border border-line-strong px-3.5 py-2.5 text-left font-body text-sm text-bone-dim transition-colors hover:border-off-line hover:text-off md:w-full"
          >
            Sair
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-6 py-8 md:px-10 md:py-10">{children}</main>
    </div>
  );
}
