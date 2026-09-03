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
 * pedir), pra nunca dar acesso à conta de um cliente de verdade — o
 * pedido foi explícito nesse sentido.
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

async function garantirUsuarioDemo(
  db: Db,
  barbeariaId: string,
  papel: "dono" | "barbeiro",
): Promise<string> {
  const { data: existente } = await db
    .from("usuarios")
    .select("id")
    .eq("barbearia_id", barbeariaId)
    .eq("role", papel)
    .maybeSingle();
  if (existente) return existente.id as string;

  // auth_user_id fica nulo de propósito: esse usuário nunca loga por
  // e-mail/senha, só entra pelo token de impersonação.
  const { data: novo, error } = await db
    .from("usuarios")
    .insert({
      barbearia_id: barbeariaId,
      nome: papel === "dono" ? "Dono (demo)" : "Barbeiro (demo)",
      email: `demo-${papel}@navalha.local`,
      role: papel,
    })
    .select("id")
    .single();

  if (error || !novo) throw new Error(error?.message ?? "Falha ao criar o usuário demo.");
  return novo.id as string;
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
    const usuarioId = await garantirUsuarioDemo(db, barbeariaId, papel);

    await registrarAcao(quem, "ver_como_demo", barbeariaId, `entrou como ${papel} (demo)`);

    const token = gerarTokenImpersonacao(usuarioId);
    const destino = papel === "dono" ? "/painel" : "/barbeiro";
    return NextResponse.json({ url: `${destino}?impersonar=${encodeURIComponent(token)}` });
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Não foi possível preparar a conta demo." },
      { status: 500 },
    );
  }
}
