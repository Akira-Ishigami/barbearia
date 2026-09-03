import { NextResponse, type NextRequest } from "next/server";
import { autenticar } from "@/lib/auth-api";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";

/**
 * Equivalente ao `usuarios` que `useSession` lê direto do Supabase Auth —
 * mas pra quando a aba está em modo "Ver como" (token de impersonação,
 * sem sessão real do Supabase pra consultar). `autenticar()` aceita os
 * dois tipos de token; aqui só devolvemos os dados no formato que a
 * sessão normal já usa.
 */
export async function GET(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  const quem = await autenticar(request);
  if (!quem) return NextResponse.json({ erro: "Sessão inválida ou vencida." }, { status: 401 });

  const db = supabaseAdmin();
  const { data: usuario } = await db
    .from("usuarios")
    .select("id, nome, email, role, barbearia_id, barbearias(nome)")
    .eq("id", quem.usuarioId)
    .maybeSingle();

  if (!usuario) return NextResponse.json({ erro: "Usuário não encontrado." }, { status: 404 });

  const barbearia = usuario.barbearias as unknown as { nome?: string } | null;

  return NextResponse.json({
    userId: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    role: usuario.role,
    barbeariaId: usuario.barbearia_id,
    barbeariaNome: barbearia?.nome ?? "Sua barbearia",
    impersonado: true,
  });
}
