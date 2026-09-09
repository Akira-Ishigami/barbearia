import { NextResponse, type NextRequest } from "next/server";
import { autenticarAdmin, registrarAcao } from "@/lib/plataforma";
import { gerarTokenImpersonacao } from "@/lib/impersonar";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";

/**
 * "Ver como" — deixa o admin abrir o /painel e o /barbeiro sem senha, pra
 * ver a tela de verdade funcionando.
 *
 * De propósito NÃO dá pra escolher uma barbearia real: sempre usa uma
 * única barbearia demo, fixa (criada aqui na primeira vez que alguém
 * pedir, achada depois disso), pra nunca dar acesso à conta de um
 * cliente de verdade — o pedido foi explícito nesse sentido.
 *
 * A demo vem populada (serviço, produto, um barbeiro, agenda) pra
 * mostrar a tela de verdade — vazia ela pareceria quebrada, não "como
 * está ficando". Garante os dois papéis (dono e barbeiro) de uma vez,
 * não só o que foi pedido: assim a agenda do dono não fica vazia se
 * ninguém clicou "ver como barbeiro" antes.
 */

const SLUG_DEMO = "navalha-demo";

type Db = ReturnType<typeof supabaseAdmin>;

async function garantirBarbeariaDemo(db: Db): Promise<string> {
  const { data: existente } = await db
    .from("barbearias")
    .select("id")
    .eq("slug", SLUG_DEMO)
    .maybeSingle();
  if (existente) return existente.id as string;

  const { data: nova, error } = await db
    .from("barbearias")
    .insert({
      nome: "Barbearia demo",
      slug: SLUG_DEMO,
      plano: "pro",
      assinatura_status: "ativa",
      assinatura_ate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();

  if (error || !nova) throw new Error(error?.message ?? "Falha ao criar a barbearia demo.");
  return nova.id as string;
}

async function garantirCatalogoDemo(db: Db, barbeariaId: string): Promise<void> {
  const { count } = await db
    .from("servicos")
    .select("id", { count: "exact", head: true })
    .eq("barbearia_id", barbeariaId);
  if (count) return;

  await db.from("servicos").insert([
    { barbearia_id: barbeariaId, nome: "Corte", categoria: "Cabelo", preco: 45, duracao_min: 30 },
    { barbearia_id: barbeariaId, nome: "Barba", categoria: "Barba", preco: 35, duracao_min: 20 },
    {
      barbearia_id: barbeariaId,
      nome: "Corte + Barba",
      categoria: "Combo",
      preco: 70,
      duracao_min: 50,
    },
  ]);

  await db.from("produtos").insert([
    { barbearia_id: barbeariaId, nome: "Pomada modeladora", categoria: "Cabelo", preco: 39.9, estoque: 12 },
    { barbearia_id: barbeariaId, nome: "Óleo pra barba", categoria: "Barba", preco: 29.9, estoque: 8 },
  ]);
}

interface UsuarioDemo {
  usuarioId: string;
  authUserId: string;
  email: string;
}

/**
 * Precisa de um `auth_user_id` de verdade — não só a linha em `usuarios` —
 * porque boa parte do app lê o Supabase direto do navegador (agenda,
 * barbeiros, estoque...), protegido por RLS, que exige `auth.uid()` real.
 * Sem isso essas telas ficam vazias mesmo com o token de impersonação
 * funcionando pras rotas de API.
 *
 * Ninguém loga nessa conta por e-mail/senha: a senha é sorteada e
 * descartada a cada "Ver como" (ver `sessaoRealDemo`), então não existe
 * senha fixa pra vazar.
 */
async function garantirUsuarioDemo(
  db: Db,
  barbeariaId: string,
  papel: "dono" | "barbeiro",
): Promise<UsuarioDemo> {
  const email = `demo-${papel}@navalha.local`;

  const { data: existente } = await db
    .from("usuarios")
    .select("id, auth_user_id")
    .eq("barbearia_id", barbeariaId)
    .eq("role", papel)
    .maybeSingle();

  if (existente?.auth_user_id) {
    return { usuarioId: existente.id as string, authUserId: existente.auth_user_id as string, email };
  }

  // Existe a linha em `usuarios` mas não a conta de login (demo criada
  // antes desta função existir) — cria a conta agora e liga as duas.
  const { data: criado, error: erroAuth } = await db.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
  });
  if (erroAuth || !criado.user) {
    throw new Error(erroAuth?.message ?? "Falha ao criar o login demo.");
  }

  if (existente) {
    await db.from("usuarios").update({ auth_user_id: criado.user.id }).eq("id", existente.id);
    return { usuarioId: existente.id as string, authUserId: criado.user.id, email };
  }

  const { data: novo, error } = await db
    .from("usuarios")
    .insert({
      barbearia_id: barbeariaId,
      nome: papel === "dono" ? "Dono (demo)" : "Barbeiro (demo)",
      email,
      role: papel,
      auth_user_id: criado.user.id,
    })
    .select("id")
    .single();

  if (error || !novo) {
    await db.auth.admin.deleteUser(criado.user.id).catch(() => {});
    throw new Error(error?.message ?? "Falha ao criar o usuário demo.");
  }
  return { usuarioId: novo.id as string, authUserId: criado.user.id, email };
}

