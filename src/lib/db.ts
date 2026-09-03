"use client";

import { supabase } from "./supabase-browser";
import { tokenImpersonado } from "./impersonar-browser";
import { gerarSlug, pareceUuid } from "./slug";
import { SLOT_MIN, slotsDe } from "./types";
import { addMinutes } from "./date";
import type {
  Agendamento,
  Barbearia,
  BarbeiroPerfil,
  MovimentoEstoque,
  Produto,
  Servico,
} from "./types";

/**
 * Acesso aos dados pelo Supabase. Substitui o antigo mock-db em
 * localStorage — agora os dados são os mesmos pra todo mundo, em
 * qualquer dispositivo.
 *
 * O banco usa snake_case e o app camelCase, então cada tabela tem um par
 * de conversores. É chato, mas mantém o resto do código igual ao que já
 * estava escrito.
 */

function erro(e: { message: string } | null): void {
  if (e) throw new Error(e.message);
}

/**
 * Cabeçalhos pras rotas de API que exigem login. O token do Supabase Auth
 * é o que prova quem está chamando — a rota não confia em id vindo no corpo.
 *
 * Se a aba estiver em modo "Ver como", manda o token de impersonação no
 * lugar da sessão normal — ver `lib/impersonar.ts`.
 */
export async function cabecalhosAutenticados(): Promise<HeadersInit> {
  const impersonado = tokenImpersonado();
  if (impersonado) {
    return { "Content-Type": "application/json", Authorization: `Bearer ${impersonado}` };
  }

  const { data } = await supabase().auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data.session?.access_token ?? ""}`,
  };
}

// ---------- Barbearia ----------

type LinhaBarbearia = Record<string, unknown>;

function paraBarbearia(l: LinhaBarbearia): Barbearia {
  return {
    id: l.id as string,
    nome: l.nome as string,
    telefone: (l.telefone as string) ?? "",
    endereco: (l.endereco as string) ?? "",
    diasFuncionamento: (l.dias_funcionamento ?? []) as Barbearia["diasFuncionamento"],
    horariosDia: (l.horarios_dia as Barbearia["horariosDia"]) ?? undefined,
    horarioAbertura: l.horario_abertura as string,
    horarioFechamento: l.horario_fechamento as string,
    plano: l.plano as Barbearia["plano"],
    slug: (l.slug as string) ?? undefined,
    linkMaps: (l.link_maps as string) ?? undefined,
    cep: (l.cep as string) ?? undefined,
    foto: (l.foto as string) ?? undefined,
    sobre: (l.sobre as string) ?? undefined,
    galeria: (l.galeria ?? []) as string[],
    criadaEm: l.criada_em as string,
    comissaoPadrao: Number(l.comissao_padrao ?? 0),
    assinaturaStatus: (l.assinatura_status as Barbearia["assinaturaStatus"]) ?? "trial",
    trialTerminaEm: (l.trial_termina_em as string) ?? null,
    assinaturaAte: (l.assinatura_ate as string) ?? null,
  };
}

/**
 * Deriva o status "de verdade" da assinatura, aplicando o vencimento — o
 * banco só muda o campo quando algo acontece, então um trial que passou da
 * data ainda aparece como 'trial' na linha. Aqui isso vira 'vencida'.
 */
export function statusAssinaturaEfetivo(b: Barbearia): "trial" | "ativa" | "vencida" {
  const agora = Date.now();
  if (b.assinaturaStatus === "ativa") {
    if (!b.assinaturaAte || new Date(b.assinaturaAte).getTime() > agora) return "ativa";
    return "vencida";
  }
  if (b.assinaturaStatus === "trial" && b.trialTerminaEm) {
    return new Date(b.trialTerminaEm).getTime() > agora ? "trial" : "vencida";
  }
  return "vencida";
}

export async function getBarbearia(id: string): Promise<Barbearia | undefined> {
  const { data, error } = await supabase().from("barbearias").select("*").eq("id", id).maybeSingle();
  erro(error);
  return data ? paraBarbearia(data) : undefined;
}

/**
 * Busca pela URL da loja, que pode ser o slug ("barbearia-do-ze") ou o uuid.
 *
 * Os dois continuam valendo: links de uuid que a barbearia já mandou pros
 * clientes não podem quebrar só porque passamos a usar nome na URL.
 */
export async function getBarbeariaPorSlugOuId(valor: string): Promise<Barbearia | undefined> {
  if (pareceUuid(valor)) return getBarbearia(valor);

  const { data, error } = await supabase()
    .from("barbearias")
    .select("*")
    .eq("slug", valor)
    .maybeSingle();
  erro(error);
  return data ? paraBarbearia(data) : undefined;
}

/**
 * Todas as barbearias, pro diretório público.
 *
 * A policy de leitura pública já libera essa tabela — é a mesma consulta
 * que a página da loja faz, só que sem filtrar por uma.
 */
export async function getBarbeariasPublicas(): Promise<Barbearia[]> {
  const { data, error } = await supabase()
    .from("barbearias")
    .select("*")
    .order("nome");
  erro(error);
  return (data ?? []).map(paraBarbearia);
}

/**
 * Slug livre a partir do nome. Se já existir, vai somando sufixo: duas
 * barbearias podem se chamar "Barbearia do Zé" e as duas precisam de link.
 */
export async function gerarSlugDisponivel(nome: string, ignorarId?: string): Promise<string> {
  const base = gerarSlug(nome) || "barbearia";

  for (let i = 0; i < 30; i++) {
    const tentativa = i === 0 ? base : `${base}-${i + 1}`;
    const { data } = await supabase()
      .from("barbearias")
      .select("id")
      .eq("slug", tentativa)
      .maybeSingle();

    if (!data || data.id === ignorarId) return tentativa;
  }

  // Improvável: 30 barbearias com o mesmo nome. Cai num sufixo aleatório.
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function updateBarbearia(id: string, patch: Partial<Barbearia>): Promise<void> {
  const linha: Record<string, unknown> = {};
  if (patch.nome !== undefined) linha.nome = patch.nome;
  if (patch.slug !== undefined) linha.slug = patch.slug || null;
  if (patch.telefone !== undefined) linha.telefone = patch.telefone;
  if (patch.endereco !== undefined) linha.endereco = patch.endereco;
  if (patch.diasFuncionamento !== undefined) linha.dias_funcionamento = patch.diasFuncionamento;
  if (patch.horariosDia !== undefined) linha.horarios_dia = patch.horariosDia ?? null;
  if (patch.horarioAbertura !== undefined) linha.horario_abertura = patch.horarioAbertura;
  if (patch.horarioFechamento !== undefined) linha.horario_fechamento = patch.horarioFechamento;
  if (patch.plano !== undefined) linha.plano = patch.plano;
  if (patch.linkMaps !== undefined) linha.link_maps = patch.linkMaps ?? null;
  if (patch.cep !== undefined) linha.cep = patch.cep ?? null;
  if (patch.foto !== undefined) linha.foto = patch.foto ?? null;
  if (patch.sobre !== undefined) linha.sobre = patch.sobre ?? null;
  if (patch.galeria !== undefined) linha.galeria = patch.galeria;
  if (patch.comissaoPadrao !== undefined) linha.comissao_padrao = patch.comissaoPadrao;

  const { error } = await supabase().from("barbearias").update(linha).eq("id", id);
  erro(error);
}

// ---------- Serviços ----------

function paraServico(l: LinhaBarbearia): Servico {
  const incluidos = (l.servicos_incluidos ?? []) as string[];
  return {
    id: l.id as string,
    barbeariaId: l.barbearia_id as string,
    nome: l.nome as string,
    categoria: l.categoria as string,
    preco: Number(l.preco),
    duracaoMin: Number(l.duracao_min),
    foto: (l.foto as string) ?? undefined,
    ativo: Boolean(l.ativo),
    servicosIncluidos: incluidos.length ? incluidos : undefined,
  };
}

export async function getServicos(barbeariaId: string): Promise<Servico[]> {
  const { data, error } = await supabase()
    .from("servicos")
    .select("*")
    .eq("barbearia_id", barbeariaId)
    .order("categoria")
    .order("nome");
  erro(error);
  return (data ?? []).map(paraServico);
}

export async function addServico(input: Omit<Servico, "id">): Promise<void> {
  const { error } = await supabase().from("servicos").insert({
    barbearia_id: input.barbeariaId,
    nome: input.nome,
    categoria: input.categoria,
    preco: input.preco,
    duracao_min: input.duracaoMin,
    foto: input.foto ?? null,
    ativo: input.ativo,
    servicos_incluidos: input.servicosIncluidos ?? [],
  });
  erro(error);
}

export async function updateServico(id: string, patch: Partial<Servico>): Promise<void> {
  const linha: Record<string, unknown> = {};
  if (patch.nome !== undefined) linha.nome = patch.nome;
  if (patch.categoria !== undefined) linha.categoria = patch.categoria;
  if (patch.preco !== undefined) linha.preco = patch.preco;
  if (patch.duracaoMin !== undefined) linha.duracao_min = patch.duracaoMin;
  if (patch.foto !== undefined) linha.foto = patch.foto ?? null;
  if (patch.ativo !== undefined) linha.ativo = patch.ativo;
  if (patch.servicosIncluidos !== undefined) {
    linha.servicos_incluidos = patch.servicosIncluidos ?? [];
  }
  const { error } = await supabase().from("servicos").update(linha).eq("id", id);
  erro(error);
}

export async function removeServico(id: string): Promise<void> {
  erro((await supabase().from("servicos").delete().eq("id", id)).error);
}

// ---------- Produtos ----------

function paraProduto(l: LinhaBarbearia): Produto {
  return {
    id: l.id as string,
    barbeariaId: l.barbearia_id as string,
    nome: l.nome as string,
    categoria: l.categoria as string,
    preco: Number(l.preco),
    estoque: Number(l.estoque),
    foto: (l.foto as string) ?? undefined,
    ativo: Boolean(l.ativo),
  };
}

export async function getProdutos(barbeariaId: string): Promise<Produto[]> {
  const { data, error } = await supabase()
    .from("produtos")
    .select("*")
    .eq("barbearia_id", barbeariaId)
    .order("categoria")
    .order("nome");
  erro(error);
  return (data ?? []).map(paraProduto);
}

export async function addProduto(input: Omit<Produto, "id">): Promise<void> {
  const { error } = await supabase().from("produtos").insert({
    barbearia_id: input.barbeariaId,
    nome: input.nome,
    categoria: input.categoria,
    preco: input.preco,
    estoque: input.estoque,
    foto: input.foto ?? null,
    ativo: input.ativo,
  });
  erro(error);
}

export async function updateProduto(id: string, patch: Partial<Produto>): Promise<void> {
  const linha: Record<string, unknown> = {};
  if (patch.nome !== undefined) linha.nome = patch.nome;
  if (patch.categoria !== undefined) linha.categoria = patch.categoria;
  if (patch.preco !== undefined) linha.preco = patch.preco;
  if (patch.estoque !== undefined) linha.estoque = patch.estoque;
  if (patch.foto !== undefined) linha.foto = patch.foto ?? null;
  if (patch.ativo !== undefined) linha.ativo = patch.ativo;
  const { error } = await supabase().from("produtos").update(linha).eq("id", id);
  erro(error);
}

export async function removeProduto(id: string): Promise<void> {
  erro((await supabase().from("produtos").delete().eq("id", id)).error);
}

// ---------- Barbeiros ----------

function paraBarbeiro(l: LinhaBarbearia): BarbeiroPerfil {
  return {
    id: l.id as string,
    barbeariaId: l.barbearia_id as string,
    usuarioId: (l.usuario_id as string) ?? null,
    nome: l.nome as string,
    email: (l.email as string) ?? "",
    especialidade: (l.especialidade as string) ?? "",
    foto: (l.foto as string) ?? undefined,
    ativo: Boolean(l.ativo),
    comissaoPercentual: Number(l.comissao_percentual ?? 0),
  };
}

export async function getBarbeiros(barbeariaId: string): Promise<BarbeiroPerfil[]> {
  const { data, error } = await supabase()
    .from("barbeiros")
    .select("*")
    .eq("barbearia_id", barbeariaId)
    .order("nome");
  erro(error);
  return (data ?? []).map(paraBarbeiro);
}

/**
 * Versão pública, pra vitrine — só nome, foto e especialidade. E-mail de
 * login e comissão não têm por que sair do painel, então vêm de uma view
 * que já corta essas colunas (ver `barbeiros_publico` no schema); ler a
 * tabela `barbeiros` direto exigiria estar logado como equipe.
 */
export async function getBarbeirosPublico(barbeariaId: string): Promise<BarbeiroPerfil[]> {
  const { data, error } = await supabase()
    .from("barbeiros_publico")
    .select("*")
    .eq("barbearia_id", barbeariaId)
    .order("nome");
  erro(error);
  return (data ?? []).map((l) => ({
    id: l.id as string,
    barbeariaId: l.barbearia_id as string,
    usuarioId: null,
    nome: l.nome as string,
    email: "",
    especialidade: (l.especialidade as string) ?? "",
    foto: (l.foto as string) ?? undefined,
    ativo: Boolean(l.ativo),
    comissaoPercentual: 0,
  }));
}

export async function updateBarbeiro(id: string, patch: Partial<BarbeiroPerfil>): Promise<void> {
  const linha: Record<string, unknown> = {};
  if (patch.nome !== undefined) linha.nome = patch.nome;
  if (patch.email !== undefined) linha.email = patch.email;
  if (patch.especialidade !== undefined) linha.especialidade = patch.especialidade;
  if (patch.foto !== undefined) linha.foto = patch.foto ?? null;
  if (patch.ativo !== undefined) linha.ativo = patch.ativo;
  if (patch.comissaoPercentual !== undefined) {
    linha.comissao_percentual = patch.comissaoPercentual;
  }
  const { error } = await supabase().from("barbeiros").update(linha).eq("id", id);
  erro(error);
}

/**
 * Criar barbeiro com acesso precisa criar um usuário de autenticação, o que
 * só o service role pode fazer — por isso passa por rota de API.
 */
export async function addBarbeiroComAcesso(input: {
  barbeariaId: string;
  nome: string;
  email: string;
  senha: string;
  especialidade: string;
  foto?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const resposta = await fetch("/api/barbeiros", {
    method: "POST",
    headers: await cabecalhosAutenticados(),
    body: JSON.stringify(input),
  });
  const corpo = await resposta.json().catch(() => ({}));
  return resposta.ok ? { ok: true } : { ok: false, error: corpo.erro ?? "Falha ao criar." };
}

export async function removeBarbeiro(id: string): Promise<void> {
  const resposta = await fetch(`/api/barbeiros?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: await cabecalhosAutenticados(),
  });
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => ({}));
    throw new Error(corpo.erro ?? "Falha ao remover.");
  }
}

