"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getBarbearia } from "@/lib/db";
import { sair, useSession } from "@/lib/use-session";
import { useAsync } from "@/lib/use-async";
import { usePendingAlerts } from "@/lib/use-pending-alerts";
import { useTheme, themeClass } from "@/lib/use-theme";
import { PendentesPopover } from "@/components/PendentesPopover";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ModalUpgrade } from "@/components/ModalUpgrade";

const NAV = [
  { href: "/painel", label: "Visão geral", pro: false },
  { href: "/painel/agenda", label: "Agenda", pro: false },
  { href: "/painel/servicos", label: "Serviços", pro: false },
  { href: "/painel/produtos", label: "Produtos", pro: true },
  { href: "/painel/estoque", label: "Estoque", pro: true },
  { href: "/painel/barbeiros", label: "Barbeiros", pro: false },
  { href: "/painel/localizacao", label: "Localização", pro: false },
  { href: "/painel/pagamentos", label: "Pagamentos", pro: false },
  { href: "/painel/relatorios", label: "Relatórios", pro: true },
];

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const theme = useTheme();
  const [verUpgrade, setVerUpgrade] = useState(false);
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

      {/* Sino de pendentes — no mobile a sidebar vira barra horizontal, então
          ele fica flutuando no canto pra continuar acessível de qualquer tela. */}
      {pendentes > 0 && (
        <div className="fixed bottom-5 right-5 z-50 w-56 md:hidden">
          <PendentesPopover
            barbeariaId={session.barbeariaId}
            pendentes={pendentes}
            flash={flash}
            direction="up"
          />
        </div>
      )}

      {/* SIDEBAR */}
      {/* No desktop a barra acompanha a rolagem: com a agenda ou a lista de
          serviços longa, o menu sumia e obrigava a rolar de volta pro topo. */}
      <aside className="flex border-b border-line bg-ink-elev/60 px-5 py-6 md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r">
        <div className="hidden md:block">
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

        <div className="mt-4 hidden md:block">
          <PendentesPopover
            barbeariaId={session.barbeariaId}
            pendentes={pendentes}
            flash={flash}
          />
        </div>

        <nav className="flex w-full gap-2 overflow-x-auto md:mt-4 md:flex-col md:gap-1 md:overflow-visible">
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

        <div className="mt-auto hidden space-y-3 pt-8 md:block">
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
