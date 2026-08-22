"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useLoja } from "@/lib/loja-context";
import { caminhoLoja } from "@/lib/slug";
import { cartTotal, clearCart, useCart } from "@/lib/cart";
import { cabecalhosOpcionais, criarPedidoLocal } from "@/lib/db";
import { useAsync } from "@/lib/use-async";
import { addMinutes } from "@/lib/date";
import { SLOT_MIN, slotsDe } from "@/lib/types";

function preco(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

const ICONE_ONLINE =
  "M2 8h20M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM6 15h4";
const ICONE_BALCAO = "M3 21h18M5 21V10l7-5 7 5v11M10 21v-6h4v6";

function PagamentoConteudo() {
  const router = useRouter();
  const params = useSearchParams();
  const { barbearia } = useLoja();
  const cart = useCart(barbearia?.id ?? "");

  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmado, setConfirmado] = useState<{ temProdutos: boolean } | null>(null);

  // Volta do Mercado Pago: `ok` significa que o pagamento foi aprovado. Quem
  // realmente confirma o horário é o webhook — isto aqui é só o aviso na tela.
  const resultado = params.get("resultado");

  const { dados: mp } = useAsync<{
    conectada: boolean;
    conta?: { aceita_pix: boolean; aceita_cartao: boolean; parcelas_max: number } | null;
  }>(
    () => fetch(`/api/mp/status?barbearia=${barbearia!.id}`).then((r) => r.json()),
    [barbearia?.id],
    { pular: !barbearia },
  );

  if (!barbearia) return null;

  const { cliente, agendamento, servicos, produtos } = cart;

  if (resultado === "ok") {
    return (
      <Resultado
        barbeariaId={barbearia.id}
        titulo="Pagamento aprovado!"
        texto="Seu horário está garantido. Te esperamos!"
        sucesso
      />
    );
  }
  if (resultado === "pendente") {
    return (
      <Resultado
        barbeariaId={barbearia.id}
        titulo="Pagamento em análise"
        texto="Assim que o Mercado Pago confirmar, seu horário fica garantido. Você recebe o aviso por e-mail."
      />
    );
  }
  if (confirmado) {
    return (
      <Resultado
        barbeariaId={barbearia.id}
        titulo="Agendamento enviado!"
        texto="A barbearia vai confirmar seu horário. Você paga no balcão no dia."
        extra={
          confirmado.temProdutos
            ? "Seus produtos ficam separados pra retirada no dia da visita."
            : undefined
        }
      />
    );
  }

  const incompleto = servicos.length === 0 || !cliente || !agendamento;
  if (incompleto) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="font-display text-xl font-semibold text-bone">Faltam algumas coisas</p>
        <p className="mt-2 font-body text-sm text-bone-dim">
          {resultado === "falhou"
            ? "O pagamento não foi concluído. Monte seu horário de novo pra tentar outra vez."
            : "Volte pro carrinho pra escolher o horário e preencher seus dados antes de pagar."}
        </p>
        <Link
          href={`${caminhoLoja(barbearia)}`}
          className="mt-8 inline-block rounded-full bg-bone px-7 py-3.5 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.03]"
        >
          Voltar pro catálogo
        </Link>
      </div>
    );
  }

  const total = cartTotal(cart);
  const blocos = servicos.reduce((s, x) => s + slotsDe(x.duracaoMin), 0);
  const horaFim = addMinutes(agendamento!.horaInicio, blocos * SLOT_MIN);

  // Cada serviço começa quando o anterior termina.
  // Preço/nome/duração não vão no corpo — o servidor busca isso no banco
  // pelo servicoId, pra ninguém conseguir editar o pedido no devtools e
  // pagar menos do que o serviço custa de verdade.
  const servicosComHora = servicos.reduce<
    { servicoId: string; hora: string; duracaoMin: number }[]
  >((lista, s) => {
    const hora =
      lista.length === 0
        ? agendamento!.horaInicio
        : addMinutes(
            lista[lista.length - 1].hora,
            slotsDe(lista[lista.length - 1].duracaoMin) * SLOT_MIN,
          );
    return [...lista, { servicoId: s.servicoId, duracaoMin: s.duracaoMin, hora }];
  }, []);

  const corpoPedido = {
    barbeariaId: barbearia.id,
    barbeiroId: agendamento!.barbeiroId,
    cliente: cliente!,
    data: agendamento!.data,
    horaInicio: agendamento!.horaInicio,
    servicos: servicosComHora.map(({ servicoId, hora }) => ({ servicoId, hora })),
    produtos: produtos.map((p) => ({
      produtoId: p.produtoId,
      quantidade: p.quantidade,
    })),
  };

  async function pagarOnline() {
    setErro(null);
    setEnviando(true);
    try {
      const resposta = await fetch("/api/pagamentos/preferencia", {
        method: "POST",
        headers: await cabecalhosOpcionais(),
        body: JSON.stringify(corpoPedido),
      });
      const corpo = await resposta.json().catch(() => ({}));

      if (!resposta.ok || !corpo.url) {
        setErro(corpo.erro ?? "Não foi possível abrir o pagamento.");
        setEnviando(false);
        return;
      }
      // Sai do site: o Mercado Pago cuida de Pix e cartão.
      window.location.href = corpo.url;
    } catch {
      setErro("Falha de conexão. Tente de novo.");
      setEnviando(false);
    }
  }

  async function pagarNoLocal() {
    setErro(null);
    setEnviando(true);
    const resultado = await criarPedidoLocal(corpoPedido);
    setEnviando(false);

    if (!resultado.ok) {
      setErro(resultado.error);
      return;
    }
    const temProdutos = produtos.length > 0;
    clearCart(barbearia!.id);
    setConfirmado({ temProdutos });
  }

  const aceitaOnline = Boolean(mp?.conectada);
  const parcelas = mp?.conta?.parcelas_max ?? 1;
  const meios = [
    mp?.conta?.aceita_pix && "Pix",
    mp?.conta?.aceita_cartao && `cartão em até ${parcelas}x`,
  ].filter(Boolean);

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-6 py-3.5">
          <button
            onClick={() => router.push(`${caminhoLoja(barbearia)}/carrinho`)}
            className="flex shrink-0 items-center gap-1.5 font-body text-sm text-bone-dim transition-colors hover:text-bone"
          >
            <span aria-hidden>←</span> Voltar
          </button>
          <p className="truncate font-display text-sm font-semibold text-bone">{barbearia.nome}</p>
          <span className="shrink-0 font-accent text-[11px] text-muted">Pagamento</span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-bold text-bone">
          {aceitaOnline ? "Como você prefere pagar?" : "Quase lá!"}
        </h1>
        <p className="mt-1.5 font-body text-sm text-bone-dim">
          {aceitaOnline
            ? "Pagando agora, seu horário fica garantido na hora."
            : "Esta barbearia recebe no balcão. É só enviar o pedido e aguardar a confirmação."}
        </p>

        <div className="mt-7 rounded-2xl border border-line bg-ink-elev px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-body text-sm font-medium text-bone">
                {agendamento!.data.slice(8, 10)}/{agendamento!.data.slice(5, 7)} ·{" "}
                {agendamento!.horaInicio}–{horaFim}
              </p>
              <p className="truncate font-body text-xs text-muted">
                {agendamento!.barbeiroNome} · {servicos.length}{" "}
                {servicos.length === 1 ? "serviço" : "serviços"}
                {produtos.length > 0 && ` · ${produtos.length} produto(s)`}
              </p>
            </div>
            <span className="shrink-0 font-accent text-lg text-gold-bright">{preco(total)}</span>
          </div>
        </div>

        {erro && (
          <p className="mt-5 rounded-xl border border-off-line bg-off-soft px-4 py-3 font-body text-xs text-off">
            {erro}
          </p>
        )}

        <div className="mt-7 space-y-3">
          {aceitaOnline && (
            <button
              onClick={pagarOnline}
              disabled={enviando}
              className="flex w-full items-center gap-4 rounded-2xl bg-bone px-5 py-4 text-left transition-transform hover:scale-[1.01] disabled:opacity-60"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink/15 text-ink">
                <Icone d={ICONE_ONLINE} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-body text-sm font-semibold text-ink">
                  {enviando ? "Abrindo pagamento…" : `Pagar agora — ${preco(total)}`}
                </span>
                <span className="block font-body text-xs text-ink/70">
                  {meios.length ? meios.join(" ou ") : "Pix ou cartão"} · horário confirmado na hora
                </span>
              </span>
            </button>
          )}

          <button
            onClick={pagarNoLocal}
            disabled={enviando}
            className="flex w-full items-center gap-4 rounded-2xl border border-line-strong px-5 py-4 text-left transition-colors hover:border-bone disabled:opacity-60"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-elev-2 text-bone-dim">
              <Icone d={ICONE_BALCAO} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-body text-sm font-semibold text-bone">
                Pagar no local
              </span>
              <span className="block font-body text-xs text-muted">
                A barbearia precisa confirmar seu horário antes
              </span>
            </span>
          </button>
        </div>

        {aceitaOnline && (
          <p className="mt-6 text-center font-body text-[11px] text-muted">
            Pagamento processado pelo Mercado Pago da {barbearia.nome}.
          </p>
        )}
      </div>
    </>
  );
}

function Icone({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d={d} />
    </svg>
  );
}

function Resultado({
  barbeariaId,
  titulo,
  texto,
  extra,
  sucesso = false,
}: {
  barbeariaId: string;
  titulo: string;
  texto: string;
  extra?: string;
  sucesso?: boolean;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <span
        className={`flex h-16 w-16 items-center justify-center rounded-full font-body text-2xl ${
          sucesso ? "bg-ok text-white" : "bg-bone text-ink"
        }`}
      >
        ✓
      </span>
      <h1 className="mt-6 font-display text-2xl font-bold text-bone">{titulo}</h1>
      <p className="mt-3 font-body text-sm leading-relaxed text-bone-dim">{texto}</p>
      {extra && <p className="mt-2 font-body text-xs text-muted">{extra}</p>}
      <Link
        href={`/loja/${barbeariaId}`}
        className="mt-8 rounded-full border border-line-strong px-6 py-3 font-body text-sm font-semibold text-bone transition-colors hover:border-bone hover:bg-bone hover:text-ink"
      >
        Fazer outro agendamento
      </Link>
    </div>
  );
}

export default function PagamentoPage() {
  return (
    <Suspense fallback={null}>
      <PagamentoConteudo />
    </Suspense>
  );
}
