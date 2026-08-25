import { NextResponse, type NextRequest } from "next/server";
import { autenticarAdmin, autenticarPlataforma, registrarAcao } from "@/lib/plataforma";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";

/**
 * Quem tem acesso de plataforma.
 *
 * Ler é liberado pro suporte (é bom ele saber com quem contar); criar,
 * mudar nível e remover é só do admin — do contrário um suporte se
 * promoveria a admin em dois cliques.
 */

/** GET — lista a equipe da plataforma. */
export async function GET(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  const quem = await autenticarPlataforma(request);
  if (!quem) return NextResponse.json({ erro: "Sem acesso." }, { status: 403 });

  const { data } = await supabaseAdmin()
    .from("plataforma_equipe")
    .select("email, nome, nivel, ativo, criado_em, ultimo_acesso")
    .order("criado_em");

  return NextResponse.json({ equipe: data ?? [], nivel: quem.nivel });
}

/** POST — libera acesso pra um e-mail (ou atualiza o nível de quem já tem). */
export async function POST(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  const quem = await autenticarAdmin(request);
  if (!quem) {
    return NextResponse.json({ erro: "Só o administrador mexe na equipe." }, { status: 403 });
  }

  let c: { email?: string; nome?: string; nivel?: string; ativo?: boolean };
  try {
    c = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const email = (c.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ erro: "E-mail inválido." }, { status: 400 });
  }

  const nivel = c.nivel === "admin" ? "admin" : "suporte";

  const { error } = await supabaseAdmin()
    .from("plataforma_equipe")
    .upsert(
      {
        email,
        nome: (c.nome ?? "").trim(),
        nivel,
        ativo: c.ativo ?? true,
      },
      { onConflict: "email" },
    );

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  await registrarAcao(quem, "equipe_salvar", null, `${email} como ${nivel}`);

  return NextResponse.json({
    ok: true,
    // A pessoa ainda precisa de conta no sistema pra o acesso valer.
    aviso:
      "O acesso vale assim que essa pessoa entrar com uma conta usando este mesmo e-mail.",
  });
}

/** DELETE — tira o acesso. */
export async function DELETE(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  const quem = await autenticarAdmin(request);
  if (!quem) {
    return NextResponse.json({ erro: "Só o administrador mexe na equipe." }, { status: 403 });
  }

  const email = (request.nextUrl.searchParams.get("email") ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ erro: "Informe o e-mail." }, { status: 400 });

  if (email === quem.email) {
    // Sem isto dá pra se remover e deixar a plataforma sem nenhum admin.
    return NextResponse.json(
      { erro: "Você não pode remover o próprio acesso." },
      { status: 400 },
    );
  }

  const { error } = await supabaseAdmin().from("plataforma_equipe").delete().eq("email", email);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  await registrarAcao(quem, "equipe_remover", null, email);
  return NextResponse.json({ ok: true });
}
