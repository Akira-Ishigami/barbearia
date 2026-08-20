"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  addProduto,
  getBarbeariaById,
  getProdutos,
  removeProduto,
  updateProduto,
} from "@/lib/mock-db";
import { parseMoney } from "@/lib/format";
import { useSession } from "@/lib/use-session";
import { CategoriaField } from "@/components/CategoriaField";
import { PRODUTO_CATEGORIAS_PRESET, type Produto } from "@/lib/types";

const ESTOQUE_BAIXO = 5;
const MAX_FOTO_BYTES = 800_000;

export default function ProdutosPage() {
  const session = useSession();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState(PRODUTO_CATEGORIAS_PRESET[0] as string);
  const [preco, setPreco] = useState("");
  const [estoque, setEstoque] = useState("10");
  const [foto, setFoto] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const barbearia = session ? getBarbeariaById(session.barbeariaId) : undefined;

  if (session && session.role === "dono" && !loaded) {
    setProdutos(getProdutos(session.barbeariaId));
    setLoaded(true);
  }

  if (!session || session.role !== "dono") return null;

  if (barbearia?.plano !== "pro") {
    return (
      <div>
        <p className="font-accent text-xs uppercase tracking-[0.2em] text-gold-bright">
          Produtos
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-bone">
          Loja de produtos
        </h1>
        <div className="mt-8 rounded-2xl border border-gold-bright/30 bg-gold-bright/5 p-8 text-center">
          <p className="font-display text-lg font-semibold text-bone">
            Exclusivo do plano Pro
          </p>
          <p className="mx-auto mt-2 max-w-md font-body text-sm text-bone-dim">
            A loja de produtos com controle de estoque faz parte do plano
            Pro. Faça upgrade pra vender produtos direto na sua página
            pública.
          </p>
          <Link
            href="/#planos"
            className="mt-5 inline-block rounded-full bg-gold-bright px-6 py-3 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.03]"
          >
            Ver plano Pro
          </Link>
        </div>
      </div>
    );
  }

  function handleFoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FOTO_BYTES) {
      setError("A foto precisa ter no máximo 800KB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = () => setFoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!session || session.role !== "dono") return;
    if (!nome.trim()) return;

    const precoNum = parseMoney(preco);
    if (precoNum === null) {
      setError("Informe um preço válido, maior que zero.");
      return;
    }

    addProduto({
      barbeariaId: session.barbeariaId,
      nome: nome.trim(),
      categoria: categoria.trim() || "Outros",
      preco: precoNum,
      estoque: Math.max(0, Number(estoque) || 0),
      foto,
      ativo: true,
    });

    setProdutos(getProdutos(session.barbeariaId));
    setNome("");
    setPreco("");
    setEstoque("10");
    setCategoria(PRODUTO_CATEGORIAS_PRESET[0]);
    setFoto(undefined);
    setFormKey((k) => k + 1);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function ajustarEstoque(p: Produto, delta: number) {
    const novoEstoque = Math.max(0, p.estoque + delta);
    updateProduto(p.id, { estoque: novoEstoque });
    setProdutos(getProdutos(session!.barbeariaId));
  }

  function excluir(id: string) {
    removeProduto(id);
    setProdutos(getProdutos(session!.barbeariaId));
  }

  const categoriasExistentes = Array.from(new Set(produtos.map((p) => p.categoria)));
  const porCategoria = categoriasExistentes.map((cat) => ({
    categoria: cat,
    itens: produtos.filter((p) => p.categoria === cat),
  }));

  return (
    <div>
      <p className="font-accent text-xs uppercase tracking-[0.2em] text-gold-bright">
        Produtos
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-bone">
        Loja de produtos
      </h1>
      <p className="mt-1 max-w-lg font-body text-sm text-bone-dim">
        Organizados por categoria, com foto e controle de estoque.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4 rounded-2xl border border-line bg-ink-elev/60 p-6"
      >
        <div>
          <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
            Foto (opcional)
          </span>
          <label className="flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-line-strong bg-white/[0.03] font-body text-[11px] text-muted hover:border-gold-bright/50">
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto} alt="" className="h-full w-full object-cover" />
            ) : (
              "Foto"
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFoto}
              className="hidden"
            />
          </label>
          {foto && (
            <button
              type="button"
              onClick={() => {
                setFoto(undefined);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="mt-1.5 font-body text-[11px] text-rose-300 hover:underline"
            >
              remover foto
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
              Nome do produto
            </span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Pomada modeladora"
              className="w-full rounded-xl border border-line-strong bg-white/[0.03] px-3.5 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
            />
          </label>
          <CategoriaField
            key={formKey}
            presets={PRODUTO_CATEGORIAS_PRESET}
            value={categoria}
            onChange={setCategoria}
          />
          <label className="block">
            <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
              Preço (R$)
            </span>
            <input
              value={preco}
              onChange={(e) => setPreco(e.target.value.replace(/[^0-9,]/g, ""))}
              placeholder="39,90"
              inputMode="decimal"
              className="w-full rounded-xl border border-line-strong bg-white/[0.03] px-3.5 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
              Estoque inicial
            </span>
            <input
              value={estoque}
              onChange={(e) => setEstoque(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              className="w-full rounded-xl border border-line-strong bg-white/[0.03] px-3.5 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
            />
          </label>
        </div>

        <button
          type="submit"
          className="rounded-xl bg-gold-bright px-5 py-2.5 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.02]"
        >
          Adicionar produto
        </button>
      </form>

      {error && (
        <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 font-body text-xs text-rose-300">
          {error}
        </p>
      )}

      <div className="mt-8 space-y-8">
        {porCategoria.length === 0 && (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center font-body text-sm text-bone-dim">
            Nenhum produto cadastrado ainda.
          </p>
        )}
        {porCategoria.map((grupo) => (
          <div key={grupo.categoria}>
            <p className="font-accent text-xs uppercase tracking-widest text-cyan-bright">
              {grupo.categoria}
            </p>
            <div className="mt-3 space-y-2.5">
              {grupo.itens.map((p) => {
                const estoqueBaixo = p.estoque > 0 && p.estoque <= ESTOQUE_BAIXO;
                const semEstoque = p.estoque === 0;
                return (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-ink-elev/60 px-5 py-4"
                  >
                    <div className="flex items-center gap-4">
                      {p.foto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.foto}
                          alt={p.nome}
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/5 font-accent text-lg text-bone-dim">
                          {p.nome.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div>
                        <p className="font-body text-sm text-bone">{p.nome}</p>
                        <p className="font-accent text-sm text-gold-bright">
                          R$ {p.preco.toFixed(2).replace(".", ",")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => ajustarEstoque(p, -1)}
                          aria-label={`Diminuir estoque de ${p.nome}`}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-line-strong text-bone-dim hover:border-gold-bright/40"
                        >
                          −
                        </button>
                        <span
                          className={`min-w-[2.5rem] text-center font-accent text-sm ${
                            semEstoque
                              ? "text-rose-300"
                              : estoqueBaixo
                                ? "text-amber-300"
                                : "text-bone"
                          }`}
                        >
                          {p.estoque}
                        </span>
                        <button
                          onClick={() => ajustarEstoque(p, 1)}
                          aria-label={`Aumentar estoque de ${p.nome}`}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-line-strong text-bone-dim hover:border-gold-bright/40"
                        >
                          +
                        </button>
                      </div>
                      {semEstoque && (
                        <span className="rounded-full bg-rose-500/10 px-3 py-1 font-body text-xs text-rose-300">
                          Sem estoque
                        </span>
                      )}
                      {estoqueBaixo && (
                        <span className="rounded-full bg-amber-400/10 px-3 py-1 font-body text-xs text-amber-300">
                          Estoque baixo
                        </span>
                      )}
                      <button
                        onClick={() => excluir(p.id)}
                        className="rounded-full border border-line-strong px-3 py-1 font-body text-xs text-bone-dim hover:border-rose-400/40 hover:text-rose-300"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
