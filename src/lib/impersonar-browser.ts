"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

export const CHAVE_IMPERSONACAO = "navalha_impersonar";
const CHAVE_OTP_CONSUMIDO = "navalha_impersonar_sessao_real";

/**
 * "Ver como" (admin de /adm entrando numa barbearia/barbeiro sem senha)
 * chega aqui por `?impersonar=<token>` na URL. Guarda no sessionStorage
 * (só essa aba, não vaza pra outras nem sobrevive fechar o navegador) e
 * limpa da URL na hora — senão fica no histórico.
 *
 * Usado tanto por `lib/db.ts` (cabeçalho das chamadas de API) quanto por
 * `lib/use-session.ts` (decidir se a aba está logada) — os dois precisam
 * concordar sobre o mesmo token.
 */
export function tokenImpersonado(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const daUrl = new URLSearchParams(window.location.search).get("impersonar");
    if (daUrl) {
      window.sessionStorage.setItem(CHAVE_IMPERSONACAO, daUrl);
      const url = new URL(window.location.href);
      url.searchParams.delete("impersonar");
      window.history.replaceState({}, "", url.toString());
      return daUrl;
    }
    return window.sessionStorage.getItem(CHAVE_IMPERSONACAO);
  } catch {
    return null;
  }
}

/**
 * O token de impersonação sozinho só cobre as rotas de API (autenticar()
 * aceita ele no Bearer). Boa parte do app, porém, lê o Supabase DIRETO do
 * navegador (agenda, barbeiros, estoque...), protegido por RLS — que exige
 * `auth.uid()` de verdade. Sem isso essas telas ficam vazias mesmo com dado
 * no banco (foi assim que a Agenda da demo apareceu em branco num teste).
 *
 * Por isso "Ver como" também manda um `otp` (magic link gerado pelo
 * servidor, `auth.admin.generateLink`) — aqui a gente troca ele por uma
 * sessão real do Supabase Auth, só nesta aba. `supabase()` já está
 * configurado pra guardar em sessionStorage quando impersonando (ver
 * `lib/supabase-browser.ts`), então essa sessão real nunca vaza pra outra
 * aba nem pra sessão de verdade do admin.
 */
export async function bootstrapSessaoImpersonada(cliente: SupabaseClient): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if (window.sessionStorage.getItem(CHAVE_OTP_CONSUMIDO)) return;
    const otp = new URLSearchParams(window.location.search).get("otp");
    if (!otp) return;

    // Marca antes de trocar: se der erro, não fica tentando de novo a cada
    // recarregar sessão (o polling do chat, por exemplo).
    window.sessionStorage.setItem(CHAVE_OTP_CONSUMIDO, "1");
    await cliente.auth.verifyOtp({ token_hash: otp, type: "magiclink" });

    const url = new URL(window.location.href);
    url.searchParams.delete("otp");
    window.history.replaceState({}, "", url.toString());
  } catch {
    // Sem sessão real, os dados atrás de RLS direto ficam vazios — mas a
    // API por rota (cabecalhosAutenticados) continua funcionando.
  }
}