// ---------- Agendamentos ----------

function paraAgendamento(l: LinhaBarbearia): Agendamento {
  const pedido = l.pedidos as
    | { cliente_nome?: string; cliente_telefone?: string; cliente_email?: string; metodo_pagamento?: string; forma_pagamento?: string }
    | null
    | undefined;

  return {
    id: l.id as string,
    barbeariaId: l.barbearia_id as string,
    barbeiroId: l.barbeiro_id as string,
    clienteNome: pedido?.cliente_nome ?? (l.cliente_nome as string) ?? "Cliente",
    clienteTelefone: pedido?.cliente_telefone ?? undefined,
    clienteEmail: pedido?.cliente_email ?? undefined,
    servicoNome: l.servico_nome as string,
    preco: Number(l.preco),
    data: l.data as string,
    hora: (l.hora as string).slice(0, 5),
    duracaoMin: Number(l.duracao_min),
    status: l.status as Agendamento["status"],
    formaPagamento: (pedido?.forma_pagamento as Agendamento["formaPagamento"]) ?? "local",
    metodoPagamento: (pedido?.metodo_pagamento as Agendamento["metodoPagamento"]) ?? undefined,
    pedidoId: (l.pedido_id as string) ?? undefined,
  };
}

const SELECT_AGENDAMENTO =
  "*, pedidos(cliente_nome, cliente_telefone, cliente_email, forma_pagamento, metodo_pagamento)";

