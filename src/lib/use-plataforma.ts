"use client";

import { useEffect, useState } from "react";
import { supabase, supabaseConfigurado } from "./supabase-browser";
import type { NivelPlataforma } from "./plataforma";

/**
 * Acesso de plataforma de quem está logado.
 *
 * Quem decide é o servidor: a tela pergunta em `/api/adm/eu` e recebe o
 * nível de volta. O navegador não tem como consultar `plataforma_equipe`
 * (a tabela não tem policy de RLS), então não dá pra alguém se declarar
 * admin mexendo no devtools — o pior que consegue é desenhar a tela vazia,
 * porque toda rota que traz dado confere o nível de novo.
 *
 * `undefined` = carregando · `null` = sem acesso.
 */
export interface AcessoPlataforma {
  nivel: NivelPlataforma;
  nome: string;
  email: string;
}

export type AcessoState = AcessoPlataforma | null | undefined;

/** Cabeçalhos com o token de quem está logado. */
export async function cabecalhosPlataforma(): Promise<HeadersInit> {
  const { data } = await supabase().auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data.session?.access_token ?? ""}`,
  };
}

export function usePlataforma(): AcessoState {
  // Sem banco não existe acesso nenhum, e isso já se sabe no primeiro
  // render: decidir aqui evita um setState dentro do efeito, que dispara
  // render em cascata (e o lint do React barra).
  const [acesso, setAcesso] = useState<AcessoState>(() =>
    supabaseConfigurado() ? undefined : null,
  );

  useEffect(() => {
    if (!supabaseConfigurado()) return;

    let cancelado = false;

    async function verificar() {
      try {
        const resposta = await fetch("/api/adm/eu", {
          headers: await cabecalhosPlataforma(),
        });
        const corpo = await resposta.json().catch(() => ({}));
        if (cancelado) return;
        setAcesso(
          corpo.dentro
            ? { nivel: corpo.nivel, nome: corpo.nome, email: corpo.email }
            : null,
        );
      } catch {
        if (!cancelado) setAcesso(null);
      }
    }

    verificar();

    // Entrar ou sair em outra aba muda quem está logado aqui também.
    const { data: sub } = supabase().auth.onAuthStateChange(() => {
      verificar();
    });

    return () => {
      cancelado = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return acesso;
}
