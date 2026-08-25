/**
 * O que a Navalha pode e não pode enxergar das barbearias e dos clientes.
 *
 * A regra, escrita uma vez pra valer em todas as telas de plataforma:
 *
 *   Somar TODAS as barbearias é legítimo — é o negócio da Navalha.
 *   Abrir UMA barbearia e ler a vida dela não é.
 *
 * Na prática:
 *   pode  → status da assinatura, plano, datas de cobrança, se conectou
 *           forma de recebimento, se tem catálogo, se está sendo usada
 *   não   → nome de cliente que agendou, valor de cada venda, faturamento
 *           daquela barbearia, nome e e-mail da equipe dela, chave Pix
 *
 * O teste é simples: se o dado só interessa pra cobrar, pra dar suporte ou
 * pra saber se o produto está funcionando, pode. Se serve pra saber quanto
 * ela ganha ou quem passa por lá, não.
 *
 * Quando um dado pessoal precisa aparecer — o suporte tem que confirmar um
 * contato com a pessoa do outro lado da linha — ele aparece mascarado: o
 * bastante pra conferir, nunca o bastante pra copiar uma base.
 */

/** `akira.vha@gmail.com` → `ak•••@gmail.com` */
export function mascararEmail(email: string): string {
  const [usuario, dominio] = email.split("@");
  if (!dominio) return "•••";
  const visivel = usuario.slice(0, 2);
  return `${visivel}${"•".repeat(Math.max(3, usuario.length - 2))}@${dominio}`;
}

/** `11988887777` → `(11) ••••-7777` — DDD e final bastam pra conferir. */
export function mascararTelefone(telefone: string): string {
  const d = telefone.replace(/\D/g, "");
  if (d.length < 6) return "•".repeat(Math.max(1, d.length));
  return `(${d.slice(0, 2)}) ••••-${d.slice(-4)}`;
}

/** `Akira Ishigami Magalhães` → `Akira M.` */
export function nomeCurto(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "—";
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[partes.length - 1][0].toUpperCase()}.`;
}

/**
 * Faixa de uso no lugar do valor exato.
 *
 * O painel precisa distinguir barbearia parada de barbearia movimentada,
 * e isso a contagem já resolve — o quanto ela faturou, não. Faixa em vez
 * de número mantém a resposta útil sem virar extrato do concorrente.
 */
export function faixaDeUso(pedidos: number): { rotulo: string; nivel: 0 | 1 | 2 | 3 } {
  if (pedidos === 0) return { rotulo: "sem movimento", nivel: 0 };
  if (pedidos < 10) return { rotulo: "pouco movimento", nivel: 1 };
  if (pedidos < 50) return { rotulo: "movimento normal", nivel: 2 };
  return { rotulo: "muito movimento", nivel: 3 };
}
