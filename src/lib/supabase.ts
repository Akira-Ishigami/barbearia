import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente do Supabase com service role — ignora RLS e enxerga tudo,
 * inclusive a tabela mp_contas. SÓ pode ser usado dentro de rotas de API
 * (`src/app/api/**`), nunca em componente que roda no navegador.
 *
 * A criação é preguiçosa de propósito: se fosse no topo do módulo, o build
 * na Vercel quebraria antes de você ter cadastrado as variáveis.
 */
let cache: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cache) return cache;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase não configurado: faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  cache = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cache;
}

/** Dá pra saber se o banco está configurado sem estourar erro. */
export function supabaseConfigurado(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
