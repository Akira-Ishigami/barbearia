import { createHmac, randomBytes } from "node:crypto";

/**
 * O `state` do OAuth leva o id da barbearia assinado com o client secret.
 * Na volta conferimos a assinatura — sem isso qualquer pessoa poderia
 * conectar a conta do Mercado Pago dela no nome de outra barbearia.
 */
function assinar(bruto: string): string {
  return createHmac("sha256", process.env.MP_CLIENT_SECRET ?? "")
    .update(bruto)
    .digest("hex")
    .slice(0, 32);
}

export function assinarState(barbeariaId: string): string {
  const bruto = `${barbeariaId}.${randomBytes(8).toString("hex")}`;
  return `${bruto}.${assinar(bruto)}`;
}

export function conferirState(state: string): string | null {
  const partes = state.split(".");
  if (partes.length !== 3) return null;

  const [barbeariaId, nonce, assinatura] = partes;
  return assinatura === assinar(`${barbeariaId}.${nonce}`) ? barbeariaId : null;
}
