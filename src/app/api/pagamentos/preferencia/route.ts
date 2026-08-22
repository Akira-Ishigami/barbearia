import { NextResponse, type NextRequest } from "next/server";
import { appUrl, criarPreferencia, renovarToken } from "@/lib/mercadopago";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";
import { clienteDoPedido } from "@/lib/cliente-api";
import { validarProdutos, validarServicos } from "@/lib/pedido-server";

/**
 * Agendamento pago online: o CLIENTE paga a BARBEARIA.
 * Usa a conta do Mercado Pago da barbearia (conectada por OAuth), então o
 * dinheiro cai direto na conta dela.
 *
 * O pedido e os agendamentos são criados ANTES de mandar pro Mercado Pago,
 * com status "aguardando_pagamento" — assim o horário fica preso enquanto a
 * pessoa paga, e o índice único do banco impede que dois clientes fechem o
 * mesmo horário ao mesmo tempo.
 */

interface Corpo {
  barbeariaId: string;
  barbeiroId: string;
  cliente: { nome: string; telefone: string; email: string };
  data: string;
  horaInicio: string;
  servicos: { servicoId: string; hora: string }[];
  produtos: { produtoId: string; quantidade: number }[];
}

export async function POST(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json(
      {
        erro: "Banco não configurado.",
        comoResolver: "Cadastre NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel.",
      },
      { status: 503 },
    );
  }

  let corpo: Corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  if (!corpo.servicos?.length) {
    return NextResponse.json({ erro: "Nenhum serviço no pedido." }, { status: 400 });
  }

  const db = supabaseAdmin();

  // 1. conta do Mercado Pago da barbearia
  const { data: conta } = await db
    .from("mp_contas")
    .select("access_token, refresh_token, expira_em, aceita_pix, aceita_cartao, parcelas_max, taxa_percentual")
    .eq("barbearia_id", corpo.barbeariaId)
    .maybeSingle();

  if (!conta) {
    return NextResponse.json(
      { erro: "Esta barbearia ainda não conectou uma conta do Mercado Pago." },
      { status: 409 },
    );
  }

  let accessToken: string = conta.access_token;
  if (new Date(conta.expira_em).getTime() - Date.now() < 24 * 60 * 60 * 1000) {
    try {
      const novos = await renovarToken(conta.refresh_token);
      accessToken = novos.access_token;
      await db
        .from("mp_contas")
        .update({
          access_token: novos.access_token,
          refresh_token: novos.refresh_token,
          expira_em: new Date(Date.now() + novos.expires_in * 1000).toISOString(),
        })
        .eq("barbearia_id", corpo.barbeariaId);
    } catch {
      /* segue com o token atual */
    }
  }

  const validacaoServicos = await validarServicos(db, corpo.barbeariaId, corpo.servicos);
  if (!validacaoServicos.ok) {
    return NextResponse.json({ erro: validacaoServicos.error }, { status: 400 });
  }
  const validacaoProdutos = await validarProdutos(db, corpo.barbeariaId, corpo.produtos ?? []);
  if (!validacaoProdutos.ok) {
    return NextResponse.json({ erro: validacaoProdutos.error }, { status: 400 });
  }
  const servicos = validacaoServicos.servicos;
  const produtos = validacaoProdutos.produtos;

  const totalServicos = servicos.reduce((s, x) => s + x.preco, 0);
  const totalProdutos = produtos.reduce((s, p) => s + p.preco * p.quantidade, 0);
  const total = totalServicos + totalProdutos;

  // 2. pedido
  const { data: pedido, error: erroPedido } = await db
    .from("pedidos")
    .insert({
      barbearia_id: corpo.barbeariaId,
      // Vazio pra quem agenda sem conta — o pedido existe do mesmo jeito.
      cliente_id: await clienteDoPedido(request, db),
      cliente_nome: corpo.cliente.nome,
      cliente_telefone: corpo.cliente.telefone,
      cliente_email: corpo.cliente.email,
      total,
      forma_pagamento: "online",
      status_pagamento: "pendente",
    })
    .select("id")
    .single();

  if (erroPedido || !pedido) {
    return NextResponse.json(
      { erro: erroPedido?.message ?? "Não foi possível abrir o pedido." },
      { status: 500 },
    );
  }

  // 3. agendamentos — o índice único derruba aqui se o horário foi tomado
  const { error: erroAgenda } = await db.from("agendamentos").insert(
    servicos.map((s) => ({
      barbearia_id: corpo.barbeariaId,
      barbeiro_id: corpo.barbeiroId,
      pedido_id: pedido.id,
      servico_nome: s.nome,
      preco: s.preco,
      duracao_min: s.duracaoMin,
      data: corpo.data,
      hora: s.hora,
      status: "aguardando_pagamento",
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

  // 4. preferência no Mercado Pago
  const base = appUrl(request);
  const taxa = Number(conta.taxa_percentual ?? 0);

  try {
    const preferencia = await criarPreferencia({
      accessToken,
      items: [
        ...servicos.map((s) => ({ title: s.nome, quantity: 1, unit_price: s.preco })),
        ...produtos.map((p) => ({
          title: p.nome,
          quantity: p.quantidade,
          unit_price: p.preco,
        })),
      ],
      externalReference: `pedido:${pedido.id}`,
      backUrls: {
        success: `${base}/loja/${corpo.barbeariaId}/pagamento?resultado=ok`,
        pending: `${base}/loja/${corpo.barbeariaId}/pagamento?resultado=pendente`,
        failure: `${base}/loja/${corpo.barbeariaId}/pagamento?resultado=falhou`,
      },
      notificationUrl: `${base}/api/mp/webhook`,
      pagador: { name: corpo.cliente.nome, email: corpo.cliente.email },
      marketplaceFee: taxa > 0 ? (total * taxa) / 100 : undefined,
      parcelasMax: conta.parcelas_max ?? 1,
      aceitaPix: conta.aceita_pix,
      aceitaCartao: conta.aceita_cartao,
    });

    await db
      .from("pedidos")
      .update({ mp_preference_id: preferencia.id })
      .eq("id", pedido.id);

    return NextResponse.json({ url: preferencia.init_point, pedidoId: pedido.id });
  } catch (e) {
    // Não deu pra cobrar: solta o horário em vez de deixá-lo preso.
    await db.from("agendamentos").delete().eq("pedido_id", pedido.id);
    await db.from("pedidos").delete().eq("id", pedido.id);
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha ao criar a cobrança." },
      { status: 502 },
    );
  }
}
