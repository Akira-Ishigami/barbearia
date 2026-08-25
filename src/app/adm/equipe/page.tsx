"use client";

import { useState, type FormEvent } from "react";
import { useAsync } from "@/lib/use-async";
import { cabecalhosPlataforma, usePlataforma } from "@/lib/use-plataforma";

/**
 * Quem tem acesso de suporte ou de administrador.
 *
 * O acesso é dado por e-mail e vale a partir do momento em que a pessoa
 * entra com uma conta usando aquele mesmo e-mail — não existe "criar
 * usuário de suporte" aqui de propósito: senha é assunto do Supabase Auth,
 * e duplicar isso só criaria um segundo lugar pra errar.
 */

interface Membro {
  email: string;
  nome: string;
  nivel: string;
  ativo: boolean;
  criado_em: string;
  ultimo_acesso: string | null;
}

interface Log {
  id: string;
  email: string;
  acao: string;
  detalhe: string;
  criado_em: string;
}

const ACAO_LABEL: Record<string, string> = {
  estender_trial: "estendeu o teste",
  marcar_paga: "marcou assinatura paga",
  mudar_plano: "mudou o plano",
  bloquear: "bloqueou",
  desconectar_mp: "soltou o Mercado Pago",
  equipe_salvar: "liberou acesso",
  equipe_remover: "removeu acesso",
};

