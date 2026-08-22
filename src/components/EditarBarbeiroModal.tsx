"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { PRESET_AVATAR, prepararFoto } from "@/lib/imagem";
import type { BarbeiroPerfil } from "@/lib/types";

/**
 * Editar o perfil de um barbeiro — inclusive o do próprio dono.
 *
 * A lista de equipe só oferecia ativar/excluir, e só no plano Pro. Resultado:
 * no Básico o dono aparecia na página pública sem foto e sem jeito de trocar,
 * já que ele é o único barbeiro da barbearia.
 */
export function EditarBarbeiroModal({
  barbeiro,
  onClose,
  onSalvar,
}: {
  barbeiro: BarbeiroPerfil;
  onClose: () => void;
  onSalvar: (patch: Partial<BarbeiroPerfil>) => Promise<void>;
}) {
  const [nome, setNome] = useState(barbeiro.nome);
  const [especialidade, setEspecialidade] = useState(barbeiro.especialidade);
  const [foto, setFoto] = useState<string | undefined>(barbeiro.foto);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro(null);
    const r = await prepararFoto(file, PRESET_AVATAR);
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
      setErro("Informe o nome.");
      return;
    }

    setSalvando(true);
    try {
      await onSalvar({
        nome: nome.trim(),
        especialidade: especialidade.trim(),
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
        <p className="font-display text-lg font-semibold text-bone">Editar perfil</p>
        <p className="mt-1 font-body text-xs text-bone-dim">
          É assim que você aparece na página que o cliente vê.
        </p>

        <div className="mt-5 flex items-center gap-4">
          <label className="flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-line-strong bg-bone/[0.03] font-body text-[11px] text-muted hover:border-gold-bright/50">
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
          <div className="min-w-0 font-body text-xs text-muted">
            <p>Clique na foto pra trocar.</p>
            {foto && (
              <button
                type="button"
                onClick={() => setFoto(undefined)}
                className="mt-1 text-off hover:underline"
              >
                remover foto
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 space-y-4">
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
          <label className="block">
            <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
              Especialidade
            </span>
            <input
              value={especialidade}
              onChange={(e) => setEspecialidade(e.target.value)}
              placeholder="Degradê, navalhado..."
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
