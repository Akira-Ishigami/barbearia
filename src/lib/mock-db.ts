import { addDays, toISODate } from "./date";
import type {
  Agendamento,
  Barbearia,
  BarbeiroPerfil,
  MovimentoEstoque,
  Produto,
  Servico,
  Session,
  Usuario,
} from "./types";

const KEYS = {
  barbearias: "navalha_barbearias",
  usuarios: "navalha_usuarios",
  session: "navalha_session",
  servicos: "navalha_servicos",
  produtos: "navalha_produtos",
  barbeiros: "navalha_barbeiros",
  agendamentos: "navalha_agendamentos",
  movimentosEstoque: "navalha_movimentos_estoque",
} as const;

// Generated placeholder photos (no emoji, no external fetch): a gradient
// tile with a simple line-art icon, standing in for a real uploaded photo
// so the demo data actually exercises the `foto` rendering path.
const ICON_SCISSORS =
  "M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.5 8.5l11 11M20 4 8.5 15.5";
const ICON_RAZOR = "M4 20 18 6M14 2l4 4-4 4";
const ICON_BOTTLE = "M9 3h6v3l2 3v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9l2-3V3Z";
const ICON_PERSON = "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z";

function svgPhoto(iconPath: string, hueFrom: number, hueTo: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hueFrom},50%,20%)"/>
      <stop offset="1" stop-color="hsl(${hueTo},55%,32%)"/>
    </linearGradient></defs>
    <rect width="200" height="200" fill="url(#g)"/>
    <g transform="translate(58,58) scale(3.6)" stroke="#f1c869" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="${iconPath}"/>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const DEMO_BARBEARIA: Barbearia = {
  id: "demo-barbearia",
  nome: "Barbearia do Zé",
  telefone: "(11) 98888-1234",
  endereco: "Rua Harmonia, 120 — Vila Madalena, São Paulo",
  diasFuncionamento: ["seg", "ter", "qua", "qui", "sex", "sab"],
  horarioAbertura: "09:00",
  horarioFechamento: "20:00",
  plano: "pro",
  criadaEm: new Date().toISOString(),
};

const DEMO_BARBEARIA_BASICO: Barbearia = {
  id: "demo-barbearia-basico",
  nome: "Barbearia do Tião",
  telefone: "(11) 97777-5678",
  endereco: "Av. Paulista, 900 — Bela Vista, São Paulo",
  diasFuncionamento: ["seg", "ter", "qua", "qui", "sex"],
  horarioAbertura: "10:00",
  horarioFechamento: "19:00",
  plano: "basico",
  criadaEm: new Date().toISOString(),
};

const DEMO_USERS: Usuario[] = [
  {
    id: "demo-dono",
    nome: "Zé Ferreira",
    email: "dono@navalha.app",
    senha: "barbearia123",
    role: "dono",
    barbeariaId: DEMO_BARBEARIA.id,
  },
  {
    id: "demo-dono-basico",
    nome: "Tião Alves",
    email: "dono.basico@navalha.app",
    senha: "barbearia123",
    role: "dono",
    barbeariaId: DEMO_BARBEARIA_BASICO.id,
  },
  {
    id: "demo-barbeiro",
    nome: "Nando Silva",
    email: "barbeiro@navalha.app",
    senha: "barbeiro123",
    role: "barbeiro",
    barbeariaId: DEMO_BARBEARIA.id,
  },
];

const DEMO_SERVICOS: Servico[] = [
  { id: "srv-1", barbeariaId: DEMO_BARBEARIA.id, nome: "Corte degradê", categoria: "Cortes", preco: 45, duracaoMin: 40, foto: svgPhoto(ICON_SCISSORS, 40, 46), ativo: true },
  { id: "srv-2", barbeariaId: DEMO_BARBEARIA.id, nome: "Barba desenhada", categoria: "Barba", preco: 35, duracaoMin: 25, foto: svgPhoto(ICON_RAZOR, 24, 30), ativo: true },
  { id: "srv-3", barbeariaId: DEMO_BARBEARIA.id, nome: "Corte + barba", categoria: "Combos", preco: 70, duracaoMin: 60, foto: svgPhoto(ICON_SCISSORS, 8, 16), ativo: true },
  { id: "srv-4", barbeariaId: DEMO_BARBEARIA.id, nome: "Sobrancelha", categoria: "Estética", preco: 20, duracaoMin: 15, foto: svgPhoto(ICON_RAZOR, 320, 330), ativo: true },
];

