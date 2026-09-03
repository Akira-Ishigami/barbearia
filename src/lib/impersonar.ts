import { createHmac } from "node:crypto";

/**
 * "Ver como" — o admin da plataforma entra numa barbearia ou como um
 * barbeiro sem senha, pra testar/dar suporte vendo a tela de verdade.
 *
 * Não usa o Supabase Auth de propósito: gerar uma sessão real trocaria a
 * sessão do admin no mesmo navegador (mesma origem, mesmo localStorage).
 * Este token é assinado com o service role key (só o servidor tem),
 * expira sozinho e é reconhecido só em `autenticar()` — nunca por
 * `autenticarPlataforma`/`autenticarAdmin`, então não dá pra usar um
 * token de impersonação pra virar admin.
 */

const DURACAO_MS = 30 * 60 * 1000;

function assinar(bruto: string): string {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")
    .update(bruto)
    .digest("hex")
    .slice(0, 32);
}

export function gerarTokenImpersonacao(usuarioId: string): string {
  const exp = Date.now() + DURACAO_MS;
  const bruto = `${usuarioId}.${exp}`;
  return `IMPERSONAR.${bruto}.${assinar(bruto)}`;
}

/** Devolve o usuarioId se o token for válido e ainda não tiver vencido. */
export function conferirTokenImpersonacao(token: string): string | null {
  if (!token.startsWith("IMPERSONAR.")) return null;

  const partes = token.slice("IMPERSONAR.".length).split(".");
  if (partes.length !== 3) return null;

  const [usuarioId, expStr, assinatura] = partes;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;

  return assinatura === assinar(`${usuarioId}.${expStr}`) ? usuarioId : null;
}
