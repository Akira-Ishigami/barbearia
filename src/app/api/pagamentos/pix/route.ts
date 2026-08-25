import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";
import { clienteDoPedido } from "@/lib/cliente-api";
import { validarProdutos, validarServicos } from "@/lib/pedido-server";
import { gerarBrCode, txidDoPedido } from "@/lib/pix";

/**
 * Agendamento pago por Pix direto na chave da barbearia.
 *
 * A diferença pro Mercado Pago é honesta e precisa ficar clara na tela: não
 * existe webhook. Ninguém avisa o sistema de que o dinheiro caiu — quem
 * confirma é o dono, olhando o extrato. Por isso o horário entra como
 * "pendente", e não como "confirmado".
 *
 * O valor vai travado dentro do código Pix, montado aqui no servidor a
 * partir do preço que está no banco. O navegador manda só quais serviços,
 * nunca quanto custam.
 */

interface Corpo {
  barbeariaId: string;
  barbeiroId: string;
  cliente: { nome: string; telefone: string; email: string };
  data: string;
  servicos: { servicoId: string; hora: string }[];
  produtos: { produtoId: string; quantidade: number }[];
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

  const { data: conta } = await db
    .from("pix_contas")
    .select("chave, beneficiario, cidade, ativo")
    .eq("barbearia_id", c.barbeariaId)
    .maybeSingle();

  if (!conta?.ativo) {
    return NextResponse.json(
      { erro: "Esta barbearia não recebe por Pix." },
      { status: 409 },
    );
  }

  // O barbeiro precisa ser dessa barbearia — o corpo veio do navegador.
  const { data: barbeiro } = await db
    .from("barbeiros")
    .select("id")
    .eq("id", c.barbeiroId)
    .eq("barbearia_id", c.barbeariaId)
    .maybeSingle();
  if (!barbeiro) {
    return NextResponse.json({ erro: "Profissional inválido." }, { status: 400 });
  }

  const validacaoServicos = await validarServicos(db, c.barbeariaId, c.servicos);
  if (!validacaoServicos.ok) {
    return NextResponse.json({ erro: validacaoServicos.error }, { status: 400 });
  }
  const validacaoProdutos = await validarProdutos(db, c.barbeariaId, c.produtos ?? []);
  if (!validacaoProdutos.ok) {
    return NextResponse.json({ erro: validacaoProdutos.error }, { status: 400 });
  }
  const servicos = validacaoServicos.servicos;
  const produtos = validacaoProdutos.produtos;

  const total =
    servicos.reduce((s, x) => s + x.preco, 0) +
    produtos.reduce((s, p) => s + p.preco * p.quantidade, 0);

  const { data: pedido, error: erroPedido } = await db
    .from("pedidos")
    .insert({
      barbearia_id: c.barbeariaId,
      cliente_id: await clienteDoPedido(request, db),
      cliente_nome: c.cliente.nome,
      cliente_telefone: c.cliente.telefone,
      cliente_email: c.cliente.email,
      total,
      forma_pagamento: "pix_direto",
      status_pagamento: "pendente",
      metodo_pagamento: "pix",
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
    servicos.map((s) => ({
      barbearia_id: c.barbeariaId,
      barbeiro_id: c.barbeiroId,
      pedido_id: pedido.id,
      servico_nome: s.nome,
      preco: s.preco,
      duracao_min: s.duracaoMin,
      data: c.data,
      hora: s.hora,
      // "pendente" e não "confirmado": sem webhook, ninguém aqui sabe que o
      // Pix caiu. O dono confirma depois de ver o extrato.
      status: "pendente",
    })),
  );

  if (erroAgenda) {
    await db.from("pedidos").delete().eq("id", pedido.id);
    const conflito = erroAgenda.code === "23505";
    return NextResponse.json(
      {
        erro: conflito
          ? "Esse horário acabou de ser ocupado. Escolha outro."
          : erroAgenda.message,
      },
      { status: conflito ? 409 : 500 },
    );
  }

  if (produtos.length) {
    await db.from("pedido_produtos").insert(
      produtos.map((p) => ({
        pedido_id: pedido.id,
        produto_id: p.id,
        produto_nome: p.nome,
        quantidade: p.quantidade,
        preco: p.preco,
      })),
    );
  }

  const txid = txidDoPedido(pedido.id as string);
  await db.from("pedidos").update({ pix_txid: txid }).eq("id", pedido.id);

  const brcode = gerarBrCode({
    chave: conta.chave as string,
    beneficiario: conta.beneficiario as string,
    cidade: conta.cidade as string,
    valor: total,
    txid,
  });

  return NextResponse.json({
    ok: true,
    pedidoId: pedido.id,
    brcode,
    total,
    beneficiario: conta.beneficiario,
  });
}
