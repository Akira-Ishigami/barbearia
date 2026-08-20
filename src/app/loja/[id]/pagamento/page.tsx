"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLoja } from "@/lib/loja-context";
import { cartTotal, clearCart, useCart } from "@/lib/cart";
import { criarPedido } from "@/lib/mock-db";
import { generateTimeSlots } from "@/lib/date";
import type { MetodoPagamento } from "@/lib/types";

type Escolha = MetodoPagamento | "local";

function preco(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

/** Código Pix de demonstração — o protótipo ainda não fala com um provedor real. */
function gerarCodigoPix(barbeariaNome: string, valor: number) {
  const chave = barbeariaNome.toLowerCase().replace(/[^a-z]/g, "").slice(0, 12);
  const centavos = Math.round(valor * 100);
  return `00020126580014BR.GOV.BCB.PIX0136${chave}-navalha52040000530398654${String(centavos).padStart(6, "0")}5802BR6009SAO PAULO62070503***6304DEMO`;
}

const ICONE_PIX =
  "M12 2 2 12l10 10 10-10L12 2Zm0 5.5L16.5 12 12 16.5 7.5 12 12 7.5Z";
const ICONE_CARTAO =
  "M2 8h20M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM6 15h4";
const ICONE_BALCAO =
  "M3 21h18M5 21V10l7-5 7 5v11M10 21v-6h4v6";

export default function PagamentoPage() {
  const router = useRouter();
  const { barbearia } = useLoja();
  const cart = useCart(barbearia?.id ?? "");

  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [cartaoNumero, setCartaoNumero] = useState("");
  const [cartaoNome, setCartaoNome] = useState("");
  const [cartaoValidade, setCartaoValidade] = useState("");
  const [cartaoCvv, setCartaoCvv] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmado, setConfirmado] = useState<{
    metodo: Escolha;
    temProdutos: boolean;
  } | null>(null);

  if (!barbearia) return null;

  const { cliente, agendamento, servicos, produtos } = cart;
  const incompleto = servicos.length === 0 || !cliente || !agendamento;

  if (incompleto && !confirmado) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="font-display text-xl font-semibold text-bone">Faltam algumas coisas</p>
        <p className="mt-2 font-body text-sm text-bone-dim">
          Volte pro carrinho pra escolher o horário e preencher seus dados antes de pagar.
        </p>
        <Link
          href={`/loja/${barbearia.id}/carrinho`}
          className="mt-8 inline-block rounded-full bg-bone px-7 py-3.5 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.03]"
        >
          Voltar pro carrinho
        </Link>
      </div>
    );
  }

  const total = cartTotal(cart);
  const todosHorarios = generateTimeSlots(barbearia.horarioAbertura, barbearia.horarioFechamento);
  const idxInicio = agendamento ? todosHorarios.indexOf(agendamento.horaInicio) : -1;
  const horaFim =
    idxInicio >= 0
      ? (todosHorarios[idxInicio + servicos.length] ?? barbearia.horarioFechamento)
      : "";
  const codigoPix = gerarCodigoPix(barbearia.nome, total);

  function validarCartao(): string | null {
    if (cartaoNumero.replace(/\D/g, "").length < 16) return "Informe os 16 dígitos do cartão.";
    if (cartaoNome.trim().length < 3) return "Informe o nome impresso no cartão.";
    if (!/^\d{2}\/\d{2}$/.test(cartaoValidade)) return "Validade no formato MM/AA.";
    if (cartaoCvv.replace(/\D/g, "").length < 3) return "Informe o CVV.";
    return null;
  }

  function finalizar(metodo: Escolha) {
    if (!cliente || !agendamento || !barbearia) return;

    if (metodo === "cartao") {
      const problema = validarCartao();
      if (problema) {
        setErro(problema);
        return;
      }
    }

    setErro(null);
    setEnviando(true);

    const result = criarPedido({
      barbeariaId: barbearia.id,
      barbeiroId: agendamento.barbeiroId,
      clienteNome: cliente.nome,
      clienteTelefone: cliente.telefone,
      clienteEmail: cliente.email,
      data: agendamento.data,
      horaInicio: agendamento.horaInicio,
      servicos: servicos.map((s) => ({
        id: s.servicoId,
        nome: s.nome,
        preco: s.preco,
        duracaoMin: s.duracaoMin,
      })),
      produtos: produtos.map((p) => ({
        id: p.produtoId,
        nome: p.nome,
        preco: p.preco,
        quantidade: p.quantidade,
      })),
      formaPagamento: metodo === "local" ? "local" : "online",
      metodoPagamento: metodo === "local" ? undefined : metodo,
    });

    setEnviando(false);

    if (!result.ok) {
      setErro(result.error);
      return;
    }

    const temProdutos = produtos.length > 0;
    clearCart(barbearia.id);
    setConfirmado({ metodo, temProdutos });
  }

  async function copiarPix() {
    try {
      await navigator.clipboard.writeText(codigoPix);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErro("Não foi possível copiar. Selecione o código manualmente.");
    }
  }

  // ── CONFIRMAÇÃO ──
  if (confirmado) {
    const pago = confirmado.metodo !== "local";
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <span
          className={`flex h-16 w-16 items-center justify-center rounded-full font-body text-2xl ${
            pago ? "bg-ok text-white" : "bg-bone text-ink"
          }`}
        >
          ✓
        </span>
        <h1 className="mt-6 font-display text-2xl font-bold text-bone">
          {pago ? "Pagamento aprovado!" : "Agendamento enviado!"}
        </h1>
        <p className="mt-3 font-body text-sm leading-relaxed text-bone-dim">
          {pago
            ? `Recebemos seu pagamento via ${confirmado.metodo === "pix" ? "Pix" : "cartão"}. Seu horário está garantido — te esperamos!`
            : "A barbearia vai confirmar seu horário. Você paga no balcão no dia."}
        </p>
        {confirmado.temProdutos && (
          <p className="mt-2 font-body text-xs text-muted">
            Seus produtos ficam separados pra retirada no dia da visita.
          </p>
        )}
        <Link
          href={`/loja/${barbearia.id}`}
          className="mt-8 rounded-full border border-line-strong px-6 py-3 font-body text-sm font-semibold text-bone transition-colors hover:border-bone hover:bg-bone hover:text-ink"
        >
          Fazer outro agendamento
        </Link>
      </div>
    );
  }

  // O pagamento online só existe se a barbearia tiver conectado a conta dela
  // do Mercado Pago (e deixado o método ligado no painel).
  const mp = barbearia.mercadoPago;
  const parcelas = mp?.parcelasMax ?? 1;

  const OPCOES: { id: Escolha; titulo: string; desc: string; icone: string; tag?: string }[] = [
    ...(mp?.aceitaPix
      ? [
          {
            id: "pix" as const,
            titulo: "Pix",
            desc: "Aprovação na hora, sem taxa",
            icone: ICONE_PIX,
            tag: "Mais rápido",
          },
        ]
      : []),
    ...(mp?.aceitaCartao
      ? [
          {
            id: "cartao" as const,
            titulo: "Cartão de crédito",
            desc:
              parcelas > 1
                ? `Em até ${parcelas}x · horário confirmado na hora`
                : "Horário confirmado na hora",
            icone: ICONE_CARTAO,
          },
        ]
      : []),
    {
      id: "local",
      titulo: "Pagar no local",
      desc: "A barbearia precisa confirmar antes",
      icone: ICONE_BALCAO,
    },
  ];

  const soLocal = OPCOES.length === 1;

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-6 py-3.5">
          <button
            onClick={() => router.push(`/loja/${barbearia.id}/carrinho`)}
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
          {soLocal ? "Quase lá!" : "Como você prefere pagar?"}
        </h1>
        <p className="mt-1.5 font-body text-sm text-bone-dim">
          {soLocal
            ? "Esta barbearia recebe no balcão. É só enviar o pedido e aguardar a confirmação."
            : "Pagando agora, seu horário fica garantido na hora."}
        </p>

        {/* recap */}
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

        {/* opções */}
        <div className="mt-7 space-y-3">
          {OPCOES.map((op) => {
            const ativo = escolha === op.id;
            return (
              <div
                key={op.id}
                className={`overflow-hidden rounded-2xl border transition-colors ${
                  ativo ? "border-bone bg-ink-elev" : "border-line bg-ink-elev"
                }`}
              >
                <button
                  onClick={() => {
                    setEscolha(op.id);
                    setErro(null);
                  }}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left"
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                      ativo ? "bg-bone text-ink" : "bg-ink-elev-2 text-bone-dim"
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                    >
                      <path d={op.icone} />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-body text-sm font-semibold text-bone">{op.titulo}</span>
                      {op.tag && (
                        <span className="rounded-full bg-ok-soft px-2 py-0.5 font-body text-[10px] font-semibold text-ok">
                          {op.tag}
                        </span>
                      )}
                    </span>
                    <span className="block font-body text-xs text-muted">{op.desc}</span>
                  </span>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      ativo ? "border-bone bg-bone text-ink" : "border-line-strong"
                    }`}
                  >
                    {ativo && <span className="font-body text-[10px]">✓</span>}
                  </span>
                </button>

                {/* PIX */}
                {ativo && op.id === "pix" && (
                  <div className="border-t border-line px-5 py-5">
                    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                      <div
                        aria-hidden
                        className="grid h-32 w-32 shrink-0 grid-cols-8 gap-0.5 rounded-xl border border-line-strong bg-white p-2"
                      >
                        {/* Placeholder visual de QR — determinístico a partir do código. */}
                        {Array.from({ length: 64 }, (_, i) => (
                          <span
                            key={i}
                            className={
                              codigoPix.charCodeAt(i % codigoPix.length) % 2 === 0
                                ? "bg-[#111214]"
                                : "bg-transparent"
                            }
                          />
                        ))}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-body text-sm font-medium text-bone">
                          Escaneie o QR ou copie o código
                        </p>
                        <p className="mt-1 font-body text-xs text-muted">
                          Valor: <span className="font-accent text-gold-bright">{preco(total)}</span>
                        </p>
                        <p className="mt-3 break-all rounded-lg border border-line bg-ink-elev-2 px-3 py-2 font-accent text-[10px] leading-relaxed text-bone-dim">
                          {codigoPix.slice(0, 72)}…
                        </p>
                        <button
                          onClick={copiarPix}
                          className="mt-2 rounded-lg border border-line-strong px-3.5 py-2 font-body text-xs font-medium text-bone transition-colors hover:border-bone"
                        >
                          {copiado ? "Código copiado ✓" : "Copiar código Pix"}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => finalizar("pix")}
                      disabled={enviando}
                      className="mt-5 w-full rounded-xl bg-bone py-3.5 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.01] disabled:opacity-60"
                    >
                      Já paguei — confirmar {preco(total)}
                    </button>
                    <p className="mt-2 text-center font-body text-[11px] text-muted">
                      Simulação: nesta versão o pagamento não é cobrado de verdade.
                    </p>
                  </div>
                )}

                {/* CARTÃO */}
                {ativo && op.id === "cartao" && (
                  <div className="border-t border-line px-5 py-5">
                    <div className="space-y-3">
                      <label className="block">
                        <span className="mb-1.5 block font-body text-xs font-medium text-bone-dim">
                          Número do cartão
                        </span>
                        <input
                          inputMode="numeric"
                          value={cartaoNumero}
                          onChange={(e) =>
                            setCartaoNumero(
                              e.target.value
                                .replace(/\D/g, "")
                                .slice(0, 16)
                                .replace(/(\d{4})(?=\d)/g, "$1 "),
                            )
                          }
                          placeholder="0000 0000 0000 0000"
                          className="w-full rounded-xl border border-line-strong bg-ink px-4 py-3 font-accent text-sm text-bone outline-none transition-colors focus:border-bone"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block font-body text-xs font-medium text-bone-dim">
                          Nome impresso no cartão
                        </span>
                        <input
                          value={cartaoNome}
                          onChange={(e) => setCartaoNome(e.target.value.toUpperCase())}
                          placeholder="COMO ESTÁ NO CARTÃO"
                          className="w-full rounded-xl border border-line-strong bg-ink px-4 py-3 font-body text-sm text-bone outline-none transition-colors focus:border-bone"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                          <span className="mb-1.5 block font-body text-xs font-medium text-bone-dim">
                            Validade
                          </span>
                          <input
                            inputMode="numeric"
                            value={cartaoValidade}
                            onChange={(e) => {
                              const d = e.target.value.replace(/\D/g, "").slice(0, 4);
                              setCartaoValidade(
                                d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d,
                              );
                            }}
                            placeholder="MM/AA"
                            className="w-full rounded-xl border border-line-strong bg-ink px-4 py-3 font-accent text-sm text-bone outline-none transition-colors focus:border-bone"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block font-body text-xs font-medium text-bone-dim">
                            CVV
                          </span>
                          <input
                            inputMode="numeric"
                            value={cartaoCvv}
                            onChange={(e) =>
                              setCartaoCvv(e.target.value.replace(/\D/g, "").slice(0, 4))
                            }
                            placeholder="123"
                            className="w-full rounded-xl border border-line-strong bg-ink px-4 py-3 font-accent text-sm text-bone outline-none transition-colors focus:border-bone"
                          />
                        </label>
                      </div>
                    </div>

                    {parcelas > 1 && (
                      <p className="mt-3 font-body text-xs text-muted">
                        Ou em até {parcelas}x de{" "}
                        <span className="font-accent text-bone-dim">
                          {preco(total / parcelas)}
                        </span>{" "}
                        sem juros.
                      </p>
                    )}

                    <button
                      onClick={() => finalizar("cartao")}
                      disabled={enviando}
                      className="mt-5 w-full rounded-xl bg-bone py-3.5 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.01] disabled:opacity-60"
                    >
                      Pagar {preco(total)}
                    </button>
                    <p className="mt-2 text-center font-body text-[11px] text-muted">
                      Simulação: nesta versão o cartão não é cobrado de verdade.
                    </p>
                  </div>
                )}

                {/* NO LOCAL */}
                {ativo && op.id === "local" && (
                  <div className="border-t border-line px-5 py-5">
                    <p className="font-body text-xs text-bone-dim">
                      Seu horário fica reservado como <span className="text-warn">pendente</span> até
                      a barbearia confirmar. Você paga no balcão no dia do atendimento.
                    </p>
                    <button
                      onClick={() => finalizar("local")}
                      disabled={enviando}
                      className="mt-4 w-full rounded-xl border border-line-strong py-3.5 font-body text-sm font-semibold text-bone transition-colors hover:border-bone disabled:opacity-60"
                    >
                      Enviar pedido de agendamento
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {erro && (
          <p className="mt-5 rounded-xl border border-off-line bg-off-soft px-4 py-3 font-body text-xs text-off">
            {erro}
          </p>
        )}

        {!escolha && !soLocal && (
          <p className="mt-5 text-center font-body text-xs text-muted">
            Escolha uma forma de pagamento para continuar.
          </p>
        )}

        {!soLocal && mp && (
          <p className="mt-6 text-center font-body text-[11px] text-muted">
            Pagamento processado pelo Mercado Pago da {barbearia.nome}.
          </p>
        )}
      </div>
    </>
  );
}
