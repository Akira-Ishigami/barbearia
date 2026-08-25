import { NextResponse, type NextRequest } from "next/server";
import {
  autenticarAdmin,
  autenticarPlataforma,
  registrarAcao,
} from "@/lib/plataforma";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";
import { mascararEmail, mascararTelefone, nomeCurto } from "@/lib/privacidade";

/**
 * Os clientes da plataforma — quem agenda, não quem vende.
 *
 * Aqui o dado é pessoal de verdade: nome, e-mail e telefone de pessoa
 * física. A LGPD não proíbe tratar isso — a Navalha precisa dele pra
 * prestar o serviço —, mas cobra **necessidade**: só o mínimo, e só pra
 * uma finalidade declarada.
 *
 * O que isso vira na prática:
 *
 *   1. NÃO existe listagem. Abrir a tela não devolve pessoa nenhuma. Uma
 *      lista de todo mundo não tem finalidade: ninguém precisa "navegar"
 *      pela base de clientes de terceiros.
 *   2. A busca exige o valor INTEIRO — e-mail completo ou telefone. É o
 *      caso real de suporte: a pessoa do outro lado da linha ditando o
 *      próprio contato. Pedaço não devolve nada, senão a busca viraria
 *      uma forma de baixar a base aos poucos.
 *   3. O que volta é mascarado. Dá pra confirmar que é quem ligou; não dá
 *      pra copiar contato.
 *   4. Em qual barbearia a pessoa foi atendida nunca é dito. Isso é a
 *      relação dela com a barbearia, não com a Navalha.
 *   5. Toda busca fica no registro, com quem buscou e o que buscou.
 *
 * O DELETE atende ao direito de eliminação (art. 18, VI): quando a pessoa
 * pede pra sair, o cadastro dela é apagado de verdade.
 */

const DIA = 24 * 60 * 60 * 1000;
const SEMANAS = 10;

interface LinhaCliente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  criado_em: string;
  auth_user_id: string | null;
}

