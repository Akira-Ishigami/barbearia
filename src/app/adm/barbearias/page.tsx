"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAsync } from "@/lib/use-async";
import { cabecalhosPlataforma, usePlataforma } from "@/lib/use-plataforma";

/**
 * A tela que o suporte abre quando alguém liga com problema.
 *
 * Mostra o que é preciso pra cobrar, pra destravar e pra saber se a conta
 * está de pé — e só isso. Nome de quem agendou lá, valor das vendas,
 * faturamento, e-mail da equipe e chave Pix não passam por aqui: nada disso
 * ajuda a resolver o problema de quem ligou, e abrir a barbearia de alguém
 * pra olhar é o tipo de coisa que só se percebe quando já virou hábito.
 */

type Status = "trial" | "ativa" | "vencida";

interface LinhaBarbearia {
  id: string;
  nome: string;
  slug?: string;
  telefone: string;
  plano: string;
  criadaEm: string;
  status: Status;
  trialTerminaEm: string | null;
  assinaturaAte: string | null;
  mercadoPago: boolean;
  pixDireto: boolean;
}

interface Detalhe {
  barbearia: LinhaBarbearia & { endereco: string };
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

const ROTULO: Record<Status, { texto: string; classe: string }> = {
  ativa: { texto: "Pagando", classe: "border-ok-line bg-ok-soft text-ok" },
  trial: { texto: "Em teste", classe: "border-warn-line bg-warn-soft text-warn" },
  vencida: { texto: "Vencida", classe: "border-off-line bg-off-soft text-off" },
};

const COR_USO = ["text-muted", "text-warn", "text-bone", "text-ok"] as const;

function data(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

/** "vence em 3 dias" diz mais que uma data pra quem está atendendo. */
function emQuantosDias(iso: string | null): string {
  if (!iso) return "";
  const dias = Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (dias < 0) return `venceu há ${Math.abs(dias)} dia(s)`;
  if (dias === 0) return "vence hoje";
  return `vence em ${dias} dia(s)`;
}

function BarbeariasConteudo() {
  const acesso = usePlataforma();
  const admin = acesso?.nivel === "admin";
  const params = useSearchParams();

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Status | "todas">("todas");
  // A visão geral linka pra cá com `?abrir=<id>`: clicar num alerta lá tem
  // que cair direto na barbearia, não na lista pra procurar de novo.
  const [aberta, setAberta] = useState<string | null>(() => params.get("abrir"));
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");

  const lista = useAsync<{ barbearias: LinhaBarbearia[] }>(
    async () => {
      const r = await fetch("/api/adm/barbearias", { headers: await cabecalhosPlataforma() });
      if (!r.ok) throw new Error("Falha ao carregar.");
      return r.json();
    },
    [acesso?.email],
    { pular: !acesso },
  );

  const detalhe = useAsync<Detalhe>(
    async () => {
      const r = await fetch(`/api/adm/barbearias?id=${aberta}`, {
        headers: await cabecalhosPlataforma(),
      });
      if (!r.ok) throw new Error("Falha ao carregar a barbearia.");
      return r.json();
    },
    [aberta],
    { pular: !aberta },
  );

  if (!acesso) return null;

  const barbearias = lista.dados?.barbearias ?? [];

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

  function selecionar(id: string | null) {
    setAberta(id);
    setMensagem(null);
    setExcluindo(false);
    setConfirmacao("");
  }

  async function agir(acao: string, corpo: Record<string, unknown> = {}) {
    if (!aberta) return;
    setOcupado(true);
    setMensagem(null);
    try {
      const r = await fetch("/api/adm/acoes", {
        method: "POST",
        headers: await cabecalhosPlataforma(),
        body: JSON.stringify({ acao, barbeariaId: aberta, ...corpo }),
      });
      const c = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMensagem({ tipo: "erro", texto: c.erro ?? "Não foi possível." });
      } else if (acao === "excluir") {
        selecionar(null);
        lista.recarregar();
        setMensagem({ tipo: "ok", texto: `"${c.excluida}" foi apagada.` });
      } else {
        setMensagem({ tipo: "ok", texto: "Feito." });
        detalhe.recarregar();
        lista.recarregar();
      }
    } catch {
      setMensagem({ tipo: "erro", texto: "Falha de conexão." });
    }
    setOcupado(false);
  }

  const d = detalhe.dados;

  return (
    <div>
      <p className="font-accent text-xs uppercase tracking-[0.2em] text-cyan-bright">
        {admin ? "Administração" : "Suporte"}
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-bone">Barbearias</h1>
      <p className="mt-1 max-w-2xl font-body text-sm text-bone-dim">
        Procure pelo nome, telefone ou endereço da página. Abrindo uma, você vê a
        situação da conta dela — assinatura, integrações e se a loja está de pé.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Nome, telefone ou link…"
          className="min-w-56 flex-1 rounded-full border border-line-strong bg-bone/[0.03] px-4 py-2.5 font-body text-sm text-bone outline-none placeholder:text-muted focus:border-cyan"
        />
        {(["todas", "ativa", "trial", "vencida"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`rounded-full border px-4 py-2 font-body text-sm font-semibold transition-colors ${
              filtro === f
                ? "border-cyan bg-cyan/10 text-cyan-bright"
                : "border-line-strong text-bone-dim hover:border-cyan/40 hover:text-bone"
            }`}
          >
            {f === "todas" ? "Todas" : ROTULO[f].texto}
          </button>
        ))}
      </div>

      {lista.carregando && <p className="mt-6 font-body text-sm text-bone-dim">Carregando…</p>}
      {lista.erro && (
        <p className="mt-6 rounded-xl border border-off-line bg-off-soft px-4 py-3 font-body text-sm text-off">
          {lista.erro}
        </p>
      )}
      {!aberta && mensagem && (
        <p
          className={`mt-6 max-w-2xl rounded-xl border px-4 py-3 font-body text-sm ${
            mensagem.tipo === "ok"
              ? "border-ok-line bg-ok-soft text-ok"
              : "border-off-line bg-off-soft text-off"
          }`}
        >
          {mensagem.texto}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* ---------- Lista ---------- */}
        <div className="space-y-2">
          {!lista.carregando && filtradas.length === 0 && (
            <p className="rounded-xl border border-line bg-ink-elev px-4 py-6 text-center font-body text-sm text-muted">
              Nenhuma barbearia com esse filtro.
            </p>
          )}

          {filtradas.map((b) => (
            <button
              key={b.id}
              onClick={() => selecionar(b.id)}
              className={`w-full rounded-xl border px-4 py-3.5 text-left transition-colors ${
                aberta === b.id
                  ? "border-cyan bg-cyan/[0.06]"
                  : "border-line bg-ink-elev hover:border-line-strong"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-body text-sm font-semibold text-bone">{b.nome}</p>
                  <p className="truncate font-body text-xs text-muted">
                    {b.telefone || "sem telefone"} · plano {b.plano}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 font-body text-[10px] font-semibold ${
                    ROTULO[b.status].classe
                  }`}
                >
                  {ROTULO[b.status].texto}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {b.mercadoPago && (
                  <span className="rounded-full border border-line bg-bone/[0.03] px-2 py-0.5 font-body text-[10px] text-bone-dim">
                    Mercado Pago
                  </span>
                )}
                {b.pixDireto && (
                  <span className="rounded-full border border-line bg-bone/[0.03] px-2 py-0.5 font-body text-[10px] text-bone-dim">
                    Pix direto
                  </span>
                )}
                {!b.mercadoPago && !b.pixDireto && (
                  <span className="rounded-full border border-warn-line bg-warn-soft px-2 py-0.5 font-body text-[10px] text-warn">
                    só no balcão
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* ---------- Detalhe ---------- */}
        <div>
          {!aberta && (
            <div className="rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
              <p className="font-body text-sm text-muted">
                Escolha uma barbearia na lista pra ver a situação da conta.
              </p>
            </div>
          )}

          {aberta && detalhe.carregando && (
            <p className="font-body text-sm text-bone-dim">Carregando…</p>
          )}

          {aberta && d && (
            <div className="space-y-4">
              {/* Identificação e cobrança */}
              <div className="rounded-2xl border border-line bg-ink-elev p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-xl font-semibold text-bone">
                      {d.barbearia.nome}
                    </p>
                    <p className="font-body text-xs text-muted">
                      {d.barbearia.telefone || "sem telefone"}
                      {d.barbearia.endereco && ` · ${d.barbearia.endereco}`}
                    </p>
                    <p className="mt-0.5 font-body text-xs text-muted">
                      Cliente desde {data(d.barbearia.criadaEm)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-3 py-1 font-body text-[11px] font-semibold ${
                      ROTULO[d.barbearia.status].classe
                    }`}
                  >
                    {ROTULO[d.barbearia.status].texto}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-line bg-bone/[0.02] px-3.5 py-2.5">
                    <p className="font-body text-[11px] uppercase tracking-wide text-muted">
                      Teste grátis
                    </p>
                    <p className="font-body text-sm text-bone">
                      {data(d.barbearia.trialTerminaEm)}
                    </p>
                    <p className="font-body text-[11px] text-muted">
                      {emQuantosDias(d.barbearia.trialTerminaEm)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-line bg-bone/[0.02] px-3.5 py-2.5">
                    <p className="font-body text-[11px] uppercase tracking-wide text-muted">
                      Assinatura paga até
                    </p>
                    <p className="font-body text-sm text-bone">
                      {data(d.barbearia.assinaturaAte)}
                    </p>
                    <p className="font-body text-[11px] text-muted">
                      plano {d.barbearia.plano}
                    </p>
                  </div>
                </div>
              </div>

              {/* Saúde da conta */}
              <div className="rounded-2xl border border-line bg-ink-elev p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display text-base font-semibold text-bone">
                    A loja está de pé?
                  </p>
                  <span
                    className={`font-body text-xs font-semibold ${COR_USO[d.saude.uso.nivel]}`}
                  >
                    {d.saude.uso.rotulo}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { r: "Serviços", v: d.saude.servicos, alerta: d.saude.servicos === 0 },
                    { r: "Produtos", v: d.saude.produtos, alerta: false },
                    { r: "Equipe", v: d.equipe.total, alerta: false },
                    {
                      r: "Pedidos 30d",
                      v: d.saude.pedidos30Dias,
                      alerta: d.saude.pedidos30Dias === 0,
                    },
                  ].map((x) => (
                    <div key={x.r}>
                      <p className="font-body text-[11px] uppercase tracking-wide text-muted">
                        {x.r}
                      </p>
                      <p
                        className={`font-accent text-base ${x.alerta ? "text-warn" : "text-bone"}`}
                      >
                        {x.v}
                      </p>
                    </div>
                  ))}
                </div>

                <p className="mt-3 font-body text-[11px] text-muted">
                  {d.equipe.donos} dono(s) e {d.equipe.barbeiros} barbeiro(s) ·{" "}
                  {d.saude.pedidosTotal} pedido(s) no total · último em{" "}
                  {data(d.saude.ultimoPedidoEm)}
                </p>

                {d.saude.servicos === 0 && (
                  <p className="mt-3 rounded-lg border border-warn-line bg-warn-soft px-3 py-2 font-body text-xs text-warn">
                    Sem nenhum serviço cadastrado — a página pública dela não vende
                    nada. É a conta que mais precisa de uma ligação.
                  </p>
                )}
              </div>

              {/* Recebimento */}
              <div className="rounded-2xl border border-line bg-ink-elev p-5">
                <p className="font-display text-base font-semibold text-bone">
                  Como ela recebe
                </p>
                <div className="mt-3 space-y-2 font-body text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-bone-dim">Mercado Pago</span>
                    <span className="text-right">
                      {d.recebimento.mercadoPago ? (
                        <>
                          <span className="text-ok">conectado</span>
                          <span className="block font-body text-[11px] text-muted">
                            {d.recebimento.mercadoPago.ambiente} · desde{" "}
                            {data(d.recebimento.mercadoPago.conectadoEm)} · autorização
                            até {data(d.recebimento.mercadoPago.expiraEm)}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted">não conectado</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3 border-t border-line pt-2">
                    <span className="text-bone-dim">Pix direto</span>
                    <span className="text-right">
                      {d.recebimento.pix ? (
                        <>
                          <span className="text-ok">ativo</span>
                          <span className="block font-body text-[11px] text-muted">
                            chave do tipo {d.recebimento.pix.tipo}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted">não cadastrado</span>
                      )}
                    </span>
                  </div>
                </div>
                <p className="mt-3 font-body text-[11px] text-muted">
                  A chave Pix não aparece aqui nem escondida. Se precisar conferir,
                  peça pro dono ler a dele em Pagamentos.
                </p>
              </div>

              {/* Ações */}
              <div className="rounded-2xl border border-cyan/25 bg-cyan/[0.04] p-5">
                <p className="font-display text-base font-semibold text-bone">
                  O que dá pra fazer daqui
                </p>

                {mensagem && (
                  <p
                    className={`mt-3 rounded-lg border px-3 py-2 font-body text-xs ${
                      mensagem.tipo === "ok"
                        ? "border-ok-line bg-ok-soft text-ok"
                        : "border-off-line bg-off-soft text-off"
                    }`}
                  >
                    {mensagem.texto}
                  </p>
                )}

                <div className="mt-4 space-y-3">
                  <div>
                    <p className="font-body text-xs font-medium text-bone-dim">
                      Estender o teste grátis
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {(admin ? [3, 7, 15, 30] : [3, 7]).map((dias) => (
                        <button
                          key={dias}
                          disabled={ocupado}
                          onClick={() => agir("estender_trial", { dias })}
                          className="rounded-full border border-line-strong px-3.5 py-1.5 font-body text-xs text-bone-dim transition-colors hover:border-cyan hover:text-cyan-bright disabled:opacity-50"
                        >
                          +{dias} dias
                        </button>
                      ))}
                    </div>
                    {!admin && (
                      <p className="mt-1.5 font-body text-[11px] text-muted">
                        O suporte estende até 7 dias por vez.
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="font-body text-xs font-medium text-bone-dim">
                      Conexão do Mercado Pago
                    </p>
                    <button
                      disabled={ocupado || !d.recebimento.mercadoPago}
                      onClick={() => agir("desconectar_mp")}
                      className="mt-1.5 rounded-full border border-line-strong px-3.5 py-1.5 font-body text-xs text-bone-dim transition-colors hover:border-off-line hover:text-off disabled:opacity-40"
                    >
                      Soltar conexão (o dono reconecta do zero)
                    </button>
                  </div>

                  {admin && (
                    <div className="border-t border-cyan/20 pt-3">
                      <p className="font-body text-xs font-medium text-cyan-bright">
                        Só administrador
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <button
                          disabled={ocupado}
                          onClick={() => agir("marcar_paga", { dias: 30 })}
                          className="rounded-full border border-ok-line bg-ok-soft px-3.5 py-1.5 font-body text-xs text-ok transition-transform hover:scale-105 disabled:opacity-50"
                        >
                          Marcar paga +30 dias
                        </button>
                        <button
                          disabled={ocupado || d.barbearia.plano === "pro"}
                          onClick={() => agir("mudar_plano", { plano: "pro" })}
                          className="rounded-full border border-line-strong px-3.5 py-1.5 font-body text-xs text-bone-dim transition-colors hover:border-cyan hover:text-cyan-bright disabled:opacity-40"
                        >
                          Virar Pro
                        </button>
                        <button
                          disabled={ocupado || d.barbearia.plano === "basico"}
                          onClick={() => agir("mudar_plano", { plano: "basico" })}
                          className="rounded-full border border-line-strong px-3.5 py-1.5 font-body text-xs text-bone-dim transition-colors hover:border-cyan hover:text-cyan-bright disabled:opacity-40"
                        >
                          Voltar pro Básico
                        </button>
                        <button
                          disabled={ocupado}
                          onClick={() => agir("bloquear")}
                          className="rounded-full border border-off-line bg-off-soft px-3.5 py-1.5 font-body text-xs text-off transition-transform hover:scale-105 disabled:opacity-50"
                        >
                          Bloquear acesso
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <p className="mt-4 font-body text-[11px] text-muted">
                  Toda ação daqui fica registrada com o seu e-mail.
                </p>
              </div>

              {/* Exclusão — separada de tudo, porque não tem desfazer */}
              {admin && (
                <div className="rounded-2xl border border-off-line bg-off-soft p-5">
                  <p className="font-display text-base font-semibold text-off">
                    Apagar esta barbearia
                  </p>
                  <p className="mt-1 font-body text-xs text-bone-dim">
                    Some tudo junto: {d.saude.servicos} serviço(s), {d.saude.produtos}{" "}
                    produto(s), {d.saude.pedidosTotal} pedido(s), a agenda inteira,{" "}
                    {d.equipe.total} conta(s) de acesso e as credenciais de
                    recebimento. <strong className="text-off">Não tem desfazer.</strong>
                  </p>

                  {d.barbearia.status === "ativa" && (
                    <p className="mt-3 rounded-lg border border-off-line bg-ink-elev/60 px-3 py-2 font-body text-xs text-off">
                      ⚠️ Esta barbearia está <strong>pagando</strong>. Confirme que é
                      mesmo ela antes de continuar.
                    </p>
                  )}

                  {!excluindo ? (
                    <button
                      onClick={() => setExcluindo(true)}
                      className="mt-3 rounded-full border border-off-line px-5 py-2 font-body text-xs font-semibold text-off transition-colors hover:bg-off hover:text-white"
                    >
                      Quero apagar
                    </button>
                  ) : (
                    <div className="mt-3">
                      <p className="font-body text-xs text-bone-dim">
                        Digite <strong className="text-bone">{d.barbearia.nome}</strong>{" "}
                        pra confirmar:
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <input
                          value={confirmacao}
                          onChange={(e) => setConfirmacao(e.target.value)}
                          placeholder={d.barbearia.nome}
                          className="min-w-48 flex-1 rounded-full border border-off-line bg-ink-elev px-4 py-2 font-body text-sm text-bone outline-none placeholder:text-muted"
                        />
                        <button
                          disabled={ocupado || confirmacao.trim() !== d.barbearia.nome}
                          onClick={() => agir("excluir", { confirmacao })}
                          className="rounded-full bg-off px-5 py-2 font-body text-xs font-semibold text-white transition-transform hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                        >
                          {ocupado ? "Apagando…" : "Apagar pra sempre"}
                        </button>
                        <button
                          onClick={() => {
                            setExcluindo(false);
                            setConfirmacao("");
                          }}
                          className="rounded-full border border-line-strong px-5 py-2 font-body text-xs text-bone-dim hover:text-bone"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * `useSearchParams` obriga um limite de Suspense — sem ele o build de
 * produção falha ao tentar pré-renderizar esta rota.
 */
export default function AdmBarbeariasPage() {
  return (
    <Suspense fallback={null}>
      <BarbeariasConteudo />
    </Suspense>
  );
}
