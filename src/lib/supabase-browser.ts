"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente do Supabase usado no navegador — chave anônima, então tudo o que
 * ele faz passa pelas regras de RLS do banco. É seguro expor.
 *
 * Criado sob demanda pra não quebrar o build enquanto as variáveis de
 * ambiente não existem.
 */
let cache: SupabaseClient | null = null;

export function supabaseConfigurado(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function supabase(): SupabaseClient {
  if (cache) return cache;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error(
      "Supabase não configurado. Cadastre NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  cache = createClient(url, anon, {
    auth: {
      // Mantém o login salvo entre visitas e renova o token sozinho antes de
      // vencer — sem isso a sessão "cai" e o dono precisa logar de novo toda
      // hora. Chave fixa pra não conflitar com outro app no mesmo domínio.
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "navalha-auth",
    },
  });
  return cache;
}
