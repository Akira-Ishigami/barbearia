"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getBarbearia } from "@/lib/db";
import { sair, useSession } from "@/lib/use-session";
import { useAsync } from "@/lib/use-async";
import { usePendingAlerts } from "@/lib/use-pending-alerts";
import { useTheme, themeClass } from "@/lib/use-theme";
import { usePlataforma } from "@/lib/use-plataforma";
import { PendentesPopover } from "@/components/PendentesPopover";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ModalUpgrade } from "@/components/ModalUpgrade";

const NAV = [
  { href: "/painel", label: "Visão geral", pro: false },
  { href: "/painel/agenda", label: "Agenda", pro: false },
  { href: "/painel/caixa", label: "Caixa", pro: false },
  { href: "/painel/servicos", label: "Serviços", pro: false },
  { href: "/painel/produtos", label: "Produtos", pro: true },
  { href: "/painel/estoque", label: "Estoque", pro: true },
  { href: "/painel/barbeiros", label: "Barbeiros", pro: false },
  { href: "/painel/comissoes", label: "Comissões", pro: true },
  { href: "/painel/localizacao", label: "Localização", pro: false },
  { href: "/painel/pagamentos", label: "Pagamentos", pro: false },
  { href: "/painel/relatorios", label: "Relatórios", pro: true },
  { href: "/painel/suporte", label: "Suporte", pro: false },
  { href: "/painel/ajuda", label: "Ajuda", pro: false },
];

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const theme = useTheme();
  // Só quem é da equipe da Navalha recebe algo aqui; pro dono comum é null.
  const plataforma = usePlataforma();
  const [verUpgrade, setVerUpgrade] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);

  // Fecha a gaveta sozinha ao trocar de tela — sem isso ficaria aberta por
  // cima da tela nova depois de tocar num link.
  useEffect(() => {
    setMenuAberto(false);
  }, [pathname]);
  const { pendentes, flash } = usePendingAlerts(
    session?.role === "dono" ? session.barbeariaId : undefined,
  );

  const { dados: barbearia } = useAsync(
    () => getBarbearia(session!.barbeariaId),
    [session?.barbeariaId],
    { pular: session?.role !== "dono" },
  );

  useEffect(() => {
    // `undefined` = sessão ainda carregando; só decide quando já sabemos.
    if (session === null) {
      router.replace("/login");
    } else if (session && session.role !== "dono") {
      router.replace("/barbeiro");
    }
  }, [session, router]);

  if (!session || session.role !== "dono") {
    return <div className={`flex flex-1 items-center justify-center bg-ink ${themeClass(theme)}`} />;
  }

  const isPro = barbearia?.plano === "pro";

  return (
    <div className={`${themeClass(theme)} grain flex flex-1 flex-col bg-ink md:flex-row`}>
      {flash && (
        <div className="animate-toast-in fixed left-1/2 top-4 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full border border-warn-line bg-warn-solid px-4 py-2.5 shadow-lg">
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-warn" />
          <span className="font-body text-sm font-medium text-warn">
            Novo agendamento aguardando confirmação
          </span>
        </div>
      )}

      {/* Barra do topo, só no mobile: hambúrguer abre a gaveta com o menu
          inteiro (a barra lateral de verdade fica pro desktop, md:). */}
      <div className="flex items-center gap-3 border-b border-line bg-ink-elev/60 px-5 py-4 md:hidden">
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
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-gold/40 bg-gold/10 text-gold-bright">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <path d="M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.5 8.5l11 11M20 4 8.5 15.5" />
          </svg>
        </span>
        <span className="font-display text-base font-semibold text-bone">Navalha</span>
      </div>

      {/* Fundo escurecido atrás da gaveta — toca fora pra fechar. */}
      {menuAberto && (
        <div
          onClick={() => setMenuAberto(false)}
          className="fixed inset-0 z-[105] bg-black/50 md:hidden"
        />
      )}

      {/* Sino de pendentes — no mobile a barra lateral fica escondida dentro
          da gaveta, então ele fica flutuando no canto pra continuar
          acessível de qualquer tela, gaveta aberta ou não. Compact (só o
          círculo) pra não cobrir o card embaixo com o rótulo "Pendentes"
          por extenso. */}
      {pendentes > 0 && (
        <div className="fixed bottom-5 right-5 z-50 md:hidden">
          <PendentesPopover
            barbeariaId={session.barbeariaId}
            pendentes={pendentes}
            flash={flash}
            direction="up"
            compact
          />
        </div>
      )}

      {/* SIDEBAR — vira gaveta no mobile (fixed, desliza da esquerda; some
          fora da tela quando fechada, translate-x-0 quando aberta) e barra
          lateral de verdade no desktop. */}
      {/* No desktop a barra acompanha a rolagem: com a agenda ou a lista de
          serviços longa, o menu sumia e obrigava a rolar de volta pro topo.
          Sem `overflow` aqui de propósito — ele criaria um recorte que corta
          a lista de pendentes, que é um popover posicionado por cima. */}
      <aside
        className={`fixed inset-y-0 left-0 z-[110] flex w-72 -translate-x-full flex-col overflow-y-auto border-r border-line bg-ink-elev px-5 py-6 transition-transform duration-300 ease-out md:sticky md:top-0 md:z-auto md:max-h-screen md:w-64 md:translate-x-0 md:shrink-0 md:border-b-0 md:transition-none ${
          menuAberto ? "translate-x-0" : ""
        }`}
      >
        <div>
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold/40 bg-gold/10 text-gold-bright">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.5 8.5l11 11M20 4 8.5 15.5" />
                </svg>
              </span>
              <span className="font-display text-lg font-semibold text-bone">
                Navalha
              </span>
            </Link>
            <button
              onClick={() => setMenuAberto(false)}
              aria-label="Fechar menu"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-bone-dim hover:bg-bone/5 md:hidden"
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

          <div
            className={`mt-4 flex items-center justify-between rounded-lg border px-3 py-2 ${
              isPro
                ? "border-gold-bright/30 bg-gold-bright/5"
                : "border-line-strong bg-bone/[0.02]"
            }`}
          >
            <div>
              <p
                className={`font-body text-xs font-semibold ${
                  isPro ? "text-gold-bright" : "text-bone-dim"
                }`}
              >
                Plano {isPro ? "Pro" : "Básico"}
              </p>
              <p className="font-body text-[11px] text-muted">
                {isPro ? "Suporte prioritário" : "Suporte por e-mail"}
              </p>
            </div>
            {!isPro && (
              <button
                onClick={() => setVerUpgrade(true)}
                className="rounded-full bg-gold-bright px-2.5 py-1 font-body text-[10px] font-semibold text-ink transition-transform hover:scale-105"
              >
                Upgrade
              </button>
            )}
          </div>
        </div>

        <div className="mt-4">
          <PendentesPopover
            barbeariaId={session.barbeariaId}
            pendentes={pendentes}
            flash={flash}
          />
        </div>

        <nav className="mt-4 flex w-full flex-col gap-1">
          {NAV.filter((item) => !item.pro || isPro).map((item) => {
            const active =
              item.href === "/painel"
                ? pathname === "/painel"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-lg px-3.5 py-2.5 text-left font-body text-sm transition-colors ${
                  active
                    ? "bg-gold-bright/10 text-gold-bright"
                    : "text-bone-dim hover:bg-bone/5 hover:text-bone"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3 pt-8">
          {plataforma && (
            <Link
              href="/adm"
              className="block rounded-lg border border-cyan/30 bg-cyan/5 px-3.5 py-2.5 font-body text-sm text-cyan-bright transition-colors hover:border-cyan/60"
            >
              Área da plataforma
            </Link>
          )}
          <ThemeToggle />
          <button
            onClick={async () => {
              await sair();
              router.push("/login");
            }}
            className="w-full rounded-lg border border-line-strong px-3.5 py-2.5 text-left font-body text-sm text-bone-dim transition-colors hover:border-gold-bright/40 hover:text-gold-bright"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="min-w-0 flex-1 px-6 py-8 md:px-10 md:py-10">
        {children}
      </main>

      {verUpgrade && <ModalUpgrade onClose={() => setVerUpgrade(false)} />}
    </div>
  );
}
