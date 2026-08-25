import { NextResponse, type NextRequest } from "next/server";
import { autenticarPlataforma, registrarAcao } from "@/lib/plataforma";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";
import { mascararEmail, mascararTelefone, nomeCurto } from "@/lib/privacidade";

/**
 * Os clientes da plataforma — quem agenda, não quem vende.
 *
 * A pergunta que esta rota responde é "a base de quem usa está crescendo e
 * voltando?". Ela responde isso com contagem, não com lista de gente.
 *
 * A lista existe, mas mascarada: nome vira "Akira M.", e-mail vira
 * "ak•••@gmail.com", telefone vira "(11) ••••-7777". Dá pra conferir que é
 * a pessoa certa quando ela liga pro suporte; não dá pra montar uma base de
 * contatos a partir da tela. Ver quem passou por qual barbearia também não
 * rola: isso é a agenda dela, não a métrica da Navalha.
 *
 * `?busca=` procura por e-mail ou telefone inteiro — o caso real é a pessoa
 * do outro lado da linha ditando o próprio contato. Toda busca fica no log.
 */

const DIA = 24 * 60 * 60 * 1000;
const SEMANAS = 10;
const LIMITE_LISTA = 40;

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

  const [clientesRes, pedidosRes] = await Promise.all([
    db
      .from("clientes")
      .select("id, nome, email, telefone, criado_em, auth_user_id")
      .order("criado_em", { ascending: false })
      .limit(5000),
    // Só o vínculo e a data: quanto a pessoa gastou e onde é assunto dela
    // com a barbearia.
    db
      .from("pedidos")
      .select("cliente_id, criado_em")
      .not("cliente_id", "is", null)
      .limit(20000),
  ]);

  const clientes = (clientesRes.data ?? []) as LinhaCliente[];
  const pedidos = (pedidosRes.data ?? []) as { cliente_id: string; criado_em: string }[];

  // ---------- Atividade por cliente ----------
  const visitas = new Map<string, { total: number; ultima: string }>();
  for (const p of pedidos) {
    const atual = visitas.get(p.cliente_id);
    if (!atual) visitas.set(p.cliente_id, { total: 1, ultima: p.criado_em });
    else {
      atual.total += 1;
      if (p.criado_em > atual.ultima) atual.ultima = p.criado_em;
    }
  }

  const comConta = clientes.filter((c) => c.auth_user_id).length;
  const agendaram = clientes.filter((c) => visitas.has(c.id)).length;
  const voltaram = clientes.filter((c) => (visitas.get(c.id)?.total ?? 0) >= 2).length;

  const desde = (dias: number) => Date.now() - dias * DIA;
  const novosEm = (dias: number) =>
    clientes.filter((c) => new Date(c.criado_em).getTime() >= desde(dias)).length;

  const ativosEm30 = clientes.filter((c) => {
    const u = visitas.get(c.id)?.ultima;
    return u ? new Date(u).getTime() >= desde(30) : false;
  }).length;

  // ---------- Linha do tempo ----------
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
      movimentado: 0,
    };
  });

  // ---------- Lista ----------
  // Sem busca, mostra os mais recentes. Com busca, só bate no valor inteiro:
  // "a" não pode devolver a base toda.
  let selecionados = clientes;
  if (busca) {
    const digitos = busca.replace(/\D/g, "");
    selecionados = clientes.filter(
      (c) =>
        c.email.toLowerCase() === busca ||
        (digitos.length >= 8 && c.telefone.replace(/\D/g, "").endsWith(digitos)),
    );
    await registrarAcao(quem, "buscar_cliente", null, `busca por "${busca}"`);
  }

  const lista = selecionados.slice(0, LIMITE_LISTA).map((c) => {
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
  });

  return NextResponse.json({
    nivel: quem.nivel,
    resumo: {
      total: clientes.length,
      comConta,
      semConta: clientes.length - comConta,
      agendaram,
      voltaram,
      ativosEm30,
      novosEm7Dias: novosEm(7),
      novosEm30Dias: novosEm(30),
      // Quantos dos que agendaram uma vez agendaram de novo.
      taxaRetorno: agendaram ? Math.round((voltaram / agendaram) * 100) : null,
      mediaVisitas: agendaram
        ? Math.round((pedidos.length / agendaram) * 10) / 10
        : 0,
    },
    semanas,
    lista,
    // Quantos ficaram de fora do que a tela mostra, pra ninguém achar que a
    // lista é a base inteira.
    naLista: lista.length,
    totalFiltrado: selecionados.length,
    busca,
  });
}
