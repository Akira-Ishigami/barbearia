import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

/**
 * Id do cliente logado, quando houver.
 *
 * Agendar sem conta continua valendo: sem token, ou com token de alguém que
 * não é cliente (um dono, por exemplo), devolve null e o pedido nasce como
 * compra de visitante.
 */
export async function clienteDoPedido(
  request: NextRequest,
  db: SupabaseClient,
): Promise<string | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;

  try {
    const { data: auth } = await db.auth.getUser(token);
    if (!auth.user) return null;

    const { data } = await db
      .from("clientes")
      .select("id")
      .eq("auth_user_id", auth.user.id)
      .maybeSingle();

    return (data?.id as string) ?? null;
  } catch {
    return null;
  }
}
