"use client";

import { useEffect, useRef, useState } from "react";
import { supabase, supabaseConfigurado } from "./supabase-browser";
import { playNotificationSound, prepararSom } from "./sound";

// 15s deixava o dono esperando demais pra ver que chegou cliente novo.
const POLL_MS = 8000;

async function contarPendentes(barbeariaId: string, barbeiroId?: string): Promise<number> {
  let consulta = supabase()
    .from("agendamentos")
    .select("id", { count: "exact", head: true })
    .eq("barbearia_id", barbeariaId)
    .eq("status", "pendente");

  if (barbeiroId) consulta = consulta.eq("barbeiro_id", barbeiroId);

  const { count } = await consulta;
  return count ?? 0;
}

/**
 * Conta agendamentos aguardando confirmação e avisa quando chega um novo.
 *
 * Passe `barbeiroId` pra limitar à agenda daquele barbeiro.
 *
 * Agora que os dados são compartilhados, a consulta bate no banco. O
 * intervalo é folgado de propósito: é um contador, não vale gastar uma
 * consulta a cada poucos segundos.
 */
export function usePendingAlerts(barbeariaId: string | undefined, barbeiroId?: string) {
  const [pendentes, setPendentes] = useState(0);
  const [flash, setFlash] = useState(false);
  // null = ainda não temos uma referência; evita tocar o alerta na primeira
  // leitura por causa de pendentes que já existiam antes de abrir a tela.
  const ultimo = useRef<number | null>(null);

  useEffect(() => {
    if (!barbeariaId || !supabaseConfigurado()) return;

    // O navegador só libera áudio depois de um gesto; deixamos escutando o
    // primeiro clique da sessão pra que o alerta seguinte já toque.
    prepararSom();

    let cancelado = false;

    async function verificar() {
      try {
        const total = await contarPendentes(barbeariaId!, barbeiroId);
        if (cancelado) return;

        if (ultimo.current !== null && total > ultimo.current) {
          playNotificationSound();
          setFlash(true);
          window.setTimeout(() => {
            if (!cancelado) setFlash(false);
          }, 3500);
        }
        ultimo.current = total;
        setPendentes(total);
      } catch {
        /* rede instável: tenta de novo no próximo ciclo */
      }
    }

    verificar();
    const intervalo = window.setInterval(verificar, POLL_MS);

    return () => {
      cancelado = true;
      window.clearInterval(intervalo);
    };
  }, [barbeariaId, barbeiroId]);

  return { pendentes, flash };
}
