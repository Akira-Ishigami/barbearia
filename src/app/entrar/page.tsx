"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase-browser";
import { SenhaField } from "@/components/SenhaField";
import { formatPhone, isValidPhone } from "@/lib/format";

/**
 * Entrada do cliente — quem agenda, não a equipe.
 *
 * A equipe entra em /login. Aqui é conta de cliente: serve pra guardar o
 * histórico, mas agendar sem conta continua valendo, é só preencher os
 * dados no checkout.
 */
function EntrarConteudo() {
  const router = useRouter();
  const params = useSearchParams();
  // Pra onde voltar depois de entrar — normalmente a loja que a pessoa estava vendo.
  const voltarPara = params.get("voltar") || "/minha-conta";

  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);

    const { error } = await supabase().auth.signInWithPassword({ email, password: senha });
    if (error) {
      setErro("E-mail ou senha incorretos.");
      setEnviando(false);
      return;
    }
    router.push(voltarPara);
  }

  async function criar(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!nome.trim()) {
      setErro("Informe seu nome.");
      return;
    }
    if (telefone && !isValidPhone(telefone)) {
      setErro("Informe um telefone válido, com DDD.");
      return;
    }
    if (senha.length < 6) {
      setErro("A senha precisa ter ao menos 6 caracteres.");
      return;
    }

    setEnviando(true);
    try {
      const resposta = await fetch("/api/cliente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, telefone, senha }),
      });
      const corpo = await resposta.json().catch(() => ({}));
      if (!resposta.ok) {
        setErro(corpo.erro ?? "Não foi possível criar a conta.");
        setEnviando(false);
        return;
      }

      // Já entra: pedir pra digitar a senha de novo logo depois de criar
      // seria só um passo a mais sem motivo.
      const { error } = await supabase().auth.signInWithPassword({
        email,
        password: senha,
      });
      if (error) {
        setModo("entrar");
        setErro("Conta criada! Agora é só entrar.");
        setEnviando(false);
        return;
      }
      router.push(voltarPara);
    } catch {
      setErro("Não foi possível criar a conta.");
      setEnviando(false);
    }
  }

  const criando = modo === "criar";

  return (
    <div className="grain flex flex-1 flex-col items-center justify-center bg-ink px-6 py-16">
      <Link href="/" className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-gold/40 bg-gold/10 text-gold-bright">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.5 8.5l11 11M20 4 8.5 15.5" />
          </svg>
        </span>
        <span className="font-display text-xl font-semibold text-bone">Navalha</span>
      </Link>

      <div className="mt-8 w-full max-w-sm rounded-2xl border border-line bg-ink-elev/60 p-6">
        <h1 className="font-display text-2xl font-semibold text-bone">
          {criando ? "Criar conta" : "Entrar"}
        </h1>
        <p className="mt-1 font-body text-sm text-bone-dim">
          {criando
            ? "Pra guardar seus agendamentos e barbearias favoritas."
            : "Veja seu histórico e agende mais rápido."}
        </p>

        <form onSubmit={criando ? criar : entrar} className="mt-6 space-y-4">
          {criando && (
            <label className="block">
              <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
                Nome
              </span>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
                className="w-full rounded-xl border border-line-strong bg-bone/[0.03] px-4 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
              E-mail
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              autoComplete="email"
              className="w-full rounded-xl border border-line-strong bg-bone/[0.03] px-4 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
            />
          </label>

          {criando && (
            <label className="block">
              <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
                Telefone
              </span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={15}
                value={telefone}
                onChange={(e) => setTelefone(formatPhone(e.target.value))}
                placeholder="(11) 99999-9999"
                className="w-full rounded-xl border border-line-strong bg-bone/[0.03] px-4 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
              />
              <span className="mt-1 block font-body text-[11px] text-muted">
                Com ele, a gente acha os agendamentos que você já fez.
              </span>
            </label>
          )}

          <SenhaField
            label="Senha"
            value={senha}
            onChange={setSenha}
            placeholder={criando ? "Mín. 6 caracteres" : "Sua senha"}
            autoComplete={criando ? "new-password" : "current-password"}
          />

          {erro && (
            <p className="rounded-lg border border-off-line bg-off-soft px-3 py-2 font-body text-xs text-off">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-xl bg-gold-bright px-4 py-3 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.02] disabled:opacity-60"
          >
            {enviando ? "Aguarde…" : criando ? "Criar conta" : "Entrar"}
          </button>
        </form>

        <button
          onClick={() => {
            setModo(criando ? "entrar" : "criar");
            setErro(null);
          }}
          className="mt-4 w-full font-body text-xs text-bone-dim hover:text-gold-bright"
        >
          {criando ? "Já tenho conta" : "Não tenho conta — criar agora"}
        </button>
      </div>

      <p className="mt-6 max-w-sm text-center font-body text-xs text-muted">
        Não precisa de conta pra agendar: dá pra marcar só preenchendo seus
        dados na página da barbearia.
      </p>

      <Link
        href="/login"
        className="mt-4 font-body text-xs text-muted hover:text-bone-dim"
      >
        Sou dono ou barbeiro
      </Link>
    </div>
  );
}

export default function EntrarPage() {
  return (
    <Suspense fallback={null}>
      <EntrarConteudo />
    </Suspense>
  );
}
