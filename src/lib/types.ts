import type { PlanId } from "./plans";

export type Weekday = "dom" | "seg" | "ter" | "qua" | "qui" | "sex" | "sab";

export const WEEKDAYS: { id: Weekday; label: string }[] = [
  { id: "seg", label: "Seg" },
  { id: "ter", label: "Ter" },
  { id: "qua", label: "Qua" },
  { id: "qui", label: "Qui" },
  { id: "sex", label: "Sex" },
  { id: "sab", label: "Sáb" },
  { id: "dom", label: "Dom" },
];

export type AmbienteMP = "teste" | "producao";

/**
 * Credenciais do Mercado Pago da própria barbearia — é pra conta dela que o
 * dinheiro do cliente vai, sem passar pela Navalha.
 *
 * ATENÇÃO: neste protótipo isso mora no localStorage só pra demonstrar o
 * fluxo. Em produção o access token NUNCA pode ficar no navegador: a conexão
 * precisa ser via OAuth do Mercado Pago, com o token guardado no servidor.
 */
export interface MercadoPagoConta {
  apelido: string;
  publicKey: string;
  accessToken: string;
  ambiente: AmbienteMP;
  aceitaPix: boolean;
  aceitaCartao: boolean;
  parcelasMax: number;
  conectadoEm: string;
}

export interface Barbearia {
  id: string;
  nome: string;
  telefone: string;
  endereco: string;
  diasFuncionamento: Weekday[];
  /**
   * Horário próprio de cada dia. Ausente = o dia usa
   * horarioAbertura/horarioFechamento, que seguem valendo como padrão.
   */
  horariosDia?: Partial<Record<Weekday, { abre: string; fecha: string }>>;
  horarioAbertura: string;
  horarioFechamento: string;
  plano: PlanId;
  /** Endereço da página pública: /loja/<slug>. Cai no id quando não houver. */
  slug?: string;
  linkMaps?: string;
  /** CEP do endereço, guardado pro campo voltar preenchido na edição. */
  cep?: string;
  criadaEm: string;
  /** Assinatura do sistema: 'trial' | 'ativa' | 'vencida'. */
  assinaturaStatus?: "trial" | "ativa" | "vencida";
  trialTerminaEm?: string | null;
  assinaturaAte?: string | null;
  /** Foto de capa exibida no topo da página pública. */
  foto?: string;
  /** Texto curto de apresentação, exibido junto da foto de capa. */
  sobre?: string;
  /** Fotos do espaço da barbearia, exibidas na galeria da página pública. */
  galeria?: string[];
  /** Conta do Mercado Pago da barbearia. Sem ela, só rola pagar no local. */
  mercadoPago?: MercadoPagoConta;
}

export type UserRole = "dono" | "barbeiro";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  senha: string;
  role: UserRole;
  barbeariaId: string;
}

/** Quem agenda. Diferente de Usuario, não pertence a nenhuma barbearia. */
export interface Cliente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  criadoEm: string;
}

/** Sessão de cliente — separada da equipe, que usa `Session`. */
export interface SessionCliente {
  clienteId: string;
  nome: string;
  email: string;
  telefone: string;
}

/** Uma visita do histórico do cliente. */
export interface VisitaCliente {
  pedidoId: string;
  barbeariaId: string;
  barbeariaNome: string;
  barbeariaSlug?: string;
  /** Com quem foi atendido — usado pra sugerir o mesmo profissional. */
  barbeiroId?: string;
  data: string;
  hora: string;
  servicos: string[];
  produtos: string[];
  total: number;
  status: AgendamentoStatus;
  formaPagamento: FormaPagamento;
}

export interface Session {
  userId: string;
  nome: string;
  email: string;
  role: UserRole;
  barbeariaId: string;
  barbeariaNome: string;
}

// Preset suggestions shown in the category dropdown. The stored value is a
// free-form string — picking "Outros" reveals a text field so the owner can
// type the category that's missing from this list.
export const SERVICO_CATEGORIAS_PRESET = ["Cortes", "Barba", "Combos", "Estética"] as const;
export const PRODUTO_CATEGORIAS_PRESET = [
  "Cabelo",
  "Barba",
  "Skincare",
  "Acessórios",
] as const;
export const CATEGORIA_OUTROS = "Outros";

export interface Servico {
  id: string;
  barbeariaId: string;
  nome: string;
  categoria: string;
  preco: number;
  duracaoMin: number;
  foto?: string;
  ativo: boolean;
  /**
   * Ids dos serviços que compõem um combo. Só usado quando a categoria é
   * "Combos" — o cliente vê o que está incluído e a duração é a soma das partes.
   */
  servicosIncluidos?: string[];
}

/** Passo da grade de horários, em minutos. */
export const SLOT_MIN = 30;

/** Quantos blocos de 30 min um serviço ocupa (mínimo 1). */
export function slotsDe(duracaoMin: number): number {
  return Math.max(1, Math.ceil(duracaoMin / SLOT_MIN));
}

export interface Produto {
  id: string;
  barbeariaId: string;
  nome: string;
  categoria: string;
  preco: number;
  estoque: number;
  foto?: string;
  ativo: boolean;
}

export interface BarbeiroPerfil {
  id: string;
  barbeariaId: string;
  usuarioId: string | null;
  nome: string;
  email: string;
  especialidade: string;
  foto?: string;
  ativo: boolean;
}

export type MovimentoEstoqueTipo = "entrada" | "saida";

export interface MovimentoEstoque {
  id: string;
  barbeariaId: string;
  produtoId: string;
  produtoNome: string;
  tipo: MovimentoEstoqueTipo;
  quantidade: number;
  motivo: string;
  data: string;
}

// "aguardando_pagamento": foi pro checkout do Mercado Pago e ainda não
// pagou — o horário fica preso, mas o dinheiro NÃO entrou. Vira
// "confirmado" só quando o webhook confirma o pagamento.
// "pendente": cliente escolheu pagar no local — precisa ser confirmado no
// painel antes de virar "confirmado".
export type AgendamentoStatus =
  | "aguardando_pagamento"
  | "pendente"
  | "confirmado"
  | "concluido"
  | "cancelado";
export type FormaPagamento = "online" | "local";

/** Como o cliente pagou quando escolheu pagar online. */
export type MetodoPagamento = "pix" | "cartao";

export const METODO_LABEL: Record<MetodoPagamento, string> = {
  pix: "Pix",
  cartao: "Cartão",
};

export interface ProdutoComprado {
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  preco: number;
}

export interface Agendamento {
  id: string;
  barbeariaId: string;
  barbeiroId: string;
  clienteNome: string;
  clienteTelefone?: string;
  clienteEmail?: string;
  servicoNome: string;
  preco: number;
  data: string;
  hora: string;
  /** Duração do serviço; define quantos blocos da grade o agendamento ocupa. */
  duracaoMin?: number;
  status: AgendamentoStatus;
  formaPagamento: FormaPagamento;
  /** Só preenchido quando formaPagamento é "online". */
  metodoPagamento?: MetodoPagamento;
  /** Agrupa os agendamentos gerados por uma mesma compra no carrinho. */
  pedidoId?: string;
  /** Produtos comprados junto nesse pedido — só preenchido no 1º item do grupo. */
  produtosComprados?: ProdutoComprado[];
}
