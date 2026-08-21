import type { SupabaseClient } from "@supabase/supabase-js";

export interface ServicoValidado {
  id: string;
  nome: string;
  preco: number;
  duracaoMin: number;
  hora: string;
}

export interface ProdutoValidado {
  id: string;
  nome: string;
  preco: number;
  quantidade: number;
}

/**
 * Recalcula nome/preço/duração a partir do banco — nunca confia no que o
 * navegador mandou no corpo da requisição. Sem isso dava pra editar o
 * `fetch` no devtools e pagar centavos por um corte de R$ 80: o preço só
 * existia no JSON enviado, sem checagem contra a tabela `servicos`.
 */
export async function validarServicos(
  db: SupabaseClient,
  barbeariaId: string,
  itens: { servicoId: string; hora: string }[],
): Promise<{ ok: true; servicos: ServicoValidado[] } | { ok: false; error: string }> {
  if (!itens.length) return { ok: false, error: "Nenhum serviço no pedido." };

  const ids = Array.from(new Set(itens.map((i) => i.servicoId)));
  const { data, error } = await db
    .from("servicos")
    .select("id, nome, preco, duracao_min, ativo")
    .eq("barbearia_id", barbeariaId)
    .in("id", ids);

  if (error) return { ok: false, error: error.message };

  const mapa = new Map((data ?? []).map((s) => [s.id as string, s]));
  const servicos: ServicoValidado[] = [];
  for (const item of itens) {
    const s = mapa.get(item.servicoId);
    if (!s || !s.ativo) {
      return { ok: false, error: "Um dos serviços escolhidos não está mais disponível." };
    }
    servicos.push({
      id: s.id,
      nome: s.nome,
      preco: Number(s.preco),
      duracaoMin: s.duracao_min,
      hora: item.hora,
    });
  }
  return { ok: true, servicos };
}

/** Mesma ideia pros produtos, com checagem de estoque junto. */
export async function validarProdutos(
  db: SupabaseClient,
  barbeariaId: string,
  itens: { produtoId: string; quantidade: number }[],
): Promise<{ ok: true; produtos: ProdutoValidado[] } | { ok: false; error: string }> {
  const validos = itens.filter((i) => i.quantidade > 0);
  if (!validos.length) return { ok: true, produtos: [] };

  const ids = Array.from(new Set(validos.map((i) => i.produtoId)));
  const { data, error } = await db
    .from("produtos")
    .select("id, nome, preco, estoque, ativo")
    .eq("barbearia_id", barbeariaId)
    .in("id", ids);

  if (error) return { ok: false, error: error.message };

  const mapa = new Map((data ?? []).map((p) => [p.id as string, p]));
  const produtos: ProdutoValidado[] = [];
  for (const item of validos) {
    const p = mapa.get(item.produtoId);
    if (!p || !p.ativo) {
      return { ok: false, error: "Um dos produtos escolhidos não está mais disponível." };
    }
    if (p.estoque < item.quantidade) {
      return { ok: false, error: `Estoque insuficiente para "${p.nome}".` };
    }
    produtos.push({
      id: p.id,
      nome: p.nome,
      preco: Number(p.preco),
      quantidade: item.quantidade,
    });
  }
  return { ok: true, produtos };
}
