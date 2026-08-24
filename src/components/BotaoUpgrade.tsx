"use client";

import { useState } from "react";
import { ModalUpgrade } from "@/components/ModalUpgrade";

/**
 * Abre a comparação de planos sem tirar o dono do painel.
 *
 * Antes cada tela bloqueada linkava pra `/#planos`, jogando a pessoa na
 * página de vendas — ela perdia onde estava e tinha que se achar de volta.
 */
export function BotaoUpgrade({
  texto = "Ver plano Pro",
  className,
}: {
  texto?: string;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className={
          className ??
          "mt-5 inline-block rounded-full bg-gold-bright px-6 py-3 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.03]"
        }
      >
        {texto}
      </button>
      {aberto && <ModalUpgrade onClose={() => setAberto(false)} />}
    </>
  );
}
