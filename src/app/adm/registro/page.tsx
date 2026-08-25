"use client";

import { useState } from "react";
import { useAsync } from "@/lib/use-async";
import { cabecalhosPlataforma, usePlataforma } from "@/lib/use-plataforma";
import { Aviso, Cabecalho, Campo, Secao, Selo, Vazio } from "@/components/adm/ui";
import { ACAO_LABEL } from "../tipos";

/**
 * Estação 05 — o registro.
 *
 * Tudo que suporte e admin fazem cai aqui: estender teste, liberar
 * assinatura, apagar barbearia, procurar cliente. Com e-mail e hora.
 *
 * Ter a trilha numa tela própria, e não escondida num canto da equipe, é
 * a diferença entre auditoria que existe e auditoria que alguém prometeu.
 * Acesso amplo sem registro visível não se sustenta.
 */

interface Linha {
  id: string;
  email: string;
  acao: string;
  barbearia_id: string | null;
  detalhe: string;
  criado_em: string;
}

/** Ações que mexem em dinheiro ou apagam coisa merecem destaque. */
const GRAVES = new Set(["excluir", "excluir_cliente", "bloquear", "marcar_paga", "mudar_plano"]);

export default function AdmRegistroPage() {
  const acesso = usePlataforma();
  const [filtro, setFiltro] = useState("");

  const { dados, carregando, erro, recarregar } = useAsync<{ log: Linha[] }>(
    async () => {
      const r = await fetch("/api/adm/acoes", { headers: await cabecalhosPlataforma() });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro ?? "Falha ao carregar.");
      return r.json();
    },
    [acesso?.email],
    { pular: !acesso },
  );

  if (!acesso) return null;

  const log = dados?.log ?? [];
  const termo = filtro.trim().toLowerCase();
  const filtrado = termo
    ? log.filter(
        (l) =>
          l.email.toLowerCase().includes(termo) ||
          (ACAO_LABEL[l.acao] ?? l.acao).toLowerCase().includes(termo) ||
          l.detalhe.toLowerCase().includes(termo),
      )
    : log;

  // Agrupa por dia: uma lista corrida de oitenta linhas some no meio.
  const porDia = new Map<string, Linha[]>();
  for (const l of filtrado) {
    const dia = new Date(l.criado_em).toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
    const atual = porDia.get(dia);
    if (atual) atual.push(l);
    else porDia.set(dia, [l]);
  }

  return (
    <div>
      <Cabecalho
        secao="Estação 05"
        titulo="Registro"
        linha="O que suporte e administração fizeram, com quem fez e quando. As 80 ações mais recentes."
      />

      <div className="adm-entra mt-8 max-w-md">
        <Campo valor={filtro} aoMudar={setFiltro} placeholder="Filtrar por pessoa, ação ou detalhe" />
      </div>

      {erro && (
        <div className="mt-8">
          <Aviso tom="off">{erro}</Aviso>
        </div>
      )}
      {carregando && (
        <p className="mt-8 font-accent text-[11px] uppercase tracking-[0.22em] text-muted">
          Carregando
        </p>
      )}

      {!carregando && filtrado.length === 0 && (
        <div className="mt-8">
          <Vazio>
            {log.length === 0
              ? "Nada registrado ainda. Assim que alguém do suporte agir, aparece aqui."
              : "Nada com esse filtro."}
          </Vazio>
        </div>
      )}

      {Array.from(porDia.entries()).map(([dia, linhas], i) => (
        <Secao key={dia} titulo={dia} atraso={i * 40}>
          <div className="border-t border-line">
            {linhas.map((l) => (
              <div
                key={l.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line py-3"
              >
                <span className="tabular shrink-0 font-accent text-[11px] text-muted">
                  {new Date(l.criado_em).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="font-body text-sm text-bone">{l.email.split("@")[0]}</span>
                <span className="font-body text-sm text-bone-dim">
                  {ACAO_LABEL[l.acao] ?? l.acao.replace(/_/g, " ")}
                </span>
                {GRAVES.has(l.acao) && <Selo tom="off">crítica</Selo>}
                {l.detalhe && (
                  <span className="w-full font-body text-[11px] text-muted">{l.detalhe}</span>
                )}
              </div>
            ))}
          </div>
        </Secao>
      ))}

      {!carregando && log.length > 0 && (
        <p className="mt-8">
          <button
            onClick={recarregar}
            className="font-body text-[11px] text-cyan hover:underline"
          >
            atualizar →
          </button>
        </p>
      )}
    </div>
  );
}
