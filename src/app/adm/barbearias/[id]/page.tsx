"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useAsync } from "@/lib/use-async";
import { cabecalhosPlataforma, usePlataforma } from "@/lib/use-plataforma";
import {
  Aviso,
  Botao,
  Cabecalho,
  Campo,
  Fila,
  Medida,
  SELO,
  Secao,
  Selo,
  data,
  dataLonga,
  emDias,
  type StatusAssinatura,
} from "@/components/adm/ui";

/**
 * A ficha de uma barbearia.
 *
 * Página própria, com endereço próprio: dá pra mandar o link pra alguém do
 * suporte, funciona no celular e abre já no lugar certo quando a estação
 * 01 aponta pra cá.
 *
 * O que ela mostra é o que resolve chamado: assinatura, integrações e se a
 * loja está de pé. O que a barbearia fatura, quem agendou nela e o e-mail
 * da equipe dela não passam por aqui — ver `lib/privacidade.ts`.
 */

interface Detalhe {
  barbearia: {
    id: string;
    nome: string;
    slug?: string;
    telefone: string;
    endereco: string;
    plano: string;
    criadaEm: string;
    status: StatusAssinatura;
    trialTerminaEm: string | null;
    assinaturaAte: string | null;
  };
  equipe: { total: number; donos: number; barbeiros: number };
  recebimento: {
    mercadoPago: {
      ambiente: string;
      conectadoEm: string;
      expiraEm: string;
      aceitaPix: boolean;
      aceitaCartao: boolean;
    } | null;
    pix: { tipo: string } | null;
  };
  saude: {
    servicos: number;
    produtos: number;
    pedidosTotal: number;
    pedidos30Dias: number;
    uso: { rotulo: string; nivel: 0 | 1 | 2 | 3 };
    ultimoPedidoEm: string | null;
  };
}

// Classe inteira e literal: o Tailwind procura a string no código-fonte,
// então `text-${variavel}` nunca chega a existir no CSS gerado.
const COR_USO = ["text-muted", "text-warn", "text-cyan", "text-ok"] as const;

