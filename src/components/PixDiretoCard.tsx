"use client";

import { useState, type FormEvent } from "react";
import { useAsync } from "@/lib/use-async";
import { cabecalhosAutenticados } from "@/lib/db";
import { TIPOS_CHAVE, type TipoChavePix } from "@/lib/pix";

/**
 * Chave Pix da barbearia, pra quem não usa Mercado Pago.
 *
 * O que essa opção resolve: barbearia pequena não quer (ou não consegue)
 * abrir conta de vendedor, mas já tem Pix. Aqui o cliente vê o código com
 * o valor exato do pedido e o dinheiro cai direto na conta do dono, sem
 * intermediário e sem taxa.
 *
 * O que ela NÃO resolve, e a tela diz isso com todas as letras: não existe
 * confirmação automática. Pix na chave não tem webhook — quem confere o
 * extrato e confirma o horário é o dono.
 */

interface Conta {
  tipo: TipoChavePix;
  chave: string;
  beneficiario: string;
  cidade: string;
  ativo: boolean;
}

export function PixDiretoCard() {
  const { dados, carregando, recarregar } = useAsync<{
    configurada: boolean;
    conta: Conta | null;
  }>(async () => {
    const r = await fetch("/api/pix/conta", { headers: await cabecalhosAutenticados() });
    if (!r.ok) throw new Error("Falha ao carregar.");
    return r.json();
  }, []);

  const [editando, setEditando] = useState(false);
  const [tipo, setTipo] = useState<TipoChavePix>("cpf");
  const [chave, setChave] = useState("");
  const [beneficiario, setBeneficiario] = useState("");
  const [cidade, setCidade] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const conta = dados?.conta ?? null;

  function abrirEdicao() {
    if (conta) {
      setTipo(conta.tipo);
      // A chave volta formatada; o servidor normaliza de novo ao salvar.
      setChave(conta.chave);
      setBeneficiario(conta.beneficiario);
      setCidade(conta.cidade);
    }
    setErro(null);
    setEditando(true);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const r = await fetch("/api/pix/conta", {
        method: "POST",
        headers: await cabecalhosAutenticados(),
        body: JSON.stringify({ tipo, chave, beneficiario, cidade }),
      });
      const c = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(c.erro ?? "Não foi possível salvar.");
      } else {
        setEditando(false);
        recarregar();
      }
    } catch {
      setErro("Falha de conexão.");
    }
    setSalvando(false);
  }

  async function remover() {
    if (!window.confirm("Tirar o Pix da sua página? Os clientes deixam de ver essa opção.")) {
      return;
    }
    await fetch("/api/pix/conta", {
      method: "DELETE",
      headers: await cabecalhosAutenticados(),
    });
    recarregar();
  }

  const exemplo = TIPOS_CHAVE.find((t) => t.id === tipo)?.exemplo ?? "";

  return (
    <div className="mt-6 max-w-2xl rounded-2xl border border-line bg-ink-elev p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold text-bone">
            Receber direto no seu Pix
          </p>
          <p className="mt-1 max-w-lg font-body text-sm text-bone-dim">
            Sem Mercado Pago e sem taxa: o cliente paga na sua chave com o valor do
            pedido já preenchido.
          </p>
        </div>
        {conta?.ativo && !editando && (
          <span className="shrink-0 rounded-full border border-ok-line bg-ok-soft px-3 py-1 font-body text-xs font-semibold text-ok">
            Ativo
          </span>
        )}
      </div>

      {carregando && <p className="mt-4 font-body text-sm text-muted">Carregando…</p>}

      {!carregando && !editando && (
        <>
          {conta?.ativo ? (
            <div className="mt-4">
              <div className="rounded-xl border border-line bg-bone/[0.02] px-4 py-3">
                <p className="font-body text-xs uppercase tracking-wide text-muted">
                  {TIPOS_CHAVE.find((t) => t.id === conta.tipo)?.label ?? conta.tipo}
                </p>
                <p className="font-body text-sm text-bone">{conta.chave}</p>
                <p className="mt-1 font-body text-xs text-muted">
                  {conta.beneficiario} · {conta.cidade}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={abrirEdicao}
                  className="rounded-full border border-line-strong px-5 py-2.5 font-body text-sm text-bone-dim transition-colors hover:border-gold-bright/40 hover:text-gold-bright"
                >
                  Trocar chave
                </button>
                <button
                  onClick={remover}
                  className="rounded-full border border-line-strong px-5 py-2.5 font-body text-sm text-bone-dim transition-colors hover:border-off-line hover:text-off"
                >
                  Remover
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={abrirEdicao}
              className="mt-4 rounded-full bg-gold-bright px-6 py-3 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.02]"
            >
              Cadastrar minha chave Pix
            </button>
          )}
        </>
      )}

      {editando && (
        <form onSubmit={salvar} className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
            <label className="block">
              <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
                Tipo
              </span>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoChavePix)}
                className="w-full rounded-xl border border-line-strong bg-ink-elev-2 px-3.5 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
              >
                {TIPOS_CHAVE.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
                Chave
              </span>
              <input
                value={chave}
                onChange={(e) => setChave(e.target.value)}
                placeholder={exemplo}
                className="w-full rounded-xl border border-line-strong bg-bone/[0.03] px-3.5 py-2.5 font-body text-sm text-bone outline-none placeholder:text-muted focus:border-gold-bright"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
                Nome de quem recebe
              </span>
              <input
                value={beneficiario}
                onChange={(e) => setBeneficiario(e.target.value)}
                maxLength={25}
                placeholder="Como está na conta do banco"
                className="w-full rounded-xl border border-line-strong bg-bone/[0.03] px-3.5 py-2.5 font-body text-sm text-bone outline-none placeholder:text-muted focus:border-gold-bright"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
                Cidade
              </span>
              <input
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                maxLength={15}
                placeholder="São Paulo"
                className="w-full rounded-xl border border-line-strong bg-bone/[0.03] px-3.5 py-2.5 font-body text-sm text-bone outline-none placeholder:text-muted focus:border-gold-bright"
              />
            </label>
          </div>

          <p className="font-body text-xs text-muted">
            Nome e cidade aparecem no app do banco de quem paga — é assim que o
            cliente confirma que está pagando pra você.
          </p>

          {erro && (
            <p className="rounded-lg border border-off-line bg-off-soft px-3 py-2 font-body text-xs text-off">
              {erro}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={salvando}
              className="rounded-full bg-gold-bright px-6 py-2.5 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.02] disabled:opacity-60"
            >
              {salvando ? "Salvando…" : "Salvar chave"}
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="rounded-full border border-line-strong px-5 py-2.5 font-body text-sm text-bone-dim hover:text-bone"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <p className="mt-6 rounded-xl border border-warn-line bg-warn-soft px-4 py-3 font-body text-xs text-warn">
        <strong>Importante:</strong> o Pix na chave não avisa o sistema quando o
        dinheiro cai. O agendamento entra como <strong>pendente</strong> e você confirma
        na agenda depois de ver o valor no extrato. Quem quer confirmação automática
        precisa do Mercado Pago.
      </p>
    </div>
  );
}
