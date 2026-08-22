"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addServicoToCart, setBarbeiroPreferido } from "@/lib/cart";
import { getClienteLogado, getHistoricoCliente } from "@/lib/cliente-db";
import { preferenciasNaBarbearia } from "@/lib/preferencias";
import { useAsync } from "@/lib/use-async";
import { caminhoLoja } from "@/lib/slug";
import type { Barbearia, BarbeiroPerfil, Servico } from "@/lib/types";

/**
 * Atalho pra quem já é cliente da casa: monta o carrinho com o que a pessoa
 * costuma fazer, em um toque.
 *
 * Não aparece pra visitante nem pra quem nunca veio nesta barbearia — nesses
 * casos não há hábito nenhum pra repetir, e o bloco só atrapalharia.
 */
export function RetomarVisita({
  barbearia,
  servicos,
  barbeiros,
}: {
  barbearia: Barbearia;
  servicos: Servico[];
  barbeiros: BarbeiroPerfil[];
}) {
  const router = useRouter();
  const [montando, setMontando] = useState(false);

  const { dados } = useAsync(async () => {
    const cliente = await getClienteLogado();
    if (!cliente) return null;

    const historico = await getHistoricoCliente(cliente.id);
    return {
      nome: cliente.nome,
      pref: preferenciasNaBarbearia(historico, barbearia.id),
    };
  }, [barbearia.id]);

  if (!dados?.pref) return null;

  const { nome, pref } = dados;

  // O serviço é casado pelo nome porque o agendamento guarda o nome, não o
  // id — se a barbearia renomeou ou tirou do catálogo, some daqui.
  const paraRepetir = pref.ultimosServicos
    .map((n) => servicos.find((s) => s.nome === n && s.ativo))
    .filter((s): s is Servico => Boolean(s));

  if (paraRepetir.length === 0) return null;

  const barbeiro = barbeiros.find(
    (b) => b.id === pref.barbeiroPreferidoId && b.ativo,
  );

  const total = paraRepetir.reduce((t, s) => t + s.preco, 0);

  function repetir() {
    setMontando(true);
    for (const s of paraRepetir) addServicoToCart(barbearia.id, s);
    if (barbeiro) setBarbeiroPreferido(barbearia.id, barbeiro.id);
    router.push(`${caminhoLoja(barbearia)}/carrinho`);
  }

  return (
    <section className="px-6 pt-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-ink-elev p-5">
          <div className="min-w-0">
            <p className="font-body text-sm font-semibold text-bone">
              Bem-vindo de volta, {nome.split(" ")[0]}
            </p>
            <p className="mt-0.5 font-body text-xs text-bone-dim">
              {pref.visitas === 1
                ? "Repetir o que você fez da última vez: "
                : `Sua ${pref.visitas}ª visita. O de sempre: `}
              <span className="text-bone">{paraRepetir.map((s) => s.nome).join(" + ")}</span>
              {barbeiro && <> com {barbeiro.nome}</>}
              {pref.horarioHabitual && <> · costuma vir às {pref.horarioHabitual}</>}
            </p>
          </div>

          <button
            onClick={repetir}
            disabled={montando}
            className="shrink-0 rounded-full bg-bone px-6 py-3 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.03] disabled:opacity-60"
          >
            {montando
              ? "Montando…"
              : `Repetir · R$ ${total.toFixed(2).replace(".", ",")}`}
          </button>
        </div>
      </div>
    </section>
  );
}
