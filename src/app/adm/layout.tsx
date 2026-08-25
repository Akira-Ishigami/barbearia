"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { sair } from "@/lib/use-session";
import { usePlataforma } from "@/lib/use-plataforma";

/**
 * Área da plataforma — a Navalha olhando pra si mesma.
 *
 * É papel: fundo quente, tinta preta, fio de cabelo, serifa nos títulos.
 * O painel da barbearia é escuro e dourado, a loja é clara e geométrica.
 * Quem tem os três acessos precisa saber onde está antes de clicar em
 * qualquer coisa, e a cor resolve isso sem precisar de aviso na tela.
 *
 * O menu é numerado como estação de trabalho: cada tela responde uma
 * pergunta e só ela. Tela que responde cinco perguntas obriga a pessoa a
 * procurar a que interessa toda vez que abre.
 *
 * Esta camada é conveniência — quem barra de verdade é a API. Cada rota
 * confere o nível outra vez, então esconder um item aqui não é proteção,
 * é só não mostrar o que não ia funcionar.
 */

const ESTACOES = [
  { href: "/adm", n: "01", label: "Hoje", nota: "o que resolver", soAdmin: false },
  { href: "/adm/barbearias", n: "02", label: "Barbearias", nota: "a base", soAdmin: false },
  { href: "/adm/crescimento", n: "03", label: "Crescimento", nota: "os números", soAdmin: false },
  { href: "/adm/clientes", n: "04", label: "Clientes", nota: "quem agenda", soAdmin: false },
  { href: "/adm/registro", n: "05", label: "Registro", nota: "o que foi feito", soAdmin: false },
  { href: "/adm/equipe", n: "06", label: "Equipe", nota: "quem tem acesso", soAdmin: true },
  {
    href: "/adm/privacidade",
    n: "07",
    label: "Privacidade",
    nota: "o que não vemos",
    soAdmin: false,
  },
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
      <div className="adm-paper flex flex-1 items-center justify-center bg-ink">
        <p className="font-accent text-[11px] uppercase tracking-[0.22em] text-muted">
          Verificando acesso
        </p>
      </div>
    );
  }

  if (!acesso) return <div className="adm-paper flex-1 bg-ink" />;

  const admin = acesso.nivel === "admin";
  const visiveis = ESTACOES.filter((e) => !e.soAdmin || admin);

  const ativa = (href: string) =>
    href === "/adm" ? pathname === "/adm" : pathname.startsWith(href);

  return (
    <div className="adm-paper adm-grade flex flex-1 flex-col bg-ink text-bone lg:flex-row">
      {/* ---------- Estações ---------- */}
      <aside className="border-b border-line-strong bg-ink-elev/60 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col px-5 py-5 lg:px-6 lg:py-7">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex items-baseline gap-2.5">
              <span className="font-display text-2xl leading-none text-bone">Navalha</span>
              <span className="font-accent text-[9px] uppercase tracking-[0.2em] text-cyan">
                plataforma
              </span>
            </Link>
            <span className="font-accent text-[10px] uppercase tracking-wider text-muted lg:hidden">
              {admin ? "Admin" : "Suporte"}
            </span>
          </div>

          <nav className="mt-5 flex gap-1 overflow-x-auto lg:mt-8 lg:flex-col lg:gap-0 lg:overflow-visible">
            {visiveis.map((e) => {
              const on = ativa(e.href);
              return (
                <Link
                  key={e.href}
                  href={e.href}
                  className={`flex shrink-0 items-baseline gap-3 whitespace-nowrap border-line py-2.5 transition-colors lg:border-t lg:px-1 ${
                    on ? "text-cyan" : "text-bone-dim hover:text-bone"
                  }`}
                >
                  <span
                    className={`tabular font-accent text-[10px] ${on ? "text-cyan" : "text-muted"}`}
                  >
                    {e.n}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-body text-sm font-medium">{e.label}</span>
                    <span className="hidden font-body text-[11px] text-muted lg:block">
                      {e.nota}
                    </span>
                  </span>
                  {on && (
                    <span aria-hidden className="ml-auto hidden font-accent text-cyan lg:block">
                      ·
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto hidden pt-8 lg:block">
            <div className="border-t border-line-strong pt-3">
              <p className="font-accent text-[10px] uppercase tracking-[0.16em] text-cyan">
                {admin ? "Administrador" : "Suporte"}
              </p>
              <p className="mt-0.5 truncate font-body text-[11px] text-muted">{acesso.email}</p>
            </div>
            <div className="mt-4 flex gap-2">
              <Link
                href="/painel"
                className="border border-line-strong px-3 py-1.5 font-body text-[11px] text-bone-dim transition-colors hover:border-cyan hover:text-cyan"
              >
                Meu painel
              </Link>
              <button
                onClick={async () => {
                  await sair();
                  router.push("/login");
                }}
                className="border border-line-strong px-3 py-1.5 font-body text-[11px] text-bone-dim transition-colors hover:border-off-line hover:text-off"
              >
                Sair
              </button>
            </div>
          </div>

          {/* No celular a barra vira uma linha só; sem isto não há como
              voltar pro painel nem sair de dentro da área. */}
          <div className="mt-3 flex gap-2 lg:hidden">
            <Link
              href="/painel"
              className="border border-line-strong px-3 py-1.5 font-body text-[11px] text-bone-dim"
            >
              Meu painel
            </Link>
            <button
              onClick={async () => {
                await sair();
                router.push("/login");
              }}
              className="border border-line-strong px-3 py-1.5 font-body text-[11px] text-bone-dim"
            >
              Sair
            </button>
          </div>
        </div>
      </aside>

      {/* ---------- Folha ---------- */}
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-5xl px-6 py-10 md:px-10 md:py-14">{children}</div>
      </main>
    </div>
  );
}
