import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";

/**
 * Agendamento pago no balcão — não passa pelo Mercado Pago.
 *
 * Vem pra cá (e não direto do navegador) porque o cliente não está logado:
 * ele não tem permissão de escrever em `pedidos`/`agendamentos` pelo RLS.
 * O horário entra como "pendente" até a barbearia confirmar.
 */
interface Corpo {
  barbeariaId: string;
  barbeiroId: string;
  cliente: { nome: string; telefone: string; email: string };
  data: string;
  servicos: { nome: string; preco: number; duracaoMin: number; hora: string }[];
  produtos: { produtoId: string; nome: string; preco: number; quantidade: number }[];
}

export async function POST(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  let c: Corpo;
  try {
    c = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  if (!c.servicos?.length) {
    return NextResponse.json({ erro: "Nenhum serviço no pedido." }, { status: 400 });
  }
  if (!c.cliente?.nome || !c.cliente?.telefone) {
    return NextResponse.json({ erro: "Informe nome e telefone." }, { status: 400 });
  }

  const db = supabaseAdmin();

  // O barbeiro precisa ser mesmo dessa barbearia — o corpo do pedido vem do
  // navegador e não pode ser tratado como verdade.
  const { data: barbeiro } = await db
    .from("barbeiros")
    .select("id")
    .eq("id", c.barbeiroId)
    .eq("barbearia_id", c.barbeariaId)
    .maybeSingle();
  if (!barbeiro) {
    return NextResponse.json({ erro: "Profissional inválido." }, { status: 400 });
  }

  const total =
    c.servicos.reduce((s, x) => s + x.preco, 0) +
    c.produtos.reduce((s, p) => s + p.preco * p.quantidade, 0);

  const { data: pedido, error: erroPedido } = await db
    .from("pedidos")
    .insert({
      barbearia_id: c.barbeariaId,
      cliente_nome: c.cliente.nome,
      cliente_telefone: c.cliente.telefone,
      cliente_email: c.cliente.email,
      total,
      forma_pagamento: "local",
      status_pagamento: "pendente",
    })
    .select("id")
    .single();

  if (erroPedido || !pedido) {
    return NextResponse.json(
      { erro: erroPedido?.message ?? "Falha ao abrir o pedido." },
      { status: 500 },
    );
  }

  const { error: erroAgenda } = await db.from("agendamentos").insert(
    c.servicos.map((s) => ({
      barbearia_id: c.barbeariaId,
      barbeiro_id: c.barbeiroId,
      pedido_id: pedido.id,
      servico_nome: s.nome,
      preco: s.preco,
      duracao_min: s.duracaoMin,
      data: c.data,
      hora: s.hora,
      status: "pendente",
    })),
  );

  if (erroAgenda) {
    await db.from("pedidos").delete().eq("id", pedido.id);
    const conflito = erroAgenda.code === "23505";
    return NextResponse.json(
      { erro: conflito ? "Esse horário acabou de ser ocupado. Escolha outro." : erroAgenda.message },
      { status: conflito ? 409 : 500 },
    );
  }

  if (c.produtos.length) {
    await db.from("pedido_produtos").insert(
      c.produtos.map((p) => ({
        pedido_id: pedido.id,
        produto_id: p.produtoId,
        produto_nome: p.nome,
        quantidade: p.quantidade,
        preco: p.preco,
      })),
    );
  }

  return NextResponse.json({ ok: true, pedidoId: pedido.id });
}
