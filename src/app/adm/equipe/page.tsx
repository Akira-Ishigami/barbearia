"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAsync } from "@/lib/use-async";
import { cabecalhosPlataforma, usePlataforma } from "@/lib/use-plataforma";
import {
  Aviso,
  Botao,
  Cabecalho,
  Campo,
  Secao,
  Selo,
  dataLonga,
  quando,
} from "@/components/adm/ui";

/**
 * Estação 06 — quem tem acesso.
 *
 * O acesso é dado por e-mail e vale a partir do momento em que a pessoa
 * entra com uma conta usando aquele mesmo e-mail. Não existe "criar
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

export default function AdmEquipePage() {
  const acesso = usePlataforma();
  const admin = acesso?.nivel === "admin";

  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [nivel, setNivel] = useState("suporte");
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const { dados, carregando, erro, recarregar } = useAsync<{ equipe: Membro[] }>(
    async () => {
      const r = await fetch("/api/adm/equipe", { headers: await cabecalhosPlataforma() });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro ?? "Falha ao carregar.");
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
      if (!r.ok) setMensagem({ tipo: "erro", texto: c.erro ?? "Não foi possível salvar." });
      else {
        setMensagem({ tipo: "ok", texto: c.aviso ?? "Acesso liberado." });
        setEmail("");
        setNome("");
        recarregar();
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
    else recarregar();
  }

  const membros = dados?.equipe ?? [];

  return (
    <div>
      <Cabecalho
        secao="Estação 06"
        titulo="Equipe"
        linha="Quem entra na área da plataforma, e com qual alcance."
      />

      {/* ---------- Os dois níveis ---------- */}
      <Secao titulo="O que cada nível faz">
        <div className="grid gap-8 sm:grid-cols-2">
          <div className="border-t border-line-strong pt-3">
            <p className="font-accent text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
              Suporte
            </p>
            <ul className="mt-3 space-y-1.5 font-body text-sm text-bone-dim">
              <li>Vê todas as barbearias e a saúde de cada conta</li>
              <li>Estende o teste grátis — até 7 dias por vez</li>
              <li>Solta uma conexão quebrada do Mercado Pago</li>
              <li>Procura um cliente pra atender quem ligou</li>
            </ul>
          </div>
          <div className="border-t border-line-strong pt-3">
            <p className="font-accent text-[11px] font-semibold uppercase tracking-[0.1em] text-cyan">
              Administrador
            </p>
            <ul className="mt-3 space-y-1.5 font-body text-sm text-bone-dim">
              <li>Tudo do suporte, sem limite de dias</li>
              <li>Marca assinatura como paga e troca o plano</li>
              <li>Bloqueia e apaga barbearia</li>
              <li>Apaga dado de cliente a pedido do titular</li>
              <li>Gerencia esta lista</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 max-w-2xl">
          <Aviso>
            A divisão é proposital: suporte que consegue liberar assinatura de graça é
            fraude esperando acontecer. Toda ação dos dois níveis cai na{" "}
            <Link href="/adm/registro" className="text-cyan underline underline-offset-2">
              estação 05
            </Link>
            .
          </Aviso>
        </div>
      </Secao>

      {/* ---------- Liberar ---------- */}
      {admin && (
        <Secao
          titulo="Liberar acesso"
          nota="Vale assim que a pessoa entrar no sistema com uma conta que use este e-mail."
          atraso={60}
        >
          <form onSubmit={salvar} className="max-w-2xl">
            <div className="grid gap-6 sm:grid-cols-2">
              <label className="block">
                <span className="font-accent text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                  E-mail
                </span>
                <div className="mt-1">
                  <Campo
                    valor={email}
                    aoMudar={setEmail}
                    tipo="email"
                    placeholder="pessoa@navalha.com"
                  />
                </div>
              </label>
              <label className="block">
                <span className="font-accent text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Nome
                </span>
                <div className="mt-1">
                  <Campo valor={nome} aoMudar={setNome} placeholder="Como chamar" />
                </div>
              </label>
            </div>

            <div className="mt-6 flex flex-wrap items-end gap-4">
              <label className="block">
                <span className="font-accent text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Nível
                </span>
                <select
                  value={nivel}
                  onChange={(e) => setNivel(e.target.value)}
                  className="mt-1 block border-b border-line-strong bg-transparent py-2 pr-6 font-body text-sm text-bone outline-none focus:border-cyan"
                >
                  <option value="suporte">Suporte</option>
                  <option value="admin">Administrador</option>
                </select>
              </label>
              <Botao type="submit" tipo="principal" disabled={salvando}>
                {salvando ? "Salvando…" : "Liberar"}
              </Botao>
            </div>

            {mensagem && (
              <div className="mt-6">
                <Aviso tom={mensagem.tipo === "ok" ? "ok" : "off"}>{mensagem.texto}</Aviso>
              </div>
            )}
          </form>
        </Secao>
      )}

      {/* ---------- Quem tem ---------- */}
      <Secao titulo="Com acesso hoje" atraso={120}>
        {erro && <Aviso tom="off">{erro}</Aviso>}
        {carregando && (
          <p className="font-accent text-[11px] uppercase tracking-[0.22em] text-muted">
            Carregando
          </p>
        )}

        <div className="border-t border-line">
          {membros.map((m) => (
            <div
              key={m.email}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3.5"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-body text-sm text-bone">
                  {m.nome || m.email.split("@")[0]}
                  {m.email === acesso.email && <Selo tom="acento">você</Selo>}
                </p>
                <p className="truncate font-accent text-[11px] text-muted">{m.email}</p>
                <p className="font-body text-[11px] text-muted">
                  {m.ultimo_acesso
                    ? `último acesso ${quando(m.ultimo_acesso)}`
                    : "nunca entrou"}{" "}
                  · desde {dataLonga(m.criado_em)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Selo tom={m.nivel === "admin" ? "acento" : "neutro"}>
                  {m.nivel === "admin" ? "Administrador" : "Suporte"}
                </Selo>
                {admin && m.email !== acesso.email && (
                  <Botao onClick={() => remover(m.email)}>Remover</Botao>
                )}
              </div>
            </div>
          ))}
        </div>
      </Secao>
    </div>
  );
}
