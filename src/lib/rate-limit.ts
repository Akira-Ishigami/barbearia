import type { NextRequest } from "next/server";

/**
 * Rate limiter simples, em memória.
 *
 * Segura pico de abuso (bot criando conta em massa) sem depender de Redis.
 * Limite: é por instância serverless, então não é um teto global exato —
 * mas já corta o flood de uma origem só, que é o caso comum. Pra garantia
 * dura em escala, trocar por Upstash/Redis depois.
 */
interface Janela {
  contagem: number;
  reiniciaEm: number;
}

const baldes = new Map<string, Janela>();

/** IP de quem chamou, atrás do proxy da Vercel. */
export function ipDoPedido(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "desconhecido";
}

/**
 * Deixa passar até `limite` pedidos por `janelaMs` pra cada chave.
 * Devolve { ok:false, esperaS } quando estourou.
 */
export function rateLimit(
  chave: string,
  limite: number,
  janelaMs: number,
): { ok: true } | { ok: false; esperaS: number } {
  const agora = Date.now();
  const balde = baldes.get(chave);

  if (!balde || agora >= balde.reiniciaEm) {
    baldes.set(chave, { contagem: 1, reiniciaEm: agora + janelaMs });
    return { ok: true };
  }

  if (balde.contagem >= limite) {
    return { ok: false, esperaS: Math.ceil((balde.reiniciaEm - agora) / 1000) };
  }

  balde.contagem += 1;
  return { ok: true };
}

// Limpeza preguiçosa: a cada ~500 chaves, varre e descarta janelas vencidas,
// pra o Map não crescer sem parar num processo de vida longa.
let desdeUltimaLimpeza = 0;
export function limparExpirados() {
  if (++desdeUltimaLimpeza < 500) return;
  desdeUltimaLimpeza = 0;
  const agora = Date.now();
  for (const [k, v] of baldes) {
    if (agora >= v.reiniciaEm) baldes.delete(k);
  }
}
