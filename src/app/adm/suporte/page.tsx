"use client";

import { useEffect, useRef, useState } from "react";
import { useAsync } from "@/lib/use-async";
import { cabecalhosPlataforma, usePlataforma } from "@/lib/use-plataforma";
import { Aviso, Botao, Cabecalho, Selo } from "@/components/adm/ui";

/**
 * Estação 07 — o chat de suporte, do lado da Navalha.
 *
 * Caixa de entrada (esquerda) + conversa (direita). Só uma pessoa do
 * suporte por conversa: "entrar" trava; sem entrar, não dá pra escrever
 * (a rota barra do lado do servidor de qualquer jeito — aqui é só pra
 * deixar claro na tela antes de tentar).
 */

interface Conversa {
  id: string;
  barbeariaId: string;
  barbeariaNome: string;
  atendidoPor: string | null;
  souEu: boolean;
  ultimaMensagemEm: string;
  aguardandoResposta: boolean;
  previa: string;
}

interface Mensagem {
  id: string;
  de: "barbearia" | "suporte";
  autor_nome: string;
  autor_email: string | null;
  texto: string | null;
  foto: string | null;
  criado_em: string;
}

const FOTO_MAX = 3_000_000;
const ATUALIZA_MS = 5000;

function quando(iso: string) {
  const d = new Date(iso);
  const hoje = new Date().toDateString() === d.toDateString();
  return hoje
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function AdmSuportePage() {
  const acesso = usePlataforma();
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  const { dados: lista, recarregar: recarregarLista } = useAsync<{ conversas: Conversa[] }>(
    async () => {
      const r = await fetch("/api/adm/suporte", { headers: await cabecalhosPlataforma() });
      if (!r.ok) throw new Error("Falha ao carregar as conversas.");
      return r.json();
    },
    [acesso?.email],
    { pular: !acesso },
  );

  const {
    dados: conversa,
    recarregar: recarregarConversa,
  } = useAsync<{ conversa: Conversa | null; mensagens: Mensagem[] }>(
    async () => {
      const r = await fetch(`/api/adm/suporte?conversa=${selecionada}`, {
        headers: await cabecalhosPlataforma(),
      });
      if (!r.ok) throw new Error("Falha ao carregar a conversa.");
      return r.json();
    },
    [selecionada],
    { pular: !selecionada },
  );

  useEffect(() => {
    if (!acesso) return () => {};
    const t = setInterval(() => {
      recarregarLista();
      if (selecionada) recarregarConversa();
    }, ATUALIZA_MS);
    return () => clearInterval(t);
  }, [acesso, selecionada, recarregarLista, recarregarConversa]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversa?.mensagens.length]);

  if (!acesso) return null;

  const itemAtual = (lista?.conversas ?? []).find((c) => c.id === selecionada);
  const travadaPorOutro = Boolean(itemAtual?.atendidoPor) && !itemAtual?.souEu;

  async function entrar() {
    if (!selecionada) return;
    setEntrando(true);
    setErro(null);
    try {
      const r = await fetch("/api/adm/suporte", {
        method: "POST",
        headers: await cabecalhosPlataforma(),
        body: JSON.stringify({ acao: "entrar", conversaId: selecionada }),
      });
      const c = await r.json().catch(() => ({}));
      if (!r.ok) setErro(c.erro ?? "Não foi possível entrar.");
      else {
        recarregarLista();
        recarregarConversa();
      }
    } catch {
      setErro("Falha de conexão.");
    }
    setEntrando(false);
  }

  async function sair() {
    if (!selecionada) return;
    await fetch("/api/adm/suporte", {
      method: "POST",
      headers: await cabecalhosPlataforma(),
      body: JSON.stringify({ acao: "sair", conversaId: selecionada }),
    });
    recarregarLista();
    recarregarConversa();
  }

  function escolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arq = e.target.files?.[0];
    e.target.value = "";
    if (!arq) return;
    if (arq.size > FOTO_MAX) {
      setErro("A foto é muito grande (máx. ~2MB).");
      return;
    }
    const leitor = new FileReader();
    leitor.onload = () => setFoto(leitor.result as string);
    leitor.readAsDataURL(arq);
  }

  async function enviar() {
    if (!selecionada || (!texto.trim() && !foto)) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch("/api/adm/suporte", {
        method: "POST",
        headers: await cabecalhosPlataforma(),
        body: JSON.stringify({ acao: "mensagem", conversaId: selecionada, texto, foto }),
      });
      const c = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(c.erro ?? "Não foi possível mandar a mensagem.");
      } else {
        setTexto("");
        setFoto(null);
        recarregarConversa();
        recarregarLista();
      }
    } catch {
      setErro("Falha de conexão.");
    }
    setEnviando(false);
  }

  return (
    <div>
      <Cabecalho
        secao="Estação 07"
        titulo="Suporte"
        linha="Conversa com cada barbearia. Só uma pessoa do suporte por vez numa mesma conversa."
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* ---------- Caixa de entrada ---------- */}
        <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-line bg-ink-elev">
          {(lista?.conversas ?? []).length === 0 && (
            <p className="p-6 text-center font-body text-sm text-muted">
              Nenhuma conversa ainda.
            </p>
          )}
          {(lista?.conversas ?? []).map((c) => (
            <button
              key={c.id}
              onClick={() => setSelecionada(c.id)}
              className={`block w-full border-b border-line px-4 py-3 text-left transition-colors ${
                selecionada === c.id ? "bg-cyan/10" : "hover:bg-ink-elev-2/50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-body text-sm font-semibold text-bone">
                  {c.barbeariaNome}
                </span>
                <span className="shrink-0 font-body text-[11px] text-muted">
                  {quando(c.ultimaMensagemEm)}
                </span>
              </div>
              <p className="mt-0.5 truncate font-body text-xs text-bone-dim">
                {c.previa || "—"}
              </p>
              <div className="mt-1.5 flex gap-1.5">
                {c.aguardandoResposta && <Selo tom="warn">aguardando</Selo>}
                {c.atendidoPor && (
                  <Selo tom={c.souEu ? "acento" : "neutro"}>
                    {c.souEu ? "com você" : "em atendimento"}
                  </Selo>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* ---------- Conversa ---------- */}
        <div className="flex h-[70vh] flex-col rounded-2xl border border-line bg-ink-elev p-4">
          {!selecionada && (
            <p className="m-auto font-body text-sm text-muted">
              Escolha uma conversa na lista.
            </p>
          )}

          {selecionada && (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
                <p className="font-display text-lg font-semibold text-bone">
                  {itemAtual?.barbeariaNome}
                </p>
                {itemAtual?.souEu ? (
                  <Botao onClick={sair}>Sair da conversa</Botao>
                ) : (
                  <Botao tipo="principal" onClick={entrar} disabled={entrando || travadaPorOutro}>
                    {entrando ? "Entrando…" : travadaPorOutro ? `Com ${itemAtual?.atendidoPor}` : "Entrar na conversa"}
                  </Botao>
                )}
              </div>

              <div className="mt-3 flex-1 overflow-y-auto">
                <div className="flex flex-col gap-3">
                  {(conversa?.mensagens ?? []).map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                        m.de === "suporte"
                          ? "self-end bg-cyan/15 text-bone"
                          : "self-start border border-line-strong bg-ink-elev-2/40 text-bone"
                      }`}
                    >
                      {m.de === "suporte" && (
                        <p className="font-accent text-[10px] font-semibold uppercase tracking-wide text-cyan">
                          {m.autor_nome || "Você"}
                        </p>
                      )}
                      {m.foto && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.foto}
                          alt="Anexo"
                          className="mt-1 max-h-64 rounded-lg object-contain"
                        />
                      )}
                      {m.texto && (
                        <p className="mt-1 whitespace-pre-wrap font-body text-sm">{m.texto}</p>
                      )}
                      <p className="mt-1 text-right font-body text-[10px] text-muted">
                        {quando(m.criado_em)}
                      </p>
                    </div>
                  ))}
                  <div ref={fimRef} />
                </div>
              </div>

              {erro && (
                <div className="mt-2">
                  <Aviso tom="off">{erro}</Aviso>
                </div>
              )}

              {foto && (
                <div className="mt-3 flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={foto} alt="Prévia" className="h-14 w-14 rounded-lg object-cover" />
                  <button
                    onClick={() => setFoto(null)}
                    className="font-body text-xs text-muted hover:text-off"
                  >
                    remover
                  </button>
                </div>
              )}

              <div className="mt-3 flex items-end gap-2">
                <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line-strong text-bone-dim transition-colors hover:border-cyan/40 hover:text-cyan">
                  <input type="file" accept="image/*" className="hidden" onChange={escolherFoto} />
                  📎
                </label>
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      enviar();
                    }
                  }}
                  placeholder={
                    travadaPorOutro ? "Entre na conversa pra responder…" : "Escreva sua resposta…"
                  }
                  disabled={travadaPorOutro}
                  rows={1}
                  className="max-h-32 flex-1 resize-none rounded-2xl border border-line-strong bg-transparent px-4 py-2.5 font-body text-sm text-bone outline-none focus:border-cyan/50 disabled:opacity-50"
                />
                <button
                  onClick={enviar}
                  disabled={enviando || travadaPorOutro || (!texto.trim() && !foto)}
                  className="h-11 shrink-0 rounded-full bg-cyan px-5 font-body text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {enviando ? "…" : "Enviar"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
