"use client";

export const CHAVE_IMPERSONACAO = "navalha_impersonar";

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
