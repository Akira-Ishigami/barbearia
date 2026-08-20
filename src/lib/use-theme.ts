"use client";

import { useSyncExternalStore } from "react";

export type Theme = "claro" | "escuro";

const THEME_KEY = "navalha_theme";
const PADRAO: Theme = "claro";

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

// Mesmo padrão do use-session: o snapshot só é recalculado quando o valor
// cru muda, senão useSyncExternalStore entra em loop.
let cachedRaw: string | null = null;
let cachedSnapshot: Theme = PADRAO;

function getSnapshot(): Theme {
  const raw = window.localStorage.getItem(THEME_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSnapshot = raw === "escuro" ? "escuro" : "claro";
  }
  return cachedSnapshot;
}

// O servidor sempre renderiza no padrão claro; se a pessoa tiver escolhido
// escuro, o React troca logo depois da hidratação, sem erro de mismatch.
function getServerSnapshot(): Theme {
  return PADRAO;
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setTheme(theme: Theme) {
  window.localStorage.setItem(THEME_KEY, theme);
  for (const l of listeners) l();
}

/** Classe a aplicar no container raiz da tela. */
export function themeClass(theme: Theme): string {
  return theme === "claro" ? "theme-light" : "";
}
