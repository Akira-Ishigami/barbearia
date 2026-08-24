"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  getBarbearia,
  getMovimentosEstoque,
  getProdutos,
  registrarMovimentoEstoque,
} from "@/lib/db";
import { useSession } from "@/lib/use-session";
import { useAsync } from "@/lib/use-async";
import type { MovimentoEstoque, MovimentoEstoqueTipo, Produto } from "@/lib/types";
import { BotaoUpgrade } from "@/components/BotaoUpgrade";

const ESTOQUE_BAIXO = 5;

export default function EstoquePage() {
  const session = useSession();
  const [produtoId, setProdutoId] = useState("");
  const [tipo, setTipo] = useState<MovimentoEstoqueTipo>("entrada");
  const [quantidade, setQuantidade] = useState("1");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const dono = session?.role === "dono";
  const { dados, recarregar } = useAsync(
    async () => {
      const id = session!.barbeariaId;
      const [barbearia, produtos, movimentos] = await Promise.all([
        getBarbearia(id),
        getProdutos(id),
        getMovimentosEstoque(id),
      ]);
      return { barbearia, produtos, movimentos };
    },
    [session?.barbeariaId],
    { pular: !dono },
  );

  const barbearia = dados?.barbearia;
  const produtos: Produto[] = dados?.produtos ?? [];
  const movimentos: MovimentoEstoque[] = dados?.movimentos ?? [];
  // O select começa no primeiro produto assim que a lista chega.
  const produtoSelecionado = produtoId || produtos[0]?.id || "";

  if (!session || !dono) return null;

  if (barbearia?.plano !== "pro") {
    return (
      <div>
        <p className="font-accent text-xs uppercase tracking-[0.2em] text-gold-bright">
          Estoque
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-bone">
          Controle de estoque
        </h1>
        <div className="mt-8 rounded-2xl border border-gold-bright/30 bg-gold-bright/5 p-8 text-center">
          <p className="font-display text-lg font-semibold text-bone">
            Exclusivo do plano Pro
          </p>
          <p className="mx-auto mt-2 max-w-md font-body text-sm text-bone-dim">
            Registre entradas e saídas de produtos, com alerta de estoque
            baixo, fazendo upgrade pro Pro.
          </p>
          <BotaoUpgrade />
        </div>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const qtd = Number(quantidade);
    if (!produtoSelecionado) {
      setError("Cadastre um produto em Produtos antes de registrar estoque.");
      return;
    }
    if (!Number.isInteger(qtd) || qtd <= 0) {
      setError("Informe uma quantidade válida, maior que zero.");
      return;
    }

    const result = await registrarMovimentoEstoque({
      barbeariaId: session!.barbeariaId,
      produtoId: produtoSelecionado,
      tipo,
      quantidade: qtd,
      motivo: motivo.trim() || (tipo === "entrada" ? "Reposição" : "Venda"),
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setQuantidade("1");
    setMotivo("");
    recarregar();
  }

  if (produtos.length === 0) {
    return (
      <div>
        <p className="font-accent text-xs uppercase tracking-[0.2em] text-gold-bright">
          Estoque
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-bone">
          Controle de estoque
        </h1>
        <div className="mt-8 rounded-2xl border border-dashed border-line-strong bg-ink-elev/30 p-8 text-center">
          <p className="font-body text-sm text-bone-dim">
            Cadastre produtos em{" "}
            <Link href="/painel/produtos" className="text-gold-bright hover:underline">
              Produtos
            </Link>{" "}
            antes de controlar o estoque deles.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="font-accent text-xs uppercase tracking-[0.2em] text-gold-bright">
        Estoque
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-bone">
        Controle de estoque
      </h1>
      <p className="mt-1 max-w-lg font-body text-sm text-bone-dim">
        Registre entradas e saídas com motivo — cada movimento fica no
        histórico.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 grid gap-4 rounded-2xl border border-line bg-ink-elev/60 p-6 sm:grid-cols-2 md:grid-cols-[1.5fr_auto_100px_1.5fr_auto]"
      >
        <label className="block">
          <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
            Produto
          </span>
          <select
            value={produtoSelecionado}
            onChange={(e) => setProdutoId(e.target.value)}
            className="w-full rounded-xl border border-line-strong bg-bone/[0.03] px-3.5 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
          >
            {produtos.map((p) => (
              <option key={p.id} value={p.id} className="bg-ink-elev">
                {p.nome} ({p.estoque} em estoque)
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
            Tipo
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setTipo("entrada")}
              className={`rounded-lg border px-3 py-2.5 font-body text-sm ${
                tipo === "entrada"
                  ? "border-gold-bright/50 bg-gold-bright/10 text-gold-bright"
                  : "border-line text-bone-dim"
              }`}
            >
              Entrada
            </button>
            <button
              type="button"
              onClick={() => setTipo("saida")}
              className={`rounded-lg border px-3 py-2.5 font-body text-sm ${
                tipo === "saida"
                  ? "border-off-line bg-off-soft text-off"
                  : "border-line text-bone-dim"
              }`}
            >
              Saída
            </button>
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
            Qtd.
          </span>
          <input
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            className="w-full rounded-xl border border-line-strong bg-bone/[0.03] px-3.5 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
            Motivo (opcional)
          </span>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={tipo === "entrada" ? "Reposição" : "Venda"}
            className="w-full rounded-xl border border-line-strong bg-bone/[0.03] px-3.5 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
          />
        </label>

        <button
          type="submit"
          className="self-end rounded-xl bg-gold-bright px-5 py-2.5 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.02]"
        >
          Registrar
        </button>
      </form>

      {error && (
        <p className="mt-3 rounded-lg border border-off-line bg-off-soft px-3 py-2 font-body text-xs text-off">
          {error}
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {produtos.map((p) => {
          const baixo = p.estoque > 0 && p.estoque <= ESTOQUE_BAIXO;
          const zerado = p.estoque === 0;
          return (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-line bg-ink-elev/60 px-4 py-3"
            >
              <span className="font-body text-sm text-bone">{p.nome}</span>
              <span
                className={`font-accent text-sm ${
                  zerado ? "text-off" : baixo ? "text-warn" : "text-gold-bright"
                }`}
              >
                {p.estoque}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-8">
        <p className="font-display text-lg font-semibold text-bone">
          Histórico de movimentações
        </p>
        <div className="mt-4 space-y-2">
          {movimentos.length === 0 && (
            <p className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center font-body text-sm text-bone-dim">
              Nenhuma movimentação registrada ainda.
            </p>
          )}
          {movimentos.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-ink-elev/40 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-1 font-body text-[11px] font-semibold ${
                    m.tipo === "entrada"
                      ? "bg-gold-bright/10 text-gold-bright"
                      : "bg-off-soft text-off"
                  }`}
                >
                  {m.tipo === "entrada" ? "+ Entrada" : "− Saída"}
                </span>
                <span className="font-body text-sm text-bone">{m.produtoNome}</span>
                <span className="font-body text-xs text-bone-dim">{m.motivo}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-accent text-sm text-bone">{m.quantidade} un.</span>
                <span className="font-body text-xs text-muted">
                  {new Date(m.data).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
