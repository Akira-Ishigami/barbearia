import { NextResponse, type NextRequest } from "next/server";
import { appUrl, mpOAuthConfigurado, urlAutorizacao } from "@/lib/mercadopago";
import { assinarState } from "@/lib/mp-state";

/** Começa a conexão OAuth: manda o dono pro Mercado Pago autorizar. */
export async function GET(request: NextRequest) {
  const barbeariaId = request.nextUrl.searchParams.get("barbearia");

  if (!barbeariaId) {
    return NextResponse.json({ erro: "Informe a barbearia." }, { status: 400 });
  }

  if (!mpOAuthConfigurado()) {
    return NextResponse.json(
      {
        erro: "Mercado Pago ainda não configurado.",
        comoResolver:
          "Cadastre MP_CLIENT_ID e MP_CLIENT_SECRET nas variáveis de ambiente da Vercel.",
      },
      { status: 503 },
    );
  }

  return NextResponse.redirect(urlAutorizacao(assinarState(barbeariaId), appUrl(request)));
}
