"use client";

import { supabase } from "./supabase-browser";
import type { Cliente, VisitaCliente } from "./types";

/**
 * Conta do cliente — quem agenda, não a equipe da barbearia.
 *
 * Agendar sem conta continua funcionando: a conta serve pra guardar o
 * histórico e reconhecer a pessoa nas próximas visitas.
 */

function erro(e: { message: string } | null) {
  if (e) throw new Error(e.message);
}

export async function getClienteLogado(): Promise<Cliente | null> {
  const db = supabase();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;

  const { data } = await db
    .from("clientes")
    .select("*")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id as string,
    nome: data.nome as string,
    email: data.email as string,
    telefone: (data.telefone as string) ?? "",
    criadoEm: data.criado_em as string,
  };
}

export async function atualizarCliente(
  id: string,
  patch: { nome?: string; telefone?: string },
): Promise<void> {
  const linha: Record<string, unknown> = {};
  if (patch.nome !== undefined) linha.nome = patch.nome;
  if (patch.telefone !== undefined) linha.telefone = patch.telefone;
  const { error } = await supabase().from("clientes").update(linha).eq("id", id);
  erro(error);
}

/**
 * Histórico de visitas. Cada pedido vira uma visita, com os serviços do
 * agendamento e os produtos comprados junto — é o mesmo agrupamento que o
 * painel da barbearia faz, só que do lado do cliente.
 */
export async function getHistoricoCliente(clienteId: string): Promise<VisitaCliente[]> {
  const db = supabase();

  const { data: pedidos, error } = await db
    .from("pedidos")
    .select("id, barbearia_id, total, forma_pagamento, criado_em, barbearias(nome, slug)")
    .eq("cliente_id", clienteId)
    .order("criado_em", { ascending: false });
  erro(error);

  const lista = pedidos ?? [];
  if (lista.length === 0) return [];

  const ids = lista.map((p) => p.id as string);

  const [{ data: agendamentos }, { data: itens }] = await Promise.all([
    db
      .from("agendamentos")
      .select("pedido_id, servico_nome, data, hora, status, barbeiro_id")
      .in("pedido_id", ids),
    db.from("pedido_produtos").select("pedido_id, produto_nome, quantidade").in("pedido_id", ids),
  ]);

  return lista
    .map((p) => {
      const doPedido = (agendamentos ?? []).filter((a) => a.pedido_id === p.id);
      const ordenados = [...doPedido].sort((x, y) =>
        String(x.hora).localeCompare(String(y.hora)),
      );
      const primeiro = ordenados[0];
      const barbearia = p.barbearias as unknown as { nome?: string; slug?: string } | null;

      return {
        pedidoId: p.id as string,
        barbeariaId: p.barbearia_id as string,
        barbeariaNome: barbearia?.nome ?? "Barbearia",
        barbeariaSlug: barbearia?.slug ?? undefined,
        barbeiroId: (primeiro?.barbeiro_id as string) ?? undefined,
        // Pedido sem agendamento não deveria existir, mas se existir não
        // pode derrubar a tela inteira do histórico.
        data: (primeiro?.data as string) ?? (p.criado_em as string).slice(0, 10),
        hora: (primeiro?.hora as string) ?? "",
        servicos: ordenados.map((a) => a.servico_nome as string),
        produtos: (itens ?? [])
          .filter((i) => i.pedido_id === p.id)
          .map((i) =>
            Number(i.quantidade) > 1
              ? `${i.produto_nome} (${i.quantidade}x)`
              : String(i.produto_nome),
          ),
        total: Number(p.total),
        status: (primeiro?.status as VisitaCliente["status"]) ?? "confirmado",
        formaPagamento: p.forma_pagamento as VisitaCliente["formaPagamento"],
      };
    })
    .sort((a, b) => (b.data + b.hora).localeCompare(a.data + a.hora));
}
