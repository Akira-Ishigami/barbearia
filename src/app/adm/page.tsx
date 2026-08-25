"use client";

import Link from "next/link";
import { useAsync } from "@/lib/use-async";
import { cabecalhosPlataforma, usePlataforma } from "@/lib/use-plataforma";

/**
 * Visão geral da plataforma: quantas barbearias, quantas pagam, quanto
 * entra por mês e o que está prestes a vencer.
 *
 * A pergunta que essa tela responde é "como a Navalha está indo hoje" —
 * por isso o topo é receita e trial vencendo, não contagem de tabela.
 */

interface Visao {
  nivel: string;
  barbearias: {
    total: number;
    trial: number;
    ativa: number;
    vencida: number;
    novasEm30Dias: number;
    trialAcabandoEm3Dias: number;
  };
  planos: Record<string, number>;
  pagamentos: { comMercadoPago: number; comPixDireto: number; semRecebimentoOnline: number };
  receita: { mensalRecorrente: number; movimentadoNoMes: number };
  uso: { pedidos30Dias: number; clientes: number };
}

function dinheiro(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

function Cartao({
  titulo,
  valor,
  detalhe,
  tom = "neutro",
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  tom?: "neutro" | "ok" | "warn" | "off";
}) {
  const cores = {
    neutro: "border-line bg-ink-elev",
    ok: "border-ok-line bg-ok-soft",
    warn: "border-warn-line bg-warn-soft",
    off: "border-off-line bg-off-soft",
  }[tom];

  const rotulo = {
    neutro: "text-bone-dim",
    ok: "text-ok",
    warn: "text-warn",
    off: "text-off",
  }[tom];

  return (
    <div className={`rounded-2xl border p-5 ${cores}`}>
      <p className={`font-body text-xs font-semibold uppercase tracking-wide ${rotulo}`}>
        {titulo}
      </p>
      <p className="mt-2 font-accent text-3xl text-bone">{valor}</p>
      {detalhe && <p className="mt-1 font-body text-xs text-bone-dim">{detalhe}</p>}
    </div>
  );
}

export default function AdmVisaoPage() {
  const acesso = usePlataforma();

  const { dados, carregando, erro } = useAsync<Visao>(
    async () => {
      const r = await fetch("/api/adm/visao", { headers: await cabecalhosPlataforma() });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro ?? "Falha ao carregar.");
      return r.json();
    },
    [acesso?.email],
    { pular: !acesso },
  );

  if (!acesso) return null;

  return (
    <div>
      <p className="font-accent text-xs uppercase tracking-[0.2em] text-cyan-bright">
        Plataforma
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-bone">
        Como a Navalha está hoje
      </h1>
      <p className="mt-1 max-w-xl font-body text-sm text-bone-dim">
        Olá, {acesso.nome.split(" ")[0]}. Aqui é a soma de todas as barbearias —
        nenhuma delas enxerga a outra, só esta tela enxerga todas.
      </p>

      {erro && (
        <p className="mt-6 rounded-xl border border-off-line bg-off-soft px-4 py-3 font-body text-sm text-off">
          {erro}
        </p>
      )}

      {carregando && (
        <p className="mt-6 font-body text-sm text-bone-dim">Carregando…</p>
      )}

      {dados && (
        <>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Cartao
              titulo="Receita recorrente"
              valor={dinheiro(dados.receita.mensalRecorrente)}
              detalhe={`${dados.barbearias.ativa} barbearia(s) com assinatura em dia`}
              tom="ok"
            />
            <Cartao
              titulo="Em teste grátis"
              valor={String(dados.barbearias.trial)}
              detalhe={
                dados.barbearias.trialAcabandoEm3Dias > 0
                  ? `${dados.barbearias.trialAcabandoEm3Dias} vence(m) em até 3 dias`
                  : "Nenhum vencendo nos próximos 3 dias"
              }
              tom={dados.barbearias.trialAcabandoEm3Dias > 0 ? "warn" : "neutro"}
            />
            <Cartao
              titulo="Vencidas"
              valor={String(dados.barbearias.vencida)}
              detalhe="Sem teste e sem pagamento em dia"
              tom={dados.barbearias.vencida > 0 ? "off" : "neutro"}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Cartao
              titulo="Barbearias"
              valor={String(dados.barbearias.total)}
              detalhe={`+${dados.barbearias.novasEm30Dias} nos últimos 30 dias`}
            />
            <Cartao
              titulo="Movimentado no mês"
              valor={dinheiro(dados.receita.movimentadoNoMes)}
              detalhe="Dinheiro que os clientes pagaram às barbearias"
            />
            <Cartao
              titulo="Pedidos (30 dias)"
              valor={String(dados.uso.pedidos30Dias)}
              detalhe="Agendamentos e compras abertos"
            />
            <Cartao
              titulo="Clientes cadastrados"
              valor={String(dados.uso.clientes)}
              detalhe="Contas de quem agenda"
            />
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-line bg-ink-elev p-6">
              <p className="font-display text-lg font-semibold text-bone">Planos</p>
              <div className="mt-4 space-y-3">
                {[
                  { id: "basico", label: "Básico" },
                  { id: "pro", label: "Pro" },
                ].map((p) => {
                  const qtd = dados.planos[p.id] ?? 0;
                  const pct = dados.barbearias.total
                    ? Math.round((qtd / dados.barbearias.total) * 100)
                    : 0;
                  return (
                    <div key={p.id}>
                      <div className="flex items-center justify-between font-body text-sm">
                        <span className="text-bone-dim">{p.label}</span>
                        <span className="text-bone">
                          {qtd} <span className="text-muted">({pct}%)</span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bone/10">
                        <div
                          className="h-full rounded-full bg-cyan"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-ink-elev p-6">
              <p className="font-display text-lg font-semibold text-bone">
                Como elas recebem
              </p>
              <p className="mt-1 font-body text-xs text-muted">
                Quem não tem nenhum dos dois só consegue cobrar no balcão.
              </p>
              <div className="mt-4 space-y-2.5 font-body text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-bone-dim">Mercado Pago conectado</span>
                  <span className="text-bone">{dados.pagamentos.comMercadoPago}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-bone-dim">Pix direto</span>
                  <span className="text-bone">{dados.pagamentos.comPixDireto}</span>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-2.5">
                  <span className="text-bone-dim">Só no balcão</span>
                  <span
                    className={
                      dados.pagamentos.semRecebimentoOnline > 0 ? "text-warn" : "text-bone"
                    }
                  >
                    {dados.pagamentos.semRecebimentoOnline}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <Link
            href="/adm/barbearias"
            className="mt-8 inline-block rounded-full bg-cyan px-6 py-3 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.02]"
          >
            Ver todas as barbearias
          </Link>
        </>
      )}
    </div>
  );
}
