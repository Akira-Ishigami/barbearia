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

  // O plano vem da barbearia no banco, não do corpo — senão dava pra pagar o
  // Básico e destravar como Pro.
  const { data: barbearia } = await supabaseAdmin()
    .from("barbearias")
    .select("plano")
    .eq("id", quem.barbeariaId)
    .maybeSingle();

  const plano = getPlan(barbearia?.plano);
  const base = appUrl(request);

  try {
    const preferencia = await criarPreferencia({
      accessToken: process.env.MP_ACCESS_TOKEN!,
      items: [
        {
          title: `Navalha — plano ${plano.name} (mensal)`,
          quantity: 1,
          unit_price: plano.valor,
        },
      ],
      externalReference: `assinatura:${quem.barbeariaId}`,
      backUrls: {
        success: `${base}/painel?assinatura=ok`,
        pending: `${base}/painel?assinatura=pendente`,
        failure: `${base}/painel?assinatura=falhou`,
      },
      notificationUrl: `${base}/api/mp/webhook`,
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
