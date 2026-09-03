import type { NextRequest } from "next/server";
import { supabaseAdmin } from "./supabase";
import { conferirTokenImpersonacao } from "./impersonar";

export interface Autenticado {
  authUserId: string;
  usuarioId: string;
  barbeariaId: string;
  role: "dono" | "barbeiro";
}

/**
 * Identifica quem está chamando a rota a partir do token do Supabase Auth
 * enviado no header Authorization — ou, se for um token de "Ver como"
 * emitido por `/api/adm/ver-como`, identifica o usuário impersonado.
 *
 * Nunca confie num barbeariaId que veio no corpo do pedido: quem manda é o
 * vínculo gravado na tabela `usuarios`.
 */
export async function autenticar(request: NextRequest): Promise<Autenticado | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;

  const db = supabaseAdmin();

  const usuarioImpersonadoId = conferirTokenImpersonacao(token);
  if (usuarioImpersonadoId) {
    const { data: usuario } = await db
      .from("usuarios")
      .select("id, barbearia_id, role, auth_user_id")
      .eq("id", usuarioImpersonadoId)
      .maybeSingle();
    if (!usuario) return null;

    return {
      authUserId: usuario.auth_user_id as string,
      usuarioId: usuario.id as string,
      barbeariaId: usuario.barbearia_id as string,
      role: usuario.role as "dono" | "barbeiro",
    };
  }

  const { data: auth, error } = await db.auth.getUser(token);
  if (error || !auth.user) return null;

  const { data: usuario } = await db
    .from("usuarios")
    .select("id, barbearia_id, role")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();

  if (!usuario) return null;

  return {
    authUserId: auth.user.id,
    usuarioId: usuario.id as string,
    barbeariaId: usuario.barbearia_id as string,
    role: usuario.role as "dono" | "barbeiro",
  };
}
