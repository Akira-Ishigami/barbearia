"use client";

import Link from "next/link";
import { useAsync } from "@/lib/use-async";
import { cabecalhosPlataforma, usePlataforma } from "@/lib/use-plataforma";
import {
  Aviso,
  Botao,
  Cabecalho,
  Fila,
  Medida,
  Pendencia,
  Secao,
  dinheiro,
  quando,
} from "@/components/adm/ui";
import type { Visao } from "./tipos";

/**
 * Estação 01 — Hoje.
 *
 * Responde uma pergunta só: **o que eu preciso resolver agora?**
 *
 * Por isso a tela abre com uma lista numerada de pendências, e não com
 * contagem de tabela. Quantas barbearias existem é informação de arquivo;
 * "o teste da Barbearia do Zé vence em dois dias" é trabalho. O arquivo
 * mora na estação 03.
 *
 * A lista é montada por prioridade, não por categoria: quem está prestes a
 * perder acesso vem antes de quem esqueceu de conectar o Mercado Pago.
 */

interface Pendente {
  titulo: string;
  motivo: string;
  prazo?: string;
  tom: "off" | "warn" | "neutro";
  href: string;
  peso: number;
}

export default function AdmHojePage() {
  const acesso = usePlataforma();

  const {
    dados: d,
    carregando,
    erro,
    recarregar,
  } = useAsync<Visao>(
    async () => {
      const r = await fetch("/api/adm/visao", { headers: await cabecalhosPlataforma() });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro ?? "Falha ao carregar.");
      return r.json();
    },
    [acesso?.email],
    { pular: !acesso },
  );

  if (!acesso) return null;

  const link = (id: string) => `/adm/barbearias/${id}`;

  // Peso menor sobe na lista. A ordem é a ordem em que vale a pena atacar:
  // acesso perdido primeiro, oportunidade de venda depois, higiene por fim.
  const pendencias: Pendente[] = [];
  if (d) {
    for (const b of d.atencao.vencidas) {
      pendencias.push({
        titulo: b.nome,
        motivo: "Perdeu o acesso — teste acabou ou o pagamento não veio",
        prazo: "bloqueada",
        tom: "off",
        href: link(b.id),
        peso: 1,
      });
    }
    for (const b of d.atencao.trialAcabando) {
      pendencias.push({
        titulo: b.nome,
        motivo: "Teste grátis terminando",
        prazo: (b.dias ?? 0) <= 0 ? "hoje" : `${b.dias}d`,
        tom: "warn",
        href: link(b.id),
        peso: 2 + (b.dias ?? 0) / 100,
      });
    }
    for (const b of d.atencao.semCatalogo) {
      pendencias.push({
        titulo: b.nome,
        motivo: "Cadastrou e não montou nada — sem serviço, a página dela não vende",
        prazo: `${b.barbeiros ?? 0} na equipe`,
        tom: "off",
        href: link(b.id),
        peso: 3,
      });
    }
    for (const b of d.atencao.paradas) {
      pendencias.push({
        titulo: b.nome,
        motivo: "Tem catálogo, mas parou de receber agendamento",
        prazo: b.diasParada === null ? "nunca usou" : `há ${b.diasParada}d`,
        tom: "warn",
        href: link(b.id),
        peso: 4,
      });
    }
    for (const b of d.atencao.tokenMpVencendo) {
      pendencias.push({
        titulo: b.nome,
        motivo: "Autorização do Mercado Pago perto de expirar",
        prazo: `${b.dias}d`,
        tom: "warn",
        href: link(b.id),
        peso: 5,
      });
    }
    for (const b of d.atencao.semRecebimento) {
      pendencias.push({
        titulo: b.nome,
        motivo: "Só cobra no balcão — sem Mercado Pago e sem Pix",
        tom: "neutro",
        href: link(b.id),
        peso: 6,
      });
    }
    pendencias.sort((a, b) => a.peso - b.peso);
  }

  return (
    <div>
      <Cabecalho
        secao="Estação 01"
        titulo="Hoje"
        linha={
          <>
            Bom dia, {acesso.nome.split(" ")[0]}. Esta folha lista o que precisa de você —
            em ordem de urgência. Os números da plataforma ficam em{" "}
            <Link href="/adm/crescimento" className="text-cyan underline underline-offset-2">
              Crescimento
            </Link>
            .
          </>
        }
        acao={
          <Botao onClick={recarregar} disabled={carregando}>
            {carregando ? "Atualizando…" : "Atualizar"}
          </Botao>
        }
      />

      {erro && (
        <div className="mt-8">
          <Aviso tom="off">{erro}</Aviso>
        </div>
      )}
      {carregando && !d && (
        <p className="mt-8 font-accent text-[11px] uppercase tracking-[0.22em] text-muted">
          Carregando
        </p>
      )}

      {d && (
        <>
          {/* ---------- Pendências ---------- */}
          <Secao
            titulo="Precisa de você"
            direita={
              <span className="tabular font-accent text-[11px] text-muted">
                {pendencias.length} {pendencias.length === 1 ? "item" : "itens"}
              </span>
            }
          >
            {pendencias.length === 0 ? (
              <Aviso tom="ok">
                Nada pendente. Nenhum teste vencendo, nenhuma barbearia parada, todo mundo
                com a loja montada.
              </Aviso>
            ) : (
              <div className="border-t border-line">
                {pendencias.map((p, i) => (
                  <Pendencia
                    key={`${p.href}-${p.motivo}`}
                    ordem={i + 1}
                    titulo={p.titulo}
                    motivo={p.motivo}
                    prazo={p.prazo}
                    tom={p.tom}
                    href={p.href}
                  />
                ))}
              </div>
            )}
          </Secao>

          {/* ---------- O pulso ---------- */}
          <Secao
            titulo="O pulso"
            nota="Movimento da plataforma inteira. O que cada barbearia fatura não entra aqui."
            atraso={70}
          >
            <Fila>
              <Medida
                rotulo="Assinaturas"
                valor={dinheiro(d.receita.mensalRecorrente)}
                nota={`por mês · ${d.barbearias.ativa} pagando`}
                tom="ok"
              />
              <Medida
                rotulo="Barbearias"
                valor={String(d.barbearias.total)}
                nota={`+${d.barbearias.novasEm7Dias} nesta semana`}
              />
              <Medida
                rotulo="Agendamentos 24h"
                valor={String(d.uso.pedidos24h)}
                nota={`${d.uso.barbeariasAtivas7Dias} com movimento na semana`}
                tom="acento"
              />
              <Medida
                rotulo="Aguardando o dono"
                valor={String(d.uso.statusAgenda.pendente ?? 0)}
                nota="horários por confirmar nas barbearias"
                tom={(d.uso.statusAgenda.pendente ?? 0) > 0 ? "warn" : "neutro"}
              />
            </Fila>
          </Secao>

          {/* ---------- Chegou agora ---------- */}
          <Secao titulo="Chegou agora" atraso={140}>
            <div className="grid gap-10 lg:grid-cols-2">
              <div>
                <p className="font-accent text-[10px] uppercase tracking-[0.16em] text-muted">
                  Últimas barbearias
                </p>
                <div className="mt-3 border-t border-line">
                  {d.ultimosCadastros.map((b) => (
                    <Link
                      key={b.id}
                      href={link(b.id)}
                      className="flex items-baseline justify-between gap-3 border-b border-line py-2.5 transition-colors hover:bg-bone/[0.025]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-body text-sm text-bone">
                          {b.nome}
                        </span>
                        <span className="font-body text-[11px] text-muted">
                          plano {b.plano} · {quando(b.criadaEm)}
                        </span>
                      </span>
                      <span className="shrink-0 font-accent text-[10px] uppercase tracking-wider text-muted">
                        {b.status}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-accent text-[10px] uppercase tracking-[0.16em] text-muted">
                  Últimas ações do suporte
                </p>
                <div className="mt-3 border-t border-line">
                  {d.log.length === 0 && (
                    <p className="border-b border-line py-3 font-body text-xs text-muted">
                      Nada registrado ainda.
                    </p>
                  )}
                  {d.log.map((l) => (
                    <p
                      key={l.id}
                      className="border-b border-line py-2.5 font-body text-xs text-bone-dim"
                    >
                      <span className="text-bone">{l.email.split("@")[0]}</span>{" "}
                      {l.acao.replace(/_/g, " ")}
                      <span className="block font-body text-[11px] text-muted">
                        {quando(l.criado_em)}
                      </span>
                    </p>
                  ))}
                </div>
                <Link
                  href="/adm/registro"
                  className="mt-3 inline-block font-body text-[11px] text-cyan hover:underline"
                >
                  ver o registro completo →
                </Link>
              </div>
            </div>
          </Secao>
        </>
      )}
    </div>
  );
}
