import { NextResponse, type NextRequest } from "next/server";
import { autenticarAdmin } from "@/lib/plataforma";
import { buscarSaldo } from "@/lib/mercadopago";

/**
 * Saldo real da conta do Mercado Pago da Navalha — não da barbearia.
 *
 * Só admin: é dinheiro, mesma régua de marcar_paga/mudar_plano. O token
 * é o `MP_ACCESS_TOKEN` do ambiente, nunca de uma barbearia conectada.
 */
export async function GET(request: NextRequest) {
  const quem = await autenticarAdmin(request);
  if (!quem) return NextResponse.json({ erro: "Sem acesso." }, { status: 403 });

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { erro: "MP_ACCESS_TOKEN não configurado.", motivo: "falha" },
      { status: 503 },
    );
  }

  const r = await buscarSaldo(token);
  if (!r.ok) {
    return NextResponse.json(
      {
        erro:
          r.motivo === "sem_permissao"
            ? "O Mercado Pago recusou a consulta de saldo pra essa conta — geralmente é cadastro incompleto (endereço pendente, tipo de conta). Confira em Seu negócio, dentro do Mercado Pago."
            : "Não foi possível consultar o saldo agora.",
        motivo: r.motivo,
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, saldo: r.saldo });
}
