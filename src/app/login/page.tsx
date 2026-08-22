"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { entrar } from "@/lib/use-session";
import { supabase } from "@/lib/supabase-browser";
import { SenhaField } from "@/components/SenhaField";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const resultado = await entrar(email, senha);
    if (!resultado.ok) {
      setError(resultado.error);
      setLoading(false);
      return;
    }

    // O papel decide o destino: dono vai pro painel, barbeiro pra agenda.
    try {
      const { data: auth } = await supabase().auth.getUser();
      const authId = auth.user?.id ?? "";

      const { data: usuario } = await supabase()
        .from("usuarios")
        .select("role")
        .eq("auth_user_id", authId)
        .maybeSingle();

      if (usuario) {
        router.push(usuario.role === "barbeiro" ? "/barbeiro" : "/painel");
        return;
      }

      // Conta de cliente entrando na tela da equipe. Sem isso ele iria pro
      // painel, seria expulso por não estar em `usuarios`, voltaria pra cá
      // já logado e ficaria girando entre as duas telas.
      const { data: cliente } = await supabase()
        .from("clientes")
        .select("id")
        .eq("auth_user_id", authId)
        .maybeSingle();

      if (cliente) {
        router.push("/minha-conta");
        return;
      }

      await supabase().auth.signOut();
      setError("Esta conta não tem acesso ao painel.");
      setLoading(false);
    } catch {
      router.push("/painel");
    }
  }

  return (
    <div className="grain grid-field relative flex flex-1 items-center justify-center px-6 py-16">
      <div className="relative w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-gold/40 bg-gradient-to-br from-gold/20 to-cyan/10 text-gold-bright shadow-[0_0_18px_-4px_rgba(255,207,107,0.5)]">
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
          <span className="font-display text-xl font-semibold tracking-tight text-bone">
            Navalha
          </span>
        </Link>

        <div className="glass-panel rounded-3xl p-8">
          <h1 className="font-display text-2xl font-semibold text-bone">
            Entrar no painel
          </h1>
          <p className="mt-1 font-body text-sm text-bone-dim">
            Acesse sua barbearia ou sua agenda de barbeiro.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
                E-mail
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@suabarbearia.com"
                className="w-full rounded-xl border border-line-strong bg-white/[0.03] px-4 py-3 font-body text-sm text-bone outline-none transition-colors placeholder:text-muted focus:border-gold-bright"
              />
            </label>
            <SenhaField value={senha} onChange={setSenha} required />

            {error && (
              <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 font-body text-xs text-rose-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-full bg-gradient-to-r from-gold to-gold-bright py-3.5 font-body text-sm font-semibold text-ink shadow-[0_0_20px_-6px_rgba(255,207,107,0.7)] transition-transform hover:scale-[1.01] disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

        </div>

        <p className="mt-6 text-center font-body text-sm text-bone-dim">
          Ainda não tem conta?{" "}
          <Link href="/#planos" className="text-gold-bright hover:underline">
            Ver planos
          </Link>
        </p>

        {/* Sem isso o cliente que caísse aqui ficaria tentando a senha dele
            numa tela que só aceita login de dono ou barbeiro. */}
        <p className="mt-2 text-center font-body text-xs text-muted">
          Vai agendar um horário?{" "}
          <Link href="/entrar" className="text-bone-dim hover:text-gold-bright">
            Entrar como cliente
          </Link>
        </p>
      </div>
    </div>
  );
}
