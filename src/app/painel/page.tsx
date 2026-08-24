"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import {
  cancelarAgendamento,
  concluirAgendamento,
  confirmarAgendamento,
  getAgendamentos,
  getBarbearia,
  getProdutos,
  statusAssinaturaEfetivo,
} from "@/lib/db";
import { ConcluirAtendimentoModal } from "@/components/ConcluirAtendimentoModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AvisoAssinatura } from "@/components/AvisoAssinatura";
import { RetornoAssinatura } from "@/components/RetornoAssinatura";
import { toISODate } from "@/lib/date";
import { sair, useSession } from "@/lib/use-session";
import { useAsync } from "@/lib/use-async";
import { getPlan } from "@/lib/plans";
import { METODO_LABEL, type Agendamento } from "@/lib/types";
import { agruparEmVisitas } from "@/lib/agrupar";
import { contaNoCaixa, getLancamentos, resumirCaixa } from "@/lib/caixa";
import { caminhoLoja } from "@/lib/slug";

function dinheiro(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

const STATUS_LABEL: Record<Agendamento["status"], string> = {
  aguardando_pagamento: "Pagamento não concluído",
  pendente: "Aguardando confirmação",
  confirmado: "Confirmado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const STATUS_CLASS: Record<Agendamento["status"], string> = {
  aguardando_pagamento: "bg-bone/5 text-muted",
  pendente: "bg-warn-soft text-warn",
  confirmado: "bg-ok-soft text-ok",
  concluido: "bg-bone/5 text-muted",
  cancelado: "bg-off-soft text-off",
};

export default function PainelPage() {
  const router = useRouter();
  const session = useSession();
  const [concluindo, setConcluindo] = useState<Agendamento | null>(null);
  const [copiado, setCopiado] = useState(false);
  const dono = session?.role === "dono";

  const { dados, recarregar } = useAsync(
    async () => {
      const id = session!.barbeariaId;
      const [barbearia, agendamentos] = await Promise.all([
        getBarbearia(id),
        getAgendamentos(id),
      ]);
      // Produtos só existem no Pro — no Básico o modal fecha só o serviço.
      const produtos = barbearia?.plano === "pro" ? await getProdutos(id) : [];

      // mp_contas não é legível pelo navegador (é onde mora o access token),
      // então o status vem por rota de API.
      const mp = await fetch(`/api/mp/status?barbearia=${id}`)
        .then((r) => r.json())
        .catch(() => ({ conectada: false }));

      // O caixa vem da mesma fonte da tela de Caixa pra as duas não
      // discordarem — e porque produto vendido mora em outra tabela, fora
      // do `agendamentos.preco`.
      const hojeISO = toISODate(new Date());
      const lancamentos = await getLancamentos(id, hojeISO, hojeISO);

      return {
        barbearia,
        agendamentos,
        produtos,
        lancamentos,
        mpConectado: Boolean(mp.conectada),
      };
    },
    [session?.barbeariaId],
    { pular: !dono },
  );

  if (!session || !dono) return null;

  const barbearia = dados?.barbearia;
  const produtos = dados?.produtos ?? [];
  const mpConectado = dados?.mpConectado ?? true; // não pisca o aviso enquanto carrega

  const hoje = toISODate(new Date());
  // Só hoje aqui (a semana inteira fica na tela de Agenda); cancelados ficam
  // fora da agenda do dia a dia — só o histórico em Relatórios os mantém.
  const agendamentos = (dados?.agendamentos ?? []).filter(
    (a) => a.data === hoje && a.status !== "cancelado",
  );
  // Cada serviço é uma linha no banco, mas o cliente é um só: agrupamos por
  // pedido pra não repetir a mesma pessoa várias vezes na lista.
  const pendentes = agruparEmVisitas(agendamentos.filter((a) => a.status === "pendente"));
  const visitasDoDia = agruparEmVisitas(agendamentos);

  // Só conta o que virou atendimento de verdade: pendente ainda nem foi
  // confirmado e "aguardando_pagamento" é checkout do MP abandonado — os
  // dois inflariam o dia com dinheiro que não existe.
  const valendo = agendamentos.filter((a) => contaNoCaixa(a.status));

  // Dinheiro sai do caixa (serviço + produto); a agenda cuida do resto.
  const caixa = resumirCaixa(dados?.lancamentos ?? []);
  const totalJaPago = caixa.recebido;
  const totalAReceber = caixa.aReceber;
  const faturamentoHoje = caixa.total;
  const ticketMedio = caixa.ticketMedio;
  const produtosVendidosHoje = caixa.emProdutos;

  // O que já foi atendido vs o que ainda está por vir.
  const concluidos = valendo.filter((a) => a.status === "concluido");
  const aAtender = valendo.filter((a) => a.status === "confirmado");
  const aguardandoNoBalcao = valendo.filter(
    (a) => a.formaPagamento === "local" && a.status === "confirmado",
  );
  const aReceber = valendo.filter((a) => a.formaPagamento === "local");

  // Quantas vendas online — por cliente, não por serviço da linha.
  const pagosOnline = (dados?.lancamentos ?? []).filter(
    (l) =>
      l.formaPagamento === "online" &&
      l.status !== "pendente" &&
      l.status !== "cancelado",
  ).length;

  const agora = new Date().toTimeString().slice(0, 5);
  const proximo =
    aAtender.find((a) => a.hora >= agora) ?? aAtender[0];

  // Produto acabando: aviso discreto pra repor antes de perder venda.
  const estoqueBaixo = produtos.filter((p) => p.ativo && p.estoque > 0 && p.estoque <= 5);
  const semEstoque = produtos.filter((p) => p.ativo && p.estoque === 0);

  async function handleConfirmar(ids: string[]) {
    await Promise.all(ids.map((id) => confirmarAgendamento(id)));
    recarregar();
  }

  async function handleCancelar(ids: string[]) {
    await Promise.all(ids.map((id) => cancelarAgendamento(id)));
    recarregar();
  }

  const plano = getPlan(barbearia?.plano);

  const caminhoDaLoja = barbearia ? caminhoLoja(barbearia) : `/loja/${session.barbeariaId}`;
  // origin só existe no navegador; em SSR o botão nem chega a ser clicado.
  const linkPublico =
    typeof window === "undefined" ? caminhoDaLoja : `${window.location.origin}${caminhoDaLoja}`;

  return (
    <div>
      {/* Suspense porque o componente lê a query string. */}
      <Suspense fallback={null}>
        <RetornoAssinatura onConfirmado={recarregar} />
      </Suspense>

      {barbearia && (
        <AvisoAssinatura
          status={{
            status: statusAssinaturaEfetivo(barbearia),
            trialTerminaEm: barbearia.trialTerminaEm ?? null,
            assinaturaAte: barbearia.assinaturaAte ?? null,
            planoNome: plano.name,
            planoValor: plano.valor,
          }}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-accent text-xs uppercase tracking-[0.2em] text-gold-bright">
            Painel da barbearia
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-bone">
            {session.barbeariaNome}
          </h1>
          <p className="mt-1 font-body text-sm text-bone-dim">
            Olá, {session.nome.split(" ")[0]} — aqui está o resumo de hoje.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* O link da loja é o que o dono manda pro cliente — fica junto do
              botão de visitar pra não precisar caçar em Localização. */}
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(linkPublico).catch(() => {});
              setCopiado(true);
              window.setTimeout(() => setCopiado(false), 2000);
            }}
            title={linkPublico}
            className="rounded-full border border-line-strong px-4 py-2 font-body text-sm font-semibold text-bone-dim transition-colors hover:border-gold-bright/40 hover:text-gold-bright"
          >
            {copiado ? "Link copiado!" : "Copiar link da loja"}
          </button>
          <Link
            href={caminhoDaLoja}
            target="_blank"
            className="rounded-full border border-line-strong px-4 py-2 font-body text-sm font-semibold text-bone-dim transition-colors hover:border-gold-bright/40 hover:text-gold-bright"
          >
            Visitar site ↗
          </Link>
          <div className="md:hidden">
            <ThemeToggle compact />
          </div>
          <button
            onClick={async () => {
              await sair();
              router.push("/login");
            }}
            className="rounded-full border border-line-strong px-4 py-2 font-body text-xs text-bone-dim hover:border-gold-bright/40 hover:text-gold-bright md:hidden"
          >
            Sair
          </button>
        </div>
      </div>

      {/* CAIXA DO DIA — o que já entrou e o que ainda falta receber */}
      <div className="mt-8 flex items-baseline justify-between gap-3">
        <p className="font-display text-lg font-semibold text-bone">Caixa de hoje</p>
        <Link
          href="/painel/caixa"
          className="font-body text-xs font-semibold text-gold-bright hover:underline"
        >
          Ver tudo que foi vendido →
        </Link>
      </div>
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-line bg-ink-elev/60 p-5 lg:col-span-1">
          <p className="font-body text-xs text-muted">Total do dia</p>
          <p className="mt-1 font-accent text-3xl text-bone">
            {dinheiro(faturamentoHoje)}
          </p>
          <p className="mt-1.5 font-body text-xs text-muted">
            {caixa.clientes} cliente(s) · ticket médio {dinheiro(ticketMedio)}
          </p>
        </div>

        <div className="rounded-2xl border border-ok-line bg-ok-soft p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ok/20">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3 text-ok"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <p className="font-body text-xs font-semibold text-ok">Já pago online</p>
          </div>
          <p className="mt-2 font-accent text-3xl text-bone">{dinheiro(totalJaPago)}</p>
          <p className="mt-1.5 font-body text-xs text-bone-dim">
            {pagosOnline === 0
              ? "Nenhum pagamento online hoje"
              : `${pagosOnline} venda(s) · caiu na sua conta`}
          </p>
        </div>

        <div className="rounded-2xl border border-warn-line bg-warn-soft p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-warn/20">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3 text-warn"
              >
                <path d="M3 21h18M5 21V10l7-5 7 5v11M10 21v-6h4v6" />
              </svg>
            </span>
            <p className="font-body text-xs font-semibold text-warn">A receber no balcão</p>
          </div>
          <p className="mt-2 font-accent text-3xl text-bone">{dinheiro(totalAReceber)}</p>
          <p className="mt-1.5 font-body text-xs text-bone-dim">
            {aguardandoNoBalcao.length > 0
              ? `${aguardandoNoBalcao.length} ainda por atender`
              : aReceber.length > 0
                ? "todos já atendidos"
                : "Nenhuma cobrança no balcão hoje"}
          </p>
        </div>
      </div>

      {/* NÚMEROS DO DIA */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Clientes hoje",
            valor: String(visitasDoDia.length),
            nota: `${concluidos.length} atendido(s) · ${aAtender.length} por vir`,
          },
          {
            label: "Aguardando confirmação",
            valor: String(pendentes.length),
            nota: pendentes.length > 0 ? "confirme na lista de pendentes" : "nada na fila",
            alerta: pendentes.length > 0,
          },
          {
            label: "Próximo cliente",
            valor: proximo ? proximo.hora : "—",
            nota: proximo ? proximo.clienteNome : "agenda livre",
          },
          {
            label: "Produtos vendidos",
            valor: dinheiro(produtosVendidosHoje),
            nota:
              barbearia?.plano === "pro" ? "junto dos atendimentos" : "exclusivo do Pro",
          },
        ].map((c) => (
          <div
            key={c.label}
            className={`rounded-2xl border p-5 ${
              c.alerta ? "border-warn-line bg-warn-soft" : "border-line bg-ink-elev/60"
            }`}
          >
            <p className="font-body text-xs text-muted">{c.label}</p>
            <p className="mt-1 font-accent text-2xl text-bone">{c.valor}</p>
            <p className="mt-1 font-body text-[11px] text-muted">{c.nota}</p>
          </div>
        ))}
      </div>

      {/* ESTOQUE ACABANDO */}
      {(estoqueBaixo.length > 0 || semEstoque.length > 0) && (
        <Link
          href="/painel/estoque"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-ink-elev/60 p-5 transition-colors hover:border-warn-line"
        >
          <div>
            <p className="font-body text-sm font-semibold text-bone">
              {semEstoque.length > 0
                ? `${semEstoque.length} produto(s) sem estoque`
                : `${estoqueBaixo.length} produto(s) acabando`}
            </p>
            <p className="mt-0.5 font-body text-xs text-bone-dim">
              {[...semEstoque, ...estoqueBaixo]
                .slice(0, 3)
                .map((p) => `${p.nome} (${p.estoque})`)
                .join(" · ")}
            </p>
          </div>
          <span className="shrink-0 font-body text-xs font-semibold text-gold-bright">
            Repor estoque →
          </span>
        </Link>
      )}

      {barbearia && !mpConectado && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-warn-line bg-warn-soft p-5">
          <div>
            <p className="font-body text-sm font-semibold text-bone">
              Você ainda não recebe pagamento online
            </p>
            <p className="mt-0.5 font-body text-xs text-bone-dim">
              Conecte sua conta do Mercado Pago pra que o cliente já pague ao agendar.
            </p>
          </div>
          <Link
            href="/painel/pagamentos"
            className="shrink-0 rounded-full bg-gold-bright px-5 py-2.5 font-body text-xs font-semibold text-ink transition-transform hover:scale-[1.03]"
          >
            Conectar Mercado Pago
          </Link>
        </div>
      )}

      {pendentes.length > 0 && (
        <div className="mt-8 rounded-2xl border border-warn-line bg-warn-soft p-6">
          <p className="font-display text-lg font-semibold text-bone">
            Aguardando confirmação
          </p>
          <p className="mt-1 font-body text-xs text-bone-dim">
            Cliente escolheu pagar no local — confirme quando o pagamento
            acontecer, ou cancele se ele não aparecer.
          </p>
          <div className="mt-4 space-y-2.5">
            {pendentes.map((v) => (
              <div
                key={v.chave}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn-line bg-ink-elev px-4 py-3"
              >
                <div className="flex items-center gap-4">
                  <span className="font-accent text-sm text-warn">{v.hora}</span>
                  <div>
                    <p className="font-body text-sm text-bone">{v.clienteNome}</p>
                    <p className="font-body text-xs text-bone-dim">
                      {v.servicos.join(" + ")} · R${" "}
                      {v.total.toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleConfirmar(v.ids)}
                    className="rounded-full bg-gold-bright px-4 py-1.5 font-body text-xs font-semibold text-ink transition-transform hover:scale-[1.03]"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => handleCancelar(v.ids)}
                    className="rounded-full border border-line-strong px-4 py-1.5 font-body text-xs text-bone-dim hover:border-off-line hover:text-off"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-line bg-ink-elev/60 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-display text-lg font-semibold text-bone">
            Agenda de hoje
          </p>
          <Link
            href="/painel/agenda"
            className="font-body text-xs font-semibold text-gold-bright hover:underline"
          >
            Ver a semana →
          </Link>
        </div>
        <div className="mt-4 space-y-2.5">
          {visitasDoDia.length === 0 && (
            <p className="rounded-xl border border-dashed border-line-strong px-4 py-10 text-center font-body text-sm text-bone-dim">
              Nenhum cliente marcado pra hoje.
            </p>
          )}
          {visitasDoDia.map((v) => {
            const status = v.primeiro.status;
            return (
              <div
                key={v.chave}
                className="flex items-center justify-between rounded-xl border border-line px-4 py-3"
              >
                <div className="flex items-center gap-4">
                  <span className="font-accent text-sm text-gold-bright">
                    {v.hora}
                  </span>
                  <div>
                    <p className="font-body text-sm text-bone">{v.clienteNome}</p>
                    <p className="font-body text-xs text-bone-dim">
                      {v.servicos.join(" + ")}
                      {v.metodoPagamento && (
                        <span className="ml-1.5 rounded bg-ok-soft px-1.5 py-0.5 font-body text-[10px] font-medium text-ok">
                          {METODO_LABEL[v.metodoPagamento]}
                        </span>
                      )}
                    </p>
                    {v.produtos.length > 0 && (
                      <p className="font-body text-[11px] text-cyan-bright">
                        + {v.produtos.map((p) => p.produtoNome).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {status === "confirmado" && (
                    <button
                      onClick={() => setConcluindo(v.primeiro)}
                      className="rounded-full border border-gold-bright/40 px-3.5 py-1.5 font-body text-xs font-semibold text-gold-bright hover:bg-gold-bright/10"
                    >
                      Concluir
                    </button>
                  )}
                  <span
                    className={`rounded-full px-3 py-1 font-body text-xs font-medium ${STATUS_CLASS[status]}`}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {concluindo && (
        <ConcluirAtendimentoModal
          agendamento={concluindo}
          produtos={produtos}
          onClose={() => setConcluindo(null)}
          onConcluir={async (vendidos) => {
            await concluirAgendamento(
              concluindo.id,
              session.barbeariaId,
              vendidos,
              concluindo.clienteNome,
            );
            setConcluindo(null);
            recarregar();
          }}
        />
      )}
    </div>
  );
}
