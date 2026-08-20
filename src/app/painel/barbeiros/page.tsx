"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  addBarbeiroComAcesso,
  getBarbearia,
  getBarbeiros,
  removeBarbeiro,
  updateBarbeiro,
} from "@/lib/db";
import { useSession } from "@/lib/use-session";
import { useAsync } from "@/lib/use-async";
import type { BarbeiroPerfil } from "@/lib/types";

const MAX_FOTO_BYTES = 800_000;

export default function BarbeirosPage() {
  const session = useSession();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [foto, setFoto] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dono = session?.role === "dono";
  const { dados, recarregar } = useAsync(
    async () => {
      const id = session!.barbeariaId;
      const [barbearia, barbeiros] = await Promise.all([getBarbearia(id), getBarbeiros(id)]);
      return { barbearia, barbeiros };
    },
    [session?.barbeariaId],
    { pular: !dono },
  );

  const barbearia = dados?.barbearia;
  const isPro = barbearia?.plano === "pro";
  const barbeiros: BarbeiroPerfil[] = dados?.barbeiros ?? [];

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
    if (!session || session.role !== "dono" || !isPro) return;
    if (!nome.trim() || !email.trim()) return;

    if (senha.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    const result = await addBarbeiroComAcesso({
      barbeariaId: session.barbeariaId,
      nome: nome.trim(),
      email: email.trim(),
      senha,
      especialidade: especialidade.trim() || "Barbeiro",
      foto,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    recarregar();
    setNome("");
    setEmail("");
    setSenha("");
    setEspecialidade("");
    setFoto(undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function excluir(id: string) {
    try {
      await removeBarbeiro(id);
      recarregar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível remover.");
    }
  }

  async function toggleAtivo(b: BarbeiroPerfil) {
    await updateBarbeiro(b.id, { ativo: !b.ativo });
    recarregar();
  }

  return (
    <div>
      <p className="font-accent text-xs uppercase tracking-[0.2em] text-gold-bright">
        Barbeiros
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-bone">
        Equipe da barbearia
      </h1>
      <p className="mt-1 max-w-lg font-body text-sm text-bone-dim">
        Cada barbeiro ativo tem acesso ao próprio painel de agenda.
      </p>

      {!isPro && (
        <div className="mt-6 rounded-2xl border border-gold-bright/30 bg-gold-bright/5 p-6">
          <p className="font-body text-sm text-bone">
            No plano Básico sua barbearia usa um painel único. Faça upgrade
            pro Pro pra ter <strong>barbeiros ilimitados</strong>, cada um com
            sua própria agenda.
          </p>
          <Link
            href="/#planos"
            className="mt-3 inline-block rounded-full bg-gold-bright px-5 py-2.5 font-body text-xs font-semibold text-ink transition-transform hover:scale-[1.03]"
          >
            Ver plano Pro
          </Link>
        </div>
      )}

      {isPro && (
        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-4 rounded-2xl border border-line bg-ink-elev/60 p-6"
        >
          <label className="flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-line-strong bg-bone/[0.03] text-xs text-muted hover:border-gold-bright/50">
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
              className="-mt-2 font-body text-[11px] text-off hover:underline"
            >
              remover foto
            </button>
          )}

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <label className="block">
              <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
                Nome
              </span>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do barbeiro"
                className="w-full rounded-xl border border-line-strong bg-bone/[0.03] px-3.5 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
                E-mail (login)
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="barbeiro@email.com"
                className="w-full rounded-xl border border-line-strong bg-bone/[0.03] px-3.5 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
                Senha (login)
              </span>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Mín. 6 caracteres"
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

          <button
            type="submit"
            className="rounded-xl bg-gold-bright px-5 py-2.5 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.02]"
          >
            Adicionar barbeiro
          </button>
        </form>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-off-line bg-off-soft px-3 py-2 font-body text-xs text-off">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-2.5">
        {barbeiros.map((b) => (
          <div
            key={b.id}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4 ${
              b.ativo ? "border-line bg-ink-elev/60" : "border-line bg-ink-elev/20 opacity-50"
            }`}
          >
            <div className="flex items-center gap-4">
              {b.foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={b.foto}
                  alt={b.nome}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/30 bg-gold/10 font-accent text-sm text-gold-bright">
                  {b.nome.charAt(0)}
                </span>
              )}
              <div>
                <p className="font-body text-sm text-bone">{b.nome}</p>
                <p className="font-body text-xs text-bone-dim">
                  {b.especialidade} · {b.email}
                </p>
              </div>
            </div>
            {isPro && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleAtivo(b)}
                  className="rounded-full border border-line-strong px-3 py-1 font-body text-xs text-bone-dim hover:border-gold-bright/40 hover:text-gold-bright"
                >
                  {b.ativo ? "Ativo" : "Inativo"}
                </button>
                {b.usuarioId !== session.userId && (
                  <button
                    onClick={() => excluir(b.id)}
                    className="rounded-full border border-line-strong px-3 py-1 font-body text-xs text-bone-dim hover:border-off-line hover:text-off"
                  >
                    Excluir
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
