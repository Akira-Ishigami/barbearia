import { NextResponse, type NextRequest } from "next/server";
import { appUrl, trocarCodePorToken } from "@/lib/mercadopago";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";
import { conferirState } from "@/lib/mp-state";

/**
 * Volta do Mercado Pago depois que o dono autorizou.
 * Troca o `code` pelos tokens da conta dele e guarda no banco.
 *
 * O access token fica só aqui no servidor — nunca vai pro navegador.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const erroMP = params.get("error");

  const voltarPara = (query: string) =>
    NextResponse.redirect(`${appUrl()}/painel/pagamentos?${query}`);

  if (erroMP) {
    return voltarPara(`mp=erro&motivo=${encodeURIComponent(erroMP)}`);
  }
  if (!code || !state) {
    return voltarPara("mp=erro&motivo=resposta-incompleta");
  }

  const barbeariaId = conferirState(state);
  if (!barbeariaId) {
    return voltarPara("mp=erro&motivo=state-invalido");
  }

  if (!supabaseConfigurado()) {
    return voltarPara("mp=erro&motivo=banco-nao-configurado");
  }

  try {
    const tokens = await trocarCodePorToken(code);
    const expiraEm = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const { error } = await supabaseAdmin()
      .from("mp_contas")
      .upsert(
        {
          barbearia_id: barbeariaId,
          mp_user_id: String(tokens.user_id),
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          public_key: tokens.public_key ?? "",
          ambiente: "producao",
          expira_em: expiraEm,
          conectado_em: new Date().toISOString(),
        },
        { onConflict: "barbearia_id" },
      );

    if (error) throw new Error(error.message);

    return voltarPara("mp=conectado");
  } catch (e) {
    const motivo = e instanceof Error ? e.message : "falha-desconhecida";
    return voltarPara(`mp=erro&motivo=${encodeURIComponent(motivo)}`);
  }
}
