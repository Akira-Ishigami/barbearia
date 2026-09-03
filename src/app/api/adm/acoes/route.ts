import { NextResponse, type NextRequest } from "next/server";
import { autenticarPlataforma, registrarAcao } from "@/lib/plataforma";
import { supabaseAdmin, supabaseConfigurado } from "@/lib/supabase";

/**
 * O que suporte e admin podem fazer numa barbearia.
 *
 * A divisão é proposital: o suporte resolve o que trava o cliente (estender
 * o teste, soltar uma conexão quebrada do Mercado Pago) e o admin é o único
 * que mexe em dinheiro — marcar como paga, mudar plano, bloquear. Suporte
 * conseguindo liberar assinatura de graça é fraude esperando acontecer.
 *
 * Tudo passa pelo `plataforma_log`.
 */

const SO_ADMIN = new Set(["marcar_paga", "mudar_plano", "bloquear", "excluir"]);

/** O suporte estende o teste, mas em doses pequenas. */
const MAX_DIAS_SUPORTE = 7;

interface Corpo {
  acao: string;
  barbeariaId: string;
  dias?: number;
  plano?: string;
  motivo?: string;
  /** Só pra excluir: tem que ser o nome exato da barbearia. */
  confirmacao?: string;
}

export async function POST(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  const quem = await autenticarPlataforma(request);
  if (!quem) return NextResponse.json({ erro: "Sem acesso." }, { status: 403 });

  let c: Corpo;
  try {
    c = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  if (!c.barbeariaId || !c.acao) {
    return NextResponse.json({ erro: "Informe a ação e a barbearia." }, { status: 400 });
  }
  if (SO_ADMIN.has(c.acao) && quem.nivel !== "admin") {
    return NextResponse.json(
      { erro: "Essa ação é só do administrador da plataforma." },
      { status: 403 },
    );
  }

  const db = supabaseAdmin();

  const { data: barbearia } = await db
    .from("barbearias")
    .select("id, nome, plano, assinatura_status, trial_termina_em, assinatura_ate")
    .eq("id", c.barbeariaId)
    .maybeSingle();

  if (!barbearia) {
    return NextResponse.json({ erro: "Barbearia não encontrada." }, { status: 404 });
  }

  switch (c.acao) {
    case "estender_trial": {
      const pedido = Math.floor(c.dias ?? 7);
      if (pedido < 1 || pedido > 90) {
        return NextResponse.json({ erro: "Informe de 1 a 90 dias." }, { status: 400 });
      }
      if (quem.nivel !== "admin" && pedido > MAX_DIAS_SUPORTE) {
        return NextResponse.json(
          { erro: `O suporte estende no máximo ${MAX_DIAS_SUPORTE} dias por vez.` },
          { status: 403 },
        );
      }

      // Parte de hoje quando o teste já venceu — senão estender 7 dias de um
      // trial vencido há um mês não devolveria acesso nenhum.
      const atual = barbearia.trial_termina_em
        ? new Date(barbearia.trial_termina_em as string).getTime()
        : Date.now();
      const base = Math.max(atual, Date.now());
      const novoFim = new Date(base + pedido * 24 * 60 * 60 * 1000).toISOString();

      await db
        .from("barbearias")
        .update({ assinatura_status: "trial", trial_termina_em: novoFim })
        .eq("id", c.barbeariaId);

      await registrarAcao(
        quem,
        "estender_trial",
        c.barbeariaId,
        `+${pedido} dia(s) → ${novoFim}. ${c.motivo ?? ""}`.trim(),
      );
      return NextResponse.json({ ok: true, trialTerminaEm: novoFim });
    }

    case "marcar_paga": {
      const dias = Math.floor(c.dias ?? 30);
      if (dias < 1 || dias > 400) {
        return NextResponse.json({ erro: "Informe de 1 a 400 dias." }, { status: 400 });
      }
      const atual = barbearia.assinatura_ate
        ? new Date(barbearia.assinatura_ate as string).getTime()
        : 0;
      const base = Math.max(atual, Date.now());
      const ate = new Date(base + dias * 24 * 60 * 60 * 1000).toISOString();

      await db
        .from("barbearias")
        .update({ assinatura_status: "ativa", assinatura_ate: ate })
        .eq("id", c.barbeariaId);

      await registrarAcao(
        quem,
        "marcar_paga",
        c.barbeariaId,
        `+${dias} dia(s) → ${ate}. ${c.motivo ?? ""}`.trim(),
      );
      return NextResponse.json({ ok: true, assinaturaAte: ate });
    }

    case "mudar_plano": {
      if (c.plano !== "basico" && c.plano !== "pro") {
        return NextResponse.json({ erro: "Plano inválido." }, { status: 400 });
      }
      await db.from("barbearias").update({ plano: c.plano }).eq("id", c.barbeariaId);
      await registrarAcao(
        quem,
        "mudar_plano",
        c.barbeariaId,
        `${barbearia.plano} → ${c.plano}. ${c.motivo ?? ""}`.trim(),
      );
      return NextResponse.json({ ok: true, plano: c.plano });
    }

    case "bloquear": {
      await db
        .from("barbearias")
        .update({
          assinatura_status: "vencida",
          // Zera as duas datas: deixar uma delas no futuro faria a barbearia
          // voltar sozinha, porque `assinatura_ativa()` olha as datas.
          assinatura_ate: null,
          trial_termina_em: new Date().toISOString(),
        })
        .eq("id", c.barbeariaId);

      await registrarAcao(quem, "bloquear", c.barbeariaId, c.motivo ?? "");
      return NextResponse.json({ ok: true });
    }

    case "excluir": {
      // Apagar leva junto agenda, pedidos, catálogo, equipe e credenciais —
      // as chaves estrangeiras são `on delete cascade`. Não tem desfazer.
      //
      // Por isso a confirmação é o nome digitado, e não um "tem certeza?":
      // clicar errado numa lista acontece, digitar o nome de outra
      // barbearia por acidente não.
      if ((c.confirmacao ?? "").trim() !== barbearia.nome) {
        return NextResponse.json(
          { erro: "Digite o nome exato da barbearia pra confirmar a exclusão." },
          { status: 400 },
        );
      }

      // As contas do Supabase Auth não são apagadas pela cascata: `usuarios`
      // guarda o auth_user_id, mas sem chave estrangeira pra lá. Sem isto o
      // dono continuaria conseguindo entrar, numa conta sem barbearia.
      const { data: equipe } = await db
        .from("usuarios")
        .select("auth_user_id")
        .eq("barbearia_id", c.barbeariaId);

      // Quem está executando a exclusão também é dono/barbeiro dessa
      // barbearia (email cadastrado nos dois lugares — comum em conta de
      // teste do próprio time). Sem esta checagem, o admin apaga a própria
      // conta do Supabase Auth como efeito colateral e fica sem conseguir
      // entrar de novo pra desfazer nada — já aconteceu uma vez.
      const apagaAPropriaConta = (equipe ?? []).some(
        (u) => u.auth_user_id === quem.authUserId,
      );
      if (apagaAPropriaConta) {
        return NextResponse.json(
          {
            erro:
              "Você está na equipe dessa barbearia — excluir ela apagaria seu próprio " +
              "login. Peça pra outro admin excluir, ou tire seu acesso dessa barbearia " +
              "antes (em Equipe) e tente de novo.",
          },
          { status: 400 },
        );
      }

      const { error: erroExclusao } = await db
        .from("barbearias")
        .delete()
        .eq("id", c.barbeariaId);

      if (erroExclusao) {
        return NextResponse.json({ erro: erroExclusao.message }, { status: 500 });
      }

      for (const u of equipe ?? []) {
        if (!u.auth_user_id) continue;
        // Uma conta que não sai não pode derrubar a exclusão, que já
        // aconteceu — fica registrada no log e some no acerto seguinte.
        await db.auth.admin.deleteUser(u.auth_user_id as string).catch(() => {});
      }

      // O log tem `on delete set null` na barbearia, então o id some daqui a
      // pouco: o nome vai no detalhe pra sobrar rastro de quem foi apagada.
      await registrarAcao(
        quem,
        "excluir",
        null,
        `"${barbearia.nome}" (${c.barbeariaId}) · ${(equipe ?? []).length} conta(s) de acesso. ${c.motivo ?? ""}`.trim(),
      );

      return NextResponse.json({ ok: true, excluida: barbearia.nome });
    }

    case "desconectar_mp": {
      // Conexão do Mercado Pago que quebrou (token revogado do lado deles)
      // só volta reconectando do zero. Soltar isso é rotina de suporte.
      await db.from("mp_contas").delete().eq("barbearia_id", c.barbeariaId);
      await registrarAcao(quem, "desconectar_mp", c.barbeariaId, c.motivo ?? "");
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ erro: "Ação desconhecida." }, { status: 400 });
  }
}

/** Últimas ações registradas — a trilha do suporte. */
export async function GET(request: NextRequest) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: "Banco não configurado." }, { status: 503 });
  }

  const quem = await autenticarPlataforma(request);
  if (!quem) return NextResponse.json({ erro: "Sem acesso." }, { status: 403 });

  const barbearia = request.nextUrl.searchParams.get("barbearia");

  let consulta = supabaseAdmin()
    .from("plataforma_log")
    .select("id, email, acao, barbearia_id, detalhe, criado_em")
    .order("criado_em", { ascending: false })
    .limit(80);

  if (barbearia) consulta = consulta.eq("barbearia_id", barbearia);

  const { data } = await consulta;
  return NextResponse.json({ log: data ?? [] });
}
