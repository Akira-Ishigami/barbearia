/**
 * Pix "copia e cola" — o BR Code do Banco Central.
 *
 * Serve pra barbearia que não usa Mercado Pago: em vez de o dono ditar a
 * chave e o cliente digitar o valor errado, a gente monta o código com o
 * valor exato do pedido já embutido. O cliente cola no banco e o valor
 * aparece travado.
 *
 * O formato é o EMV®QRCPS: uma sequência de campos `IDTAMANHOVALOR`. Aqui
 * só existe montagem — nada de rede. A confirmação de que o dinheiro caiu
 * é manual, porque Pix direto não tem webhook (o dono confere no extrato).
 *
 * Referência: Manual do BR Code, Banco Central do Brasil.
 */

export type TipoChavePix = "cpf" | "cnpj" | "telefone" | "email" | "aleatoria";

export const TIPOS_CHAVE: { id: TipoChavePix; label: string; exemplo: string }[] = [
  { id: "cpf", label: "CPF", exemplo: "123.456.789-00" },
  { id: "cnpj", label: "CNPJ", exemplo: "12.345.678/0001-00" },
  { id: "telefone", label: "Celular", exemplo: "(11) 98888-7777" },
  { id: "email", label: "E-mail", exemplo: "contato@barbearia.com" },
  { id: "aleatoria", label: "Chave aleatória", exemplo: "8f2b0c1e-…" },
];

const so = (v: string) => v.replace(/\D/g, "");

/**
 * Deixa a chave no formato que o banco espera.
 *
 * O que a pessoa digita ("(11) 98888-7777") não é o que vai no código
 * ("+5511988887777"). Errar isso gera um QR que abre no app e falha na
 * hora de pagar — daí a normalização ser feita uma vez, aqui.
 */
export function normalizarChave(
  tipo: TipoChavePix,
  bruta: string,
): { ok: true; chave: string } | { ok: false; error: string } {
  const v = bruta.trim();
  if (!v) return { ok: false, error: "Informe a chave Pix." };

  switch (tipo) {
    case "cpf": {
      const d = so(v);
      if (d.length !== 11) return { ok: false, error: "CPF precisa ter 11 dígitos." };
      return { ok: true, chave: d };
    }
    case "cnpj": {
      const d = so(v);
      if (d.length !== 14) return { ok: false, error: "CNPJ precisa ter 14 dígitos." };
      return { ok: true, chave: d };
    }
    case "telefone": {
      const d = so(v);
      // Aceita com ou sem o 55 na frente; o código sempre leva +55.
      const nacional = d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
      if (nacional.length < 10 || nacional.length > 11) {
        return { ok: false, error: "Celular precisa ter DDD + número." };
      }
      return { ok: true, chave: `+55${nacional}` };
    }
    case "email": {
      const e = v.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 77) {
        return { ok: false, error: "E-mail inválido." };
      }
      return { ok: true, chave: e };
    }
    case "aleatoria": {
      const c = v.toLowerCase();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(c)) {
        return { ok: false, error: "A chave aleatória tem o formato 8f2b0c1e-…" };
      }
      return { ok: true, chave: c };
    }
  }
}

/** Como a chave aparece pro dono conferir, sem virar um blocão de dígitos. */
export function formatarChave(tipo: TipoChavePix, chave: string): string {
  if (tipo === "cpf" && chave.length === 11) {
    return `${chave.slice(0, 3)}.${chave.slice(3, 6)}.${chave.slice(6, 9)}-${chave.slice(9)}`;
  }
  if (tipo === "cnpj" && chave.length === 14) {
    return `${chave.slice(0, 2)}.${chave.slice(2, 5)}.${chave.slice(5, 8)}/${chave.slice(8, 12)}-${chave.slice(12)}`;
  }
  return chave;
}

/**
 * Nome e cidade viajam dentro do código e aparecem no app de quem paga.
 * O padrão só aceita ASCII, então acento vira letra simples — "SÃO PAULO"
 * precisa virar "SAO PAULO" ou o código não é lido.
 */
function ascii(texto: string, max: number): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, max);
}

/** Um campo EMV: id + tamanho em 2 dígitos + valor. */
function campo(id: string, valor: string): string {
  return id + String(valor.length).padStart(2, "0") + valor;
}

/**
 * CRC16/CCITT-FALSE — o dígito verificador do fim do código.
 *
 * É calculado sobre o payload inteiro já com "6304" no fim; sem ele o
 * banco recusa o código como corrompido.
 */
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface DadosBrCode {
  chave: string;
  beneficiario: string;
  cidade: string;
  /** Em reais. Vai travado no código — o cliente não consegue mudar. */
  valor: number;
  /** Identificador do pedido; volta no extrato do dono. Até 25 caracteres. */
  txid?: string;
}

/**
 * Monta o "copia e cola".
 *
 * O ponto de iniciação é `12` (uso único) porque cada pedido tem o próprio
 * valor: um código reutilizável com valor fixo confundiria o cliente que
 * voltasse a usar o mesmo QR de uma compra antiga.
 */
export function gerarBrCode(d: DadosBrCode): string {
  // "***" é o que o padrão manda usar quando não há identificador próprio.
  const txid = (d.txid ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";

  const merchant =
    campo("00", "br.gov.bcb.pix") + campo("01", d.chave);

  const payload =
    campo("00", "01") +
    campo("01", "12") +
    campo("26", merchant) +
    campo("52", "0000") +
    campo("53", "986") +
    campo("54", d.valor.toFixed(2)) +
    campo("58", "BR") +
    campo("59", ascii(d.beneficiario, 25) || "BARBEARIA") +
    campo("60", ascii(d.cidade, 15) || "SAO PAULO") +
    campo("62", campo("05", txid));

  const comCrc = `${payload}6304`;
  return comCrc + crc16(comCrc);
}

/** Identificador curto e legível pro extrato, derivado do id do pedido. */
export function txidDoPedido(pedidoId: string): string {
  return `NAVALHA${pedidoId.replace(/-/g, "").slice(0, 17)}`.toUpperCase();
}
