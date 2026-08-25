"use client";

import Link from "next/link";
import { TRIAL_DAYS, getPlan, type PlanId } from "@/lib/plans";

/**
 * Botão dos planos na home. Leva pro cadastro em qualquer caso — a cobrança
 * do Pro acontece dentro do painel, não aqui.
 *
 * Os dois planos têm o mesmo mês grátis, então o texto do botão é igual
 * nos dois. O `temTrial` continua sendo consultado em vez de assumido:
 * se um plano voltar a ser pago desde o primeiro dia, o botão para de
 * prometer grátis sozinho.
 */
export function BotaoAssinar({
  plano,
  destaque,
}: {
  plano: PlanId;
  destaque: boolean;
}) {
  const p = getPlan(plano);

  return (
    <Link
      href={`/cadastro?plano=${plano}`}
      className={`mt-10 block rounded-full py-3.5 text-center font-body text-sm font-semibold transition-transform hover:scale-[1.02] ${
        destaque
          ? "bg-gold-bright text-ink"
          : "border border-line-strong text-bone hover:border-gold-bright hover:text-gold-bright"
      }`}
    >
      {p.temTrial ? `Começar grátis por ${TRIAL_DAYS} dias` : `Assinar o ${p.name}`}
    </Link>
  );
}
