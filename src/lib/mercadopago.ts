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
 * MP_REDIRECT_URI tem prioridade justamente por ser a que está cadastrada
 * lá. Derivar do host do pedido parecia mais esperto, mas quebrava em
 * desenvolvimento: o host vira `http://localhost:3000` e o Mercado Pago
 * responde 403 Forbidden antes mesmo da tela de login (ver `redirectUriValida`).
 */
export function redirectUri(origem?: string): string {
  const cadastrada = process.env.MP_REDIRECT_URI;
  if (cadastrada) return cadastrada.trim().replace(/\/$/, "");
  if (origem) return `${origem}/api/mp/callback`;
  return `${appUrl()}/api/mp/callback`;
}

/**
 * O Mercado Pago só aceita redirect_uri em HTTPS e recusa localhost.
 * Conferimos antes de mandar a pessoa pra lá — senão ela sai do sistema e
 * cai numa tela de erro genérica do MP, sem saber o que aconteceu.
 */
export function redirectUriValida(uri: string): boolean {
  return uri.startsWith("https://") && !uri.includes("localhost") && !uri.includes("127.0.0.1");
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

export interface UsuarioMP {
  /** Como a conta se identifica — apelido do Mercado Livre, ex. "BARBEARIADOZE". */
  nickname: string;
  email: string;
  nome: string;
  /** false quando a conta ainda é de testes (credencial TEST-). */
  producao: boolean;
}

/**
 * Lê os dados da conta que acabou de autorizar.
 *
 * Serve pra mostrar no painel QUAL conta foi conectada — sem isso o dono
 * que tem mais de uma conta no Mercado Pago não tem como saber se
 * autorizou a certa.
 */
export async function buscarUsuario(accessToken: string): Promise<UsuarioMP | null> {
  try {
    const resposta = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!resposta.ok) return null;

    const d = await resposta.json();
    const nome = [d.first_name, d.last_name].filter(Boolean).join(" ").trim();
    return {
      nickname: d.nickname ?? "",
      email: d.email ?? "",
      nome: nome || d.nickname || "",
      producao: d.site_status === "active",
    };
  } catch {
    // Conta conectada é o que importa; o apelido é enfeite.
    return null;
  }
}

export interface SaldoMP {
  disponivel: number;
  moeda: string;
}

/**
 * Saldo da conta do Mercado Pago da própria Navalha (não da barbearia —
 * essa conta nunca é lida, é o dinheiro de outra empresa).
 *
 * O endpoint é real (confere com o cliente oficial em Python da própria
 * Mercado Livre), mas não está na documentação atual — o caminho
 * "de vitrine" pra dado financeiro hoje é um relatório assíncrono
 * (POST, espera, baixa CSV), pesado demais pra mostrar um número. Esse
 * aqui é o direto. Se a conta tiver alguma pendência de cadastro (endereço
 * incompleto, tipo de conta), o Mercado Pago devolve 403 — por isso o
 * retorno distingue "sem saldo" de "conta não deixa ver".
 */
export async function buscarSaldo(
  accessToken: string,
): Promise<{ ok: true; saldo: SaldoMP } | { ok: false; motivo: "sem_permissao" | "falha" }> {
  const usuario = await buscarUsuario(accessToken).catch(() => null);
  const id = usuario ? await idDoUsuario(accessToken) : null;
  if (!id) return { ok: false, motivo: "falha" };

  try {
    const resposta = await fetch(
      `${MP_API}/users/${id}/mercadopago_account/balance`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (resposta.status === 403) return { ok: false, motivo: "sem_permissao" };
    if (!resposta.ok) return { ok: false, motivo: "falha" };

    const d = await resposta.json();
    const valor = Number(d.available_balance ?? d.amount ?? d.total_amount ?? NaN);
    if (!Number.isFinite(valor)) return { ok: false, motivo: "falha" };

    return { ok: true, saldo: { disponivel: valor, moeda: d.currency_id ?? "BRL" } };
  } catch {
    return { ok: false, motivo: "falha" };
  }
}

/** `/users/me` só devolve o id junto de um monte de outra coisa; isola isso. */
async function idDoUsuario(accessToken: string): Promise<number | null> {
  try {
    const resposta = await fetch(`${MP_API}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!resposta.ok) return null;
    const d = await resposta.json();
    return typeof d.id === "number" ? d.id : null;
  } catch {
    return null;
  }
}

export interface ItemPreferencia {
  title: string;
  quantity: number;
  unit_price: number;
  /**
   * O Mercado Pago pontua a preferência por completude (tela "Aprovação
   * dos pagamentos" na conta), e descrição vazia é um dos itens que tira
   * ponto — deixa o antifraude deles com menos contexto pra aprovar.
   */
  description?: string;
}

export interface CriarPreferenciaInput {
  accessToken: string;
  items: ItemPreferencia[];
  externalReference: string;
  backUrls: { success: string; pending: string; failure: string };
  notificationUrl: string;
  pagador?: { nome?: string; email?: string };
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

  // `auto_return` faz o Mercado Pago devolver o cliente sozinho depois de
  // pagar, mas só é aceito com back_url https — em localhost a criação da
  // preferência falha inteira com "auto_return invalid".
  const podeAutoReturn = redirectUriValida(input.backUrls.success);

  const corpo: Record<string, unknown> = {
    items: input.items.map((i) => ({ ...i, currency_id: "BRL" })),
    external_reference: input.externalReference,
    back_urls: input.backUrls,
    ...(podeAutoReturn ? { auto_return: "approved" } : {}),
    notification_url: input.notificationUrl,
    statement_descriptor: "NAVALHA",
    payment_methods: {
      excluded_payment_types: excluir,
      installments: input.parcelasMax ?? 1,
    },
  };

  if (input.pagador?.email) {
    // O score de aprovação do MP pontua nome e sobrenome separados — um
    // campo "name" só não conta pra "Sobrenome do comprador" na tela
    // deles. Nome completo com espaço é o único formato que já temos
    // (checkout não pede nome/sobrenome à parte), então o corte é aqui.
    const partes = (input.pagador.nome ?? "").trim().split(/\s+/).filter(Boolean);
    corpo.payer = {
      first_name: partes[0] || undefined,
      last_name: partes.length > 1 ? partes.slice(1).join(" ") : undefined,
      email: input.pagador.email,
    };
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
