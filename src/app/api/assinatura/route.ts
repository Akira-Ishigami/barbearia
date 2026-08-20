import { NextResponse, type NextRequest } from "next/server";
import { appUrl, criarPreferencia, mpAssinaturaConfigurada } from "@/lib/mercadopago";
import { getPlan } from "@/lib/plans";

/**
 * Assinatura do sistema: a BARBEARIA paga a NAVALHA.
 * Aqui usamos a conta do Mercado Pago da própria Navalha (MP_ACCESS_TOKEN),
 * diferente do agendamento, que usa a conta de cada barbearia.
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

  let corpo: { plano?: string; email?: string; nome?: string };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const plano = getPlan(corpo.plano);
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
      externalReference: `assinatura:${plano.id}:${corpo.email ?? "sem-email"}`,
      backUrls: {
        success: `${base}/cadastro?assinatura=ok&plano=${plano.id}`,
        pending: `${base}/cadastro?assinatura=pendente&plano=${plano.id}`,
        failure: `${base}/cadastro?assinatura=falhou&plano=${plano.id}`,
      },
      notificationUrl: `${base}/api/mp/webhook`,
      pagador: { name: corpo.nome, email: corpo.email },
      parcelasMax: 1,
    });

    return NextResponse.json({ url: preferencia.init_point, preferenciaId: preferencia.id });
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha ao criar a cobrança." },
      { status: 502 },
    );
  }
}
