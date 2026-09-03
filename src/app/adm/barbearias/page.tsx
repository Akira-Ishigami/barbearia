"use client";

import Link from "next/link";
import { useState } from "react";
import { useAsync } from "@/lib/use-async";
import { cabecalhosPlataforma, usePlataforma } from "@/lib/use-plataforma";
import {
  Cabecalho,
  Campo,
  SELO,
  Selo,
  Vazio,
  data,
  type StatusAssinatura,
} from "@/components/adm/ui";

/**
 * Estação 02 — a base.
 *
 * Uma lista, e só. O detalhe de cada barbearia ganhou página própria
 * (`/adm/barbearias/[id]`) em vez de painel lateral: painel lateral obriga
 * a tela a servir a dois donos, fica apertado no celular e não dá pra
 * mandar o link pra ninguém.
 *
 * A lista é densa de propósito — linha fina, sem cartão. Quem abre esta
 * tela quer varrer, achar e clicar; cartão com sombra e respiro transforma
 * vinte barbearias em vinte telas de rolagem.
 */

interface LinhaBarbearia {
  id: string;
  nome: string;
  slug?: string;
  telefone: string;
  plano: string;
  criadaEm: string;
  status: StatusAssinatura;
  trialTerminaEm: string | null;
  assinaturaAte: string | null;
  mercadoPago: boolean;
  pixDireto: boolean;
}

type Filtro = StatusAssinatura | "todas";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "ativa", label: "Pagando" },
  { id: "trial", label: "Em teste" },
  { id: "vencida", label: "Vencida" },
];

export default function AdmBarbeariasPage() {
  const acesso = usePlataforma();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const { dados, carregando, erro } = useAsync<{ barbearias: LinhaBarbearia[] }>(
    async () => {
      const r = await fetch("/api/adm/barbearias", { headers: await cabecalhosPlataforma() });
      if (!r.ok) throw new Error("Falha ao carregar.");
      return r.json();
    },
    [acesso?.email],
    { pular: !acesso },
  );

  if (!acesso) return null;

  const barbearias = dados?.barbearias ?? [];
  const termo = busca.trim().toLowerCase();

  const filtradas = barbearias.filter((b) => {
    if (filtro !== "todas" && b.status !== filtro) return false;
    if (!termo) return true;
    return (
      b.nome.toLowerCase().includes(termo) ||
      (b.telefone ?? "").includes(termo) ||
      (b.slug ?? "").includes(termo)
    );
  });

  const contar = (f: Filtro) =>
    f === "todas" ? barbearias.length : barbearias.filter((b) => b.status === f).length;

  return (
    <div>
      <Cabecalho
        secao="Estação 02"
        titulo="Barbearias"
        linha="Quem usa a Navalha. Clique numa para ver a situação da conta — assinatura, integrações e se a loja está de pé."
      />

      {/* ---------- Filtros ---------- */}
      <div className="adm-entra mt-8 flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="min-w-56 flex-1">
          <Campo valor={busca} aoMudar={setBusca} placeholder="Nome, telefone ou link da loja" />
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`border-b-2 px-3 pb-1.5 font-body text-xs font-semibold transition-colors ${
                filtro === f.id
                  ? "border-cyan text-cyan"
                  : "border-transparent text-muted hover:text-bone"
              }`}
            >
              {f.label}
              <span className="tabular ml-1.5 font-accent text-[11px] opacity-70">
                {contar(f.id)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {erro && <p className="mt-8 font-body text-sm text-off">{erro}</p>}
      {carregando && (
        <p className="mt-8 font-accent text-[11px] uppercase tracking-[0.22em] text-muted">
          Carregando
        </p>
      )}

      {/* ---------- Folha de linhas ---------- */}
      {!carregando && (
        <div className="adm-entra mt-8" style={{ animationDelay: "60ms" }}>
          {filtradas.length === 0 ? (
            <Vazio>Nenhuma barbearia com esse filtro.</Vazio>
          ) : (
            <>
              <div className="hidden grid-cols-[1fr_9rem_8rem_5rem] gap-4 border-b border-line-strong pb-2 font-accent text-[11px] font-semibold uppercase tracking-[0.1em] text-muted md:grid">
                <span>Barbearia</span>
                <span>Recebimento</span>
                <span>Assinatura</span>
                <span className="text-right">Desde</span>
              </div>

              {filtradas.map((b) => (
                <Link
                  key={b.id}
                  href={`/adm/barbearias/${b.id}`}
                  className="group grid grid-cols-1 gap-2 border-b border-line py-3.5 transition-colors hover:bg-bone/[0.025] md:grid-cols-[1fr_9rem_8rem_5rem] md:items-center md:gap-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-body text-sm font-medium text-bone group-hover:text-cyan">
                      {b.nome}
                    </p>
                    <p className="truncate font-body text-[11px] text-muted">
                      {b.telefone || "sem telefone"} · plano {b.plano}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {b.mercadoPago && <Selo>MP</Selo>}
                    {b.pixDireto && <Selo>Pix</Selo>}
                    {!b.mercadoPago && !b.pixDireto && <Selo tom="warn">só balcão</Selo>}
                  </div>

                  <div>
                    <Selo tom={b.status === "ativa" ? "ok" : b.status === "trial" ? "warn" : "off"}>
                      {SELO[b.status].texto}
                    </Selo>
                  </div>

                  <p className="tabular font-accent text-[11px] text-muted md:text-right">
                    {data(b.criadaEm)}
                  </p>
                </Link>
              ))}

              <p className="mt-4 font-body text-[11px] text-muted">
                {filtradas.length} de {barbearias.length}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
