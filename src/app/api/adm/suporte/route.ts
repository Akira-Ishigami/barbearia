import { NextResponse, type NextRequest } from "next/server";
import { autenticarPlataforma } from "@/lib/plataforma";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";

/**
 * O chat de suporte, do lado da Navalha.
 *
 * A trava ("um suporte por vez" numa conversa) é um UPDATE condicional —
 * só troca `atendido_por` se estiver livre, já com o e-mail de quem
 * chamou, ou vencido (ver TRAVA_MS). Sem isso dois atendentes escrevendo
 * na mesma conversa ao mesmo tempo se atropelariam sem saber.
 */

const FOTO_MAX = 3_000_000;
// Trava vencida depois disso sem atividade — cobre aba fechada sem
// clicar "sair". Toda mensagem do suporte renova o prazo.
const TRAVA_MS = 20 * 60 * 1000;

export async function GET(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  const quem = await autenticarPlataforma(request);
  if (!quem) return NextResponse.json({ erro: "Sem acesso." }, { status: 403 });

  const db = supabaseAdmin();
  const conversaId = request.nextUrl.searchParams.get("conversa");

  // ---------- Uma conversa: as mensagens ----------
  if (conversaId) {
    const { data: mensagens } = await db
      .from("suporte_mensagens")
      .select("id, de, autor_nome, autor_email, texto, foto, criado_em")
      .eq("conversa_id", conversaId)
      .order("criado_em", { ascending: true })
      .limit(300);

    const { data: conversa } = await db
      .from("suporte_conversas")
      .select("id, barbearia_id, atendido_por, atendido_desde")
      .eq("id", conversaId)
      .maybeSingle();

    return NextResponse.json({ conversa, mensagens: mensagens ?? [] });
  }

  // ---------- Lista: todas as conversas, mais recente primeiro ----------
  const { data: conversas } = await db
    .from("suporte_conversas")
    .select("id, barbearia_id, atendido_por, atendido_desde, ultima_mensagem_em, barbearias(nome)")
    .order("ultima_mensagem_em", { ascending: false })
    .limit(200);

  const ids = (conversas ?? []).map((c) => c.id as string);
  const ultimasPorConversa = new Map<string, { de: string; texto: string | null }>();
  if (ids.length) {
    const { data: ultimas } = await db
      .from("suporte_mensagens")
      .select("conversa_id, de, texto, criado_em")
      .in("conversa_id", ids)
      .order("criado_em", { ascending: false });
    for (const m of ultimas ?? []) {
      const id = m.conversa_id as string;
      if (!ultimasPorConversa.has(id)) {
        ultimasPorConversa.set(id, { de: m.de as string, texto: m.texto as string | null });
      }
    }
  }

  const agora = Date.now();

  return NextResponse.json({
    conversas: (conversas ?? []).map((c) => {
      const travada =
        Boolean(c.atendido_por) &&
        Boolean(c.atendido_desde) &&
        agora - new Date(c.atendido_desde as string).getTime() < TRAVA_MS;
      const ultima = ultimasPorConversa.get(c.id as string);
      const barbearia = c.barbearias as unknown as { nome?: string } | null;
      return {
        id: c.id,
        barbeariaId: c.barbearia_id,
        barbeariaNome: barbearia?.nome ?? "—",
        atendidoPor: travada ? c.atendido_por : null,
        souEu: travada && c.atendido_por === quem.email,
        ultimaMensagemEm: c.ultima_mensagem_em,
        aguardandoResposta: ultima?.de === "barbearia",
        previa: (ultima?.texto ?? "").slice(0, 80),
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  const quem = await autenticarPlataforma(request);
  if (!quem) return NextResponse.json({ erro: "Sem acesso." }, { status: 403 });

  let corpo: { acao?: string; conversaId?: string; texto?: string; foto?: string };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const conversaId = corpo.conversaId;
  if (!conversaId || !corpo.acao) {
    return NextResponse.json({ erro: "Informe a ação e a conversa." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const agora = new Date();
  const travaVencidaAntes = new Date(agora.getTime() - TRAVA_MS).toISOString();

  if (corpo.acao === "entrar") {
    const { data: atual } = await db
      .from("suporte_conversas")
      .select("atendido_por, atendido_desde")
      .eq("id", conversaId)
      .maybeSingle();
    if (!atual) return NextResponse.json({ erro: "Conversa não encontrada." }, { status: 404 });

    // Livre pra entrar se: ninguém tem, é o próprio dono da trava
    // (reabrindo a aba), ou a trava de outro atendente já venceu.
    const livre =
      !atual.atendido_por ||
      atual.atendido_por === quem.email ||
      !atual.atendido_desde ||
      new Date(atual.atendido_desde as string).toISOString() < travaVencidaAntes;

    if (!livre) {
      return NextResponse.json(
        { erro: `Essa conversa já está com ${atual.atendido_por}.` },
        { status: 409 },
      );
    }

    const { error } = await db
      .from("suporte_conversas")
      .update({ atendido_por: quem.email, atendido_desde: agora.toISOString() })
      .eq("id", conversaId);
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (corpo.acao === "sair") {
    await db
      .from("suporte_conversas")
      .update({ atendido_por: null, atendido_desde: null })
      .eq("id", conversaId)
      .eq("atendido_por", quem.email);
    return NextResponse.json({ ok: true });
  }

  if (corpo.acao === "mensagem") {
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

    // Só quem está com a conversa (ou ninguém ainda) manda mensagem —
    // impede escrever por cima de quem já está atendendo.
    const { data: conversa } = await db
      .from("suporte_conversas")
      .select("atendido_por, atendido_desde")
      .eq("id", conversaId)
      .maybeSingle();
    if (!conversa) return NextResponse.json({ erro: "Conversa não encontrada." }, { status: 404 });

    const travada =
      conversa.atendido_por &&
      conversa.atendido_por !== quem.email &&
      conversa.atendido_desde &&
      agora.getTime() - new Date(conversa.atendido_desde as string).getTime() < TRAVA_MS;
    if (travada) {
      return NextResponse.json(
        { erro: `Essa conversa está com ${conversa.atendido_por}. Entre nela primeiro.` },
        { status: 409 },
      );
    }

    const { data: mensagem, error: erroMensagem } = await db
      .from("suporte_mensagens")
      .insert({
        conversa_id: conversaId,
        de: "suporte",
        autor_nome: quem.nome,
        autor_email: quem.email,
        texto: texto || null,
        foto,
      })
      .select("id, de, autor_nome, autor_email, texto, foto, criado_em")
      .single();

    if (erroMensagem || !mensagem) {
      return NextResponse.json(
        { erro: erroMensagem?.message ?? "Falha ao mandar a mensagem." },
        { status: 500 },
      );
    }

    // Manda a mensagem renova a trava — segue "atendendo" enquanto
    // responde, sem precisar clicar em nada.
    await db
      .from("suporte_conversas")
      .update({
        ultima_mensagem_em: mensagem.criado_em,
        atendido_por: quem.email,
        atendido_desde: agora.toISOString(),
      })
      .eq("id", conversaId);

    return NextResponse.json({ ok: true, mensagem });
  }

  return NextResponse.json({ erro: "Ação desconhecida." }, { status: 400 });
}