const DEMO_PRODUTOS: Produto[] = [
  { id: "prd-1", barbeariaId: DEMO_BARBEARIA.id, nome: "Pomada modeladora", categoria: "Cabelo", preco: 39.9, estoque: 12, foto: svgPhoto(ICON_BOTTLE, 175, 185), ativo: true },
  { id: "prd-2", barbeariaId: DEMO_BARBEARIA.id, nome: "Óleo para barba", categoria: "Barba", preco: 29.9, estoque: 3, foto: svgPhoto(ICON_BOTTLE, 24, 30), ativo: true },
  { id: "prd-3", barbeariaId: DEMO_BARBEARIA.id, nome: "Shampoo 3 em 1", categoria: "Cabelo", preco: 24.5, estoque: 0, foto: svgPhoto(ICON_BOTTLE, 190, 200), ativo: true },
];

const DEMO_SERVICOS_BASICO: Servico[] = [
  { id: "srv-b1", barbeariaId: DEMO_BARBEARIA_BASICO.id, nome: "Corte simples", categoria: "Cortes", preco: 30, duracaoMin: 30, foto: svgPhoto(ICON_SCISSORS, 40, 46), ativo: true },
  { id: "srv-b2", barbeariaId: DEMO_BARBEARIA_BASICO.id, nome: "Barba", categoria: "Barba", preco: 25, duracaoMin: 20, foto: svgPhoto(ICON_RAZOR, 24, 30), ativo: true },
];

const DEMO_BARBEIROS: BarbeiroPerfil[] = [
  { id: "brb-1", barbeariaId: DEMO_BARBEARIA.id, usuarioId: "demo-dono", nome: "Zé Ferreira", email: "dono@navalha.app", especialidade: "Cortes clássicos", foto: svgPhoto(ICON_PERSON, 40, 50), ativo: true },
  { id: "brb-2", barbeariaId: DEMO_BARBEARIA.id, usuarioId: "demo-barbeiro", nome: "Nando Silva", email: "barbeiro@navalha.app", especialidade: "Degradê e barba", foto: svgPhoto(ICON_PERSON, 190, 200), ativo: true },
  { id: "brb-3", barbeariaId: DEMO_BARBEARIA.id, usuarioId: null, nome: "Kaká Torres", email: "kaka@navalha.app", especialidade: "Navalhado", foto: svgPhoto(ICON_PERSON, 260, 270), ativo: true },
  { id: "brb-b1", barbeariaId: DEMO_BARBEARIA_BASICO.id, usuarioId: "demo-dono-basico", nome: "Tião Alves", email: "dono.basico@navalha.app", especialidade: "Dono da barbearia", foto: svgPhoto(ICON_PERSON, 40, 50), ativo: true },
];

const hoje = toISODate(new Date());
const ontem = addDays(hoje, -1);
const amanha = addDays(hoje, 1);
const depois = addDays(hoje, 2);

