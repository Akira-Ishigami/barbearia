"use client";

import Link from "next/link";
import { TRIAL_DAYS, type PlanId } from "@/lib/plans";

/**
 * Botão dos planos na home. Leva pro cadastro — os {TRIAL_DAYS} dias são
 * grátis, então ninguém paga nada aqui. A cobrança só aparece dentro do
 * painel quando o trial vence.
 */
export function BotaoAssinar({
  plano,
  destaque,
}: {
  plano: PlanId;
  destaque: boolean;
}) {
  return (
    <Link
      href={`/cadastro?plano=${plano}`}
      className={`mt-10 block rounded-full py-3.5 text-center font-body text-sm font-semibold transition-transform hover:scale-[1.02] ${
        destaque
          ? "bg-gold-bright text-ink"
          : "border border-line-strong text-bone hover:border-gold-bright hover:text-gold-bright"
      }`}
    >
      Começar grátis por {TRIAL_DAYS} dias
    </Link>
  );
}
