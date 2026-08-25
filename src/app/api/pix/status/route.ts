import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";

/**
 * A página pública precisa saber se a barbearia aceita Pix direto pra
 * decidir se mostra o botão. Mas a chave em si não pode sair daqui — quem
 * monta o código Pix é o servidor, na hora de fechar o pedido.
 *
 * Por isso a resposta só diz "aceita" e o nome de quem recebe, que é o
 * mesmo nome que o cliente veria no app do banco de qualquer jeito.
 */
export async function GET(request: NextRequest) {
  const barbeariaId = request.nextUrl.searchParams.get("barbearia");

  if (!barbeariaId || !supabaseConfigurado()) {
    return NextResponse.json({ aceita: false });
  }

  try {
    const { data } = await supabaseAdmin()
      .from("pix_contas")
      .select("beneficiario, ativo")
      .eq("barbearia_id", barbeariaId)
      .maybeSingle();

    return NextResponse.json({
      aceita: Boolean(data?.ativo),
      beneficiario: data?.ativo ? data.beneficiario : undefined,
    });
  } catch {
    return NextResponse.json({ aceita: false });
  }
}
