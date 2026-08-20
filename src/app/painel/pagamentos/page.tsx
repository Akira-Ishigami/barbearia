"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  atualizarPreferenciasMP,
  conectarMercadoPago,
  desconectarMercadoPago,
  getBarbeariaById,
} from "@/lib/mock-db";
import { useSession } from "@/lib/use-session";
import type { AmbienteMP } from "@/lib/types";

const PARCELAS = [1, 2, 3, 6, 10, 12];

/** Mostra só o começo e o fim da credencial — o resto vira ponto. */
function mascarar(valor: string) {
  if (valor.length <= 14) return valor;
  return `${valor.slice(0, 10)}${"•".repeat(10)}${valor.slice(-4)}`;
}

function dataLonga(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function PagamentosPage() {
  const session = useSession();
  const [, forceRefresh] = useState(0);
  const [abrindoForm, setAbrindoForm] = useState(false);
  const [apelido, setApelido] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [ambiente, setAmbiente] = useState<AmbienteMP>("teste");
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  if (!session || session.role !== "dono") return null;

  const barbearia = getBarbeariaById(session.barbeariaId);
  if (!barbearia) return null;

  const conta = barbearia.mercadoPago;

  function handleConectar(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setErro(null);

    const result = conectarMercadoPago({
      barbeariaId: session.barbeariaId,
      apelido,
      publicKey,
      accessToken,
      ambiente,
    });

    if (!result.ok) {
      setErro(result.error);
      return;
    }

    setApelido("");
    setPublicKey("");
    setAccessToken("");
    setAbrindoForm(false);
    setSalvo(true);
    forceRefresh((k) => k + 1);
  }

  function handleDesconectar() {
    if (!session) return;
    desconectarMercadoPago(session.barbeariaId);
    setSalvo(false);
    forceRefresh((k) => k + 1);
  }

  function mudarPreferencia(patch: Parameters<typeof atualizarPreferenciasMP>[1]) {
    if (!session) return;
    atualizarPreferenciasMP(session.barbeariaId, patch);
    forceRefresh((k) => k + 1);
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

      {/* ---------- CONECTADO ---------- */}
      {conta ? (
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
                  <p className="font-body text-sm text-bone-dim">{conta.apelido}</p>
                  <p className="mt-0.5 font-body text-xs text-muted">
                    Conectada em {dataLonga(conta.conectadoEm)}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 font-body text-xs font-semibold ${
                  conta.ambiente === "producao"
                    ? "bg-ok text-white"
                    : "bg-warn-soft text-warn"
                }`}
              >
                {conta.ambiente === "producao" ? "Produção" : "Modo teste"}
              </span>
            </div>

            {conta.ambiente === "teste" && (
              <p className="mt-4 rounded-xl border border-warn-line bg-warn-soft px-4 py-3 font-body text-xs text-warn">
                Em modo teste nenhuma cobrança é real. Troque pelas credenciais de produção
                quando for começar a receber de verdade.
              </p>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Public Key", conta.publicKey],
                ["Access Token", conta.accessToken],
              ].map(([label, valor]) => (
                <div key={label} className="rounded-xl border border-line bg-ink-elev px-4 py-3">
                  <p className="font-body text-[11px] uppercase tracking-wide text-muted">
                    {label}
                  </p>
                  <p className="mt-1 truncate font-accent text-xs text-bone-dim">
                    {mascarar(valor)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* preferências de cobrança */}
          <div className="rounded-2xl border border-line bg-ink-elev/60 p-6">
            <p className="font-display text-lg font-semibold text-bone">
              O que aceitar do cliente
            </p>
            <p className="mt-1 font-body text-xs text-bone-dim">
              Desmarcando os dois, sua página passa a oferecer só pagamento no local.
            </p>

            <div className="mt-4 space-y-2.5">
              {(
                [
                  ["aceitaPix", "Pix", "Cai na hora, sem taxa de cartão"],
                  ["aceitaCartao", "Cartão de crédito", "Aceita parcelamento"],
                ] as const
              ).map(([campo, titulo, desc]) => {
                const ativo = conta[campo];
                return (
                  <button
                    key={campo}
                    onClick={() => mudarPreferencia({ [campo]: !ativo })}
                    className={`flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-colors ${
                      ativo ? "border-ok-line bg-ok-soft" : "border-line hover:border-line-strong"
                    }`}
                  >
                    <span>
                      <span className="block font-body text-sm font-medium text-bone">
                        {titulo}
                      </span>
                      <span className="block font-body text-xs text-muted">{desc}</span>
                    </span>
                    <span
                      className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                        ativo ? "bg-ok" : "bg-ink-elev-2"
                      }`}
                    >
                      <span
                        className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          ativo ? "translate-x-5" : ""
                        }`}
                      />
                    </span>
                  </button>
                );
              })}
            </div>

            {conta.aceitaCartao && (
              <div className="mt-5">
                <p className="font-body text-xs font-medium uppercase tracking-wide text-muted">
                  Parcelar em até
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PARCELAS.map((n) => (
                    <button
                      key={n}
                      onClick={() => mudarPreferencia({ parcelasMax: n })}
                      className={`rounded-lg border px-3.5 py-1.5 font-body text-xs transition-colors ${
                        conta.parcelasMax === n
                          ? "border-gold-bright bg-gold-bright/10 text-gold-bright"
                          : "border-line-strong text-bone-dim hover:border-gold-bright/40"
                      }`}
                    >
                      {n}x
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/loja/${barbearia.id}`}
              target="_blank"
              className="rounded-full border border-line-strong px-5 py-2.5 font-body text-sm font-semibold text-bone-dim transition-colors hover:border-gold-bright/40 hover:text-gold-bright"
            >
              Ver como o cliente paga ↗
            </Link>
            <button
              onClick={handleDesconectar}
              className="rounded-full border border-line-strong px-5 py-2.5 font-body text-sm text-bone-dim transition-colors hover:border-off-line hover:text-off"
            >
              Desconectar conta
            </button>
          </div>
        </div>
      ) : (
        /* ---------- NÃO CONECTADO ---------- */
        <div className="mt-6 max-w-2xl">
          <div className="rounded-2xl border border-warn-line bg-warn-soft p-6">
            <p className="font-display text-lg font-semibold text-bone">
              Nenhuma conta conectada
            </p>
            <p className="mt-1 max-w-lg font-body text-sm text-bone-dim">
              Sem uma conta do Mercado Pago, sua página pública só oferece{" "}
              <strong className="text-bone">pagar no local</strong> — e você precisa confirmar
              cada agendamento na mão.
            </p>
            {!abrindoForm && (
              <button
                onClick={() => setAbrindoForm(true)}
                className="mt-5 rounded-full bg-gold-bright px-6 py-3 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.02]"
              >
                Conectar minha conta
              </button>
            )}
          </div>

          {abrindoForm && (
            <form
              onSubmit={handleConectar}
              className="mt-4 space-y-5 rounded-2xl border border-line bg-ink-elev/60 p-6"
            >
              <div>
                <p className="font-display text-lg font-semibold text-bone">
                  Credenciais do Mercado Pago
                </p>
                <p className="mt-1 font-body text-xs text-bone-dim">
                  Pegue em{" "}
                  <a
                    href="https://www.mercadopago.com.br/developers/panel/app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold-bright hover:underline"
                  >
                    mercadopago.com.br/developers
                  </a>{" "}
                  → Suas integrações → Credenciais.
                </p>
              </div>

              <div>
                <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
                  Ambiente
                </span>
                <div className="flex gap-2">
                  {(
                    [
                      ["teste", "Teste", "Pra experimentar sem cobrar"],
                      ["producao", "Produção", "Cobrança real no cliente"],
                    ] as const
                  ).map(([valor, titulo, desc]) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setAmbiente(valor)}
                      className={`flex-1 rounded-xl border px-4 py-2.5 text-left font-body text-sm transition-colors ${
                        ambiente === valor
                          ? "border-gold-bright bg-gold-bright/10 text-gold-bright"
                          : "border-line-strong text-bone-dim hover:border-gold-bright/40"
                      }`}
                    >
                      {titulo}
                      <span className="block font-body text-[11px] text-muted">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
                  E-mail da conta Mercado Pago
                </span>
                <input
                  value={apelido}
                  onChange={(e) => setApelido(e.target.value)}
                  placeholder="voce@email.com"
                  className="w-full rounded-xl border border-line-strong bg-bone/[0.03] px-4 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
                  Public Key
                </span>
                <input
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                  placeholder={ambiente === "teste" ? "TEST-..." : "APP_USR-..."}
                  className="w-full rounded-xl border border-line-strong bg-bone/[0.03] px-4 py-2.5 font-accent text-sm text-bone outline-none focus:border-gold-bright"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
                  Access Token
                </span>
                <input
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder={ambiente === "teste" ? "TEST-..." : "APP_USR-..."}
                  className="w-full rounded-xl border border-line-strong bg-bone/[0.03] px-4 py-2.5 font-accent text-sm text-bone outline-none focus:border-gold-bright"
                />
              </label>

              {erro && (
                <p className="rounded-lg border border-off-line bg-off-soft px-3 py-2 font-body text-xs text-off">
                  {erro}
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="rounded-full bg-gold-bright px-6 py-3 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.02]"
                >
                  Conectar conta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAbrindoForm(false);
                    setErro(null);
                  }}
                  className="rounded-full border border-line-strong px-6 py-3 font-body text-sm text-bone-dim hover:text-bone"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {salvo && (
        <p className="mt-4 max-w-2xl rounded-lg border border-ok-line bg-ok-soft px-3 py-2 font-body text-xs text-ok">
          Conta conectada. Sua página pública já aceita pagamento online.
        </p>
      )}

      <p className="mt-8 max-w-2xl rounded-xl border border-line bg-ink-elev/40 px-4 py-3 font-body text-xs text-muted">
        <strong className="text-bone-dim">Sobre esta versão:</strong> as credenciais ficam
        salvas só no seu navegador e nenhuma cobrança é feita de verdade. Numa versão de
        produção a conexão seria pelo OAuth do Mercado Pago, com o Access Token guardado no
        servidor — nunca no navegador.
      </p>
    </div>
  );
}
