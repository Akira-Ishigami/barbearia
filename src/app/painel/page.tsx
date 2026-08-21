"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { toISODate } from "@/lib/date";
import { sair, useSession } from "@/lib/use-session";
import { useAsync } from "@/lib/use-async";
import { getPlan } from "@/lib/plans";
import { METODO_LABEL, type Agendamento } from "@/lib/types";

const STATUS_LABEL: Record<Agendamento["status"], string> = {
  pendente: "Aguardando confirmação",
  confirmado: "Confirmado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const STATUS_CLASS: Record<Agendamento["status"], string> = {
  pendente: "bg-warn-soft text-warn",
  confirmado: "bg-ok-soft text-ok",
  concluido: "bg-bone/5 text-muted",
  cancelado: "bg-off-soft text-off",
};

export default function PainelPage() {
  const router = useRouter();
  const session = useSession();
  const [concluindo, setConcluindo] = useState<Agendamento | null>(null);
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

      return { barbearia, agendamentos, produtos, mpConectado: Boolean(mp.conectada) };
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
  const pendentes = agendamentos.filter((a) => a.status === "pendente");
  const faturamentoHoje = agendamentos
    .filter((a) => a.status !== "pendente")
    .reduce((sum, a) => sum + a.preco, 0);
  const proximo = agendamentos.find((a) => a.status === "confirmado");

  async function handleConfirmar(id: string) {
    await confirmarAgendamento(id);
    recarregar();
  }

  async function handleCancelar(id: string) {
    await cancelarAgendamento(id);
    recarregar();
  }

  const plano = getPlan(barbearia?.plano);

  return (
    <div>
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
          <Link
            href={`/loja/${session.barbeariaId}`}
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

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        {[
          ["Agendamentos hoje", String(agendamentos.length)],
          ["Faturamento do dia", `R$ ${faturamentoHoje.toFixed(2).replace(".", ",")}`],
          ["Aguardando confirmação", String(pendentes.length)],
          ["Próximo cliente", proximo ? `${proximo.hora} · ${proximo.clienteNome}` : "Nenhum"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-ink-elev/60 p-5">
            <p className="font-body text-xs text-muted">{label}</p>
            <p className="mt-1 font-accent text-2xl text-bone">{value}</p>
          </div>
        ))}
      </div>

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
            {pendentes.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn-line bg-ink-elev px-4 py-3"
              >
                <div className="flex items-center gap-4">
                  <span className="font-accent text-sm text-warn">{a.hora}</span>
                  <div>
                    <p className="font-body text-sm text-bone">{a.clienteNome}</p>
                    <p className="font-body text-xs text-bone-dim">{a.servicoNome}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleConfirmar(a.id)}
                    className="rounded-full bg-gold-bright px-4 py-1.5 font-body text-xs font-semibold text-ink transition-transform hover:scale-[1.03]"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => handleCancelar(a.id)}
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
        <p className="font-display text-lg font-semibold text-bone">
          Agenda de hoje
        </p>
        <div className="mt-4 space-y-2.5">
          {agendamentos.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-xl border border-line px-4 py-3"
            >
              <div className="flex items-center gap-4">
                <span className="font-accent text-sm text-gold-bright">
                  {a.hora}
                </span>
                <div>
                  <p className="font-body text-sm text-bone">{a.clienteNome}</p>
                  <p className="font-body text-xs text-bone-dim">
                    {a.servicoNome}
                    {a.metodoPagamento && (
                      <span className="ml-1.5 rounded bg-ok-soft px-1.5 py-0.5 font-body text-[10px] font-medium text-ok">
                        {METODO_LABEL[a.metodoPagamento]}
                      </span>
                    )}
                  </p>
                  {a.produtosComprados && a.produtosComprados.length > 0 && (
                    <p className="font-body text-[11px] text-cyan-bright">
                      + {a.produtosComprados.map((p) => p.produtoNome).join(", ")}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {a.status === "confirmado" && (
                  <button
                    onClick={() => setConcluindo(a)}
                    className="rounded-full border border-gold-bright/40 px-3.5 py-1.5 font-body text-xs font-semibold text-gold-bright hover:bg-gold-bright/10"
                  >
                    Concluir
                  </button>
                )}
                <span
                  className={`rounded-full px-3 py-1 font-body text-xs font-medium ${STATUS_CLASS[a.status]}`}
                >
                  {STATUS_LABEL[a.status]}
                </span>
              </div>
            </div>
          ))}
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
