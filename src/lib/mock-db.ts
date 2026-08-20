import { addDays, addMinutes, generateTimeSlots, toISODate } from "./date";
import { SLOT_MIN, slotsDe } from "./types";
import type {
  Agendamento,
  Barbearia,
  BarbeiroPerfil,
  MercadoPagoConta,
  MovimentoEstoque,
  ProdutoComprado,
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
const ICON_CHAIR = "M6 20v-4h12v4M5 16V9a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v7M9 6V4h6v2";
const ICON_MIRROR = "M7 21h10M12 17v4M6 3h12v10a6 6 0 0 1-12 0V3Z";

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

/** Banner largo (placeholder de foto de capa) — mesma ideia do svgPhoto, em formato widescreen. */
function svgCover(iconPath: string, hueFrom: number, hueTo: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hueFrom},45%,16%)"/>
      <stop offset="1" stop-color="hsl(${hueTo},50%,26%)"/>
    </linearGradient></defs>
    <rect width="800" height="400" fill="url(#g)"/>
    <g transform="translate(320,120) scale(7)" stroke="#f1c869" stroke-width="0.7" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.5">
      <path d="${iconPath}"/>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Placeholder 4:3 pras fotos do espaço da barbearia. */
function svgGaleria(iconPath: string, hueFrom: number, hueTo: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hueFrom},40%,18%)"/>
      <stop offset="1" stop-color="hsl(${hueTo},45%,30%)"/>
    </linearGradient></defs>
    <rect width="640" height="480" fill="url(#g)"/>
    <g transform="translate(260,180) scale(5)" stroke="#f1c869" stroke-width="0.8" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.55">
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
  foto: svgCover(ICON_SCISSORS, 40, 20),
  sobre:
    "Tradição e navalha afiada desde 2012. Ambiente clássico, equipe experiente e café sempre fresco pra quem espera a vez.",
  galeria: [
    svgGaleria(ICON_CHAIR, 30, 20),
    svgGaleria(ICON_MIRROR, 200, 190),
    svgGaleria(ICON_SCISSORS, 15, 35),
    svgGaleria(ICON_RAZOR, 260, 250),
  ],
  mercadoPago: {
    apelido: "ze.ferreira@navalha.app",
    publicKey: "TEST-8f21c4a9-0d3e-47bb-9c10-demo",
    accessToken: "TEST-4471928365108842-demo-token",
    ambiente: "teste",
    aceitaPix: true,
    aceitaCartao: true,
    parcelasMax: 3,
    conectadoEm: new Date().toISOString(),
  },
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
  foto: svgCover(ICON_RAZOR, 24, 10),
  sobre: "Corte rápido e bem feito no coração da Paulista. Sem hora marcada não tem estresse.",
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
  { id: "srv-5", barbeariaId: DEMO_BARBEARIA.id, nome: "Corte social", categoria: "Cortes", preco: 40, duracaoMin: 30, foto: svgPhoto(ICON_SCISSORS, 210, 220), ativo: true },
  { id: "srv-6", barbeariaId: DEMO_BARBEARIA.id, nome: "Corte navalhado", categoria: "Cortes", preco: 55, duracaoMin: 45, foto: svgPhoto(ICON_SCISSORS, 340, 350), ativo: true },
  { id: "srv-7", barbeariaId: DEMO_BARBEARIA.id, nome: "Corte infantil", categoria: "Cortes", preco: 35, duracaoMin: 30, foto: svgPhoto(ICON_SCISSORS, 160, 175), ativo: true },
  { id: "srv-2", barbeariaId: DEMO_BARBEARIA.id, nome: "Barba desenhada", categoria: "Barba", preco: 35, duracaoMin: 25, foto: svgPhoto(ICON_RAZOR, 24, 30), ativo: true },
  { id: "srv-8", barbeariaId: DEMO_BARBEARIA.id, nome: "Barba com toalha quente", categoria: "Barba", preco: 50, duracaoMin: 40, foto: svgPhoto(ICON_RAZOR, 0, 12), ativo: true },
  { id: "srv-3", barbeariaId: DEMO_BARBEARIA.id, nome: "Corte + barba", categoria: "Combos", preco: 70, duracaoMin: 65, foto: svgPhoto(ICON_SCISSORS, 8, 16), ativo: true, servicosIncluidos: ["srv-1", "srv-2"] },
  { id: "srv-9", barbeariaId: DEMO_BARBEARIA.id, nome: "Combo completo", categoria: "Combos", preco: 95, duracaoMin: 80, foto: svgPhoto(ICON_SCISSORS, 280, 295), ativo: true, servicosIncluidos: ["srv-1", "srv-2", "srv-4"] },
  { id: "srv-4", barbeariaId: DEMO_BARBEARIA.id, nome: "Sobrancelha", categoria: "Estética", preco: 20, duracaoMin: 15, foto: svgPhoto(ICON_RAZOR, 320, 330), ativo: true },
  { id: "srv-10", barbeariaId: DEMO_BARBEARIA.id, nome: "Hidratação capilar", categoria: "Estética", preco: 45, duracaoMin: 30, foto: svgPhoto(ICON_BOTTLE, 150, 165), ativo: true },
  { id: "srv-11", barbeariaId: DEMO_BARBEARIA.id, nome: "Limpeza de pele", categoria: "Estética", preco: 60, duracaoMin: 45, foto: svgPhoto(ICON_BOTTLE, 195, 210), ativo: true },
];

