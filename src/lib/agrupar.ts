import type { Agendamento } from "./types";

/**
 * Uma visita do cliente: os serviços que ele marcou de uma vez só.
 *
 * No banco cada serviço vira uma linha em `agendamentos` (é assim que a
 * grade da agenda sabe qual horário cada um ocupa). Mas pro dono é uma
 * pessoa só chegando — mostrar "Fulano" três vezes seguidas, uma por
 * serviço, com três botões de aceitar, não faz sentido.
 */
export interface Visita {
  /** Id do pedido quando existe; senão o id do próprio agendamento. */
  chave: string;
  /** Ids de todos os agendamentos da visita — aceitar/rejeitar mexe em todos. */
  ids: string[];
  clienteNome: string;
  clienteTelefone?: string;
  data: string;
  /** Horário do primeiro serviço. */
  hora: string;
  servicos: string[];
  total: number;
  formaPagamento: Agendamento["formaPagamento"];
  metodoPagamento?: Agendamento["metodoPagamento"];
  produtos: { produtoNome: string; quantidade: number }[];
  primeiro: Agendamento;
}

export function agruparEmVisitas(agendamentos: Agendamento[]): Visita[] {
  const mapa = new Map<string, Agendamento[]>();

  for (const a of agendamentos) {
    // Sem pedidoId (agendamento antigo ou criado à mão) cada linha é uma
    // visita própria — melhor separar do que juntar coisas de clientes
    // diferentes por engano.
    const chave = a.pedidoId ?? a.id;
    const atual = mapa.get(chave);
    if (atual) atual.push(a);
    else mapa.set(chave, [a]);
  }

  return Array.from(mapa.entries())
    .map(([chave, itens]) => {
      const ordenados = [...itens].sort((x, y) => x.hora.localeCompare(y.hora));
      const primeiro = ordenados[0];
      return {
        chave,
        ids: ordenados.map((i) => i.id),
        clienteNome: primeiro.clienteNome,
        clienteTelefone: primeiro.clienteTelefone,
        data: primeiro.data,
        hora: primeiro.hora,
        servicos: ordenados.map((i) => i.servicoNome),
        total: ordenados.reduce((s, i) => s + i.preco, 0),
        formaPagamento: primeiro.formaPagamento,
        metodoPagamento: primeiro.metodoPagamento,
        produtos:
          ordenados
            .flatMap((i) => i.produtosComprados ?? [])
            .map((p) => ({ produtoNome: p.produtoNome, quantidade: p.quantidade })) ?? [],
        primeiro,
      };
    })
    .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
}
