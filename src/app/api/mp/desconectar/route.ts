import { NextResponse, type NextRequest } from "next/server";
import { autenticar } from "@/lib/auth-api";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";

/**
 * Remove a conta do Mercado Pago da barbearia.
 *
 * Exige login e usa sempre a barbearia de quem está autenticado — nunca a
 * do query param, senão qualquer um desconectaria o Mercado Pago de
 * qualquer barbearia só sabendo o id dela.
 */
export async function POST(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  const quem = await autenticar(request);
  if (!quem) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (quem.role !== "dono") {
    return NextResponse.json(
      { erro: "Só o dono pode desconectar o Mercado Pago." },
      { status: 403 },
    );
  }

  const { error } = await supabaseAdmin()
    .from("mp_contas")
    .delete()
    .eq("barbearia_id", quem.barbeariaId);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
