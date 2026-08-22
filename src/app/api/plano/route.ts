import { NextResponse, type NextRequest } from "next/server";
import { autenticar } from "@/lib/auth-api";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";

/**
 * Troca de plano.
 *
 * Subir de plano NÃO passa por aqui: precisa de pagamento aprovado, senão
 * bastava chamar esta rota pra virar Pro de graça. O upgrade é feito em
 * `/api/assinatura`, e quem realmente muda o plano é o webhook do Mercado
 * Pago, depois que o dinheiro entra.
 *
 * Descer de plano é liberado: a barbearia está abrindo mão de recursos, e
 * o valor menor passa a valer no próximo ciclo.
 */
export async function PATCH(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  const quem = await autenticar(request);
  if (!quem) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (quem.role !== "dono") {
    return NextResponse.json({ erro: "Só o dono muda o plano." }, { status: 403 });
  }

  let corpo: { plano?: string };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  if (corpo.plano !== "basico" && corpo.plano !== "pro") {
    return NextResponse.json({ erro: "Plano inválido." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: barbearia } = await db
    .from("barbearias")
    .select("plano")
    .eq("id", quem.barbeariaId)
    .maybeSingle();

  if (!barbearia) {
    return NextResponse.json({ erro: "Barbearia não encontrada." }, { status: 404 });
  }

  if (corpo.plano === barbearia.plano) {
    return NextResponse.json({ ok: true, plano: barbearia.plano });
  }

  // 402 = precisa pagar. O painel usa isso pra mandar a pessoa pro checkout.
  if (corpo.plano === "pro") {
    return NextResponse.json(
      {
        erro: "Mudar pro plano Pro precisa de pagamento.",
        precisaPagar: true,
      },
      { status: 402 },
    );
  }

  const { error } = await db
    .from("barbearias")
    .update({ plano: "basico" })
    .eq("id", quem.barbeariaId);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, plano: "basico" });
}
