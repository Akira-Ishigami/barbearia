import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";

/**
 * Reconhece o cliente pelo telefone pra já preencher nome e e-mail.
 *
 * Passa por rota de API porque `pedidos` não é legível por quem não está
 * logado — e mesmo aqui só devolvemos nome e e-mail de quem já usou aquele
 * telefone naquela barbearia, com o número exato.
 */
export async function GET(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ cliente: null });
  }

  const params = request.nextUrl.searchParams;
  const barbeariaId = params.get("barbearia");
  const digitos = (params.get("telefone") ?? "").replace(/\D/g, "");

  // Exige o número inteiro: sem isso viraria uma forma de varrer a base
  // testando prefixos.
  if (!barbeariaId || digitos.length < 10) {
    return NextResponse.json({ cliente: null });
  }

  const { data } = await supabaseAdmin()
    .from("pedidos")
    .select("cliente_nome, cliente_email, cliente_telefone")
    .eq("barbearia_id", barbeariaId)
    .order("criado_em", { ascending: false })
    .limit(50);

  const achado = (data ?? []).find(
    (p) => (p.cliente_telefone ?? "").replace(/\D/g, "") === digitos,
  );

  return NextResponse.json({
    cliente: achado
      ? { nome: achado.cliente_nome, email: achado.cliente_email || undefined }
      : null,
  });
}