const DEMO_AGENDAMENTOS: Agendamento[] = [
  // Hoje
  { id: "ag-1", barbeariaId: DEMO_BARBEARIA.id, barbeiroId: "brb-2", clienteNome: "Carlos M.", servicoNome: "Corte degradê", preco: 45, data: hoje, hora: "09:00", status: "concluido", formaPagamento: "online" },
  { id: "ag-2", barbeariaId: DEMO_BARBEARIA.id, barbeiroId: "brb-2", clienteNome: "Rafael P.", servicoNome: "Barba desenhada", preco: 35, data: hoje, hora: "10:30", status: "concluido", formaPagamento: "local" },
  { id: "ag-4", barbeariaId: DEMO_BARBEARIA.id, barbeiroId: "brb-1", clienteNome: "Marcos T.", servicoNome: "Corte degradê", preco: 45, data: hoje, hora: "11:00", status: "confirmado", formaPagamento: "online" },
  { id: "ag-3", barbeariaId: DEMO_BARBEARIA.id, barbeiroId: "brb-2", clienteNome: "João Vitor", servicoNome: "Corte + barba", preco: 70, data: hoje, hora: "14:00", status: "confirmado", formaPagamento: "online" },
  { id: "ag-5", barbeariaId: DEMO_BARBEARIA.id, barbeiroId: "brb-3", clienteNome: "Diego A.", servicoNome: "Sobrancelha", preco: 20, data: hoje, hora: "15:30", status: "pendente", formaPagamento: "local" },
  { id: "ag-6", barbeariaId: DEMO_BARBEARIA.id, barbeiroId: "brb-2", clienteNome: "Bruno K.", servicoNome: "Corte degradê", preco: 45, data: hoje, hora: "16:30", status: "pendente", formaPagamento: "local" },
  { id: "ag-7", barbeariaId: DEMO_BARBEARIA.id, barbeiroId: "brb-1", clienteNome: "Yuri N.", servicoNome: "Barba desenhada", preco: 35, data: hoje, hora: "12:00", status: "cancelado", formaPagamento: "local" },
  // Ontem
  { id: "ag-8", barbeariaId: DEMO_BARBEARIA.id, barbeiroId: "brb-2", clienteNome: "Felipe R.", servicoNome: "Corte degradê", preco: 45, data: ontem, hora: "10:00", status: "concluido", formaPagamento: "online" },
  { id: "ag-9", barbeariaId: DEMO_BARBEARIA.id, barbeiroId: "brb-1", clienteNome: "Gabriel T.", servicoNome: "Sobrancelha", preco: 20, data: ontem, hora: "13:30", status: "concluido", formaPagamento: "local" },
  // Amanhã
  { id: "ag-10", barbeariaId: DEMO_BARBEARIA.id, barbeiroId: "brb-3", clienteNome: "Igor S.", servicoNome: "Corte + barba", preco: 70, data: amanha, hora: "09:30", status: "confirmado", formaPagamento: "online" },
  { id: "ag-11", barbeariaId: DEMO_BARBEARIA.id, barbeiroId: "brb-2", clienteNome: "Thiago L.", servicoNome: "Barba desenhada", preco: 35, data: amanha, hora: "11:00", status: "confirmado", formaPagamento: "online" },
  { id: "ag-12", barbeariaId: DEMO_BARBEARIA.id, barbeiroId: "brb-1", clienteNome: "Caio V.", servicoNome: "Corte degradê", preco: 45, data: amanha, hora: "17:00", status: "pendente", formaPagamento: "local" },
  // Depois de amanhã
  { id: "ag-13", barbeariaId: DEMO_BARBEARIA.id, barbeiroId: "brb-2", clienteNome: "Danilo P.", servicoNome: "Corte + barba", preco: 70, data: depois, hora: "10:00", status: "confirmado", formaPagamento: "online" },

  // Barbearia do Tião (Básico)
  { id: "ag-b1", barbeariaId: DEMO_BARBEARIA_BASICO.id, barbeiroId: "brb-b1", clienteNome: "Eduardo L.", servicoNome: "Corte simples", preco: 30, data: hoje, hora: "10:30", status: "concluido", formaPagamento: "online" },
  { id: "ag-b2", barbeariaId: DEMO_BARBEARIA_BASICO.id, barbeiroId: "brb-b1", clienteNome: "Fábio S.", servicoNome: "Barba", preco: 25, data: hoje, hora: "13:00", status: "confirmado", formaPagamento: "online" },
  { id: "ag-b3", barbeariaId: DEMO_BARBEARIA_BASICO.id, barbeiroId: "brb-b1", clienteNome: "Gustavo P.", servicoNome: "Corte simples", preco: 30, data: hoje, hora: "16:00", status: "pendente", formaPagamento: "local" },
  { id: "ag-b4", barbeariaId: DEMO_BARBEARIA_BASICO.id, barbeiroId: "brb-b1", clienteNome: "Henrique O.", servicoNome: "Barba", preco: 25, data: hoje, hora: "11:30", status: "cancelado", formaPagamento: "local" },
  { id: "ag-b5", barbeariaId: DEMO_BARBEARIA_BASICO.id, barbeiroId: "brb-b1", clienteNome: "Ivan R.", servicoNome: "Corte simples", preco: 30, data: amanha, hora: "12:00", status: "confirmado", formaPagamento: "online" },
];

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function seedIfMissing<T extends { id: string }>(key: string, demoItems: T[]) {
  const current = read<T[]>(key, []);
  const missing = demoItems.filter((d) => !current.some((c) => c.id === d.id));
  if (missing.length) {
    write(key, [...current, ...missing]);
  }
}

