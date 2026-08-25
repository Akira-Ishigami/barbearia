/**
 * O formato do que `/api/adm/visao` devolve.
 *
 * Fica num arquivo próprio porque três telas leem a mesma resposta (Hoje,
 * Crescimento e Barbearias). Repetir a interface em cada uma faria elas
 * divergirem em silêncio no primeiro campo que mudasse.
 *
 * Repare no que NÃO existe aqui: nenhum campo de valor por barbearia,
 * nenhum nome de cliente. Não é esquecimento — a rota não lê esses dados.
 * Ver `lib/privacidade.ts`.
 */

export interface ItemAtencao {
  id: string;
  nome: string;
  dias?: number;
  diasParada?: number | null;
  plano?: string;
  barbeiros?: number;
}

export interface Semana {
  inicio: string;
  cadastros: number;
  pedidos: number;
}

export interface LinhaRanking {
  id: string;
  nome: string;
  status: "trial" | "ativa" | "vencida";
  plano: string;
  pedidos: number;
  uso: { rotulo: string; nivel: 0 | 1 | 2 | 3 };
  ultimoPedido: string | null;
}

export interface Visao {
  nivel: string;
  janelaDias: number;
  barbearias: {
    total: number;
    trial: number;
    ativa: number;
    vencida: number;
    novasEm7Dias: number;
    novasEm30Dias: number;
  };
  planos: Record<string, number>;
  /** Só a mensalidade das assinaturas — receita da própria Navalha. */
  receita: { mensalRecorrente: number };
  conversao: { jaPagaram: number; saiuDoTeste: number; taxa: number | null };
  pagamentos: {
    comMercadoPago: number;
    comPixDireto: number;
    semRecebimentoOnline: number;
  };
  uso: {
    pedidos24h: number;
    pedidos7Dias: number;
    pedidos30Dias: number;
    barbeariasAtivas7Dias: number;
    clientes: number;
    agendamentos30Dias: number;
    statusAgenda: Record<string, number>;
    porForma: Record<string, number>;
  };
  atencao: {
    trialAcabando: ItemAtencao[];
    vencidas: ItemAtencao[];
    semRecebimento: ItemAtencao[];
    semCatalogo: ItemAtencao[];
    paradas: ItemAtencao[];
    tokenMpVencendo: ItemAtencao[];
  };
  semanas: Semana[];
  ranking: LinhaRanking[];
  ultimosCadastros: {
    id: string;
    nome: string;
    plano: string;
    status: string;
    criadaEm: string;
  }[];
  log: { id: string; email: string; acao: string; detalhe: string; criado_em: string }[];
}

export const ROTULO_FORMA: Record<string, string> = {
  online: "Mercado Pago",
  pix_direto: "Pix na chave",
  local: "No balcão",
};

export const ACAO_LABEL: Record<string, string> = {
  estender_trial: "estendeu o teste",
  marcar_paga: "marcou assinatura paga",
  mudar_plano: "mudou o plano",
  bloquear: "bloqueou o acesso",
  excluir: "apagou a barbearia",
  desconectar_mp: "soltou o Mercado Pago",
  equipe_salvar: "liberou acesso",
  equipe_remover: "removeu acesso",
  buscar_cliente: "procurou um cliente",
  excluir_cliente: "apagou dado de cliente",
};
