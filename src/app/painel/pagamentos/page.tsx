"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useSession } from "@/lib/use-session";
import { useAsync } from "@/lib/use-async";
import { cabecalhosAutenticados } from "@/lib/db";
import { useState } from "react";

interface Conta {
  apelido: string;
  ambiente: string;
  aceita_pix: boolean;
  aceita_cartao: boolean;
  parcelas_max: number;
  conectado_em: string;
}

interface Status {
  oauthConfigurado: boolean;
  bancoConfigurado: boolean;
  conectada: boolean;
  conta?: Conta | null;
}

function dataLonga(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const MOTIVOS: Record<string, string> = {
  "state-invalido": "O pedido de conexão não confere. Tente de novo.",
  "banco-nao-configurado": "O banco de dados ainda não está configurado.",
  "resposta-incompleta": "O Mercado Pago não devolveu os dados esperados.",
  access_denied: "Você cancelou a autorização no Mercado Pago.",
};

/**
 * O Mercado Pago devolve o motivo em inglês e em jargão técnico. Traduzimos
 * os casos comuns pra o dono saber o que fazer — principalmente o de
 * redirect_uri, que é erro de configuração do app, não culpa dele.
 */
function explicarMotivo(motivo: string | null): string | null {
  if (!motivo) return null;
  if (MOTIVOS[motivo]) return MOTIVOS[motivo];

  const m = motivo.toLowerCase();
  if (m.includes("redirect_uri") || m.includes("redirect uri")) {
    return "A aplicação da Navalha ainda não está liberada pra conectar contas. Avise o suporte — não é problema da sua conta.";
  }
  if (m.includes("invalid_client") || m.includes("client_id")) {
    return "As credenciais da Navalha no Mercado Pago estão inválidas. Avise o suporte.";
  }
  if (m.includes("invalid_grant") || m.includes("expired")) {
    return "A autorização expirou no meio do caminho. Clique em conectar e tente de novo.";
  }
  return `Não foi possível conectar: ${motivo}`;
}

function PagamentosConteudo() {
  const session = useSession();
  const params = useSearchParams();
  const dono = session?.role === "dono";

  const resultado = params.get("mp");
  const motivo = params.get("motivo");

  const { dados, carregando, recarregar } = useAsync<Status>(
    () =>
      fetch(`/api/mp/status?barbearia=${session!.barbeariaId}`).then((r) => r.json()),
    [session?.barbeariaId, resultado],
    { pular: !dono },
  );

  const [conectando, setConectando] = useState(false);
  const [erroConexao, setErroConexao] = useState<string | null>(null);

  if (!session || !dono) return null;

  const conta = dados?.conta ?? null;
  const conectada = Boolean(dados?.conectada);
  const pronto = dados?.oauthConfigurado && dados?.bancoConfigurado;

  async function desconectar() {
    await fetch("/api/mp/desconectar", {
      method: "POST",
      headers: await cabecalhosAutenticados(),
    });
    recarregar();
  }

  async function conectar() {
    setErroConexao(null);
    setConectando(true);
    try {
      const resposta = await fetch("/api/mp/conectar", {
        headers: await cabecalhosAutenticados(),
      });
      const corpo = await resposta.json().catch(() => ({}));
      if (!resposta.ok || !corpo.url) {
        // `comoResolver` diz o que fazer; sem ele a mensagem fica só no
        // "não deu certo" e a pessoa trava.
        setErroConexao(
          [corpo.erro, corpo.comoResolver].filter(Boolean).join(" ") ||
            "Não foi possível iniciar a conexão.",
        );
        setConectando(false);
        return;
      }
      // Navegação de página inteira de propósito: o Mercado Pago precisa
      // carregar a própria tela de login na aba do usuário.
      window.location.href = corpo.url;
    } catch {
      setErroConexao("Não foi possível iniciar a conexão.");
      setConectando(false);
    }
  }

  return (
    <div>
      <p className="font-accent text-xs uppercase tracking-[0.2em] text-gold-bright">
        Pagamentos
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-bone">
        Receber pelo Mercado Pago
      </h1>
      <p className="mt-1 max-w-xl font-body text-sm text-bone-dim">
        Conecte a conta do Mercado Pago da <strong className="text-bone">sua barbearia</strong>.
        O que o cliente pagar online cai direto nela — o dinheiro não passa pela Navalha.
      </p>

      {resultado === "conectado" && (
        <p className="mt-6 max-w-2xl rounded-xl border border-ok-line bg-ok-soft px-4 py-3 font-body text-sm text-ok">
          Conta conectada! Sua página pública já aceita pagamento online.
        </p>
      )}
      {resultado === "erro" && (
        <p className="mt-6 max-w-2xl rounded-xl border border-off-line bg-off-soft px-4 py-3 font-body text-sm text-off">
          {explicarMotivo(motivo) ?? "Não foi possível conectar."}
        </p>
      )}

      {carregando ? (
        <p className="mt-6 font-body text-sm text-bone-dim">Carregando…</p>
      ) : !pronto ? (
        <div className="mt-6 max-w-2xl rounded-2xl border border-warn-line bg-warn-soft p-6">
          <p className="font-display text-lg font-semibold text-bone">
            Integração ainda não configurada
          </p>
          <p className="mt-1 font-body text-sm text-bone-dim">
            Faltam variáveis de ambiente no servidor
            {!dados?.bancoConfigurado && " (banco de dados)"}
            {!dados?.oauthConfigurado && " (Mercado Pago)"}. O passo a passo está no
            arquivo <code className="font-accent text-xs">SETUP.md</code> do projeto.
          </p>
        </div>
      ) : conectada && conta ? (
        <div className="mt-6 max-w-2xl space-y-4">
          <div className="rounded-2xl border border-ok-line bg-ok-soft p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ok font-body text-lg text-white">
                  ✓
                </span>
                <div>
                  <p className="font-display text-lg font-semibold text-bone">
                    Conta conectada
                  </p>
                  {conta.apelido && (
                    <p className="font-body text-sm text-bone-dim">{conta.apelido}</p>
                  )}
                  <p className="mt-0.5 font-body text-xs text-muted">
                    Conectada em {dataLonga(conta.conectado_em)}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-ok px-3 py-1 font-body text-xs font-semibold text-white">
                {conta.ambiente === "producao" ? "Produção" : "Teste"}
              </span>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {conta.aceita_pix && (
                <span className="rounded-full border border-line bg-ink-elev px-3 py-1.5 font-body text-xs text-bone">
                  Pix aceito
                </span>
              )}
              {conta.aceita_cartao && (
                <span className="rounded-full border border-line bg-ink-elev px-3 py-1.5 font-body text-xs text-bone">
                  Cartão em até {conta.parcelas_max}x
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/loja/${session.barbeariaId}`}
              target="_blank"
              className="rounded-full border border-line-strong px-5 py-2.5 font-body text-sm font-semibold text-bone-dim transition-colors hover:border-gold-bright/40 hover:text-gold-bright"
            >
              Ver como o cliente paga ↗
            </Link>
            <button
              onClick={desconectar}
              className="rounded-full border border-line-strong px-5 py-2.5 font-body text-sm text-bone-dim transition-colors hover:border-off-line hover:text-off"
            >
              Desconectar conta
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 max-w-2xl rounded-2xl border border-warn-line bg-warn-soft p-6">
          <p className="font-display text-lg font-semibold text-bone">
            Nenhuma conta conectada
          </p>
          <p className="mt-1 max-w-lg font-body text-sm text-bone-dim">
            Sem uma conta do Mercado Pago, sua página pública só oferece{" "}
            <strong className="text-bone">pagar no local</strong> — e você precisa confirmar
            cada agendamento na mão.
          </p>
          <button
            onClick={conectar}
            disabled={conectando}
            className="mt-5 inline-block rounded-full bg-gold-bright px-6 py-3 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.02] disabled:opacity-60"
          >
            {conectando ? "Abrindo o Mercado Pago…" : "Conectar com Mercado Pago"}
          </button>
          <p className="mt-3 font-body text-xs text-muted">
            Você vai para o site do Mercado Pago, autoriza e volta pra cá.
          </p>
          {erroConexao && (
            <p className="mt-3 rounded-lg border border-off-line bg-off-soft px-3 py-2 font-body text-xs text-off">
              {erroConexao}
            </p>
          )}
        </div>
      )}

      <p className="mt-8 max-w-2xl rounded-xl border border-line bg-ink-elev/40 px-4 py-3 font-body text-xs text-muted">
        <strong className="text-bone-dim">Segurança:</strong> as credenciais da sua conta
        ficam guardadas no servidor e nunca chegam ao navegador. A Navalha só usa a
        autorização pra criar as cobranças em nome da sua barbearia.
      </p>
    </div>
  );
}

export default function PagamentosPage() {
  return (
    <Suspense fallback={null}>
      <PagamentosConteudo />
    </Suspense>
  );
}
