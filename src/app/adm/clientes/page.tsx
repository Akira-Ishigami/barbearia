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
  Fila,
  Medida,
  Proporcao,
  Secao,
  Selo,
  Serie,
  Vazio,
  dataLonga,
  quando,
  type Semana,
} from "@/components/adm/ui";

/**
 * Estação 04 — quem agenda.
 *
 * Esta é a tela mais delicada do sistema: o dado aqui é pessoal de pessoa
 * física, e ela não é cliente da Navalha — é cliente da barbearia. A
 * Navalha só guarda porque precisa pro serviço funcionar.
 *
 * Por isso ela é feita ao contrário das outras: **não existe listagem**.
 * Abrir a tela mostra contagem e mais nada. Pessoa só aparece quando
 * alguém procura por ela pelo dado inteiro — que é o caso real de suporte,
 * com a pessoa do outro lado da linha ditando o próprio contato. E mesmo
 * assim vem mascarada.
 *
 * Em qual barbearia cada uma foi atendida não aparece em lugar nenhum:
 * isso é a relação dela com a barbearia, não com a plataforma.
 */

interface Encontrado {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  temConta: boolean;
  criadoEm: string;
  visitas: number;
  ultimaVisita: string | null;
}

interface Resposta {
  nivel: string;
  resumo: {
    total: number;
    comConta: number;
    semConta: number;
    agendaram: number;
    voltaram: number;
    ativosEm30: number;
    novosEm7Dias: number;
    novosEm30Dias: number;
    taxaRetorno: number | null;
    mediaVisitas: number;
  };
  semanas: Semana[];
  encontrados: Encontrado[] | null;
  aviso?: string;
}

