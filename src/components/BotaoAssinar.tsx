"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TRIAL_DAYS, type PlanId } from "@/lib/plans";

/**
 * Botão dos planos na home. Manda a barbearia pro Checkout Pro do Mercado
 * Pago (conta da Navalha). Se o pagamento ainda não estiver configurado no
 * ambiente, cai no cadastro normal em vez de mostrar erro pro visitante.
 */
export function BotaoAssinar({
  plano,
  destaque,
}: {
  plano: PlanId;
  destaque: boolean;
}) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function assinar() {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/assinatura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano }),
      });

      if (resposta.ok) {
        const { url } = await resposta.json();
        if (url) {
          window.location.href = url;
          return;
        }
      }
      // 503 = cobrança ainda não configurada; segue pro cadastro.
      router.push(`/cadastro?plano=${plano}`);
    } catch {
      setErro("Não foi possível abrir o pagamento. Tente de novo.");
      setCarregando(false);
    }
  }

  return (
    <div className="mt-10">
      <button
        onClick={assinar}
        disabled={carregando}
        className={`block w-full rounded-full py-3.5 text-center font-body text-sm font-semibold transition-transform hover:scale-[1.02] disabled:opacity-60 ${
          destaque
            ? "bg-gold-bright text-ink"
            : "border border-line-strong text-bone hover:border-gold-bright hover:text-gold-bright"
        }`}
      >
        {carregando ? "Abrindo pagamento…" : `Começar grátis por ${TRIAL_DAYS} dias`}
      </button>
      {erro && (
        <p className="mt-2 text-center font-body text-xs text-rose-300">{erro}</p>
      )}
    </div>
  );
}
