import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";

/** Remove a conta do Mercado Pago da barbearia. */
export async function POST(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  const barbeariaId = request.nextUrl.searchParams.get("barbearia");
  if (!barbeariaId) {
    return NextResponse.json({ erro: "Informe a barbearia." }, { status: 400 });
  }

  const { error } = await supabaseAdmin()
    .from("mp_contas")
    .delete()
    .eq("barbearia_id", barbeariaId);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
