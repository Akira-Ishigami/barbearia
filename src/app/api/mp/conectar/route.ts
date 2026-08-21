import { NextResponse, type NextRequest } from "next/server";
import { autenticar } from "@/lib/auth-api";
import { appUrl, mpOAuthConfigurado, urlAutorizacao } from "@/lib/mercadopago";
import { assinarState } from "@/lib/mp-state";

/**
 * Começa a conexão OAuth: devolve a URL de autorização do Mercado Pago
 * pro navegador navegar até ela.
 *
 * Não redireciona direto porque isso exigiria aceitar `barbearia` como
 * query param sem checar quem está pedindo — e qualquer um que soubesse o
 * id de uma barbearia (ele aparece na URL pública da loja) conseguiria
 * conectar a PRÓPRIA conta do Mercado Pago no lugar da dela, desviando os
 * pagamentos dos clientes. Por isso exige o token de quem está logado e
 * usa sempre a barbearia do dono autenticado, nunca a do query param.
 */
export async function GET(request: NextRequest) {
  const quem = await autenticar(request);
  if (!quem) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (quem.role !== "dono") {
    return NextResponse.json(
      { erro: "Só o dono pode conectar o Mercado Pago." },
      { status: 403 },
    );
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

  const url = urlAutorizacao(assinarState(quem.barbeariaId), appUrl(request));
  return NextResponse.json({ url });
}