export default function AdmBarbeariaPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const acesso = usePlataforma();
  const admin = acesso?.nivel === "admin";

  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");

  const { dados: d, carregando, erro, recarregar } = useAsync<Detalhe>(
    async () => {
      const r = await fetch(`/api/adm/barbearias?id=${id}`, {
        headers: await cabecalhosPlataforma(),
      });
      if (!r.ok) throw new Error("Barbearia não encontrada.");
      return r.json();
    },
    [id, acesso?.email],
    { pular: !acesso || !id },
  );

  if (!acesso) return null;

  async function agir(acao: string, corpo: Record<string, unknown> = {}) {
    setOcupado(true);
    setMensagem(null);
    try {
      const r = await fetch("/api/adm/acoes", {
        method: "POST",
        headers: await cabecalhosPlataforma(),
        body: JSON.stringify({ acao, barbeariaId: id, ...corpo }),
      });
      const c = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMensagem({ tipo: "erro", texto: c.erro ?? "Não foi possível." });
      } else if (acao === "excluir") {
        router.push("/adm/barbearias");
        return;
      } else {
        setMensagem({ tipo: "ok", texto: "Feito." });
        recarregar();
      }
    } catch {
      setMensagem({ tipo: "erro", texto: "Falha de conexão." });
    }
    setOcupado(false);
  }

  if (erro) {
    return (
      <div>
        <Cabecalho secao="Estação 02" titulo="Barbearia" />
        <div className="mt-8">
          <Aviso tom="off">{erro}</Aviso>
        </div>
        <Link
          href="/adm/barbearias"
          className="mt-6 inline-block font-body text-sm text-cyan hover:underline"
        >
          ← voltar pra lista
        </Link>
      </div>
    );
  }

  if (carregando || !d) {
    return (
      <p className="font-accent text-[11px] uppercase tracking-[0.22em] text-muted">
        Carregando
      </p>
    );
  }

  const b = d.barbearia;
  const semLoja = d.saude.servicos === 0;

  return (
    <div>
      <Link
        href="/adm/barbearias"
        className="adm-entra mb-6 inline-block font-body text-[11px] text-muted transition-colors hover:text-cyan"
      >
        ← todas as barbearias
      </Link>

      <Cabecalho
        secao="Estação 02 · ficha"
        titulo={b.nome}
        linha={
          <>
            {b.telefone || "sem telefone"}
            {b.endereco && ` · ${b.endereco}`}
            <span className="block text-muted">Cliente desde {dataLonga(b.criadaEm)}</span>
          </>
        }
        acao={
          <div className="flex flex-col items-end gap-2">
            <Selo tom={b.status === "ativa" ? "ok" : b.status === "trial" ? "warn" : "off"}>
              {SELO[b.status].texto}
            </Selo>
            {b.slug && (
              <a
                href={`/loja/${b.slug}`}
                target="_blank"
                rel="noreferrer"
                className="font-body text-[11px] text-muted transition-colors hover:text-cyan"
              >
                ver a loja ↗
              </a>
            )}
          </div>
        }
      />

      {mensagem && (
        <div className="mt-6">
          <Aviso tom={mensagem.tipo === "ok" ? "ok" : "off"}>{mensagem.texto}</Aviso>
        </div>
      )}

      {/* ---------- Assinatura ---------- */}
      <Secao titulo="Assinatura">
        <Fila>
          <Medida rotulo="Plano" valor={b.plano === "pro" ? "Pro" : "Básico"} />
          <Medida
            rotulo="Teste grátis até"
            valor={data(b.trialTerminaEm)}
            nota={emDias(b.trialTerminaEm)}
            tom={b.status === "trial" ? "warn" : "neutro"}
          />
          <Medida
            rotulo="Pago até"
            valor={data(b.assinaturaAte)}
            nota={b.assinaturaAte ? emDias(b.assinaturaAte) : "nunca pagou"}
            tom={b.status === "ativa" ? "ok" : "neutro"}
          />
          <Medida
            rotulo="Equipe"
            valor={String(d.equipe.total)}
            nota={`${d.equipe.donos} dono(s) · ${d.equipe.barbeiros} barbeiro(s)`}
          />
        </Fila>
      </Secao>

      {/* ---------- Saúde ---------- */}
      <Secao
        titulo="A loja está de pé?"
        direita={
          <span className={`font-accent text-[11px] ${COR_USO[d.saude.uso.nivel]}`}>
            {d.saude.uso.rotulo}
          </span>
        }
        atraso={60}
      >
        <Fila>
          <Medida
            rotulo="Serviços"
            valor={String(d.saude.servicos)}
            tom={semLoja ? "off" : "neutro"}
          />
          <Medida rotulo="Produtos" valor={String(d.saude.produtos)} />
          <Medida
            rotulo="Pedidos 30d"
            valor={String(d.saude.pedidos30Dias)}
            nota={`${d.saude.pedidosTotal} no total`}
            tom={d.saude.pedidos30Dias === 0 ? "warn" : "neutro"}
          />
          <Medida
            rotulo="Último pedido"
            valor={data(d.saude.ultimoPedidoEm)}
            nota={d.saude.ultimoPedidoEm ? "" : "nunca recebeu"}
          />
        </Fila>

        {semLoja && (
          <div className="mt-6">
            <Aviso tom="off">
              Sem nenhum serviço cadastrado — a página pública dela não vende nada. É a
              conta que mais precisa de uma ligação.
            </Aviso>
          </div>
        )}
      </Secao>

      {/* ---------- Recebimento ---------- */}
      <Secao
        titulo="Como ela recebe"
        nota="A chave Pix não aparece aqui, nem escondida. Se precisar conferir, peça pro dono ler a dele em Pagamentos."
        atraso={120}
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="border-l-[3px] border-line-strong pl-3.5">
            <p className="font-accent text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
              Mercado Pago
            </p>
            {d.recebimento.mercadoPago ? (
              <>
                <p className="mt-1.5 font-body text-sm text-ok">Conectado</p>
                <p className="mt-1 font-body text-[11px] leading-relaxed text-muted">
                  ambiente {d.recebimento.mercadoPago.ambiente} · desde{" "}
                  {data(d.recebimento.mercadoPago.conectadoEm)}
                  <br />
                  autorização até {data(d.recebimento.mercadoPago.expiraEm)} (
                  {emDias(d.recebimento.mercadoPago.expiraEm)})
                </p>
              </>
            ) : (
              <p className="mt-1.5 font-body text-sm text-muted">Não conectado</p>
            )}
          </div>

          <div className="border-l-[3px] border-line-strong pl-3.5">
            <p className="font-accent text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
              Pix na chave
            </p>
            {d.recebimento.pix ? (
              <>
                <p className="mt-1.5 font-body text-sm text-ok">Ativo</p>
                <p className="mt-1 font-body text-[11px] text-muted">
                  chave do tipo {d.recebimento.pix.tipo}
                </p>
              </>
            ) : (
              <p className="mt-1.5 font-body text-sm text-muted">Não cadastrado</p>
            )}
          </div>
        </div>
      </Secao>

      {/* ---------- Ações ---------- */}
      <Secao
        titulo="O que dá pra fazer daqui"
        nota="Toda ação fica registrada com o seu e-mail na estação 05."
        atraso={180}
      >
        <div className="space-y-6">
          <div>
            <p className="font-body text-xs font-medium text-bone-dim">
              Estender o teste grátis
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(admin ? [3, 7, 15, 30] : [3, 7]).map((dias) => (
                <Botao key={dias} disabled={ocupado} onClick={() => agir("estender_trial", { dias })}>
                  +{dias} dias
                </Botao>
              ))}
            </div>
            {!admin && (
              <p className="mt-2 font-body text-[11px] text-muted">
                O suporte estende até 7 dias por vez.
              </p>
            )}
          </div>

          <div>
            <p className="font-body text-xs font-medium text-bone-dim">
              Conexão do Mercado Pago
            </p>
            <div className="mt-2">
              <Botao
                disabled={ocupado || !d.recebimento.mercadoPago}
                onClick={() => agir("desconectar_mp")}
              >
                Soltar conexão — o dono reconecta do zero
              </Botao>
            </div>
          </div>

          {admin && (
            <div className="border-t border-line pt-5">
              <p className="font-accent text-[11px] font-semibold uppercase tracking-[0.1em] text-cyan">
                Só administrador
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Botao disabled={ocupado} onClick={() => agir("marcar_paga", { dias: 30 })}>
                  Marcar paga +30 dias
                </Botao>
                <Botao
                  disabled={ocupado || b.plano === "pro"}
                  onClick={() => agir("mudar_plano", { plano: "pro" })}
                >
                  Virar Pro
                </Botao>
                <Botao
                  disabled={ocupado || b.plano === "basico"}
                  onClick={() => agir("mudar_plano", { plano: "basico" })}
                >
                  Voltar pro Básico
                </Botao>
                <Botao tipo="perigo" disabled={ocupado} onClick={() => agir("bloquear")}>
                  Bloquear acesso
                </Botao>
              </div>
            </div>
          )}
        </div>
      </Secao>

      {/* ---------- Exclusão ---------- */}
      {admin && (
        <Secao titulo="Apagar" atraso={240}>
          <div className="border-l-2 border-off-line py-3 pl-4">
            <p className="font-body text-sm text-bone">
              Some tudo junto: {d.saude.servicos} serviço(s), {d.saude.produtos} produto(s),{" "}
              {d.saude.pedidosTotal} pedido(s), a agenda inteira, {d.equipe.total} conta(s) de
              acesso e as credenciais de recebimento.
            </p>
            <p className="mt-1 font-body text-sm font-semibold text-off">Não tem desfazer.</p>

            {b.status === "ativa" && (
              <p className="mt-3 font-body text-xs text-off">
                Atenção: esta barbearia está <strong>pagando</strong>.
              </p>
            )}

            {!excluindo ? (
              <div className="mt-4">
                <Botao tipo="perigo" onClick={() => setExcluindo(true)}>
                  Quero apagar
                </Botao>
              </div>
            ) : (
              <div className="mt-4 max-w-md">
                <p className="font-body text-xs text-bone-dim">
                  Digite <strong className="text-bone">{b.nome}</strong> pra confirmar:
                </p>
                <div className="mt-2">
                  <Campo valor={confirmacao} aoMudar={setConfirmacao} placeholder={b.nome} />
                </div>
                <div className="mt-3 flex gap-2">
                  <Botao
                    tipo="perigo"
                    disabled={ocupado || confirmacao.trim() !== b.nome}
                    onClick={() => agir("excluir", { confirmacao })}
                  >
                    {ocupado ? "Apagando…" : "Apagar pra sempre"}
                  </Botao>
                  <Botao
                    onClick={() => {
                      setExcluindo(false);
                      setConfirmacao("");
                    }}
                  >
                    Cancelar
                  </Botao>
                </div>
              </div>
            )}
          </div>
        </Secao>
      )}
    </div>
  );
}
