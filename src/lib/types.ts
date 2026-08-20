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

export interface Barbearia {
  id: string;
  nome: string;
  telefone: string;
  endereco: string;
  diasFuncionamento: Weekday[];
  horarioAbertura: string;
  horarioFechamento: string;
  plano: PlanId;
  linkMaps?: string;
  criadaEm: string;
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

// "pendente": cliente escolheu pagar no local — precisa ser confirmado no
// painel antes de virar "confirmado". Pagamento online já entra confirmado.
export type AgendamentoStatus = "pendente" | "confirmado" | "concluido" | "cancelado";
export type FormaPagamento = "online" | "local";

export interface Agendamento {
  id: string;
  barbeariaId: string;
  barbeiroId: string;
  clienteNome: string;
  clienteTelefone?: string;
  servicoNome: string;
  preco: number;
  data: string;
  hora: string;
  status: AgendamentoStatus;
  formaPagamento: FormaPagamento;
}