export async function getAgendamentos(barbeariaId: string): Promise<Agendamento[]> {
  const { data, error } = await supabase()
    .from("agendamentos")
    .select(SELECT_AGENDAMENTO)
    .eq("barbearia_id", barbeariaId)
    .order("data")
    .order("hora");
  erro(error);
  return (data ?? []).map(paraAgendamento);
}

export async function getAgendamentosPorBarbeiro(barbeiroId: string): Promise<Agendamento[]> {
  const { data, error } = await supabase()
    .from("agendamentos")
    .select(SELECT_AGENDAMENTO)
    .eq("barbeiro_id", barbeiroId)
    .order("data")
    .order("hora");
  erro(error);
  return (data ?? []).map(paraAgendamento);
}

/**
 * Confirma um agendamento "pendente" (pagamento no local ou Pix direto).
 * Passa por uma função do banco, não por um update direto: é ela quem já
 * baixa o estoque dos produtos comprados junto no carrinho, na primeira
 * vez que o pedido é confirmado — ver `confirmar_agendamento()` no schema.
 */
export async function confirmarAgendamento(id: string): Promise<void> {
  erro((await supabase().rpc("confirmar_agendamento", { p_id: id })).error);
}

export async function cancelarAgendamento(id: string): Promise<void> {
  erro((await supabase().from("agendamentos").update({ status: "cancelado" }).eq("id", id)).error);
}