// Bumped whenever the shape of the mock data changes (new fields, etc).
// Old localStorage data was seeded before those fields existed, so
// seedIfMissing alone won't add them to already-saved demo records —
// bumping this wipes stale mock data instead of silently breaking on it.
const SCHEMA_VERSION = 7;
const VERSION_KEY = "navalha_schema_version";

function ensureSeeded() {
  if (typeof window === "undefined") return;

  const storedVersion = window.localStorage.getItem(VERSION_KEY);
  if (storedVersion !== String(SCHEMA_VERSION)) {
    for (const key of Object.values(KEYS)) {
      window.localStorage.removeItem(key);
    }
    window.localStorage.setItem(VERSION_KEY, String(SCHEMA_VERSION));
  }

  seedIfMissing(KEYS.barbearias, [DEMO_BARBEARIA, DEMO_BARBEARIA_BASICO]);
  seedIfMissing(KEYS.usuarios, DEMO_USERS);
  seedIfMissing(KEYS.servicos, [...DEMO_SERVICOS, ...DEMO_SERVICOS_BASICO]);
  seedIfMissing(KEYS.produtos, DEMO_PRODUTOS);
  seedIfMissing(KEYS.barbeiros, DEMO_BARBEIROS);
  seedIfMissing(KEYS.agendamentos, DEMO_AGENDAMENTOS);
}

// ---------- Barbearias / Auth ----------

export function getBarbearias(): Barbearia[] {
  ensureSeeded();
  return read<Barbearia[]>(KEYS.barbearias, []);
}

export function getBarbeariaById(id: string): Barbearia | undefined {
  return getBarbearias().find((b) => b.id === id);
}

export function updateBarbearia(id: string, patch: Partial<Barbearia>) {
  const barbearias = getBarbearias().map((b) =>
    b.id === id ? { ...b, ...patch } : b,
  );
  write(KEYS.barbearias, barbearias);
}

export function getUsuarios(): Usuario[] {
  ensureSeeded();
  return read<Usuario[]>(KEYS.usuarios, []);
}

export interface CadastroInput {
  barbeariaNome: string;
  telefone: string;
  endereco: string;
  diasFuncionamento: Barbearia["diasFuncionamento"];
  horarioAbertura: string;
  horarioFechamento: string;
  plano: Barbearia["plano"];
  donoNome: string;
  email: string;
  senha: string;
}

