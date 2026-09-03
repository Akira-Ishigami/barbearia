import { NextResponse, type NextRequest } from "next/server";
import { appUrl, criarPreferencia, mpAssinaturaConfigurada } from "@/lib/mercadopago";
import { autenticar } from "@/lib/auth-api";
import { supabaseAdmin } from "@/lib/supabase";
import { getPlan } from "@/lib/plans";

/**
 * Assinatura do sistema: a BARBEARIA paga a NAVALHA.
 * Usa a conta do Mercado Pago da própria Navalha (MP_ACCESS_TOKEN).
 *
 * Exige login: quem paga é o dono, pela própria barbearia. O
 * external_reference leva o id da barbearia pra o webhook liberar a conta
 * certa quando o pagamento cair.
 */
export async function POST(request: NextRequest) {
  if (!mpAssinaturaConfigurada()) {
    return NextResponse.json(
      {
        erro: "Pagamento da assinatura ainda não configurado.",
        comoResolver: "Cadastre MP_ACCESS_TOKEN nas variáveis de ambiente da Vercel.",
      },
      { status: 503 },
    );
  }

  const quem = await autenticar(request);
  if (!quem) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (quem.role !== "dono") {
    return NextResponse.json({ erro: "Só o dono assina o plano." }, { status: 403 });
  }

  const db = supabaseAdmin();
  const [{ data: barbearia }, { data: usuario }] = await Promise.all([
    db.from("barbearias").select("plano").eq("id", quem.barbeariaId).maybeSingle(),
    db.from("usuarios").select("nome, email").eq("id", quem.usuarioId).maybeSingle(),
  ]);

  // O corpo pode pedir OUTRO plano (é assim que se faz upgrade), mas só um
  // dos planos reais — o preço sempre sai da tabela de planos, nunca do
  // corpo, senão dava pra "pagar" R$ 1 e destravar o Pro.
  let corpo: { plano?: string } = {};
  try {
    corpo = await request.json();
  } catch {
    /* corpo vazio = renovar o plano atual */
  }

  const planoAlvo =
    corpo.plano === "pro" || corpo.plano === "basico" ? corpo.plano : barbearia?.plano;

  const plano = getPlan(planoAlvo);
  const base = appUrl(request);

  try {
    const preferencia = await criarPreferencia({
      accessToken: process.env.MP_ACCESS_TOKEN!,
      items: [
        {
          title: `Navalha — plano ${plano.name} (mensal)`,
          quantity: 1,
          unit_price: plano.valor,
          description: `Assinatura mensal do sistema Navalha, plano ${plano.name}`,
        },
      ],
      // O plano vai junto: é o webhook, com o pagamento aprovado em mãos,
      // que aplica a mudança na barbearia.
      externalReference: `assinatura:${quem.barbeariaId}:${plano.id}`,
      backUrls: {
        success: `${base}/painel?assinatura=ok`,
        pending: `${base}/painel?assinatura=pendente`,
        failure: `${base}/painel?assinatura=falhou`,
      },
      notificationUrl: `${base}/api/mp/webhook`,
      pagador: usuario ? { nome: usuario.nome, email: usuario.email } : undefined,
      parcelasMax: 1,
    });

    return NextResponse.json({ url: preferencia.init_point });
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha ao criar a cobrança." },
      { status: 502 },
    );
  }
}