/** Marca como concluído e dá baixa nos produtos levados na hora. */
export async function concluirAgendamento(
  id: string,
  barbeariaId: string,
  produtosVendidos: { produtoId: string; quantidade: number }[] = [],
  clienteNome = "",
): Promise<void> {
  for (const item of produtosVendidos) {
    await registrarMovimentoEstoque({
      barbeariaId,
      produtoId: item.produtoId,
      tipo: "saida",
      quantidade: item.quantidade,
      motivo: `Venda — ${clienteNome}`.trim(),
    });
  }
  erro((await supabase().from("agendamentos").update({ status: "concluido" }).eq("id", id)).error);
}

/**
 * Horários já tomados por barbeiro num dia. Vem por função do banco pra a
 * página pública saber o que está ocupado sem enxergar quem marcou.
 */
export async function getHorariosOcupados(
  barbeariaId: string,
  data: string,
): Promise<Record<string, string[]>> {
  const { data: linhas, error } = await supabase().rpc("horarios_ocupados", {
    p_barbearia: barbeariaId,
    p_data: data,
  });
  erro(error);

  const porBarbeiro: Record<string, string[]> = {};
  for (const l of (linhas ?? []) as { barbeiro_id: string; hora: string; duracao_min: number }[]) {
    const inicio = l.hora.slice(0, 5);
    const blocos = slotsDe(l.duracao_min ?? SLOT_MIN);
    const lista = (porBarbeiro[l.barbeiro_id] ??= []);
    for (let i = 0; i < blocos; i++) lista.push(addMinutes(inicio, i * SLOT_MIN));
  }
  return porBarbeiro;
}

