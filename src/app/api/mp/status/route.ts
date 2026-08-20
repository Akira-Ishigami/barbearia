import { NextResponse, type NextRequest } from "next/server";
import { mpOAuthConfigurado } from "@/lib/mercadopago";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";

/**
 * Diz ao painel se o Mercado Pago já está ligado e se aquela barbearia
 * conectou a conta dela. Devolve só o que é seguro mostrar — nunca o
 * access token.
 */
export async function GET(request: NextRequest) {
  const barbeariaId = request.nextUrl.searchParams.get("barbearia");

  const base = {
    oauthConfigurado: mpOAuthConfigurado(),
    bancoConfigurado: supabaseConfigurado(),
  };

  if (!barbeariaId || !base.oauthConfigurado || !base.bancoConfigurado) {
    return NextResponse.json({ ...base, conectada: false });
  }

  try {
    const { data } = await supabaseAdmin()
      .from("mp_contas")
      .select("mp_user_id, apelido, ambiente, aceita_pix, aceita_cartao, parcelas_max, conectado_em")
      .eq("barbearia_id", barbeariaId)
      .maybeSingle();

    return NextResponse.json({ ...base, conectada: Boolean(data), conta: data ?? null });
  } catch {
    return NextResponse.json({ ...base, conectada: false });
  }
}