export function cadastrarBarbearia(
  input: CadastroInput,
): { ok: true; session: Session } | { ok: false; error: string } {
  ensureSeeded();
  const usuarios = read<Usuario[]>(KEYS.usuarios, []);

  if (usuarios.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
    return { ok: false, error: "Já existe uma conta com esse e-mail." };
  }

  const barbearia: Barbearia = {
    id: `barbearia-${Date.now()}`,
    nome: input.barbeariaNome,
    telefone: input.telefone,
    endereco: input.endereco,
    diasFuncionamento: input.diasFuncionamento,
    horarioAbertura: input.horarioAbertura,
    horarioFechamento: input.horarioFechamento,
    plano: input.plano,
    criadaEm: new Date().toISOString(),
  };

  const usuario: Usuario = {
    id: `usuario-${Date.now()}`,
    nome: input.donoNome,
    email: input.email,
    senha: input.senha,
    role: "dono",
    barbeariaId: barbearia.id,
  };

  write(KEYS.barbearias, [...getBarbearias(), barbearia]);
  write(KEYS.usuarios, [...usuarios, usuario]);

  const donoBarbeiro: BarbeiroPerfil = {
    id: `barbeiro-${Date.now()}`,
    barbeariaId: barbearia.id,
    usuarioId: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    especialidade: "Dono da barbearia",
    ativo: true,
  };
  write(KEYS.barbeiros, [...getBarbeiros(), donoBarbeiro]);

  const session: Session = {
    userId: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    role: usuario.role,
    barbeariaId: barbearia.id,
    barbeariaNome: barbearia.nome,
  };
  write(KEYS.session, session);

  return { ok: true, session };
}

export function login(
  email: string,
  senha: string,
): { ok: true; session: Session } | { ok: false; error: string } {
  ensureSeeded();
  const usuarios = read<Usuario[]>(KEYS.usuarios, []);
  const usuario = usuarios.find(
    (u) => u.email.toLowerCase() === email.toLowerCase(),
  );

  if (!usuario || usuario.senha !== senha) {
    return { ok: false, error: "E-mail ou senha incorretos." };
  }

  const barbearia = getBarbearias().find((b) => b.id === usuario.barbeariaId);

  const session: Session = {
    userId: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    role: usuario.role,
    barbeariaId: usuario.barbeariaId,
    barbeariaNome: barbearia?.nome ?? "Sua barbearia",
  };
  write(KEYS.session, session);

  return { ok: true, session };
}

export function getSession(): Session | null {
  return read<Session | null>(KEYS.session, null);
}

export function logout() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEYS.session);
}

// ---------- Serviços ----------

export function getServicos(barbeariaId: string): Servico[] {
  ensureSeeded();
  return read<Servico[]>(KEYS.servicos, []).filter(
    (s) => s.barbeariaId === barbeariaId,
  );
}

export function addServico(input: Omit<Servico, "id">): Servico {
  const servico: Servico = { ...input, id: `servico-${Date.now()}` };
  write(KEYS.servicos, [...read<Servico[]>(KEYS.servicos, []), servico]);
  return servico;
}

export function updateServico(id: string, patch: Partial<Servico>) {
  const servicos = read<Servico[]>(KEYS.servicos, []).map((s) =>
    s.id === id ? { ...s, ...patch } : s,
  );
  write(KEYS.servicos, servicos);
}

export function removeServico(id: string) {
  write(
    KEYS.servicos,
    read<Servico[]>(KEYS.servicos, []).filter((s) => s.id !== id),
  );
}

// ---------- Produtos ----------

export function getProdutos(barbeariaId: string): Produto[] {
  ensureSeeded();
  return read<Produto[]>(KEYS.produtos, []).filter(
    (p) => p.barbeariaId === barbeariaId,
  );
}

export function addProduto(input: Omit<Produto, "id">): Produto {
  const produto: Produto = { ...input, id: `produto-${Date.now()}` };
  write(KEYS.produtos, [...read<Produto[]>(KEYS.produtos, []), produto]);
  return produto;
}

export function updateProduto(id: string, patch: Partial<Produto>) {
  const produtos = read<Produto[]>(KEYS.produtos, []).map((p) =>
    p.id === id ? { ...p, ...patch } : p,
  );
  write(KEYS.produtos, produtos);
}

export function removeProduto(id: string) {
  write(
    KEYS.produtos,
    read<Produto[]>(KEYS.produtos, []).filter((p) => p.id !== id),
  );
}