/** Agendamento pago no local — não passa pelo Mercado Pago. */
/**
 * Cabeçalho pro checkout. Manda o token quando existe sessão, pra o pedido
 * entrar no histórico de quem está logado — mas segue sem ele numa boa,
 * porque agendar sem conta é o caminho normal.
 */
export async function cabecalhosOpcionais(): Promise<HeadersInit> {
  try {
    const { data } = await supabase().auth.getSession();
    const token = data.session?.access_token;
    return token
      ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
      : { "Content-Type": "application/json" };
  } catch {
    return { "Content-Type": "application/json" };
  }
}

export async function criarPedidoLocal(input: {
  barbeariaId: string;
  barbeiroId: string;
  cliente: { nome: string; telefone: string; email: string };
  data: string;
  servicos: { servicoId: string; hora: string }[];
  produtos: { produtoId: string; quantidade: number }[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const resposta = await fetch("/api/pagamentos/local", {
    method: "POST",
    headers: await cabecalhosOpcionais(),
    body: JSON.stringify(input),
  });
  const corpo = await resposta.json().catch(() => ({}));
  return resposta.ok ? { ok: true } : { ok: false, error: corpo.erro ?? "Falha ao agendar." };
}

/** Último nome/e-mail usados por esse telefone nessa barbearia. */
export async function buscarClientePorTelefone(
  barbeariaId: string,
  telefone: string,
): Promise<{ nome: string; email?: string } | null> {
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length < 10) return null;

  const resposta = await fetch(
    `/api/clientes?barbearia=${encodeURIComponent(barbeariaId)}&telefone=${encodeURIComponent(digitos)}`,
  );
  if (!resposta.ok) return null;
  const corpo = await resposta.json().catch(() => null);
  return corpo?.cliente ?? null;
}

// ---------- Estoque ----------

export async function getMovimentosEstoque(barbeariaId: string): Promise<MovimentoEstoque[]> {
  const { data, error } = await supabase()
    .from("movimentos_estoque")
    .select("*")
    .eq("barbearia_id", barbeariaId)
    .order("data", { ascending: false })
    .limit(200);
  erro(error);

  return (data ?? []).map((l) => ({
    id: l.id as string,
    barbeariaId: l.barbearia_id as string,
    produtoId: l.produto_id as string,
    produtoNome: l.produto_nome as string,
    tipo: l.tipo as MovimentoEstoque["tipo"],
    quantidade: Number(l.quantidade),
    motivo: (l.motivo as string) ?? "",
    data: l.data as string,
  }));
}

export async function registrarMovimentoEstoque(input: {
  barbeariaId: string;
  produtoId: string;
  tipo: MovimentoEstoque["tipo"];
  quantidade: number;
  motivo: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase().rpc("movimentar_estoque", {
    p_barbearia: input.barbeariaId,
    p_produto: input.produtoId,
    p_tipo: input.tipo,
    p_quantidade: input.quantidade,
    p_motivo: input.motivo,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}
