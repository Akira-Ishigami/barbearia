import { NextResponse, type NextRequest } from "next/server";
import { autenticarAdmin } from "@/lib/plataforma";
import { buscarSaldo, renovarToken } from "@/lib/mercadopago";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";

/**
 * Saldo real da conta do Mercado Pago da Navalha — não da barbearia.
 *
 * Só admin: é dinheiro, mesma régua de marcar_paga/mudar_plano.
 *
 * Prefere o token de OAuth (conectado por login de verdade em
 * plataforma_mp_conta) sobre o MP_ACCESS_TOKEN fixo do ambiente. Na
 * prática os dois devolvem 403 nessa conta — confirmado com saldo e
 * extrato reais visíveis no próprio app do Mercado Pago, então não é a
 * conta que está incompleta: é esse endpoint específico que a Mercado
 * Pago não libera pra aplicativo de terceiro, seja qual for o token.
 * Mantém a preferência por OAuth porque é o token "certo" pro caso de um
 * dia a Mercado Pago liberar. Cai pro token fixo se a conta nunca foi
 * conectada.
 */
export async function GET(request: NextRequest) {
  const quem = await autenticarAdmin(request);
  if (!quem) return NextResponse.json({ erro: "Sem acesso." }, { status: 403 });

  const { token, apelido, conectadoViaOAuth } = await tokenDaCarteira();
  if (!token) {
    return NextResponse.json(
      {
        erro: "Nenhuma conta do Mercado Pago disponível pra consultar.",
        motivo: "nao_conectado",
        conectadoViaOAuth: false,
      },
      { status: 200 },
    );
  }

  const r = await buscarSaldo(token);
  if (!r.ok) {
    return NextResponse.json(
      {
        erro:
          r.motivo === "sem_permissao"
            ? "O Mercado Pago tem saldo e extrato normalmente, mas recusa esse endpoint pra aplicativos de terceiro nessa conta — não é problema de cadastro. Pra ver o valor real, entra direto no Mercado Pago."
            : "Não foi possível consultar o saldo agora.",
        motivo: r.motivo,
        conectadoViaOAuth,
        apelido,
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, saldo: r.saldo, conectadoViaOAuth, apelido });
}

/** Token de OAuth se a conta foi conectada por login; senão o fixo do ambiente. */
async function tokenDaCarteira(): Promise<{
  token: string | null;
  apelido?: string;
  conectadoViaOAuth: boolean;
}> {
  if (!supabaseConfigurado()) {
    return { token: process.env.MP_ACCESS_TOKEN ?? null, conectadoViaOAuth: false };
  }

  const db = supabaseAdmin();
  const { data: conta } = await db
    .from("plataforma_mp_conta")
    .select("access_token, refresh_token, expira_em, apelido")
    .eq("id", "navalha")
    .maybeSingle();

  if (!conta) {
    return { token: process.env.MP_ACCESS_TOKEN ?? null, conectadoViaOAuth: false };
  }

  let accessToken: string = conta.access_token;
  const vencendo = new Date(conta.expira_em).getTime() - Date.now() < 24 * 60 * 60 * 1000;
  if (vencendo) {
    try {
      const novos = await renovarToken(conta.refresh_token);
      accessToken = novos.access_token;
      await db
        .from("plataforma_mp_conta")
        .update({
          access_token: novos.access_token,
          refresh_token: novos.refresh_token,
          expira_em: new Date(Date.now() + novos.expires_in * 1000).toISOString(),
        })
        .eq("id", "navalha");
    } catch {
      /* segue com o token atual — pode já estar vencido, mas é o que há */
    }
  }

  return { token: accessToken, apelido: conta.apelido, conectadoViaOAuth: true };
}