export default function AdmClientesPage() {
  const acesso = usePlataforma();
  const admin = acesso?.nivel === "admin";

  const [campo, setCampo] = useState("");
  const [busca, setBusca] = useState("");
  const [apagando, setApagando] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const { dados: d, carregando, erro, recarregar } = useAsync<Resposta>(
    async () => {
      const url = busca
        ? `/api/adm/clientes?busca=${encodeURIComponent(busca)}`
        : "/api/adm/clientes";
      const r = await fetch(url, { headers: await cabecalhosPlataforma() });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro ?? "Falha ao carregar.");
      return r.json();
    },
    [acesso?.email, busca],
    { pular: !acesso },
  );

  if (!acesso) return null;

  function procurar(e: FormEvent) {
    e.preventDefault();
    setMensagem(null);
    setBusca(campo.trim());
  }

  async function apagar(c: Encontrado) {
    if (
      !window.confirm(
        `Apagar o cadastro de ${c.nome} (${c.email})?\n\n` +
          "Use isto quando a própria pessoa pedir pra sair. A conta e os dados dela " +
          "somem; os pedidos ficam com a barbearia, sem ligação com ninguém.\n\n" +
          "Não tem desfazer.",
      )
    ) {
      return;
    }

    setApagando(c.id);
    const r = await fetch(`/api/adm/clientes?id=${c.id}`, {
      method: "DELETE",
      headers: await cabecalhosPlataforma(),
    });
    const corpo = await r.json().catch(() => ({}));
    setApagando(null);

    if (!r.ok) setMensagem(corpo.erro ?? "Não foi possível apagar.");
    else {
      setMensagem("Cadastro apagado.");
      recarregar();
    }
  }

  const r = d?.resumo;

  return (
    <div>
      <Cabecalho
        secao="Estação 04"
        titulo="Quem agenda"
        linha="Os clientes das barbearias. O que interessa à plataforma é se a base cresce e se as pessoas voltam — não quem elas são."
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

      {d && r && (
        <>
          <Secao titulo="A base">
            <Fila>
              <Medida
                rotulo="Contas"
                valor={String(r.total)}
                nota={`+${r.novosEm7Dias} na semana · +${r.novosEm30Dias} em 30 dias`}
                tom="acento"
              />
              <Medida
                rotulo="Voltam a agendar"
                valor={r.taxaRetorno === null ? "—" : `${r.taxaRetorno}%`}
                nota={
                  r.agendaram === 0
                    ? "ninguém agendou ainda"
                    : `${r.voltaram} de ${r.agendaram} que agendaram`
                }
                tom="ok"
              />
              <Medida
                rotulo="Ativos em 30 dias"
                valor={String(r.ativosEm30)}
                nota="agendaram no período"
              />
              <Medida
                rotulo="Média de visitas"
                valor={String(r.mediaVisitas)}
                nota="por quem já agendou"
              />
            </Fila>
          </Secao>

          <Secao titulo="Últimas 10 semanas" atraso={60}>
            <div className="grid gap-8 sm:grid-cols-3">
              <Serie titulo="Contas novas" semanas={d.semanas} campo="cadastros" />
              <Serie titulo="Agendamentos" semanas={d.semanas} campo="pedidos" />
              <div className="border-t border-line-strong pt-3">
                <p className="font-accent text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Agendam com conta?
                </p>
                <p className="mt-1 font-body text-[11px] leading-snug text-muted">
                  Dá pra marcar sem criar conta — ela só guarda o histórico.
                </p>
                <div className="mt-4">
                  <Proporcao
                    total={r.total}
                    itens={[
                      { rotulo: "Com conta", valor: r.comConta },
                      { rotulo: "Sem conta", valor: r.semConta, tom: "neutro" },
                    ]}
                  />
                </div>
              </div>
            </div>
          </Secao>

          {/* ---------- Busca ---------- */}
          <Secao
            titulo="Procurar uma pessoa"
            nota="Só pra atender quem entrou em contato. Toda busca fica no registro, com quem procurou."
            atraso={120}
          >
            <div className="max-w-xl">
              <Aviso>
                Não existe lista aqui. Uma relação de todos os clientes das barbearias não
                teria finalidade — e dado pessoal sem finalidade não se guarda nem se
                mostra. Digite o <strong>e-mail completo</strong> ou o{" "}
                <strong>telefone com DDD</strong> de quem procurou você.
              </Aviso>

              <form onSubmit={procurar} className="mt-6 flex flex-wrap items-end gap-3">
                <div className="min-w-56 flex-1">
                  <Campo
                    valor={campo}
                    aoMudar={setCampo}
                    placeholder="fulano@email.com ou (11) 98888-7777"
                  />
                </div>
                <Botao type="submit" tipo="principal">
                  Procurar
                </Botao>
                {busca && (
                  <Botao
                    onClick={() => {
                      setCampo("");
                      setBusca("");
                      setMensagem(null);
                    }}
                  >
                    Limpar
                  </Botao>
                )}
              </form>

              {d.aviso && (
                <div className="mt-4">
                  <Aviso tom="warn">{d.aviso}</Aviso>
                </div>
              )}
              {mensagem && (
                <div className="mt-4">
                  <Aviso tom="ok">{mensagem}</Aviso>
                </div>
              )}
            </div>

            {d.encontrados !== null && (
              <div className="mt-8">
                {d.encontrados.length === 0 && !d.aviso ? (
                  <Vazio>Ninguém com esse e-mail ou telefone.</Vazio>
                ) : (
                  <div className="border-t border-line">
                    {d.encontrados.map((c) => (
                      <div
                        key={c.id}
                        className="flex flex-wrap items-start justify-between gap-4 border-b border-line py-4"
                      >
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 font-body text-sm text-bone">
                            {c.nome}
                            {!c.temConta && <Selo>sem conta</Selo>}
                          </p>
                          <p className="mt-1 font-accent text-[11px] text-muted">
                            {c.email} · {c.telefone}
                          </p>
                          <p className="mt-1 font-body text-[11px] text-muted">
                            {c.visitas === 0
                              ? "nunca agendou"
                              : `${c.visitas} visita(s) · última ${quando(c.ultimaVisita!)}`}{" "}
                            · cadastro de {dataLonga(c.criadoEm)}
                          </p>
                        </div>

                        {admin && (
                          <div className="shrink-0">
                            <Botao
                              tipo="perigo"
                              disabled={apagando === c.id}
                              onClick={() => apagar(c)}
                            >
                              {apagando === c.id ? "Apagando…" : "Apagar a pedido dela"}
                            </Botao>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Secao>

          <Secao titulo="Por que a tela é assim" atraso={180}>
            <div className="max-w-2xl space-y-3 font-body text-sm leading-relaxed text-bone-dim">
              <p>
                Nome, e-mail e telefone de pessoa física são dado pessoal. A Navalha guarda
                porque precisa — sem isso não existe agendamento —, mas guardar não é o
                mesmo que poder olhar quando quiser.
              </p>
              <p>
                A regra que esta tela segue está inteira em{" "}
                <Link href="/adm/privacidade" className="text-cyan underline underline-offset-2">
                  Privacidade
                </Link>
                , junto com o que a plataforma deixa de ver nas outras estações.
              </p>
            </div>
          </Secao>
        </>
      )}
    </div>
  );
}