// ---------- Barbeiros ----------

export function getBarbeiros(barbeariaId?: string): BarbeiroPerfil[] {
  ensureSeeded();
  const all = read<BarbeiroPerfil[]>(KEYS.barbeiros, []);
  return barbeariaId ? all.filter((b) => b.barbeariaId === barbeariaId) : all;
}

export interface NovoBarbeiroInput {
  barbeariaId: string;
  nome: string;
  email: string;
  senha: string;
  especialidade: string;
  foto?: string;
}

/** Creates both the barbeiro directory entry and a login-capable Usuario account. */
export function addBarbeiroComAcesso(
  input: NovoBarbeiroInput,
): { ok: true; barbeiro: BarbeiroPerfil } | { ok: false; error: string } {
  const usuarios = read<Usuario[]>(KEYS.usuarios, []);
  if (usuarios.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
    return { ok: false, error: "Já existe uma conta com esse e-mail." };
  }

  const usuario: Usuario = {
    id: `usuario-${Date.now()}`,
    nome: input.nome,
    email: input.email,
    senha: input.senha,
    role: "barbeiro",
    barbeariaId: input.barbeariaId,
  };
  write(KEYS.usuarios, [...usuarios, usuario]);

  const barbeiro: BarbeiroPerfil = {
    id: `barbeiro-${Date.now()}`,
    barbeariaId: input.barbeariaId,
    usuarioId: usuario.id,
    nome: input.nome,
    email: input.email,
    especialidade: input.especialidade,
    foto: input.foto,
    ativo: true,
  };
  write(KEYS.barbeiros, [...getBarbeiros(), barbeiro]);

  return { ok: true, barbeiro };
}

export function updateBarbeiro(id: string, patch: Partial<BarbeiroPerfil>) {
  const barbeiros = getBarbeiros().map((b) =>
    b.id === id ? { ...b, ...patch } : b,
  );
  write(KEYS.barbeiros, barbeiros);
}

export function removeBarbeiro(id: string) {
  const barbeiro = getBarbeiros().find((b) => b.id === id);
  write(
    KEYS.barbeiros,
    getBarbeiros().filter((b) => b.id !== id),
  );
  if (barbeiro?.usuarioId) {
    write(
      KEYS.usuarios,
      read<Usuario[]>(KEYS.usuarios, []).filter((u) => u.id !== barbeiro.usuarioId),
    );
  }
}

// ---------- Agendamentos ----------

export function getAgendamentos(barbeariaId: string): Agendamento[] {
  ensureSeeded();
  return read<Agendamento[]>(KEYS.agendamentos, [])
    .filter((a) => a.barbeariaId === barbeariaId)
    .sort((a, b) => a.hora.localeCompare(b.hora));
}

export function getAgendamentosPorBarbeiro(barbeiroId: string): Agendamento[] {
  ensureSeeded();
  return read<Agendamento[]>(KEYS.agendamentos, [])
    .filter((a) => a.barbeiroId === barbeiroId)
    .sort((a, b) => a.hora.localeCompare(b.hora));
}

function updateAgendamento(id: string, patch: Partial<Agendamento>) {
  const agendamentos = read<Agendamento[]>(KEYS.agendamentos, []).map((a) =>
    a.id === id ? { ...a, ...patch } : a,
  );
  write(KEYS.agendamentos, agendamentos);
}

/** Dono/barbeiro confirms a "pendente" (pay-at-location) booking. */
export function confirmarAgendamento(id: string) {
  updateAgendamento(id, { status: "confirmado" });
}

export function cancelarAgendamento(id: string) {
  updateAgendamento(id, { status: "cancelado" });
}

/** Horários já tomados por um barbeiro num dia (pendente ou confirmado seguram o slot). */
export function getHorariosOcupados(barbeiroId: string, data: string): string[] {
  return read<Agendamento[]>(KEYS.agendamentos, [])
    .filter(
      (a) =>
        a.barbeiroId === barbeiroId &&
        a.data === data &&
        (a.status === "pendente" || a.status === "confirmado"),
    )
    .map((a) => a.hora);
}