function quando(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdmEquipePage() {
  const acesso = usePlataforma();
  const admin = acesso?.nivel === "admin";

  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [nivel, setNivel] = useState("suporte");
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const equipe = useAsync<{ equipe: Membro[] }>(
    async () => {
      const r = await fetch("/api/adm/equipe", { headers: await cabecalhosPlataforma() });
      if (!r.ok) throw new Error("Falha ao carregar.");
      return r.json();
    },
    [acesso?.email],
    { pular: !acesso },
  );

  const log = useAsync<{ log: Log[] }>(
    async () => {
      const r = await fetch("/api/adm/acoes", { headers: await cabecalhosPlataforma() });
      if (!r.ok) throw new Error("Falha ao carregar.");
      return r.json();
    },
    [acesso?.email],
    { pular: !acesso },
  );

  if (!acesso) return null;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setMensagem(null);
    setSalvando(true);
    try {
      const r = await fetch("/api/adm/equipe", {
        method: "POST",
        headers: await cabecalhosPlataforma(),
        body: JSON.stringify({ email, nome, nivel }),
      });
      const c = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMensagem({ tipo: "erro", texto: c.erro ?? "Não foi possível salvar." });
      } else {
        setMensagem({ tipo: "ok", texto: c.aviso ?? "Acesso liberado." });
        setEmail("");
        setNome("");
        equipe.recarregar();
      }
    } catch {
      setMensagem({ tipo: "erro", texto: "Falha de conexão." });
    }
    setSalvando(false);
  }

  async function remover(alvo: string) {
    if (!window.confirm(`Tirar o acesso de ${alvo}?`)) return;
    const r = await fetch(`/api/adm/equipe?email=${encodeURIComponent(alvo)}`, {
      method: "DELETE",
      headers: await cabecalhosPlataforma(),
    });
    const c = await r.json().catch(() => ({}));
    if (!r.ok) setMensagem({ tipo: "erro", texto: c.erro ?? "Não foi possível remover." });
    else equipe.recarregar();
  }

  const membros = equipe.dados?.equipe ?? [];

  return (
    <div>
      <p className="font-accent text-xs uppercase tracking-[0.2em] text-cyan-bright">
        Plataforma
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-bone">
        Quem tem acesso
      </h1>
      <p className="mt-1 max-w-xl font-body text-sm text-bone-dim">
        <strong className="text-bone">Suporte</strong> enxerga todas as barbearias e
        destrava o que trava o cliente. <strong className="text-bone">Administrador</strong>{" "}
        faz isso e mais: assinatura, plano e esta lista aqui.
      </p>

      {admin && (
        <form
          onSubmit={salvar}
          className="mt-6 max-w-2xl rounded-2xl border border-line bg-ink-elev p-6"
        >
          <p className="font-display text-lg font-semibold text-bone">Liberar acesso</p>
          <p className="mt-1 font-body text-xs text-muted">
            Vale assim que a pessoa entrar com uma conta usando este e-mail.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
                E-mail
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="pessoa@navalha.com"
                className="w-full rounded-xl border border-line-strong bg-bone/[0.03] px-3.5 py-2.5 font-body text-sm text-bone outline-none placeholder:text-muted focus:border-cyan"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
                Nome
              </span>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Como chamar"
                className="w-full rounded-xl border border-line-strong bg-bone/[0.03] px-3.5 py-2.5 font-body text-sm text-bone outline-none placeholder:text-muted focus:border-cyan"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
                Nível
              </span>
              <select
                value={nivel}
                onChange={(e) => setNivel(e.target.value)}
                className="rounded-xl border border-line-strong bg-ink-elev-2 px-3.5 py-2.5 font-body text-sm text-bone outline-none focus:border-cyan"
              >
                <option value="suporte">Suporte</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={salvando}
              className="rounded-full bg-cyan px-6 py-2.5 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.02] disabled:opacity-60"
            >
              {salvando ? "Salvando…" : "Liberar"}
            </button>
          </div>

          {mensagem && (
            <p
              className={`mt-4 rounded-lg border px-3 py-2 font-body text-xs ${
                mensagem.tipo === "ok"
                  ? "border-ok-line bg-ok-soft text-ok"
                  : "border-off-line bg-off-soft text-off"
              }`}
            >
              {mensagem.texto}
            </p>
          )}
        </form>
      )}

      <div className="mt-6 max-w-2xl space-y-2">
        {membros.map((m) => (
          <div
            key={m.email}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-ink-elev px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate font-body text-sm font-semibold text-bone">
                {m.nome || m.email}
              </p>
              <p className="truncate font-body text-xs text-muted">
                {m.email} ·{" "}
                {m.ultimo_acesso ? `último acesso ${quando(m.ultimo_acesso)}` : "nunca entrou"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-1 font-body text-[10px] font-semibold ${
                  m.nivel === "admin"
                    ? "border-cyan/40 bg-cyan/10 text-cyan-bright"
                    : "border-line-strong text-bone-dim"
                }`}
              >
                {m.nivel === "admin" ? "Administrador" : "Suporte"}
              </span>
              {admin && m.email !== acesso.email && (
                <button
                  onClick={() => remover(m.email)}
                  className="rounded-full border border-line-strong px-3 py-1 font-body text-[11px] text-bone-dim transition-colors hover:border-off-line hover:text-off"
                >
                  Remover
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ---------- Trilha ---------- */}
      <div className="mt-10 max-w-2xl">
        <h2 className="font-display text-xl font-semibold text-bone">
          O que foi feito
        </h2>
        <p className="mt-1 font-body text-xs text-muted">
          Acesso amplo sem registro não se sustenta — tudo que o suporte faz cai aqui.
        </p>

        <div className="mt-4 space-y-1.5">
          {(log.dados?.log ?? []).length === 0 && (
            <p className="rounded-xl border border-line bg-ink-elev px-4 py-5 text-center font-body text-sm text-muted">
              Nada registrado ainda.
            </p>
          )}
          {(log.dados?.log ?? []).map((l) => (
            <div
              key={l.id}
              className="rounded-xl border border-line bg-ink-elev px-4 py-2.5 font-body text-xs"
            >
              <span className="text-bone-dim">{l.email}</span>{" "}
              <span className="text-bone">{ACAO_LABEL[l.acao] ?? l.acao}</span>
              {l.detalhe && <span className="text-muted"> — {l.detalhe}</span>}
              <span className="block text-[11px] text-muted">{quando(l.criado_em)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