/**
 * Sessão real do Supabase Auth pro usuário demo, via magic link gerado
 * pelo servidor — nunca envia e-mail nenhum, só devolve o token pra
 * trocar por sessão no navegador (`verifyOtp`, em `impersonar-browser.ts`).
 * Isolada na aba: ver `supabase-browser.ts`.
 */
async function gerarOtpSessaoReal(db: Db, email: string): Promise<string> {
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  const hash = data?.properties?.hashed_token;
  if (error || !hash) throw new Error(error?.message ?? "Falha ao preparar a sessão demo.");
  return hash;
}

/** O perfil público (tabela `barbeiros`) é o que a agenda e a loja usam — sem ele o barbeiro demo não aparece em nenhuma tela. */
async function garantirBarbeiroDemo(
  db: Db,
  barbeariaId: string,
  usuarioId: string,
): Promise<string> {
  const { data: existente } = await db
    .from("barbeiros")
    .select("id")
    .eq("usuario_id", usuarioId)
    .maybeSingle();
  if (existente) return existente.id as string;

  const { data: novo, error } = await db
    .from("barbeiros")
    .insert({
      barbearia_id: barbeariaId,
      usuario_id: usuarioId,
      nome: "Barbeiro (demo)",
      email: "demo-barbeiro@navalha.local",
      especialidade: "Cortes clássicos",
      ativo: true,
    })
    .select("id")
    .single();

  if (error || !novo) throw new Error(error?.message ?? "Falha ao criar o perfil do barbeiro demo.");
  return novo.id as string;
}

async function garantirAgendaDemo(db: Db, barbeariaId: string, barbeiroId: string): Promise<void> {
  const { count } = await db
    .from("agendamentos")
    .select("id", { count: "exact", head: true })
    .eq("barbeiro_id", barbeiroId);
  if (count) return;

  const dataDe = (diasAFrente: number) =>
    new Date(Date.now() + diasAFrente * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  await db.from("agendamentos").insert([
    {
      barbearia_id: barbeariaId,
      barbeiro_id: barbeiroId,
      servico_nome: "Corte",
      preco: 45,
      duracao_min: 30,
      data: dataDe(1),
      hora: "10:00",
      status: "confirmado",
    },
    {
      barbearia_id: barbeariaId,
      barbeiro_id: barbeiroId,
      servico_nome: "Corte + Barba",
      preco: 70,
      duracao_min: 50,
      data: dataDe(2),
      hora: "14:30",
      status: "pendente",
    },
  ]);
}

export async function GET(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  const quem = await autenticarAdmin(request);
  if (!quem) return NextResponse.json({ erro: "Sem acesso." }, { status: 403 });

  const papel = request.nextUrl.searchParams.get("papel");
  if (papel !== "dono" && papel !== "barbeiro") {
    return NextResponse.json({ erro: "Informe o papel (dono ou barbeiro)." }, { status: 400 });
  }

  const db = supabaseAdmin();
  try {
    const barbeariaId = await garantirBarbeariaDemo(db);
    await garantirCatalogoDemo(db, barbeariaId);

    const donoDemo = await garantirUsuarioDemo(db, barbeariaId, "dono");
    const barbeiroDemo = await garantirUsuarioDemo(db, barbeariaId, "barbeiro");
    const barbeiroId = await garantirBarbeiroDemo(db, barbeariaId, barbeiroDemo.usuarioId);
    await garantirAgendaDemo(db, barbeariaId, barbeiroId);

    const alvo = papel === "dono" ? donoDemo : barbeiroDemo;

    await registrarAcao(quem, "ver_como_demo", barbeariaId, `entrou como ${papel} (demo)`);

    const [token, otp] = await Promise.all([
      Promise.resolve(gerarTokenImpersonacao(alvo.usuarioId)),
      gerarOtpSessaoReal(db, alvo.email),
    ]);
    const destino = papel === "dono" ? "/painel" : "/barbeiro";
    const params = new URLSearchParams({ impersonar: token, otp });
    return NextResponse.json({ url: `${destino}?${params.toString()}` });
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Não foi possível preparar a conta demo." },
      { status: 500 },
    );
  }
}