export interface NovoAgendamentoInput {
  barbeariaId: string;
  barbeiroId: string;
  clienteNome: string;
  clienteTelefone: string;
  servicoNome: string;
  preco: number;
  data: string;
  hora: string;
  formaPagamento: Agendamento["formaPagamento"];
}

/**
 * Agendamento feito pelo cliente na página pública.
 * Pagamento online já entra confirmado; pagar no local fica pendente até a
 * barbearia confirmar no painel.
 */
export function criarAgendamento(
  input: NovoAgendamentoInput,
): { ok: true; agendamento: Agendamento } | { ok: false; error: string } {
  const ocupados = getHorariosOcupados(input.barbeiroId, input.data);
  if (ocupados.includes(input.hora)) {
    return { ok: false, error: "Esse horário acabou de ser ocupado. Escolha outro." };
  }

  const agendamento: Agendamento = {
    id: `ag-${Date.now()}`,
    barbeariaId: input.barbeariaId,
    barbeiroId: input.barbeiroId,
    clienteNome: input.clienteNome,
    clienteTelefone: input.clienteTelefone,
    servicoNome: input.servicoNome,
    preco: input.preco,
    data: input.data,
    hora: input.hora,
    status: input.formaPagamento === "online" ? "confirmado" : "pendente",
    formaPagamento: input.formaPagamento,
  };

  write(KEYS.agendamentos, [
    ...read<Agendamento[]>(KEYS.agendamentos, []),
    agendamento,
  ]);

  return { ok: true, agendamento };
}

/** Marca como concluído e, se houver produtos vendidos, dá baixa no estoque. */
export function concluirAgendamento(
  id: string,
  produtosVendidos: { produtoId: string; quantidade: number }[] = [],
) {
  const agendamento = read<Agendamento[]>(KEYS.agendamentos, []).find((a) => a.id === id);
  if (!agendamento) return;

  for (const item of produtosVendidos) {
    registrarMovimentoEstoque({
      barbeariaId: agendamento.barbeariaId,
      produtoId: item.produtoId,
      tipo: "saida",
      quantidade: item.quantidade,
      motivo: `Venda — ${agendamento.clienteNome}`,
    });
  }

  updateAgendamento(id, { status: "concluido" });
}

// ---------- Estoque ----------

export function getMovimentosEstoque(barbeariaId: string): MovimentoEstoque[] {
  return read<MovimentoEstoque[]>(KEYS.movimentosEstoque, [])
    .filter((m) => m.barbeariaId === barbeariaId)
    .sort((a, b) => b.data.localeCompare(a.data));
}

export function registrarMovimentoEstoque(input: {
  barbeariaId: string;
  produtoId: string;
  tipo: MovimentoEstoque["tipo"];
  quantidade: number;
  motivo: string;
}): { ok: true } | { ok: false; error: string } {
  const produto = getProdutos(input.barbeariaId).find((p) => p.id === input.produtoId);
  if (!produto) return { ok: false, error: "Produto não encontrado." };

  const delta = input.tipo === "entrada" ? input.quantidade : -input.quantidade;
  const novoEstoque = produto.estoque + delta;
  if (novoEstoque < 0) {
    return { ok: false, error: "Estoque insuficiente pra essa saída." };
  }

  updateProduto(produto.id, { estoque: novoEstoque });

  const movimento: MovimentoEstoque = {
    id: `mov-${Date.now()}`,
    barbeariaId: input.barbeariaId,
    produtoId: produto.id,
    produtoNome: produto.nome,
    tipo: input.tipo,
    quantidade: input.quantidade,
    motivo: input.motivo,
    data: new Date().toISOString(),
  };
  write(KEYS.movimentosEstoque, [
    ...read<MovimentoEstoque[]>(KEYS.movimentosEstoque, []),
    movimento,
  ]);

  return { ok: true };
}
