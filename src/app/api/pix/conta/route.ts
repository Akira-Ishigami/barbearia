import { NextResponse, type NextRequest } from "next/server";
import { autenticar } from "@/lib/auth-api";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";
import { formatarChave, normalizarChave, type TipoChavePix } from "@/lib/pix";

/**
 * A chave Pix da própria barbearia.
 *
 * Passa por rota de API — e não direto pelo navegador — porque `pix_contas`
 * não tem policy de RLS: a chave costuma ser o CPF ou o celular do dono, e
 * `barbearias` tem leitura pública. Guardar lá deixaria o CPF dele aberto
 * na internet junto com o endereço da loja.
 *
 * A barbearia sempre vem do vínculo em `usuarios`, nunca do corpo do
 * pedido: senão um dono cadastraria a própria chave na barbearia do vizinho
 * e receberia no lugar dele.
 */

const TIPOS: TipoChavePix[] = ["cpf", "cnpj", "telefone", "email", "aleatoria"];

export async function GET(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  const quem = await autenticar(request);
  if (!quem) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { data } = await supabaseAdmin()
    .from("pix_contas")
    .select("tipo, chave, beneficiario, cidade, ativo, criado_em")
    .eq("barbearia_id", quem.barbeariaId)
    .maybeSingle();

  if (!data) return NextResponse.json({ configurada: false, conta: null });

  return NextResponse.json({
    configurada: true,
    conta: {
      tipo: data.tipo,
      // Volta formatada pro dono conferir que é a chave certa. É a conta
      // dele mesmo, então aqui não mascaramos — no painel do suporte, sim.
      chave: formatarChave(data.tipo as TipoChavePix, data.chave as string),
      beneficiario: data.beneficiario,
      cidade: data.cidade,
      ativo: data.ativo,
      criadoEm: data.criado_em,
    },
  });
}

export async function POST(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  const quem = await autenticar(request);
  if (!quem) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (quem.role !== "dono") {
    return NextResponse.json(
      { erro: "Só o dono cadastra a chave de recebimento." },
      { status: 403 },
    );
  }

  let c: { tipo?: string; chave?: string; beneficiario?: string; cidade?: string };
  try {
    c = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const tipo = c.tipo as TipoChavePix;
  if (!TIPOS.includes(tipo)) {
    return NextResponse.json({ erro: "Tipo de chave inválido." }, { status: 400 });
  }

  const normalizada = normalizarChave(tipo, c.chave ?? "");
  if (!normalizada.ok) {
    return NextResponse.json({ erro: normalizada.error }, { status: 400 });
  }

  const beneficiario = (c.beneficiario ?? "").trim();
  const cidade = (c.cidade ?? "").trim();
  if (!beneficiario) {
    return NextResponse.json(
      { erro: "Informe o nome de quem recebe (como está no banco)." },
      { status: 400 },
    );
  }
  if (!cidade) {
    return NextResponse.json({ erro: "Informe a cidade." }, { status: 400 });
  }

  const { error } = await supabaseAdmin()
    .from("pix_contas")
    .upsert(
      {
        barbearia_id: quem.barbeariaId,
        tipo,
        chave: normalizada.chave,
        beneficiario,
        cidade,
        ativo: true,
      },
      { onConflict: "barbearia_id" },
    );

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  const quem = await autenticar(request);
  if (!quem) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (quem.role !== "dono") {
    return NextResponse.json({ erro: "Só o dono remove a chave." }, { status: 403 });
  }

  const { error } = await supabaseAdmin()
    .from("pix_contas")
    .delete()
    .eq("barbearia_id", quem.barbeariaId);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
