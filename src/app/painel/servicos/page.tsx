"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { addServico, getServicos, removeServico, updateServico } from "@/lib/mock-db";
import { parseMoney } from "@/lib/format";
import { useSession } from "@/lib/use-session";
import { CategoriaField } from "@/components/CategoriaField";
import { SERVICO_CATEGORIAS_PRESET, type Servico } from "@/lib/types";

const MAX_FOTO_BYTES = 800_000;

export default function ServicosPage() {
  const session = useSession();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState(SERVICO_CATEGORIAS_PRESET[0] as string);
  const [preco, setPreco] = useState("");
  const [duracao, setDuracao] = useState("30");
  const [foto, setFoto] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (session && session.role === "dono" && !loaded) {
    setServicos(getServicos(session.barbeariaId));
    setLoaded(true);
  }

  if (!session || session.role !== "dono") return null;

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

    addServico({
      barbeariaId: session.barbeariaId,
      nome: nome.trim(),
      categoria: categoria.trim() || "Outros",
      preco: precoNum,
      duracaoMin: Number(duracao) || 30,
      foto,
      ativo: true,
    });

    setServicos(getServicos(session.barbeariaId));
    setNome("");
    setPreco("");
    setDuracao("30");
    setCategoria(SERVICO_CATEGORIAS_PRESET[0]);
    setFoto(undefined);
    setFormKey((k) => k + 1);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function toggleAtivo(s: Servico) {
    updateServico(s.id, { ativo: !s.ativo });
    setServicos(getServicos(session!.barbeariaId));
  }

  function excluir(id: string) {
    removeServico(id);
    setServicos(getServicos(session!.barbeariaId));
  }

  const categoriasExistentes = Array.from(new Set(servicos.map((s) => s.categoria)));
  const porCategoria = categoriasExistentes.map((cat) => ({
    categoria: cat,
    itens: servicos.filter((s) => s.categoria === cat),
  }));

  return (
    <div>
      <p className="font-accent text-xs uppercase tracking-[0.2em] text-gold-bright">
        Serviços
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-bone">
        Catálogo de serviços
      </h1>
      <p className="mt-1 max-w-lg font-body text-sm text-bone-dim">
        Esses são os serviços exibidos na sua página pública, organizados por
        categoria, com foto e preço.
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
              Nome do serviço
            </span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Corte social"
              className="w-full rounded-xl border border-line-strong bg-white/[0.03] px-3.5 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
            />
          </label>
          <CategoriaField
            key={formKey}
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
              placeholder="40"
              inputMode="decimal"
              className="w-full rounded-xl border border-line-strong bg-white/[0.03] px-3.5 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
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
              className="w-full rounded-xl border border-line-strong bg-white/[0.03] px-3.5 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
            />
          </label>
        </div>

        <button
          type="submit"
          className="rounded-xl bg-gold-bright px-5 py-2.5 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.02]"
        >
          Adicionar serviço
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
            Nenhum serviço cadastrado ainda.
          </p>
        )}
        {porCategoria.map((grupo) => (
          <div key={grupo.categoria}>
            <p className="font-accent text-xs uppercase tracking-widest text-cyan-bright">
              {grupo.categoria}
            </p>
            <div className="mt-3 space-y-2.5">
              {grupo.itens.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 transition-opacity ${
                    s.ativo ? "border-line bg-ink-elev/60" : "border-line bg-ink-elev/20 opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {s.foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.foto}
                        alt={s.nome}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/5 font-accent text-lg text-bone-dim">
                        {s.nome.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div>
                      <p className="font-body text-sm text-bone">{s.nome}</p>
                      <p className="font-body text-xs text-bone-dim">
                        {s.duracaoMin} min
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-accent text-sm text-gold-bright">
                      R$ {s.preco.toFixed(2).replace(".", ",")}
                    </span>
                    <button
                      onClick={() => toggleAtivo(s)}
                      className="rounded-full border border-line-strong px-3 py-1 font-body text-xs text-bone-dim hover:border-gold-bright/40 hover:text-gold-bright"
                    >
                      {s.ativo ? "Ativo" : "Inativo"}
                    </button>
                    <button
                      onClick={() => excluir(s.id)}
                      className="rounded-full border border-line-strong px-3 py-1 font-body text-xs text-bone-dim hover:border-rose-400/40 hover:text-rose-300"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
