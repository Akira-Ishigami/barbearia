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
    return <div className="theme-light loja-light flex flex-1 bg-ink" />;
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

  // Última barbearia visitada — é pra ela que o "voltar" leva.
  const lojaDeVolta = barbearias.length
    ? [...barbearias].sort((a, b) => b.ultima.localeCompare(a.ultima))[0]
    : null;

  const totalGasto = historico
    .filter((v) => v.status !== "cancelado")
    .reduce((t, v) => t + v.total, 0);

  return (
    <div className="theme-light loja-light grain flex flex-1 flex-col bg-ink text-bone">
      <header className="border-b border-line px-6 py-5">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          {/* Volta pra barbearia de onde a pessoa veio, não pra home do
              sistema: o cliente entrou pela loja, é lá que ele quer voltar. */}
          {lojaDeVolta ? (
            <Link
              href={`/loja/${lojaDeVolta.slug || lojaDeVolta.id}`}
              className="flex min-w-0 items-center gap-2 font-body text-sm text-bone-dim transition-colors hover:text-bone"
            >
              <span aria-hidden>←</span>
              <span className="truncate font-display font-semibold text-bone">
                {lojaDeVolta.nome}
              </span>
            </Link>
          ) : (
            <Link
              href="/barbearias"
              className="flex items-center gap-2 font-body text-sm text-bone-dim transition-colors hover:text-bone"
            >
              <span aria-hidden>←</span> Voltar
            </Link>
          )}
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
