"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { addServico, getServicos, removeServico, updateServico } from "@/lib/db";
import { parseMoney } from "@/lib/format";
import { useSession } from "@/lib/use-session";
import { useAsync } from "@/lib/use-async";
import { CategoriaField } from "@/components/CategoriaField";
import { SERVICO_CATEGORIAS_PRESET, type Servico } from "@/lib/types";

const MAX_FOTO_BYTES = 800_000;

export default function ServicosPage() {
  const session = useSession();
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState(SERVICO_CATEGORIAS_PRESET[0] as string);
  const [preco, setPreco] = useState("");
  const [duracao, setDuracao] = useState("30");
  const [foto, setFoto] = useState<string | undefined>(undefined);
  const [incluidos, setIncluidos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dono = session?.role === "dono";
  const { dados, recarregar } = useAsync(
    () => getServicos(session!.barbeariaId),
    [session?.barbeariaId],
    { pular: !dono },
  );
  const servicos: Servico[] = dados ?? [];

  if (!session || !dono) return null;

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!session || session.role !== "dono") return;
    if (!nome.trim()) return;

    const precoNum = parseMoney(preco);
    if (precoNum === null) {
      setError("Informe um preço válido, maior que zero.");
      return;
    }

    if (ehCombo && incluidos.length < 2) {
      setError("Um combo precisa juntar pelo menos dois serviços.");
      return;
    }

    try {
      await addServico({
        barbeariaId: session.barbeariaId,
        nome: nome.trim(),
        categoria: categoria.trim() || "Outros",
        preco: precoNum,
        duracaoMin: Number(duracao) || 30,
        foto,
        ativo: true,
        servicosIncluidos: ehCombo ? incluidos : undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
      return;
    }

    recarregar();
    setNome("");
    setPreco("");
    setDuracao("30");
    setCategoria(SERVICO_CATEGORIAS_PRESET[0]);
    setFoto(undefined);
    setIncluidos([]);
    setFormKey((k) => k + 1);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /** Marca/desmarca um serviço dentro do combo e recalcula preço e duração sugeridos. */
  function toggleIncluido(s: Servico) {
    const novos = incluidos.includes(s.id)
      ? incluidos.filter((id) => id !== s.id)
      : [...incluidos, s.id];
    setIncluidos(novos);

    const partes = servicos.filter((x) => novos.includes(x.id));
    setDuracao(String(partes.reduce((sum, x) => sum + x.duracaoMin, 0) || 30));
    const soma = partes.reduce((sum, x) => sum + x.preco, 0);
    setPreco(soma > 0 ? String(soma).replace(".", ",") : "");
  }

  async function toggleAtivo(s: Servico) {
    await updateServico(s.id, { ativo: !s.ativo });
    recarregar();
  }

  async function excluir(id: string) {
    await removeServico(id);
    recarregar();
  }

  // Combos são montados a partir dos outros serviços já cadastrados.
  const ehCombo = categoria.trim().toLowerCase() === "combos";
  const candidatosCombo = servicos.filter(
    (s) => s.categoria.trim().toLowerCase() !== "combos",
  );
  const nomeDoServico = (id: string) => servicos.find((s) => s.id === id)?.nome ?? "";

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
        {/* Escolher o tipo primeiro deixa claro que dá pra montar combo aqui. */}
        <div>
          <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
            O que você quer cadastrar?
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setCategoria(SERVICO_CATEGORIAS_PRESET[0]);
                setIncluidos([]);
                setFormKey((k) => k + 1);
              }}
              className={`rounded-xl border px-4 py-2.5 text-left font-body text-sm transition-colors ${
                !ehCombo
                  ? "border-gold-bright bg-gold-bright/10 text-gold-bright"
                  : "border-line-strong text-bone-dim hover:border-gold-bright/40"
              }`}
            >
              Serviço avulso
              <span className="block font-body text-[11px] text-muted">Um serviço só</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCategoria("Combos");
                setFormKey((k) => k + 1);
              }}
              className={`rounded-xl border px-4 py-2.5 text-left font-body text-sm transition-colors ${
                ehCombo
                  ? "border-cyan-bright bg-cyan-bright/10 text-cyan-bright"
                  : "border-line-strong text-bone-dim hover:border-cyan-bright/40"
              }`}
            >
              Combo
              <span className="block font-body text-[11px] text-muted">
                Junta 2 ou mais serviços
              </span>
            </button>
          </div>
        </div>

        <div>
          <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
            Foto (opcional)
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
              onClick={() => {
                setFoto(undefined);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="mt-1.5 font-body text-[11px] text-off hover:underline"
            >
              remover foto
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
              {ehCombo ? "Nome do combo" : "Nome do serviço"}
            </span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder={ehCombo ? "Corte + barba" : "Corte social"}
              className="w-full rounded-xl border border-line-strong bg-bone/[0.03] px-3.5 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
            />
          </label>
          {/* No modo combo a categoria é sempre "Combos", então o seletor sai de cena. */}
          {!ehCombo && (
            <CategoriaField
              key={formKey}
              presets={SERVICO_CATEGORIAS_PRESET}
              value={categoria}
              onChange={setCategoria}
            />
          )}
          <label className="block">
            <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
              Preço (R$)
            </span>
            <input
              value={preco}
              onChange={(e) => setPreco(e.target.value.replace(/[^0-9,]/g, ""))}
              placeholder="40"
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

        {ehCombo && (
          <div className="rounded-xl border border-cyan/30 bg-cyan/5 p-4">
            <p className="font-body text-xs font-medium uppercase tracking-wide text-cyan-bright">
              Serviços incluídos no combo
            </p>
            <p className="mt-1 font-body text-[11px] text-bone-dim">
              Marque o que entra. Preço e duração são somados automaticamente — depois você
              pode ajustar (pra dar desconto no combo, por exemplo).
            </p>

            {candidatosCombo.length === 0 ? (
              <p className="mt-3 font-body text-xs text-muted">
                Cadastre os serviços avulsos primeiro para poder montar um combo.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {candidatosCombo.map((s) => {
                  const marcado = incluidos.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleIncluido(s)}
                      className={`rounded-lg border px-3 py-1.5 font-body text-xs transition-colors ${
                        marcado
                          ? "border-cyan-bright bg-cyan-bright/15 text-cyan-bright"
                          : "border-line-strong text-bone-dim hover:border-cyan/40"
                      }`}
                    >
                      {marcado ? "✓ " : ""}
                      {s.nome}
                      <span className="ml-1.5 text-muted">{s.duracaoMin}min</span>
                    </button>
                  );
                })}
              </div>
            )}

            {incluidos.length > 0 && (
              <p className="mt-3 font-body text-xs text-bone-dim">
                Combo: {incluidos.map(nomeDoServico).join(" + ")}
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          className={`rounded-xl px-5 py-2.5 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.02] ${
            ehCombo ? "bg-cyan-bright" : "bg-gold-bright"
          }`}
        >
          {ehCombo ? "Adicionar combo" : "Adicionar serviço"}
        </button>
      </form>

      {error && (
        <p className="mt-3 rounded-lg border border-off-line bg-off-soft px-3 py-2 font-body text-xs text-off">
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
                      <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-bone/5 font-accent text-lg text-bone-dim">
                        {s.nome.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div>
                      <p className="font-body text-sm text-bone">{s.nome}</p>
                      <p className="font-body text-xs text-bone-dim">
                        {s.duracaoMin} min
                      </p>
                      {s.servicosIncluidos && s.servicosIncluidos.length > 0 && (
                        <p className="font-body text-[11px] text-cyan-bright">
                          Inclui: {s.servicosIncluidos.map(nomeDoServico).filter(Boolean).join(" + ")}
                        </p>
                      )}
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
                      className="rounded-full border border-line-strong px-3 py-1 font-body text-xs text-bone-dim hover:border-off-line hover:text-off"
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
