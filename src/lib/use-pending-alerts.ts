"use client";

import { useEffect, useRef, useState } from "react";
import { getAgendamentos, getAgendamentosPorBarbeiro } from "./mock-db";
import { playNotificationSound } from "./sound";

const POLL_MS = 4000;

function countPendentes(barbeariaId: string, barbeiroId?: string): number {
  const agendamentos = barbeiroId
    ? getAgendamentosPorBarbeiro(barbeiroId)
    : getAgendamentos(barbeariaId);
  return agendamentos.filter((a) => a.status === "pendente").length;
}

/** barbeiroId is optional — pass it to scope the alert to one barbeiro's own agenda. */
export function usePendingAlerts(barbeariaId: string | undefined, barbeiroId?: string) {
  const [pendentes, setPendentes] = useState(0);
  const [flash, setFlash] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const lastCount = useRef<number | null>(null);

  // Baseline read on first client render — doesn't sound the alarm for
  // appointments that were already pending before this page opened.
  if (barbeariaId && !loaded) {
    setPendentes(countPendentes(barbeariaId, barbeiroId));
    setLoaded(true);
  }

  useEffect(() => {
    if (!barbeariaId) return;

    // Refs can't be written during render, so the baseline for this effect
    // run is (re)established here instead.
    lastCount.current = countPendentes(barbeariaId, barbeiroId);

    function check() {
      const count = countPendentes(barbeariaId!, barbeiroId);
      if (lastCount.current !== null && count > lastCount.current) {
        playNotificationSound();
        setFlash(true);
        setTimeout(() => setFlash(false), 3500);
      }
      lastCount.current = count;
      setPendentes(count);
    }

    const interval = setInterval(check, POLL_MS);
    window.addEventListener("storage", check);
    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", check);
    };
  }, [barbeariaId, barbeiroId]);

  return { pendentes, flash };
}
