import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";
import { gerarSlug } from "@/lib/slug";
import { ipDoPedido, limparExpirados, rateLimit } from "@/lib/rate-limit";

// Cadastro é aberto (não exige login) e caro: cria conta Auth + barbearia +
// usuário + barbeiro. Sem teto, um bot enche o banco e a cota do Supabase.
const MAX_CADASTROS = 5;
const JANELA_MS = 60 * 60 * 1000; // 1 hora

/**
 * Cadastro de uma barbearia nova + a conta do dono.
 *
 * Cria a conta de login (service role), a barbearia, o vínculo em `usuarios`
 * e já deixa o dono como primeiro barbeiro da equipe.
 */
export async function POST(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json(
      { erro: "Banco não configurado. Veja o SETUP.md." },
      { status: 503 },
    );
  }

  limparExpirados();
  const limite = rateLimit(`cadastro:${ipDoPedido(request)}`, MAX_CADASTROS, JANELA_MS);
  if (!limite.ok) {
    return NextResponse.json(
      { erro: "Muitas tentativas. Tente de novo mais tarde." },
      { status: 429, headers: { "Retry-After": String(limite.esperaS) } },
    );
  }

  let c: {
    barbeariaNome?: string;
    telefone?: string;
    endereco?: string;
    diasFuncionamento?: string[];
    horarioAbertura?: string;
    horarioFechamento?: string;
    plano?: string;
    donoNome?: string;
    email?: string;
    senha?: string;
  };
  try {
    c = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const email = (c.email ?? "").trim().toLowerCase();
  const nomeBarbearia = (c.barbeariaNome ?? "").trim();
  const donoNome = (c.donoNome ?? "").trim();
  const senha = c.senha ?? "";

  if (!nomeBarbearia || !donoNome || !email) {
    return NextResponse.json({ erro: "Preencha todos os campos." }, { status: 400 });
  }
  if (senha.length < 6) {
    return NextResponse.json(
      { erro: "A senha precisa ter ao menos 6 caracteres." },
      { status: 400 },
    );
  }

  const db = supabaseAdmin();

  const { data: criado, error: erroAuth } = await db.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });

  if (erroAuth || !criado.user) {
    const jaExiste = (erroAuth?.message ?? "").toLowerCase().includes("already");
    return NextResponse.json(
      {
        erro: jaExiste
          ? "Já existe uma conta com esse e-mail."
          : (erroAuth?.message ?? "Falha ao criar a conta."),
      },
      { status: 400 },
    );
  }

  try {
    const { data: barbearia, error: erroBarbearia } = await db
      .from("barbearias")
      .insert({
        nome: nomeBarbearia,
        slug: await slugDisponivel(db, nomeBarbearia),
        telefone: (c.telefone ?? "").trim(),
        endereco: (c.endereco ?? "").trim(),
        dias_funcionamento: c.diasFuncionamento?.length
          ? c.diasFuncionamento
          : ["seg", "ter", "qua", "qui", "sex"],
        horario_abertura: c.horarioAbertura ?? "09:00",
        horario_fechamento: c.horarioFechamento ?? "20:00",
        plano: c.plano === "pro" ? "pro" : "basico",
      })
      .select("id")
      .single();
    if (erroBarbearia || !barbearia) {
      throw new Error(erroBarbearia?.message ?? "Falha ao criar a barbearia.");
    }

    const { data: usuario, error: erroUsuario } = await db
      .from("usuarios")
      .insert({
        barbearia_id: barbearia.id,
        nome: donoNome,
        email,
        role: "dono",
        auth_user_id: criado.user.id,
      })
      .select("id")
      .single();
    if (erroUsuario || !usuario) {
      throw new Error(erroUsuario?.message ?? "Falha ao criar o usuário.");
    }

    // O dono já entra como barbeiro, senão a barbearia nasce sem ninguém
    // pra receber agendamento.
    await db.from("barbeiros").insert({
      barbearia_id: barbearia.id,
      usuario_id: usuario.id,
      nome: donoNome,
      email,
      especialidade: "Dono da barbearia",
      ativo: true,
    });

    return NextResponse.json({ ok: true, barbeariaId: barbearia.id });
  } catch (e) {
    await db.auth.admin.deleteUser(criado.user.id).catch(() => {});
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha no cadastro." },
      { status: 500 },
    );
  }
}

/**
 * Endereço da página pública a partir do nome, sem repetir um já usado —
 * duas barbearias com o mesmo nome viram "barbearia-do-ze" e
 * "barbearia-do-ze-2".
 */
async function slugDisponivel(
  db: ReturnType<typeof supabaseAdmin>,
  nome: string,
): Promise<string> {
  const base = gerarSlug(nome) || "barbearia";

  for (let i = 0; i < 30; i++) {
    const tentativa = i === 0 ? base : `${base}-${i + 1}`;
    const { data } = await db
      .from("barbearias")
      .select("id")
      .eq("slug", tentativa)
      .maybeSingle();
    if (!data) return tentativa;
  }

  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}
