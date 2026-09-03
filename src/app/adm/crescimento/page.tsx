"use client";

import Link from "next/link";
import { useState } from "react";
import { useAsync } from "@/lib/use-async";
import { cabecalhosPlataforma, usePlataforma } from "@/lib/use-plataforma";
import {
  Aviso,
  Botao,
  Cabecalho,
  Fila,
  Medida,
  Proporcao,
  SELO,
  Secao,
  Selo,
  Serie,
  data,
  dinheiro,
} from "@/components/adm/ui";
import { ROTULO_FORMA, type Visao } from "../tipos";

/**
 * Estação 03 — os números.
 *
 * Aqui mora o que a estação 01 tira do caminho: o retrato da plataforma.
 * A separação é o ponto — misturar "quanto eu tenho" com "o que eu faço
 * hoje" faz a segunda pergunta se perder no meio da primeira.
 *
 * Uma nota que vale repetir na tela: o único dinheiro aqui é a mensalidade
 * das assinaturas, que é receita da Navalha. Quanto cada barbearia fatura
 * não é lido em lugar nenhum do sistema.
 */

interface RespostaCarteira {
  ok?: boolean;
  saldo?: { disponivel: number; moeda: string };
  erro?: string;
  motivo?: string;
  conectadoViaOAuth?: boolean;
  apelido?: string;
}