const DEMO_PRODUTOS: Produto[] = [
  { id: "prd-1", barbeariaId: DEMO_BARBEARIA.id, nome: "Pomada modeladora", categoria: "Cabelo", preco: 39.9, estoque: 12, foto: svgPhoto(ICON_BOTTLE, 175, 185), ativo: true },
  { id: "prd-3", barbeariaId: DEMO_BARBEARIA.id, nome: "Shampoo 3 em 1", categoria: "Cabelo", preco: 24.5, estoque: 0, foto: svgPhoto(ICON_BOTTLE, 190, 200), ativo: true },
  { id: "prd-4", barbeariaId: DEMO_BARBEARIA.id, nome: "Cera fixadora", categoria: "Cabelo", preco: 34.9, estoque: 8, foto: svgPhoto(ICON_BOTTLE, 120, 135), ativo: true },
  { id: "prd-5", barbeariaId: DEMO_BARBEARIA.id, nome: "Tônico capilar", categoria: "Cabelo", preco: 49.9, estoque: 5, foto: svgPhoto(ICON_BOTTLE, 95, 110), ativo: true },
  { id: "prd-2", barbeariaId: DEMO_BARBEARIA.id, nome: "Óleo para barba", categoria: "Barba", preco: 29.9, estoque: 3, foto: svgPhoto(ICON_BOTTLE, 24, 30), ativo: true },
  { id: "prd-6", barbeariaId: DEMO_BARBEARIA.id, nome: "Balm para barba", categoria: "Barba", preco: 32.9, estoque: 9, foto: svgPhoto(ICON_BOTTLE, 8, 20), ativo: true },
  { id: "prd-7", barbeariaId: DEMO_BARBEARIA.id, nome: "Shampoo para barba", categoria: "Barba", preco: 27.9, estoque: 6, foto: svgPhoto(ICON_BOTTLE, 40, 55), ativo: true },
  { id: "prd-8", barbeariaId: DEMO_BARBEARIA.id, nome: "Máscara facial de argila", categoria: "Skincare", preco: 22.9, estoque: 10, foto: svgPhoto(ICON_BOTTLE, 300, 315), ativo: true },
  { id: "prd-9", barbeariaId: DEMO_BARBEARIA.id, nome: "Protetor solar facial", categoria: "Skincare", preco: 45.0, estoque: 4, foto: svgPhoto(ICON_BOTTLE, 220, 235), ativo: true },
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
  { id: "ag-1", barbeariaId: DEMO_BARBEARIA.id, barbeiroId: "brb-2", clienteNome: "Carlos M.", servicoNome: "Corte degradê", preco: 45, duracaoMin: 40, data: hoje, hora: "09:00", status: "concluido", formaPagamento: "online", metodoPagamento: "pix" },
  { id: "ag-2", barbeariaId: DEMO_BARBEARIA.id, barbeiroId: "brb-2", clienteNome: "Rafael P.", servicoNome: "Barba desenhada", preco: 35, duracaoMin: 25, data: hoje, hora: "10:30", status: "concluido", formaPagamento: "local" },
  { id: "ag-4", barbeariaId: DEMO_BARBEARIA.id, barbeiroId: "brb-1", clienteNome: "Marcos T.", servicoNome: "Corte degradê", preco: 45, duracaoMin: 40, data: hoje, hora: "11:00", status: "confirmado", formaPagamento: "online", metodoPagamento: "pix" },
  { id: "ag-3", barbeariaId: DEMO_BARBEARIA.id, barbeiroId: "brb-2", clienteNome: "João Vitor", servicoNome: "Corte + barba", preco: 70, duracaoMin: 60, data: hoje, hora: "14:00", status: "confirmado", formaPagamento: "online", metodoPagamento: "pix" },
  { id: "ag-5", barbeariaId: DEMO_BARBEARIA.id, barbeiroId: "brb-3", clienteNome: "Diego A.", servicoNome: "Sobrancelha", preco: 20, duracaoMin: 15, data: hoje, hora: "15:30", status: "pendente", formaPagamento: "local" },
  { id: "ag-6", barbeariaId: DEMO_BARBEARIA.id, barbeiroId: "brb-2", clienteNome: "Bruno K.", servicoNome: "Corte degradê", preco: 45, duracaoMin: 40, data: hoje, hora: "16:30", status: "pendente", formaPagamento: "local" },
  { id: "ag-7", barbeariaId: DEMO_BARBEARIA.id, barbeiroId: "brb-1", clienteNome: "Yuri N.", servicoNome: "Barba desenhada", preco: 35, duracaoMin: 25, data: hoje, hora: "12:00", status: "cancelado", formaPagamento: "local" },
  // Ontem
  { id: "ag-8", barbeariaId: DEMO_BARBEARIA.id, barbeiroId: "brb-2", clienteNome: "Felipe R.", servicoNome: "Corte degradê", preco: 45, duracaoMin: 40, data: ontem, hora: "10:00", status: "concluido", formaPagamento: "online", metodoPagamento: "pix" },
  { id: "ag-9", barbeariaId: DEMO_BARBEARIA.id, barbeiroId: "brb-1", clienteNome: "Gabriel T.", servicoNome: "Sobrancelha", preco: 20, duracaoMin: 15, data: ontem, hora: "13:30", status: "concluido", formaPagamento: "local" },
  // Amanhã
  { id: "ag-10", barbeariaId: DEMO_BARBEARIA.id, barbeiroId: "brb-3", clienteNome: "Igor S.", servicoNome: "Corte + barba", preco: 70, duracaoMin: 60, data: amanha, hora: "09:30", status: "confirmado", formaPagamento: "online", metodoPagamento: "pix" },
  { id: "ag-11", barbeariaId: DEMO_BARBEARIA.id, barbeiroId: "brb-2", clienteNome: "Thiago L.", servicoNome: "Barba desenhada", preco: 35, duracaoMin: 25, data: amanha, hora: "11:00", status: "confirmado", formaPagamento: "online", metodoPagamento: "pix" },
  { id: "ag-12", barbeariaId: DEMO_BARBEARIA.id, barbeiroId: "brb-1", clienteNome: "Caio V.", servicoNome: "Corte degradê", preco: 45, duracaoMin: 40, data: amanha, hora: "17:00", status: "pendente", formaPagamento: "local" },
  // Depois de amanhã
  { id: "ag-13", barbeariaId: DEMO_BARBEARIA.id, barbeiroId: "brb-2", clienteNome: "Danilo P.", servicoNome: "Corte + barba", preco: 70, duracaoMin: 60, data: depois, hora: "10:00", status: "confirmado", formaPagamento: "online", metodoPagamento: "pix" },

  // Barbearia do Tião (Básico)
  { id: "ag-b1", barbeariaId: DEMO_BARBEARIA_BASICO.id, barbeiroId: "brb-b1", clienteNome: "Eduardo L.", servicoNome: "Corte simples", preco: 30, duracaoMin: 30, data: hoje, hora: "10:30", status: "concluido", formaPagamento: "online", metodoPagamento: "pix" },
  { id: "ag-b2", barbeariaId: DEMO_BARBEARIA_BASICO.id, barbeiroId: "brb-b1", clienteNome: "Fábio S.", servicoNome: "Barba", preco: 25, duracaoMin: 20, data: hoje, hora: "13:00", status: "confirmado", formaPagamento: "online", metodoPagamento: "pix" },
  { id: "ag-b3", barbeariaId: DEMO_BARBEARIA_BASICO.id, barbeiroId: "brb-b1", clienteNome: "Gustavo P.", servicoNome: "Corte simples", preco: 30, duracaoMin: 30, data: hoje, hora: "16:00", status: "pendente", formaPagamento: "local" },
  { id: "ag-b4", barbeariaId: DEMO_BARBEARIA_BASICO.id, barbeiroId: "brb-b1", clienteNome: "Henrique O.", servicoNome: "Barba", preco: 25, duracaoMin: 20, data: hoje, hora: "11:30", status: "cancelado", formaPagamento: "local" },
  { id: "ag-b5", barbeariaId: DEMO_BARBEARIA_BASICO.id, barbeiroId: "brb-b1", clienteNome: "Ivan R.", servicoNome: "Corte simples", preco: 30, duracaoMin: 30, data: amanha, hora: "12:00", status: "confirmado", formaPagamento: "online", metodoPagamento: "pix" },
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
const SCHEMA_VERSION = 11;
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

// ---------- Mercado Pago ----------

export interface ConectarMPInput {
  barbeariaId: string;
  apelido: string;
  publicKey: string;
  accessToken: string;
  ambiente: MercadoPagoConta["ambiente"];
}

/** Formato das credenciais do Mercado Pago (TEST-… no sandbox, APP_USR-… em produção). */
export function validarCredencialMP(
  valor: string,
  ambiente: MercadoPagoConta["ambiente"],
): boolean {
  const prefixo = ambiente === "teste" ? "TEST-" : "APP_USR-";
  return valor.trim().startsWith(prefixo) && valor.trim().length > prefixo.length + 12;
}

export function conectarMercadoPago(
  input: ConectarMPInput,
): { ok: true } | { ok: false; error: string } {
  const barbearia = getBarbeariaById(input.barbeariaId);
  if (!barbearia) return { ok: false, error: "Barbearia não encontrada." };

  if (!input.apelido.trim()) {
    return { ok: false, error: "Informe o e-mail ou apelido da conta do Mercado Pago." };
  }
  if (!validarCredencialMP(input.publicKey, input.ambiente)) {
    return {
      ok: false,
      error: `A Public Key precisa começar com ${input.ambiente === "teste" ? "TEST-" : "APP_USR-"}.`,
    };
  }
  if (!validarCredencialMP(input.accessToken, input.ambiente)) {
    return {
      ok: false,
      error: `O Access Token precisa começar com ${input.ambiente === "teste" ? "TEST-" : "APP_USR-"}.`,
    };
  }

  const conta: MercadoPagoConta = {
    apelido: input.apelido.trim(),
    publicKey: input.publicKey.trim(),
    accessToken: input.accessToken.trim(),
    ambiente: input.ambiente,
    aceitaPix: true,
    aceitaCartao: true,
    parcelasMax: 3,
    conectadoEm: new Date().toISOString(),
  };

  updateBarbearia(input.barbeariaId, { mercadoPago: conta });
  return { ok: true };
}

export function atualizarPreferenciasMP(
  barbeariaId: string,
  patch: Partial<Pick<MercadoPagoConta, "aceitaPix" | "aceitaCartao" | "parcelasMax">>,
) {
  const barbearia = getBarbeariaById(barbeariaId);
  if (!barbearia?.mercadoPago) return;
  updateBarbearia(barbeariaId, { mercadoPago: { ...barbearia.mercadoPago, ...patch } });
}

export function desconectarMercadoPago(barbeariaId: string) {
  updateBarbearia(barbeariaId, { mercadoPago: undefined });
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

/**
 * Horários já tomados por um barbeiro num dia (pendente, confirmado ou já
 * concluído seguram o bloco). Um agendamento longo ocupa vários blocos de
 * 30 min, então a lista é expandida a partir da duração do serviço.
 */
export function getHorariosOcupados(barbeiroId: string, data: string): string[] {
  const doDia = read<Agendamento[]>(KEYS.agendamentos, []).filter(
    (a) =>
      a.barbeiroId === barbeiroId &&
      a.data === data &&
      (a.status === "pendente" || a.status === "confirmado" || a.status === "concluido"),
  );

  const ocupados: string[] = [];
  for (const a of doDia) {
    const blocos = slotsDe(a.duracaoMin ?? SLOT_MIN);
    for (let i = 0; i < blocos; i++) {
      ocupados.push(addMinutes(a.hora, i * SLOT_MIN));
    }
  }
  return ocupados;
}

/** Último nome/e-mail usados por esse telefone nessa barbearia, se houver. */
export function buscarClientePorTelefone(
  barbeariaId: string,
  telefone: string,
): { nome: string; email?: string } | null {
  const digits = telefone.replace(/\D/g, "");
  if (digits.length < 10) return null;

  const anteriores = read<Agendamento[]>(KEYS.agendamentos, [])
    .filter(
      (a) =>
        a.barbeariaId === barbeariaId &&
        (a.clienteTelefone ?? "").replace(/\D/g, "") === digits,
    )
    .sort((a, b) => b.id.localeCompare(a.id));

  const recente = anteriores[0];
  return recente ? { nome: recente.clienteNome, email: recente.clienteEmail } : null;
}

export interface NovoPedidoInput {
  barbeariaId: string;
  barbeiroId: string;
  clienteNome: string;
  clienteTelefone: string;
  clienteEmail?: string;
  data: string;
  horaInicio: string;
  servicos: { id: string; nome: string; preco: number; duracaoMin: number }[];
  produtos: { id: string; nome: string; preco: number; quantidade: number }[];
  formaPagamento: Agendamento["formaPagamento"];
  metodoPagamento?: Agendamento["metodoPagamento"];
}

/**
 * Fecha a compra feita pelo carrinho na página pública: um Agendamento por
 * serviço (horários encadeados a partir de horaInicio, mesmo barbeiro), e dá
 * baixa imediata no estoque dos produtos levados junto.
 * Pagamento online já entra confirmado; pagar no local fica pendente até a
 * barbearia confirmar no painel.
 */
export function criarPedido(
  input: NovoPedidoInput,
): { ok: true; agendamentos: Agendamento[] } | { ok: false; error: string } {
  if (input.servicos.length === 0) {
    return { ok: false, error: "Adicione ao menos um serviço ao carrinho." };
  }

  for (const item of input.produtos) {
    const produto = getProdutos(input.barbeariaId).find((p) => p.id === item.id);
    if (!produto || produto.estoque < item.quantidade) {
      return {
        ok: false,
        error: `"${item.nome}" ficou sem estoque suficiente. Ajuste a quantidade no carrinho.`,
      };
    }
  }

  const barbearia = getBarbeariaById(input.barbeariaId);
  if (!barbearia) return { ok: false, error: "Barbearia não encontrada." };

  const todosHorarios = generateTimeSlots(barbearia.horarioAbertura, barbearia.horarioFechamento);
  const startIdx = todosHorarios.indexOf(input.horaInicio);
  if (startIdx === -1) {
    return { ok: false, error: "Horário inválido." };
  }

  // Cada serviço ocupa quantos blocos a duração dele exigir, encadeados.
  const totalSlots = input.servicos.reduce((sum, s) => sum + slotsDe(s.duracaoMin), 0);
  if (startIdx + totalSlots > todosHorarios.length) {
    return {
      ok: false,
      error: "Não há horários seguidos suficientes nesse dia. Escolha um horário mais cedo.",
    };
  }

  const slotsNecessarios = todosHorarios.slice(startIdx, startIdx + totalSlots);
  const ocupados = getHorariosOcupados(input.barbeiroId, input.data);
  if (slotsNecessarios.some((h) => ocupados.includes(h))) {
    return { ok: false, error: "Um dos horários necessários acabou de ser ocupado. Escolha outro." };
  }

  const pedidoId = `pedido-${Date.now()}`;
  const produtosComprados: ProdutoComprado[] = input.produtos.map((p) => ({
    produtoId: p.id,
    produtoNome: p.nome,
    quantidade: p.quantidade,
    preco: p.preco,
  }));

  let cursor = startIdx;
  const novosAgendamentos: Agendamento[] = input.servicos.map((s, i) => {
    const hora = todosHorarios[cursor];
    cursor += slotsDe(s.duracaoMin);
    return {
      id: `ag-${Date.now()}-${i}`,
      barbeariaId: input.barbeariaId,
      barbeiroId: input.barbeiroId,
      clienteNome: input.clienteNome,
      clienteTelefone: input.clienteTelefone,
      clienteEmail: input.clienteEmail,
      servicoNome: s.nome,
      preco: s.preco,
      data: input.data,
      hora,
      duracaoMin: s.duracaoMin,
      status: input.formaPagamento === "online" ? "confirmado" : "pendente",
      formaPagamento: input.formaPagamento,
      metodoPagamento: input.formaPagamento === "online" ? input.metodoPagamento : undefined,
      pedidoId,
      produtosComprados: i === 0 && produtosComprados.length > 0 ? produtosComprados : undefined,
    };
  });

  write(KEYS.agendamentos, [
    ...read<Agendamento[]>(KEYS.agendamentos, []),
    ...novosAgendamentos,
  ]);

  for (const item of input.produtos) {
    registrarMovimentoEstoque({
      barbeariaId: input.barbeariaId,
      produtoId: item.id,
      tipo: "saida",
      quantidade: item.quantidade,
      motivo: `Venda online — ${input.clienteNome}`,
    });
  }

  return { ok: true, agendamentos: novosAgendamentos };
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
