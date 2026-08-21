import { NextResponse, type NextRequest } from "next/server";
import { autenticar } from "@/lib/auth-api";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";

/**
 * Cria e remove barbeiro com acesso próprio.
 *
 * Passa por rota de API porque criar/apagar conta de login exige o service
 * role — o navegador não pode fazer isso.
 */

export async function POST(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  const quem = await autenticar(request);
  if (!quem) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (quem.role !== "dono") {
    return NextResponse.json({ erro: "Só o dono pode cadastrar barbeiros." }, { status: 403 });
  }

  let corpo: { nome?: string; email?: string; senha?: string; especialidade?: string; foto?: string };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const nome = (corpo.nome ?? "").trim();
  const email = (corpo.email ?? "").trim().toLowerCase();
  const senha = corpo.senha ?? "";

  if (!nome || !email) {
    return NextResponse.json({ erro: "Informe nome e e-mail." }, { status: 400 });
  }
  if (senha.length < 6) {
    return NextResponse.json({ erro: "A senha precisa ter ao menos 6 caracteres." }, { status: 400 });
  }
  // ~2MB em base64. A foto vem do navegador; sem teto do lado do servidor,
  // uma imagem enorme inflaria a linha no banco.
  if (corpo.foto && corpo.foto.length > 3_000_000) {
    return NextResponse.json({ erro: "A foto é muito grande." }, { status: 413 });
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
      { erro: jaExiste ? "Já existe uma conta com esse e-mail." : (erroAuth?.message ?? "Falha ao criar acesso.") },
      { status: 400 },
    );
  }

  // Se algo abaixo falhar, desfazemos a conta de login pra não deixar
  // um usuário órfão que impede recadastrar o mesmo e-mail.
  try {
    const { data: usuario, error: erroUsuario } = await db
      .from("usuarios")
      .insert({
        barbearia_id: quem.barbeariaId,
        nome,
        email,
        role: "barbeiro",
        auth_user_id: criado.user.id,
      })
      .select("id")
      .single();
    if (erroUsuario || !usuario) throw new Error(erroUsuario?.message ?? "Falha ao criar usuário.");

    const { error: erroBarbeiro } = await db.from("barbeiros").insert({
      barbearia_id: quem.barbeariaId,
      usuario_id: usuario.id,
      nome,
      email,
      especialidade: (corpo.especialidade ?? "").trim(),
      foto: corpo.foto ?? null,
      ativo: true,
    });
    if (erroBarbeiro) throw new Error(erroBarbeiro.message);

    return NextResponse.json({ ok: true });
  } catch (e) {
    await db.auth.admin.deleteUser(criado.user.id).catch(() => {});
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha ao cadastrar barbeiro." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  const quem = await autenticar(request);
  if (!quem) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (quem.role !== "dono") {
    return NextResponse.json({ erro: "Só o dono pode remover barbeiros." }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ erro: "Informe o barbeiro." }, { status: 400 });

  const db = supabaseAdmin();

  const { data: barbeiro } = await db
    .from("barbeiros")
    .select("id, usuario_id, barbearia_id")
    .eq("id", id)
    .maybeSingle();

  if (!barbeiro || barbeiro.barbearia_id !== quem.barbeariaId) {
    return NextResponse.json({ erro: "Barbeiro não encontrado." }, { status: 404 });
  }

  if (barbeiro.usuario_id) {
    const { data: usuario } = await db
      .from("usuarios")
      .select("auth_user_id")
      .eq("id", barbeiro.usuario_id)
      .maybeSingle();

    // O dono não pode se auto-excluir junto com o próprio acesso.
    if (usuario?.auth_user_id && usuario.auth_user_id !== quem.authUserId) {
      await db.auth.admin.deleteUser(usuario.auth_user_id).catch(() => {});
    }
    await db.from("usuarios").delete().eq("id", barbeiro.usuario_id);
  }

  await db.from("barbeiros").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
