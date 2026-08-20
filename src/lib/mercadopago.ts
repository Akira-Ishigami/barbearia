/**
 * Cliente do Mercado Pago — só roda no servidor (rotas de API).
 *
 * São duas contas diferentes em jogo:
 *  • a da NAVALHA  (MP_ACCESS_TOKEN) — recebe a assinatura mensal das barbearias
 *  • a de cada BARBEARIA (via OAuth) — recebe o pagamento dos clientes dela
 */

const MP_API = "https://api.mercadopago.com";

/**
 * Endereço público da aplicação.
 *
 * Preferimos deduzir do próprio pedido: assim funciona em produção, em
 * preview e no localhost sem ninguém precisar acertar variável de ambiente
 * — que foi exatamente o que quebrou a conexão com o Mercado Pago antes
 * (o redirect_uri ia como http://localhost:3000 em produção).
 */
export function appUrl(request?: { nextUrl: URL; headers: Headers }): string {
  if (request) {
    // Atrás do proxy da Vercel, o host real vem nestes cabeçalhos.
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
    if (host) return `${proto}://${host}`;
    return request.nextUrl.origin;
  }

  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new Error("Falta NEXT_PUBLIC_APP_URL.");
  return url.replace(/\/$/, "");
}

export function mpOAuthConfigurado(): boolean {
  return Boolean(process.env.MP_CLIENT_ID && process.env.MP_CLIENT_SECRET);
}

export function mpAssinaturaConfigurada(): boolean {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}

/**
 * Precisa bater EXATAMENTE com o que está cadastrado no painel do Mercado
 * Pago, tanto ao mandar o dono autorizar quanto ao trocar o code por token.
 *
 * Ignoramos MP_REDIRECT_URI quando temos o pedido em mãos: é fonte comum de
 * erro (fica apontando pro localhost) e o host real é mais confiável.
 */
function redirectUri(origem?: string): string {
  if (origem) return `${origem}/api/mp/callback`;
  return process.env.MP_REDIRECT_URI || `${appUrl()}/api/mp/callback`;
}

/** URL pra onde mandamos o dono autorizar a barbearia dele. */
export function urlAutorizacao(state: string, origem?: string): string {
  const clientId = process.env.MP_CLIENT_ID;
  if (!clientId) throw new Error("Falta MP_CLIENT_ID.");

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    platform_id: "mp",
    state,
    redirect_uri: redirectUri(origem),
  });
  return `https://auth.mercadopago.com.br/authorization?${params}`;
}

export interface TokensMP {
  access_token: string;
  refresh_token: string;
  user_id: number;
  public_key: string;
  expires_in: number;
}

async function chamarOAuth(body: Record<string, string>): Promise<TokensMP> {
  const resposta = await fetch(`${MP_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      ...body,
    }),
  });

  const dados = await resposta.json();
  if (!resposta.ok) {
    throw new Error(dados?.message || dados?.error || "Falha ao falar com o Mercado Pago.");
  }
  return dados as TokensMP;
}

/** Troca o `code` do OAuth pelos tokens da barbearia. */
export function trocarCodePorToken(code: string, origem?: string) {
  return chamarOAuth({
    grant_type: "authorization_code",
    code,
    // Tem que ser o mesmo redirect_uri usado na autorização, senão o
    // Mercado Pago recusa a troca.
    redirect_uri: redirectUri(origem),
  });
}

/** Os tokens do MP expiram (~180 dias); isso renova antes de usar. */
export function renovarToken(refreshToken: string) {
  return chamarOAuth({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export interface ItemPreferencia {
  title: string;
  quantity: number;
  unit_price: number;
}

export interface CriarPreferenciaInput {
  accessToken: string;
  items: ItemPreferencia[];
  externalReference: string;
  backUrls: { success: string; pending: string; failure: string };
  notificationUrl: string;
  pagador?: { name?: string; email?: string };
  /** Comissão retida pela Navalha (só no fluxo marketplace). */
  marketplaceFee?: number;
  parcelasMax?: number;
  aceitaPix?: boolean;
  aceitaCartao?: boolean;
}

export interface Preferencia {
  id: string;
  init_point: string;
  sandbox_init_point: string;
}

/** Cria a preferência do Checkout Pro e devolve o link pra onde mandar o cliente. */
export async function criarPreferencia(input: CriarPreferenciaInput): Promise<Preferencia> {
  // O MP não tem um "só pix"; o jeito de restringir é excluir os outros meios.
  const excluir: { id: string }[] = [];
  if (input.aceitaPix === false) excluir.push({ id: "pix" });
  if (input.aceitaCartao === false) {
    excluir.push({ id: "credit_card" }, { id: "debit_card" });
  }

  const corpo: Record<string, unknown> = {
    items: input.items.map((i) => ({ ...i, currency_id: "BRL" })),
    external_reference: input.externalReference,
    back_urls: input.backUrls,
    auto_return: "approved",
    notification_url: input.notificationUrl,
    statement_descriptor: "NAVALHA",
    payment_methods: {
      excluded_payment_types: excluir,
      installments: input.parcelasMax ?? 1,
    },
  };

  if (input.pagador?.email) {
    corpo.payer = { name: input.pagador.name, email: input.pagador.email };
  }
  if (input.marketplaceFee && input.marketplaceFee > 0) {
    corpo.marketplace_fee = Number(input.marketplaceFee.toFixed(2));
  }

  const resposta = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.accessToken}`,
    },
    body: JSON.stringify(corpo),
  });

  const dados = await resposta.json();
  if (!resposta.ok) {
    throw new Error(dados?.message || "Não foi possível criar o pagamento no Mercado Pago.");
  }
  return dados as Preferencia;
}

export interface PagamentoMP {
  id: number;
  status: string;
  status_detail: string;
  external_reference: string | null;
  payment_type_id: string;
  transaction_amount: number;
}

/** Consulta um pagamento — usado pelo webhook pra confirmar de verdade. */
export async function buscarPagamento(
  paymentId: string,
  accessToken: string,
): Promise<PagamentoMP> {
  const resposta = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const dados = await resposta.json();
  if (!resposta.ok) {
    throw new Error(dados?.message || "Pagamento não encontrado no Mercado Pago.");
  }
  return dados as PagamentoMP;
}

/** "credit_card" → "cartao", "bank_transfer"/"pix" → "pix" */
export function metodoDoTipo(paymentTypeId: string): "pix" | "cartao" {
  return paymentTypeId === "credit_card" || paymentTypeId === "debit_card" ? "cartao" : "pix";
}
