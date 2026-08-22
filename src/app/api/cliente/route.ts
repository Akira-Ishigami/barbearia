import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";
import { ipDoPedido, limparExpirados, rateLimit } from "@/lib/rate-limit";

/**
 * Cadastro de cliente (quem agenda).
 *
 * Ter conta é opcional: dá pra agendar só preenchendo nome e telefone no
 * checkout. A conta existe pra guardar o histórico e reconhecer a pessoa
 * nas próximas visitas.
 *
 * Passa por rota de API porque criar login exige o service role.
 */
export async function POST(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  limparExpirados();
  const limite = rateLimit(`cliente:${ipDoPedido(request)}`, 5, 60_000);
  if (!limite.ok) {
    return NextResponse.json(
      { erro: "Muitas tentativas. Tente de novo mais tarde." },
      { status: 429, headers: { "Retry-After": String(limite.esperaS) } },
    );
  }

  let c: { nome?: string; email?: string; telefone?: string; senha?: string };
  try {
    c = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const nome = (c.nome ?? "").trim();
  const email = (c.email ?? "").trim().toLowerCase();
  const telefone = (c.telefone ?? "").trim();
  const senha = c.senha ?? "";

  if (!nome || !email) {
    return NextResponse.json({ erro: "Informe nome e e-mail." }, { status: 400 });
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
    const { data: cliente, error } = await db
      .from("clientes")
      .insert({ auth_user_id: criado.user.id, nome, email, telefone })
      .select("id")
      .single();
    if (error || !cliente) throw new Error(error?.message ?? "Falha ao criar o cadastro.");

    // Liga as compras que a pessoa já fez como visitante, casando pelo
    // telefone — assim o histórico não começa vazio pra quem já era cliente.
    if (telefone) {
      const digitos = telefone.replace(/\D/g, "");
      if (digitos.length >= 10) {
        const { data: anteriores } = await db
          .from("pedidos")
          .select("id, cliente_telefone")
          .is("cliente_id", null);

        const meus = (anteriores ?? [])
          .filter((p) => (p.cliente_telefone ?? "").replace(/\D/g, "") === digitos)
          .map((p) => p.id);

        if (meus.length) {
          await db.from("pedidos").update({ cliente_id: cliente.id }).in("id", meus);
        }
      }
    }

    return NextResponse.json({ ok: true, clienteId: cliente.id });
  } catch (e) {
    // Sem isso o e-mail ficaria preso num login órfão, impedindo recadastro.
    await db.auth.admin.deleteUser(criado.user.id).catch(() => {});
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha no cadastro." },
      { status: 500 },
    );
  }
}
