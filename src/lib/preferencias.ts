import type { VisitaCliente } from "./types";

/**
 * O que o cliente costuma fazer, deduzido do histórico dele.
 *
 * Não existe tela de "configure suas preferências" — ninguém preenche isso.
 * O padrão sai do que a pessoa já fez: o serviço que mais pediu, com quem
 * costuma cortar e a faixa de horário que escolhe. Serve pra deixar o
 * agendamento pronto em vez de começar do zero toda vez.
 */
export interface Preferencias {
  /** Serviços da última visita, na ordem em que foram feitos. */
  ultimosServicos: string[];
  /** Nome do serviço mais pedido (nem sempre é o da última visita). */
  servicoFavorito?: string;
  /** Com quem mais se atendeu nesta barbearia. */
  barbeiroPreferidoId?: string;
  /** Horário mais comum das visitas, ex. "14:00". */
  horarioHabitual?: string;
  /** Quantas vezes já foi nesta barbearia. */
  visitas: number;
  /** Data da última visita (ISO). */
  ultimaVisita?: string;
}

function maisFrequente<T>(itens: T[]): T | undefined {
  if (itens.length === 0) return undefined;

  const contagem = new Map<T, number>();
  for (const i of itens) contagem.set(i, (contagem.get(i) ?? 0) + 1);

  let melhor: T | undefined;
  let maior = 0;
  for (const [item, n] of contagem) {
    if (n > maior) {
      maior = n;
      melhor = item;
    }
  }
  return melhor;
}

/**
 * Deduz as preferências dentro de UMA barbearia.
 *
 * Por barbearia de propósito: o corte que a pessoa faz num lugar não
 * necessariamente existe no outro, e o barbeiro preferido muito menos.
 */
export function preferenciasNaBarbearia(
  historico: VisitaCliente[],
  barbeariaId: string,
): Preferencias | null {
  // Cancelado não conta: se a pessoa desmarcou, aquilo não virou hábito.
  const visitas = historico
    .filter((v) => v.barbeariaId === barbeariaId && v.status !== "cancelado")
    .sort((a, b) => (b.data + b.hora).localeCompare(a.data + a.hora));

  if (visitas.length === 0) return null;

  const ultima = visitas[0];

  return {
    ultimosServicos: ultima.servicos,
    servicoFavorito: maisFrequente(visitas.flatMap((v) => v.servicos)),
    barbeiroPreferidoId: maisFrequente(
      visitas.map((v) => v.barbeiroId).filter((id): id is string => Boolean(id)),
    ),
    horarioHabitual: maisFrequente(visitas.map((v) => v.hora).filter(Boolean)),
    visitas: visitas.length,
    ultimaVisita: ultima.data,
  };
}
