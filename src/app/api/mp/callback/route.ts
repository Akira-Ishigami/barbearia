import { NextResponse, type NextRequest } from "next/server";
import { appUrl, buscarUsuario, trocarCodePorToken } from "@/lib/mercadopago";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";
import { conferirState } from "@/lib/mp-state";

/**
 * Volta do Mercado Pago depois que o dono (ou o admin da plataforma)
 * autorizou. Troca o `code` pelos tokens da conta e guarda no banco.
 *
 * O access token fica só aqui no servidor — nunca vai pro navegador.
 *
 * Mesma rota pros dois casos: o Mercado Pago exige que o redirect_uri
 * bata exatamente com o cadastrado no painel deles, então criar uma rota
 * nova só pra conexão da plataforma pediria cadastrar um segundo endereço
 * lá. Em vez disso, o `state` carrega um valor especial ("plataforma") no
 * lugar do id da barbearia, e é isso que decide onde os tokens vão parar.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const erroMP = params.get("error");
  const descricaoMP = params.get("error_description");

  const origem = appUrl(request);
  const alvo = state ? conferirState(state) : null;
  const daPlataforma = alvo === "plataforma";
  const voltarPara = (query: string) =>
    NextResponse.redirect(
      `${origem}/${daPlataforma ? "adm/crescimento" : "painel/pagamentos"}?${query}`,
    );

  if (erroMP) {
    // O MP manda `error_description` com o motivo real (ex.: redirect_uri
    // não cadastrada). Sem repassar, quem conectou só via "erro" e ficava
    // perdido.
    const motivo = descricaoMP || erroMP;
    return voltarPara(`mp=erro&motivo=${encodeURIComponent(motivo)}`);
  }
  if (!code || !state) {
    return voltarPara("mp=erro&motivo=resposta-incompleta");
  }
  if (!alvo) {
    return voltarPara("mp=erro&motivo=state-invalido");
  }

  if (!supabaseConfigurado()) {
    return voltarPara("mp=erro&motivo=banco-nao-configurado");
  }

  try {
    const tokens = await trocarCodePorToken(code, origem);
    const expiraEm = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const usuario = await buscarUsuario(tokens.access_token);
    const db = supabaseAdmin();

    const { error } = daPlataforma
      ? await db.from("plataforma_mp_conta").upsert(
          {
            id: "navalha",
            mp_user_id: String(tokens.user_id),
            apelido: usuario?.nome || usuario?.nickname || "",
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expira_em: expiraEm,
            conectado_em: new Date().toISOString(),
          },
          { onConflict: "id" },
        )
      : await db.from("mp_contas").upsert(
          {
            barbearia_id: alvo,
            mp_user_id: String(tokens.user_id),
            apelido: usuario?.nome || usuario?.nickname || "",
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
