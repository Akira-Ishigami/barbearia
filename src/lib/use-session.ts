"use client";

import { useSyncExternalStore } from "react";
import type { Session } from "./types";

const SESSION_KEY = "navalha_session";

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function notifyListeners() {
  for (const l of listeners) l();
}

export function refreshSession() {
  notifyListeners();
}

// Cache the parsed snapshot and only re-parse when the raw localStorage
// value actually changes — useSyncExternalStore requires a stable
// reference across calls when nothing changed, otherwise it loops forever.
let cachedRaw: string | null = null;
let cachedSnapshot: Session | null = null;

function getSnapshot(): Session | null {
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedSnapshot = raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      cachedSnapshot = null;
    }
  }
  return cachedSnapshot;
}

function getServerSnapshot(): Session | null {
  return null;
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
