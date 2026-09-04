import { NextResponse, type NextRequest } from "next/server";
import { autenticar } from "@/lib/auth-api";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";

/**
 * O chat de suporte, do lado da barbearia — dono ou barbeiro, tanto faz:
 * é uma conversa só por barbearia, não por pessoa, porque quem responde
 * do outro lado está resolvendo o problema da loja, não de um funcionário.
 */

// ~2MB em base64, mesmo teto usado pra foto de barbeiro.
const FOTO_MAX = 3_000_000;

export async function GET(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  const quem = await autenticar(request);
  if (!quem) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const db = supabaseAdmin();

  // A conversa nasce na primeira mensagem, não antes — abrir a tela não
  // cria linha nenhuma.
  const { data: conversa } = await db
    .from("suporte_conversas")
    .select("id, atendido_por, atendido_desde")
    .eq("barbearia_id", quem.barbeariaId)
    .maybeSingle();

  if (!conversa) {
    return NextResponse.json({ existe: false, mensagens: [] });
  }

  const { data: mensagens } = await db
    .from("suporte_mensagens")
    .select("id, de, autor_nome, texto, foto, criado_em")
    .eq("conversa_id", conversa.id)
    .order("criado_em", { ascending: true })
    .limit(300);

  return NextResponse.json({
    existe: true,
    // A barbearia só precisa saber que tem alguém cuidando, não quem —
    // e-mail da equipe de suporte não é da conta dela.
    atendida: Boolean(conversa.atendido_por),
    mensagens: mensagens ?? [],
  });
}

export async function POST(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  const quem = await autenticar(request);
  if (!quem) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  let corpo: { texto?: string; foto?: string; nome?: string };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const texto = (corpo.texto ?? "").trim();
  const foto = corpo.foto ?? null;
  if (!texto && !foto) {
    return NextResponse.json({ erro: "Mande um texto ou uma foto." }, { status: 400 });
  }
  if (texto.length > 4000) {
    return NextResponse.json({ erro: "Mensagem muito longa." }, { status: 400 });
  }
  if (foto && foto.length > FOTO_MAX) {
    return NextResponse.json({ erro: "A foto é muito grande." }, { status: 413 });
  }

  const db = supabaseAdmin();

  const { data: conversa, error: erroConversa } = await db
    .from("suporte_conversas")
    .upsert(
      { barbearia_id: quem.barbeariaId, ultima_mensagem_em: new Date().toISOString() },
      { onConflict: "barbearia_id" },
    )
    .select("id")
    .single();

  if (erroConversa || !conversa) {
    return NextResponse.json(
      { erro: erroConversa?.message ?? "Falha ao abrir a conversa." },
      { status: 500 },
    );
  }

  const { data: mensagem, error: erroMensagem } = await db
    .from("suporte_mensagens")
    .insert({
      conversa_id: conversa.id,
      de: "barbearia",
      autor_nome: (corpo.nome ?? "").trim(),
      texto: texto || null,
      foto,
    })
    .select("id, de, autor_nome, texto, foto, criado_em")
    .single();

  if (erroMensagem || !mensagem) {
    return NextResponse.json(
      { erro: erroMensagem?.message ?? "Falha ao mandar a mensagem." },
      { status: 500 },
    );
  }

  await db
    .from("suporte_conversas")
    .update({ ultima_mensagem_em: mensagem.criado_em })
    .eq("id", conversa.id);

  return NextResponse.json({ ok: true, mensagem });
}
