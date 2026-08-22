"use client";

import { createContext, useContext } from "react";
import { getBarbeariaPorSlugOuId, getBarbeiros, getProdutos, getServicos } from "./db";
import { supabaseConfigurado } from "./supabase-browser";
import { useAsync } from "./use-async";
import type { Barbearia, BarbeiroPerfil, Produto, Servico } from "./types";

interface LojaData {
  barbearia: Barbearia | undefined;
  servicos: Servico[];
  produtos: Produto[];
  barbeiros: BarbeiroPerfil[];
  isPro: boolean;
  loaded: boolean;
  erro: string | null;
}

const VAZIO: LojaData = {
  barbearia: undefined,
  servicos: [],
  produtos: [],
  barbeiros: [],
  isPro: false,
  loaded: false,
  erro: null,
};

const LojaContext = createContext<LojaData | null>(null);

/** Carrega os dados públicos da barbearia e compartilha entre catálogo, carrinho e pagamento. */
export function LojaProvider({ id, children }: { id: string; children: React.ReactNode }) {
  const configurado = supabaseConfigurado();

  const { dados, carregando, erro } = useAsync(
    async () => {
      // `id` aqui é o que veio na URL: pode ser o slug ou o uuid antigo.
      const barbearia = await getBarbeariaPorSlugOuId(id);
      if (!barbearia) return { barbearia: undefined, servicos: [], produtos: [], barbeiros: [] };

      // Daqui pra frente sempre o uuid — as outras tabelas referenciam por ele.
      const [servicos, produtos, barbeiros] = await Promise.all([
        getServicos(barbearia.id),
        getProdutos(barbearia.id),
        getBarbeiros(barbearia.id),
      ]);

      return {
        barbearia,
        servicos: servicos.filter((s) => s.ativo),
        produtos: produtos.filter((p) => p.ativo),
        barbeiros: barbeiros.filter((b) => b.ativo),
      };
    },
    [id],
    { pular: !configurado || !id },
  );

  const value: LojaData = !configurado
    ? { ...VAZIO, loaded: true, erro: "Banco não configurado." }
    : {
        barbearia: dados?.barbearia,
        servicos: dados?.servicos ?? [],
        produtos: dados?.produtos ?? [],
        barbeiros: dados?.barbeiros ?? [],
        isPro: dados?.barbearia?.plano === "pro",
        loaded: !carregando,
        erro,
      };

  return <LojaContext.Provider value={value}>{children}</LojaContext.Provider>;
}

export function useLoja(): LojaData {
  const ctx = useContext(LojaContext);
  if (!ctx) throw new Error("useLoja precisa estar dentro de um LojaProvider");
  return ctx;
}
