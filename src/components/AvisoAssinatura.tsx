"use client";

import { useState } from "react";
import { cabecalhosAutenticados } from "@/lib/db";
import { TRIAL_DAYS } from "@/lib/plans";

export interface StatusAssinatura {
  status: "trial" | "ativa" | "vencida";
  trialTerminaEm: string | null;
  assinaturaAte: string | null;
  planoNome: string;
  planoValor: number;
}

function diasAte(iso: string | null): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

/**
 * Faixa no topo do painel avisando sobre o trial ou a cobrança.
 *
 * - trial em dia    → conta os dias restantes, com botão de assinar já
 * - trial vencendo  → aviso mais forte nos últimos 2 dias
 * - vencida         → bloqueia visualmente e força o pagamento
 */
export function AvisoAssinatura({ status }: { status: StatusAssinatura }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function assinar() {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/assinatura", {
        method: "POST",
        headers: await cabecalhosAutenticados(),
      });
      const corpo = await resposta.json().catch(() => ({}));
      if (resposta.ok && corpo.url) {
        window.location.href = corpo.url;
        return;
      }
      setErro(corpo.erro ?? "Não foi possível abrir o pagamento.");
    } catch {
      setErro("Falha de conexão. Tente de novo.");
    }
    setCarregando(false);
  }

  const preco = `R$ ${status.planoValor.toFixed(2).replace(".", ",")}`;

  // ── Assinatura ativa: nada a mostrar ──
  if (status.status === "ativa") return null;

  // ── Vencida: bloqueio ──
  if (status.status === "vencida") {
    return (
      <div className="mb-6 rounded-2xl border border-off-line bg-off-soft p-5">
        <p className="font-display text-lg font-semibold text-bone">
          Seu período grátis terminou
        </p>
        <p className="mt-1 max-w-xl font-body text-sm text-bone-dim">
          Pra continuar recebendo agendamentos e usando o painel, assine o plano{" "}
          {status.planoNome} por {preco}/mês.
        </p>
        <button
          onClick={assinar}
          disabled={carregando}
          className="mt-4 rounded-full bg-gold-bright px-6 py-3 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.02] disabled:opacity-60"
        >
          {carregando ? "Abrindo pagamento…" : `Assinar por ${preco}/mês`}
        </button>
        {erro && <p className="mt-2 font-body text-xs text-off">{erro}</p>}
      </div>
    );
  }

  // ── Trial em andamento ──
  const dias = diasAte(status.trialTerminaEm);
  const urgente = dias <= 2;

  return (
    <div
      className={`mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 ${
        urgente ? "border-warn-line bg-warn-soft" : "border-line bg-ink-elev/60"
      }`}
    >
      <div>
        <p className="font-body text-sm font-semibold text-bone">
          {dias === 0
            ? "Seu período grátis termina hoje"
            : dias === 1
              ? "Falta 1 dia do seu período grátis"
              : `Faltam ${dias} dias do seu período grátis`}
        </p>
        <p className="mt-0.5 font-body text-xs text-bone-dim">
          Depois dos {TRIAL_DAYS} dias, o plano {status.planoNome} custa {preco}/mês.
        </p>
      </div>
      <button
        onClick={assinar}
        disabled={carregando}
        className="shrink-0 rounded-full bg-gold-bright px-5 py-2.5 font-body text-xs font-semibold text-ink transition-transform hover:scale-[1.03] disabled:opacity-60"
      >
        {carregando ? "Abrindo…" : "Assinar agora"}
      </button>
      {erro && <p className="w-full font-body text-xs text-off">{erro}</p>}
    </div>
  );
}