export default function AdmCrescimentoPage() {
  const acesso = usePlataforma();
  const admin = acesso?.nivel === "admin";

  const { dados: d, carregando, erro } = useAsync<Visao>(
    async () => {
      const r = await fetch("/api/adm/visao", { headers: await cabecalhosPlataforma() });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro ?? "Falha ao carregar.");
      return r.json();
    },
    [acesso?.email],
    { pular: !acesso },
  );

  // Saldo é chamada à parte, e não faz parte de /api/adm/visao: depende do
  // Mercado Pago responder, que é mais lento e menos confiável que ler o
  // próprio banco — não faz sentido travar o resto da tela por causa dele.
  const { dados: carteira, carregando: carregandoCarteira } = useAsync<RespostaCarteira>(
    async () => {
      const r = await fetch("/api/adm/carteira", { headers: await cabecalhosPlataforma() });
      return r.json();
    },
    [acesso?.email],
    { pular: !admin },
  );

  const [conectando, setConectando] = useState(false);
  const [erroConexao, setErroConexao] = useState<string | null>(null);

  async function conectarMP() {
    setErroConexao(null);
    setConectando(true);
    try {
      const r = await fetch("/api/adm/mp/conectar", { headers: await cabecalhosPlataforma() });
      const corpo = await r.json().catch(() => ({}));
      if (!r.ok || !corpo.url) {
        setErroConexao(
          [corpo.erro, corpo.comoResolver].filter(Boolean).join(" ") ||
            "Não foi possível iniciar a conexão.",
        );
        setConectando(false);
        return;
      }
      // Navegação de página inteira: o Mercado Pago precisa carregar a
      // própria tela de login.
      window.location.href = corpo.url;
    } catch {
      setErroConexao("Não foi possível iniciar a conexão.");
      setConectando(false);
    }
  }

  if (!acesso) return null;

  const totalForma = d ? Object.values(d.uso.porForma).reduce((a, b) => a + b, 0) : 0;
  const agenda = d?.uso.statusAgenda ?? {};
  const totalAgenda = Object.values(agenda).reduce((a, b) => a + b, 0);
  const maiorUso = Math.max(1, ...(d?.ranking ?? []).map((r) => r.pedidos));

  return (
    <div>
      <Cabecalho
        secao="Estação 03"
        titulo="Crescimento"
        linha="O retrato da plataforma inteira. O que precisa de ação hoje fica na estação 01."
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
          {/* ---------- Receita ---------- */}
          <Secao
            titulo="Receita da Navalha"
            nota="A mensalidade das assinaturas. O que o cliente paga à barbearia não passa pela Navalha e não é lido em lugar nenhum."
          >
            <Fila>
              <Medida
                rotulo="Por mês"
                valor={dinheiro(d.receita.mensalRecorrente)}
                nota={`${d.barbearias.ativa} assinatura(s) em dia`}
                tom="ok"
              />
              <Medida
                rotulo="Convertem"
                valor={d.conversao.taxa === null ? "—" : `${d.conversao.taxa}%`}
                nota={
                  d.conversao.saiuDoTeste === 0
                    ? "ninguém terminou o teste ainda"
                    : `${d.conversao.jaPagaram} de ${d.conversao.saiuDoTeste} que saíram do teste`
                }
                tom="acento"
              />
              <Medida
                rotulo="Em teste"
                valor={String(d.barbearias.trial)}
                nota="ainda não decidiram"
                tom="warn"
              />
              <Medida
                rotulo="Perderam acesso"
                valor={String(d.barbearias.vencida)}
                nota="teste acabou ou não pagaram"
                tom={d.barbearias.vencida > 0 ? "off" : "neutro"}
              />
            </Fila>
          </Secao>

          {/* ---------- Carteira ---------- */}
          {admin && (
            <Secao
              titulo="Carteira"
              nota={
                carteira?.conectadoViaOAuth
                  ? `Conectada por login, como ${carteira.apelido || "Navalha"} — saldo de verdade, não estimativa.`
                  : "Saldo de verdade na conta do Mercado Pago da Navalha — não é estimativa, é o que já caiu."
              }
              atraso={40}
              direita={
                <Botao onClick={conectarMP} disabled={conectando}>
                  {conectando
                    ? "Abrindo o Mercado Pago…"
                    : carteira?.conectadoViaOAuth
                      ? "Reconectar"
                      : "Conectar com Mercado Pago"}
                </Botao>
              }
            >
              {erroConexao && (
                <div className="mb-4">
                  <Aviso tom="off">{erroConexao}</Aviso>
                </div>
              )}
              {carregandoCarteira && (
                <p className="font-body text-sm text-muted">Consultando o Mercado Pago…</p>
              )}
              {!carregandoCarteira && carteira?.ok && carteira.saldo && (
                <Medida
                  rotulo={`Disponível · ${carteira.saldo.moeda}`}
                  valor={dinheiro(carteira.saldo.disponivel)}
                  tom="ok"
                />
              )}
              {!carregandoCarteira && (!carteira || !carteira.ok) && (
                <>
                  <Aviso tom="warn">
                    {carteira?.erro ?? "Não foi possível consultar o saldo agora."}
                  </Aviso>
                  <div className="mt-4">
                    <Medida
                      rotulo="Faturamento · mensalidades em dia"
                      valor={dinheiro(d.receita.mensalRecorrente)}
                      nota="não é o saldo do Mercado Pago — é a soma do que as assinaturas ativas pagam por mês"
                      tom="acento"
                    />
                  </div>
                </>
              )}
            </Secao>
          )}

          {/* ---------- Séries ---------- */}
          <Secao
            titulo="Últimas 10 semanas"
            nota="Duas medidas, dois desenhos. Passe o mouse numa barra pra ver a semana."
            atraso={60}
          >
            <div className="grid gap-8 sm:grid-cols-2">
              <Serie titulo="Barbearias novas" semanas={d.semanas} campo="cadastros" />
              <Serie titulo="Agendamentos" semanas={d.semanas} campo="pedidos" />
            </div>
          </Secao>

          {/* ---------- Composição ---------- */}
          <Secao titulo="Composição da base" atraso={120}>
            <div className="grid gap-10 lg:grid-cols-3">
              <div>
                <p className="font-accent text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Situação
                </p>
                <div className="mt-4">
                  <Proporcao
                    total={d.barbearias.total}
                    itens={[
                      { rotulo: "Pagando", valor: d.barbearias.ativa, tom: "ok" },
                      { rotulo: "Em teste", valor: d.barbearias.trial, tom: "warn" },
                      { rotulo: "Vencida", valor: d.barbearias.vencida, tom: "off" },
                    ]}
                  />
                </div>
              </div>

              <div>
                <p className="font-accent text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Plano
                </p>
                <div className="mt-4">
                  <Proporcao
                    total={d.barbearias.total}
                    itens={[
                      { rotulo: "Básico", valor: d.planos.basico ?? 0 },
                      { rotulo: "Pro", valor: d.planos.pro ?? 0 },
                    ]}
                  />
                </div>
              </div>

              <div>
                <p className="font-accent text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Como recebem
                </p>
                <div className="mt-4">
                  <Proporcao
                    total={d.barbearias.total}
                    itens={[
                      { rotulo: "Mercado Pago", valor: d.pagamentos.comMercadoPago },
                      { rotulo: "Pix na chave", valor: d.pagamentos.comPixDireto },
                      {
                        rotulo: "Só no balcão",
                        valor: d.pagamentos.semRecebimentoOnline,
                        tom: "warn",
                      },
                    ]}
                  />
                </div>
              </div>
            </div>
          </Secao>

          {/* ---------- Uso ---------- */}
          <Secao
            titulo="Uso da plataforma"
            nota="Contagem de agendamentos. Nenhum valor entra nesta conta."
            atraso={180}
          >
            <Fila>
              <Medida rotulo="Últimas 24h" valor={String(d.uso.pedidos24h)} nota="agendamentos" />
              <Medida
                rotulo="7 dias"
                valor={String(d.uso.pedidos7Dias)}
                nota={`${d.uso.barbeariasAtivas7Dias} barbearia(s) com movimento`}
              />
              <Medida rotulo="30 dias" valor={String(d.uso.pedidos30Dias)} nota="agendamentos" />
              <Medida
                rotulo="Contas de cliente"
                valor={String(d.uso.clientes)}
                nota="quem agenda — estação 04"
              />
            </Fila>

            <div className="mt-10 grid gap-10 lg:grid-cols-2">
              <div>
                <p className="font-accent text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                  O que acontece com o horário · 30 dias
                </p>
                <div className="mt-4">
                  <Proporcao
                    total={totalAgenda}
                    itens={[
                      { rotulo: "Concluído", valor: agenda.concluido ?? 0, tom: "ok" },
                      { rotulo: "Confirmado", valor: agenda.confirmado ?? 0 },
                      { rotulo: "Aguardando o dono", valor: agenda.pendente ?? 0, tom: "warn" },
                      {
                        rotulo: "Checkout abandonado",
                        valor: agenda.aguardando_pagamento ?? 0,
                        tom: "off",
                      },
                      { rotulo: "Cancelado", valor: agenda.cancelado ?? 0, tom: "off" },
                    ]}
                  />
                </div>
              </div>

              <div>
                <p className="font-accent text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Como o cliente paga · 30 dias
                </p>
                <div className="mt-4">
                  <Proporcao
                    total={totalForma}
                    itens={Object.keys(ROTULO_FORMA).map((f) => ({
                      rotulo: ROTULO_FORMA[f],
                      valor: d.uso.porForma[f] ?? 0,
                    }))}
                  />
                </div>
              </div>
            </div>
          </Secao>

          {/* ---------- Quem mais usa ---------- */}
          <Secao
            titulo="Quem mais usa"
            nota={`Agendamentos nos últimos ${d.janelaDias} dias. Ordenado por quantidade — o valor de cada barbearia não entra aqui.`}
            atraso={240}
          >
            <div className="border-t border-line">
              {d.ranking.slice(0, 12).map((r) => (
                <Link
                  key={r.id}
                  href={`/adm/barbearias/${r.id}`}
                  className="group flex items-center gap-4 border-b border-line py-3 transition-colors hover:bg-bone/[0.025]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-body text-sm text-bone group-hover:text-cyan">
                        {r.nome}
                      </span>
                      <Selo
                        tom={
                          r.status === "ativa" ? "ok" : r.status === "trial" ? "warn" : "off"
                        }
                      >
                        {SELO[r.status].texto}
                      </Selo>
                    </span>
                    <span className="mt-1.5 block h-[3px] w-full bg-bone/[0.07]">
                      <span
                        className="block h-full bg-cyan/70 transition-colors group-hover:bg-cyan"
                        style={{ width: `${Math.max(1, (r.pedidos / maiorUso) * 100)}%` }}
                      />
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="tabular block font-accent text-sm text-bone">
                      {r.pedidos}
                    </span>
                    <span className="block font-body text-[11px] text-muted">
                      último {data(r.ultimoPedido)}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </Secao>
        </>
      )}
    </div>
  );
}
