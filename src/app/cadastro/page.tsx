"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { cadastrarBarbearia } from "@/lib/mock-db";
import { formatPhone, isValidPhone } from "@/lib/format";
import { getPlan, TRIAL_DAYS } from "@/lib/plans";
import { WEEKDAYS, type Weekday } from "@/lib/types";

function CadastroForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plano = getPlan(searchParams.get("plano"));

  const [barbeariaNome, setBarbeariaNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [dias, setDias] = useState<Weekday[]>(["seg", "ter", "qua", "qui", "sex", "sab"]);
  const [abertura, setAbertura] = useState("09:00");
  const [fechamento, setFechamento] = useState("20:00");
  const [donoNome, setDonoNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleDia(dia: Weekday) {
    setDias((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia],
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (dias.length === 0) {
      setError("Selecione ao menos um dia de funcionamento.");
      return;
    }

    if (!isValidPhone(telefone)) {
      setError("Informe um telefone válido, com DDD.");
      return;
    }

    if (abertura >= fechamento) {
      setError("O horário de fechamento precisa ser depois do horário de abertura.");
      return;
    }

    if (senha.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    const result = cadastrarBarbearia({
      barbeariaNome,
      telefone,
      endereco,
      diasFuncionamento: dias,
      horarioAbertura: abertura,
      horarioFechamento: fechamento,
      plano: plano.id,
      donoNome,
      email,
      senha,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.push("/painel");
  }

  return (
    <div className="grain grid-field relative flex flex-1 justify-center px-6 py-16">
      <div className="relative w-full max-w-xl">
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

        <div className="glass-panel rounded-3xl p-8 md:p-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-semibold text-bone">
                Cadastre sua barbearia
              </h1>
              <p className="mt-1 font-body text-sm text-bone-dim">
                {TRIAL_DAYS} dias grátis, sem cobrança agora.
              </p>
            </div>
            <div className="text-right">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 font-body text-xs font-semibold ${
                  plano.highlight
                    ? "bg-gold-bright/15 text-gold-bright"
                    : "bg-white/10 text-bone-dim"
                }`}
              >
                Plano {plano.name}
              </span>
              <p className="mt-1 font-accent text-xs text-muted">
                R$ {plano.price}/mês depois do teste
              </p>
              <Link
                href="/#planos"
                className="font-body text-xs text-cyan-bright hover:underline"
              >
                trocar plano
              </Link>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <fieldset className="space-y-4">
              <legend className="font-accent text-[10px] uppercase tracking-widest text-gold-bright">
                Dados da barbearia
              </legend>
              <Field
                label="Nome da barbearia"
                value={barbeariaNome}
                onChange={setBarbeariaNome}
                placeholder="Barbearia do Zé"
                required
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
                    Telefone
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    required
                    value={telefone}
                    onChange={(e) => setTelefone(formatPhone(e.target.value))}
                    placeholder="(11) 98888-1234"
                    maxLength={15}
                    className="w-full rounded-xl border border-line-strong bg-white/[0.03] px-4 py-3 font-body text-sm text-bone outline-none transition-colors placeholder:text-muted focus:border-gold-bright"
                  />
                </label>
                <Field
                  label="Endereço"
                  value={endereco}
                  onChange={setEndereco}
                  placeholder="Rua, número, bairro, cidade"
                  required
                />
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="font-accent text-[10px] uppercase tracking-widest text-gold-bright">
                Horário de funcionamento
              </legend>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDia(d.id)}
                    className={`rounded-lg border px-3 py-1.5 font-body text-xs transition-colors ${
                      dias.includes(d.id)
                        ? "border-gold-bright/50 bg-gold-bright/10 text-gold-bright"
                        : "border-line text-bone-dim hover:border-line-strong"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
                    Abre às
                  </span>
                  <input
                    type="time"
                    value={abertura}
                    onChange={(e) => setAbertura(e.target.value)}
                    className="w-full rounded-xl border border-line-strong bg-white/[0.03] px-4 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
                    Fecha às
                  </span>
                  <input
                    type="time"
                    value={fechamento}
                    onChange={(e) => setFechamento(e.target.value)}
                    className="w-full rounded-xl border border-line-strong bg-white/[0.03] px-4 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
                  />
                </label>
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="font-accent text-[10px] uppercase tracking-widest text-gold-bright">
                Seus dados de acesso
              </legend>
              <Field
                label="Seu nome"
                value={donoNome}
                onChange={setDonoNome}
                placeholder="Seu nome completo"
                required
              />
              <Field
                label="E-mail"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="voce@suabarbearia.com"
                required
              />
              <Field
                label="Senha"
                type="password"
                value={senha}
                onChange={setSenha}
                placeholder="Crie uma senha"
                required
              />
            </fieldset>

            {error && (
              <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 font-body text-xs text-rose-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-gradient-to-r from-gold to-gold-bright py-3.5 font-body text-sm font-semibold text-ink shadow-[0_0_20px_-6px_rgba(255,207,107,0.7)] transition-transform hover:scale-[1.01] disabled:opacity-60"
            >
              {loading ? "Criando..." : `Criar conta e começar teste grátis`}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center font-body text-sm text-bone-dim">
          Já tem conta?{" "}
          <Link href="/login" className="text-gold-bright hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-line-strong bg-white/[0.03] px-4 py-3 font-body text-sm text-bone outline-none transition-colors placeholder:text-muted focus:border-gold-bright"
      />
    </label>
  );
}

export default function CadastroPage() {
  return (
    <Suspense fallback={null}>
      <CadastroForm />
    </Suspense>
  );
}
