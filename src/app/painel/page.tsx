"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  cancelarAgendamento,
  concluirAgendamento,
  confirmarAgendamento,
  getAgendamentos,
  getBarbeariaById,
  getProdutos,
  logout,
} from "@/lib/mock-db";
import { ConcluirAtendimentoModal } from "@/components/ConcluirAtendimentoModal";
import { toISODate } from "@/lib/date";
import { useSession } from "@/lib/use-session";
import type { Agendamento } from "@/lib/types";

const STATUS_LABEL: Record<Agendamento["status"], string> = {
  pendente: "Aguardando confirmação",
  confirmado: "Confirmado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const STATUS_CLASS: Record<Agendamento["status"], string> = {
  pendente: "bg-amber-400/10 text-amber-300",
  confirmado: "bg-gold-bright/15 text-gold-bright",
  concluido: "bg-white/5 text-muted",
  cancelado: "bg-rose-500/10 text-rose-300",
};

export default function PainelPage() {
  const router = useRouter();
  const session = useSession();
  const [, forceRefresh] = useState(0);
  const [concluindo, setConcluindo] = useState<Agendamento | null>(null);

  if (!session || session.role !== "dono") {
    return null;
  }

  // Produtos só existem no Pro — no Básico o modal fecha só o serviço.
  const isPro = getBarbeariaById(session.barbeariaId)?.plano === "pro";
  const produtos = isPro ? getProdutos(session.barbeariaId) : [];

  const hoje = toISODate(new Date());
  // Só hoje aqui (a semana inteira fica na tela de Agenda); cancelados ficam
  // fora da agenda do dia a dia — só o histórico em Relatórios os mantém.
  const agendamentos = getAgendamentos(session.barbeariaId).filter(
    (a) => a.data === hoje && a.status !== "cancelado",
  );
  const pendentes = agendamentos.filter((a) => a.status === "pendente");
  const faturamentoHoje = agendamentos
    .filter((a) => a.status !== "pendente")
    .reduce((sum, a) => sum + a.preco, 0);
  const proximo = agendamentos.find((a) => a.status === "confirmado");

  function handleConfirmar(id: string) {
    confirmarAgendamento(id);
    forceRefresh((k) => k + 1);
  }

  function handleCancelar(id: string) {
    cancelarAgendamento(id);
    forceRefresh((k) => k + 1);
  }

  return (
    <div>
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
          <button
            onClick={() => {
              logout();
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

      {pendentes.length > 0 && (
        <div className="mt-8 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-6">
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
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-ink-elev/60 px-4 py-3"
              >
                <div className="flex items-center gap-4">
                  <span className="font-accent text-sm text-amber-300">{a.hora}</span>
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
                    className="rounded-full border border-line-strong px-4 py-1.5 font-body text-xs text-bone-dim hover:border-rose-400/40 hover:text-rose-300"
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
                  <p className="font-body text-xs text-bone-dim">{a.servicoNome}</p>
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
          onConcluir={(vendidos) => {
            concluirAgendamento(concluindo.id, vendidos);
            setConcluindo(null);
            forceRefresh((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