export async function GET(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  const quem = await autenticarPlataforma(request);
  if (!quem) return NextResponse.json({ erro: "Sem acesso." }, { status: 403 });

  const db = supabaseAdmin();
  const busca = (request.nextUrl.searchParams.get("busca") ?? "").trim().toLowerCase();

  // Os agregados não precisam de nome nenhum: só data de cadastro e se a
  // pessoa tem conta. O nome só é lido quando alguém procura por ela.
  const [clientesRes, pedidosRes] = await Promise.all([
    db
      .from("clientes")
      .select("id, criado_em, auth_user_id")
      .order("criado_em", { ascending: false })
      .limit(20000),
    db
      .from("pedidos")
      .select("cliente_id, criado_em")
      .not("cliente_id", "is", null)
      .limit(20000),
  ]);

  const clientes = (clientesRes.data ?? []) as {
    id: string;
    criado_em: string;
    auth_user_id: string | null;
  }[];
  const pedidos = (pedidosRes.data ?? []) as { cliente_id: string; criado_em: string }[];

  const visitas = new Map<string, { total: number; ultima: string }>();
  for (const p of pedidos) {
    const atual = visitas.get(p.cliente_id);
    if (!atual) visitas.set(p.cliente_id, { total: 1, ultima: p.criado_em });
    else {
      atual.total += 1;
      if (p.criado_em > atual.ultima) atual.ultima = p.criado_em;
    }
  }

  const desde = (dias: number) => Date.now() - dias * DIA;
  const novosEm = (dias: number) =>
    clientes.filter((c) => new Date(c.criado_em).getTime() >= desde(dias)).length;

  const comConta = clientes.filter((c) => c.auth_user_id).length;
  const agendaram = clientes.filter((c) => visitas.has(c.id)).length;
  const voltaram = clientes.filter((c) => (visitas.get(c.id)?.total ?? 0) >= 2).length;
  const ativosEm30 = clientes.filter((c) => {
    const u = visitas.get(c.id)?.ultima;
    return u ? new Date(u).getTime() >= desde(30) : false;
  }).length;

  const semanas = Array.from({ length: SEMANAS }, (_, i) => {
    const fim = Date.now() - (SEMANAS - 1 - i) * 7 * DIA;
    const inicio = fim - 7 * DIA;
    const dentro = (iso: string) => {
      const t = new Date(iso).getTime();
      return t >= inicio && t < fim;
    };
    return {
      inicio: new Date(inicio).toISOString(),
      cadastros: clientes.filter((c) => dentro(c.criado_em)).length,
      pedidos: pedidos.filter((p) => dentro(p.criado_em)).length,
    };
  });

  const resumo = {
    total: clientes.length,
    comConta,
    semConta: clientes.length - comConta,
    agendaram,
    voltaram,
    ativosEm30,
    novosEm7Dias: novosEm(7),
    novosEm30Dias: novosEm(30),
    taxaRetorno: agendaram ? Math.round((voltaram / agendaram) * 100) : null,
    mediaVisitas: agendaram ? Math.round((pedidos.length / agendaram) * 10) / 10 : 0,
  };

  // ---------- Sem busca: nenhuma pessoa sai daqui ----------
  if (!busca) {
    return NextResponse.json({ nivel: quem.nivel, resumo, semanas, encontrados: null });
  }

  // ---------- Com busca: valor inteiro, mascarado e registrado ----------
  const digitos = busca.replace(/\D/g, "");
  const ehEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(busca);
  const ehTelefone = digitos.length >= 10;

  if (!ehEmail && !ehTelefone) {
    return NextResponse.json({
      nivel: quem.nivel,
      resumo,
      semanas,
      encontrados: [],
      aviso:
        "Informe o e-mail completo ou o telefone com DDD. Busca por parte do dado não é permitida aqui.",
    });
  }

  let consulta = db.from("clientes").select("id, nome, email, telefone, criado_em, auth_user_id");
  consulta = ehEmail ? consulta.eq("email", busca) : consulta.ilike("telefone", `%${digitos}%`);

  const { data } = await consulta.limit(10);
  const achados = (data ?? []) as LinhaCliente[];

  await registrarAcao(
    quem,
    "buscar_cliente",
    null,
    `${ehEmail ? "e-mail" : "telefone"} · ${achados.length} resultado(s)`,
  );

  return NextResponse.json({
    nivel: quem.nivel,
    resumo,
    semanas,
    encontrados: achados.map((c) => {
      const v = visitas.get(c.id);
      return {
        id: c.id,
        nome: nomeCurto(c.nome),
        email: mascararEmail(c.email),
        telefone: c.telefone ? mascararTelefone(c.telefone) : "—",
        temConta: Boolean(c.auth_user_id),
        criadoEm: c.criado_em,
        visitas: v?.total ?? 0,
        ultimaVisita: v?.ultima ?? null,
      };
    }),
  });
}

/**
 * Direito de eliminação (LGPD art. 18, VI).
 *
 * Apaga o cadastro da pessoa e a conta de acesso dela. Os pedidos ficam,
 * com `cliente_id` nulo — a chave estrangeira é `on delete set null`. Isso
 * é proposital: o pedido é registro fiscal e operacional da barbearia, que
 * tem base legal própria pra guardá-lo, e ele deixa de estar ligado a uma
 * pessoa identificada.
 */
export async function DELETE(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  const quem = await autenticarAdmin(request);
  if (!quem) {
    return NextResponse.json(
      { erro: "Apagar dado de cliente é só do administrador da plataforma." },
      { status: 403 },
    );
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ erro: "Informe o cliente." }, { status: 400 });

  const db = supabaseAdmin();

  const { data: cliente } = await db
    .from("clientes")
    .select("id, email, auth_user_id")
    .eq("id", id)
    .maybeSingle();

  if (!cliente) return NextResponse.json({ erro: "Cliente não encontrado." }, { status: 404 });

  const { error } = await db.from("clientes").delete().eq("id", id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  if (cliente.auth_user_id) {
    // Conta que não sai não derruba a exclusão, que já aconteceu.
    await db.auth.admin.deleteUser(cliente.auth_user_id as string).catch(() => {});
  }

  // O e-mail vai mascarado até no registro: a trilha precisa provar que a
  // exclusão aconteceu, não guardar de novo o dado que acabou de sair.
  await registrarAcao(
    quem,
    "excluir_cliente",
    null,
    `${mascararEmail(cliente.email as string)} · a pedido do titular`,
  );

  return NextResponse.json({ ok: true });
}
