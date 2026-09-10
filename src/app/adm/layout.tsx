"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { sair } from "@/lib/use-session";
import { usePlataforma } from "@/lib/use-plataforma";

/**
 * Área da plataforma — a Navalha olhando pra si mesma.
 *
 * Console de operação: cartão branco de verdade contra um cinza neutro,
 * item ativo com preenchimento sólido em vez de só trocar de cor. O
 * painel da barbearia é escuro e dourado, a loja é clara e geométrica;
 * aqui é a terceira, e quem tem os três acessos precisa saber onde está
 * antes de clicar em qualquer coisa — a cor resolve isso sem aviso na
 * tela.
 *
 * O menu é numerado como estação de trabalho: cada tela responde uma
 * pergunta e só ela. Tela que responde cinco perguntas obriga a pessoa a
 * procurar a que interessa toda vez que abre.
 *
 * Esta camada é conveniência — quem barra de verdade é a API. Cada rota
 * confere o nível outra vez, então esconder um item aqui não é proteção,
 * é só não mostrar o que não ia funcionar.
 */

// "Privacidade" não tem estação: fica fora do menu do dia a dia (ninguém
// precisa reler a regra toda vez que abre a plataforma), mas a página
// continua no ar — Clientes linka pra ela como referência de por que a
// tela é do jeito que é.
const ESTACOES = [
  { href: "/adm", n: "01", label: "Hoje", nota: "o que resolver", soAdmin: false },
  { href: "/adm/barbearias", n: "02", label: "Barbearias", nota: "a base", soAdmin: false },
  { href: "/adm/crescimento", n: "03", label: "Crescimento", nota: "os números", soAdmin: false },
  { href: "/adm/clientes", n: "04", label: "Clientes", nota: "quem agenda", soAdmin: false },
  { href: "/adm/registro", n: "05", label: "Registro", nota: "o que foi feito", soAdmin: false },
  { href: "/adm/equipe", n: "06", label: "Equipe", nota: "quem tem acesso", soAdmin: true },
  { href: "/adm/suporte", n: "07", label: "Suporte", nota: "conversa com cada barbearia", soAdmin: false },
];

export default function AdmLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const acesso = usePlataforma();
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    // `undefined` = ainda verificando; só decide quando a resposta chega.
    if (acesso === null) router.replace("/login?motivo=sem-acesso");
  }, [acesso, router]);

  // Fecha a gaveta sozinha ao trocar de estação.
  useEffect(() => {
    setMenuAberto(false);
  }, [pathname]);

  if (acesso === undefined) {
    return (
      <div className="adm-paper flex flex-1 items-center justify-center bg-ink">
        <p className="font-accent text-xs font-semibold uppercase tracking-[0.14em] text-muted">
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
    <div className="adm-paper flex flex-1 flex-col bg-ink text-bone lg:flex-row">
      {/* Barra do topo, só no celular: hambúrguer abre a gaveta com a
          estação inteira (a barra lateral de verdade fica pro desktop,
          lg:). Sticky pra continuar acessível rolando a tela. */}
      <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-line bg-ink-elev/95 px-5 py-4 backdrop-blur-sm lg:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuAberto(true)}
            aria-label="Abrir menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line-strong text-bone-dim"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              className="h-4 w-4"
            >
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <span className="flex items-baseline gap-2">
            <span className="font-display text-lg font-bold leading-none text-bone">
              Navalha
            </span>
            <span className="font-accent text-[10px] font-bold uppercase tracking-[0.1em] text-cyan">
              plataforma
            </span>
          </span>
        </div>
        <span className="rounded-full bg-ink-elev-2 px-2.5 py-1 font-accent text-[11px] font-bold uppercase tracking-wide text-bone-dim">
          {admin ? "Admin" : "Suporte"}
        </span>
      </div>

      {/* Fundo escurecido atrás da gaveta — toca fora pra fechar. */}
      {menuAberto && (
        <div
          onClick={() => setMenuAberto(false)}
          className="fixed inset-0 z-[105] bg-black/50 lg:hidden"
        />
      )}

      {/* ---------- Estações ---------- */}
      {/* Vira gaveta no celular (fixed, desliza da esquerda) e barra
          lateral de verdade no desktop. */}
      <aside
        style={{ paddingBottom: "max(1.25rem, calc(env(safe-area-inset-bottom) + 0.75rem))" }}
        className={`fixed inset-y-0 left-0 z-[110] w-72 -translate-x-full overflow-y-auto border-r border-line bg-ink-elev transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-64 lg:translate-x-0 lg:shrink-0 lg:border-b-0 lg:transition-none ${
          menuAberto ? "translate-x-0" : ""
        }`}
      >
        <div className="flex h-full flex-col px-5 py-5 lg:px-6 lg:py-7">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex items-baseline gap-2.5">
              <span className="font-display text-2xl font-bold leading-none text-bone">
                Navalha
              </span>
              <span className="font-accent text-[11px] font-bold uppercase tracking-[0.1em] text-cyan">
                plataforma
              </span>
            </Link>
            <button
              onClick={() => setMenuAberto(false)}
              aria-label="Fechar menu"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-bone-dim hover:bg-bone/5 lg:hidden"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                className="h-4 w-4"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="mt-5 flex flex-col gap-1 lg:mt-8">
            {visiveis.map((e) => {
              const on = ativa(e.href);
              return (
                <Link
                  key={e.href}
                  href={e.href}
                  className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 transition-colors ${
                    on ? "bg-cyan text-white" : "text-bone-dim hover:bg-ink-elev-2 hover:text-bone"
                  }`}
                >
                  <span
                    className={`tabular font-accent text-xs font-bold ${on ? "text-white/80" : "text-muted"}`}
                  >
                    {e.n}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-body text-sm font-semibold">{e.label}</span>
                    <span
                      className={`font-body text-xs ${on ? "text-white/75" : "text-muted"}`}
                    >
                      {e.nota}
                    </span>
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-8">
            <div className="rounded-xl bg-ink-elev-2 px-3.5 py-3">
              <p className="font-accent text-[11px] font-bold uppercase tracking-[0.08em] text-cyan">
                {admin ? "Administrador" : "Suporte"}
              </p>
              <p className="mt-0.5 truncate font-body text-xs text-bone-dim">{acesso.email}</p>
            </div>
            <div className="mt-3 flex gap-2">
              <Link
                href="/painel"
                className="flex-1 rounded-lg border border-line-strong px-3 py-2 text-center font-body text-xs font-semibold text-bone-dim transition-colors hover:border-cyan hover:text-cyan"
              >
                Meu painel
              </Link>
              <button
                onClick={async () => {
                  await sair();
                  router.push("/login");
                }}
                className="flex-1 rounded-lg border border-line-strong px-3 py-2 font-body text-xs font-semibold text-bone-dim transition-colors hover:border-off-line hover:text-off"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ---------- Conteúdo ---------- */}
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-5xl px-6 py-10 md:px-10 md:py-14">{children}</div>
      </main>
    </div>
  );
}
