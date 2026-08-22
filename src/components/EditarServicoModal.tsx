"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { parseMoney } from "@/lib/format";
import { PRESET_CATALOGO, prepararFoto } from "@/lib/imagem";
import { CategoriaField } from "@/components/CategoriaField";
import { SERVICO_CATEGORIAS_PRESET, type Servico } from "@/lib/types";

/**
 * Editar serviço já cadastrado.
 *
 * Antes só dava pra ativar/desativar ou excluir: pra corrigir um preço a
 * pessoa tinha que apagar e cadastrar de novo — perdendo a foto junto.
 */
export function EditarServicoModal({
  servico,
  onClose,
  onSalvar,
}: {
  servico: Servico;
  onClose: () => void;
  onSalvar: (patch: Partial<Servico>) => Promise<void>;
}) {
  const [nome, setNome] = useState(servico.nome);
  const [categoria, setCategoria] = useState(servico.categoria);
  const [preco, setPreco] = useState(String(servico.preco).replace(".", ","));
  const [duracao, setDuracao] = useState(String(servico.duracaoMin));
  const [foto, setFoto] = useState<string | undefined>(servico.foto);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null);
    const r = await prepararFoto(file, PRESET_CATALOGO);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setFoto(r.foto.dataUrl);
  }

  async function submeter(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!nome.trim()) {
      setErro("Informe o nome do serviço.");
      return;
    }
    const precoNum = parseMoney(preco);
    if (precoNum === null) {
      setErro("Informe um preço válido, maior que zero.");
      return;
    }

    setSalvando(true);
    try {
      await onSalvar({
        nome: nome.trim(),
        categoria: categoria.trim() || "Outros",
        preco: precoNum,
        duracaoMin: Number(duracao) || 30,
        // `?? null` no db.ts apaga a foto quando ela é removida aqui.
        foto: foto ?? undefined,
      });
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submeter}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line-strong bg-ink-elev p-6 shadow-2xl sm:rounded-3xl"
      >
        <p className="font-display text-lg font-semibold text-bone">Editar serviço</p>

        <div className="mt-5">
          <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
            Foto
          </span>
          <label className="flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-line-strong bg-bone/[0.03] font-body text-[11px] text-muted hover:border-gold-bright/50">
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
              onClick={() => setFoto(undefined)}
              className="mt-1.5 font-body text-[11px] text-off hover:underline"
            >
              remover foto
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
              Nome
            </span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded-xl border border-line-strong bg-bone/[0.03] px-3.5 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
            />
          </label>
          <CategoriaField
            presets={SERVICO_CATEGORIAS_PRESET}
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
              inputMode="decimal"
              className="w-full rounded-xl border border-line-strong bg-bone/[0.03] px-3.5 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
              Duração (min)
            </span>
            <input
              value={duracao}
              onChange={(e) => setDuracao(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              className="w-full rounded-xl border border-line-strong bg-bone/[0.03] px-3.5 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
            />
          </label>
        </div>

        {erro && (
          <p className="mt-4 rounded-lg border border-off-line bg-off-soft px-3 py-2 font-body text-xs text-off">
            {erro}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="submit"
            disabled={salvando}
            className="flex-1 rounded-xl bg-gold-bright px-4 py-3 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.02] disabled:opacity-60"
          >
            {salvando ? "Salvando…" : "Salvar"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line-strong px-4 py-3 font-body text-sm text-bone-dim hover:text-bone"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
