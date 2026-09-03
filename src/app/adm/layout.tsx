"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
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
      {/* ---------- Estações ---------- */}
      <aside className="border-b border-line bg-ink-elev lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
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
            <span className="rounded-full bg-ink-elev-2 px-2.5 py-1 font-accent text-[11px] font-bold uppercase tracking-wide text-bone-dim lg:hidden">
              {admin ? "Admin" : "Suporte"}
            </span>
          </div>

          <nav className="mt-5 flex gap-1.5 overflow-x-auto lg:mt-8 lg:flex-col lg:gap-1 lg:overflow-visible">
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
                      className={`hidden font-body text-xs lg:block ${on ? "text-white/75" : "text-muted"}`}
                    >
                      {e.nota}
                    </span>
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto hidden pt-8 lg:block">
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

          {/* No celular a barra vira uma linha só; sem isto não há como
              voltar pro painel nem sair de dentro da área. */}
          <div className="mt-3 flex gap-2 lg:hidden">
            <Link
              href="/painel"
              className="rounded-lg border border-line-strong px-3 py-1.5 font-body text-xs font-semibold text-bone-dim"
            >
              Meu painel
            </Link>
            <button
              onClick={async () => {
                await sair();
                router.push("/login");
              }}
              className="rounded-lg border border-line-strong px-3 py-1.5 font-body text-xs font-semibold text-bone-dim"
            >
              Sair
            </button>
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
