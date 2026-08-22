"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getClienteLogado, getHistoricoCliente } from "@/lib/cliente-db";
import { supabase } from "@/lib/supabase-browser";
import { useAsync } from "@/lib/use-async";
import { formatDayLabel } from "@/lib/date";
import type { VisitaCliente } from "@/lib/types";

function dinheiro(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

const STATUS_LABEL: Record<VisitaCliente["status"], string> = {
  pendente: "Aguardando confirmação",
  confirmado: "Confirmado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const STATUS_CLASS: Record<VisitaCliente["status"], string> = {
  pendente: "bg-warn-soft text-warn",
  confirmado: "bg-ok-soft text-ok",
  concluido: "bg-bone/5 text-muted",
  cancelado: "bg-off-soft text-off",
};

export default function MinhaContaPage() {
  const router = useRouter();

  const { dados, carregando } = useAsync(async () => {
    const cliente = await getClienteLogado();
    if (!cliente) return { cliente: null, historico: [] as VisitaCliente[] };
    return { cliente, historico: await getHistoricoCliente(cliente.id) };
  }, []);

  const cliente = dados?.cliente ?? null;

  useEffect(() => {
    // `carregando` evita mandar embora antes de saber se está logado.
    if (!carregando && dados && !cliente) router.replace("/entrar");
  }, [carregando, dados, cliente, router]);

  if (carregando || !cliente) {
    return <div className="flex flex-1 bg-ink" />;
  }

  const historico = dados?.historico ?? [];
  const hoje = new Date().toISOString().slice(0, 10);

  const proximos = historico.filter(
    (v) => v.data >= hoje && (v.status === "confirmado" || v.status === "pendente"),
  );
  const passados = historico.filter((v) => !proximos.includes(v));

  // Uma entrada por barbearia, com quantas vezes a pessoa foi.
  const barbearias = Array.from(
    historico.reduce((mapa, v) => {
      const atual = mapa.get(v.barbeariaId);
      mapa.set(v.barbeariaId, {
        id: v.barbeariaId,
        nome: v.barbeariaNome,
        slug: v.barbeariaSlug,
        visitas: (atual?.visitas ?? 0) + 1,
        ultima: atual?.ultima && atual.ultima > v.data ? atual.ultima : v.data,
      });
      return mapa;
    }, new Map<string, { id: string; nome: string; slug?: string; visitas: number; ultima: string }>()),
  ).map(([, b]) => b);

  const totalGasto = historico
    .filter((v) => v.status !== "cancelado")
    .reduce((t, v) => t + v.total, 0);

  return (
    <div className="grain flex flex-1 flex-col bg-ink">
      <header className="border-b border-line px-6 py-5">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
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
            <span className="font-display text-lg font-semibold text-bone">Navalha</span>
          </Link>
          <button
            onClick={async () => {
              await supabase().auth.signOut();
              router.push("/");
            }}
            className="rounded-full border border-line-strong px-4 py-2 font-body text-xs text-bone-dim hover:border-gold-bright/40 hover:text-gold-bright"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <p className="font-accent text-xs uppercase tracking-[0.2em] text-gold-bright">
          Minha conta
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-bone">
          Olá, {cliente.nome.split(" ")[0]}
        </h1>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            ["Visitas", String(historico.length)],
            ["Barbearias", String(barbearias.length)],
            ["Total gasto", dinheiro(totalGasto)],
          ].map(([label, valor]) => (
            <div key={label} className="rounded-2xl border border-line bg-ink-elev/60 p-5">
              <p className="font-body text-xs text-muted">{label}</p>
              <p className="mt-1 font-accent text-2xl text-bone">{valor}</p>
            </div>
          ))}
        </div>

        {proximos.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-lg font-semibold text-bone">
              Seus próximos horários
            </h2>
            <div className="mt-4 space-y-2.5">
              {proximos.map((v) => (
                <Link
                  key={v.pedidoId}
                  href={`/loja/${v.barbeariaSlug || v.barbeariaId}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ok-line bg-ok-soft px-5 py-4 transition-colors hover:border-gold-bright/40"
                >
                  <div className="min-w-0">
                    <p className="font-body text-sm font-semibold text-bone">
                      {v.barbeariaNome}
                    </p>
                    <p className="font-body text-xs text-bone-dim">
                      {formatDayLabel(v.data)} · {v.hora} · {v.servicos.join(" + ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-accent text-sm text-bone">{dinheiro(v.total)}</span>
                    <span
                      className={`rounded-full px-3 py-1 font-body text-xs font-medium ${STATUS_CLASS[v.status]}`}
                    >
                      {STATUS_LABEL[v.status]}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-bone">
              Barbearias que você já foi
            </h2>
            <Link
              href="/barbearias"
              className="font-body text-xs font-semibold text-gold-bright hover:underline"
            >
              Descobrir outras →
            </Link>
          </div>

          {barbearias.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-line-strong px-5 py-10 text-center">
              <p className="font-body text-sm text-bone-dim">
                Você ainda não agendou por aqui.
              </p>
              <Link
                href="/barbearias"
                className="mt-4 inline-block rounded-full bg-gold-bright px-6 py-3 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.03]"
              >
                Encontrar uma barbearia
              </Link>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {barbearias.map((b) => (
                <Link
                  key={b.id}
                  href={`/loja/${b.slug || b.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-ink-elev/60 px-5 py-4 transition-colors hover:border-gold-bright/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-body text-sm font-semibold text-bone">
                      {b.nome}
                    </p>
                    <p className="font-body text-xs text-muted">
                      {b.visitas} visita{b.visitas > 1 ? "s" : ""} · última em{" "}
                      {formatDayLabel(b.ultima)}
                    </p>
                  </div>
                  <span className="shrink-0 font-body text-xs font-semibold text-gold-bright">
                    Agendar →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {passados.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-lg font-semibold text-bone">Histórico</h2>
            <div className="mt-4 space-y-2.5">
              {passados.map((v) => (
                <div
                  key={v.pedidoId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-ink-elev/60 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="font-body text-sm text-bone">{v.barbeariaNome}</p>
                    <p className="font-body text-xs text-bone-dim">
                      {formatDayLabel(v.data)} · {v.servicos.join(" + ")}
                    </p>
                    {v.produtos.length > 0 && (
                      <p className="font-body text-[11px] text-cyan-bright">
                        + {v.produtos.join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-accent text-sm text-bone-dim">
                      {dinheiro(v.total)}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 font-body text-xs font-medium ${STATUS_CLASS[v.status]}`}
                    >
                      {STATUS_LABEL[v.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
