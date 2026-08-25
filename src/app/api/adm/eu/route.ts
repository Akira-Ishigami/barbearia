import { NextResponse, type NextRequest } from "next/server";
import { autenticarPlataforma } from "@/lib/plataforma";
import { supabaseConfigurado } from "@/lib/supabase";

/**
 * "Eu tenho acesso à plataforma?" — a tela pergunta isso antes de desenhar
 * qualquer coisa.
 *
 * Devolve 200 com `dentro: false` em vez de 401 porque não ter acesso é a
 * resposta normal pra quase todo mundo logado (dono, barbeiro, cliente);
 * não é erro.
 */
export async function GET(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ dentro: false, motivo: "banco" });
  }

  const quem = await autenticarPlataforma(request);
  if (!quem) return NextResponse.json({ dentro: false });

  return NextResponse.json({
    dentro: true,
    nivel: quem.nivel,
    nome: quem.nome,
    email: quem.email,
  });
}
