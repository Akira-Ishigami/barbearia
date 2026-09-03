import { NextResponse, type NextRequest } from "next/server";
import { autenticarAdmin } from "@/lib/plataforma";
import {
  appUrl,
  mpOAuthConfigurado,
  redirectUri,
  redirectUriValida,
  urlAutorizacao,
} from "@/lib/mercadopago";
import { assinarState } from "@/lib/mp-state";

/**
 * Começa a conexão OAuth da conta do Mercado Pago da própria Navalha —
 * não de uma barbearia. Mesma rota de callback de sempre
 * (`/api/mp/callback`); o que diferencia é o `state` valer "plataforma"
 * em vez de um id de barbearia.
 */
export async function GET(request: NextRequest) {
  const quem = await autenticarAdmin(request);
  if (!quem) return NextResponse.json({ erro: "Sem acesso." }, { status: 403 });

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

  const destino = redirectUri(appUrl(request));
  if (!redirectUriValida(destino)) {
    return NextResponse.json(
      {
        erro: "A conexão com o Mercado Pago só funciona no site publicado (https).",
        detalhe: `O endereço de retorno seria "${destino}", que o Mercado Pago recusa.`,
        comoResolver:
          "Rodando local, use o site em produção pra conectar. Em produção, cadastre MP_REDIRECT_URI com a URL https do site.",
      },
      { status: 400 },
    );
  }

  const url = urlAutorizacao(assinarState("plataforma"), appUrl(request));
  return NextResponse.json({ url });
}
