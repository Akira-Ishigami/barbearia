import { NextResponse, type NextRequest } from "next/server";
import { autenticar } from "@/lib/auth-api";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";

/**
 * Troca o plano da barbearia (Básico ↔ Pro).
 *
 * A cobrança acompanha: quem está no período grátis passa a ser cobrado pelo
 * novo plano quando ele acabar, e quem já assina vê a diferença na próxima
 * mensalidade. Não cobramos nada agora justamente pra não gerar cobrança
 * quebrada no meio do ciclo.
 */
export async function PATCH(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  const quem = await autenticar(request);
  if (!quem) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (quem.role !== "dono") {
    return NextResponse.json({ erro: "Só o dono muda o plano." }, { status: 403 });
  }

  let corpo: { plano?: string };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  if (corpo.plano !== "basico" && corpo.plano !== "pro") {
    return NextResponse.json({ erro: "Plano inválido." }, { status: 400 });
  }

  const { error } = await supabaseAdmin()
    .from("barbearias")
    .update({ plano: corpo.plano })
    .eq("id", quem.barbeariaId);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, plano: corpo.plano });
}
