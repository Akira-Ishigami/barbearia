"use client";

import { useEffect, useRef, useState } from "react";
import { cabecalhosAutenticados } from "@/lib/db";
import { useSession } from "@/lib/use-session";
import { useAsync } from "@/lib/use-async";

/**
 * Chat com o suporte da Navalha — uma conversa só, contínua, da barbearia
 * (dono e barbeiro escrevem na mesma linha, porque quem responde do outro
 * lado está resolvendo o problema da loja).
 *
 * Atualiza sozinho a cada alguns segundos em vez de tempo real de verdade
 * — simples, e suporte não é um chat de velocidade.
 */

interface Mensagem {
  id: string;
  de: "barbearia" | "suporte";
  autor_nome: string;
  texto: string | null;
  foto: string | null;
  criado_em: string;
}

const FOTO_MAX = 3_000_000;
const ATUALIZA_MS = 5000;

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function SuportePage() {
  const session = useSession();
  const [texto, setTexto] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  const { dados, recarregar } = useAsync<{ existe: boolean; atendida: boolean; mensagens: Mensagem[] }>(
    async () => {
      const r = await fetch("/api/suporte/conversa", { headers: await cabecalhosAutenticados() });
      if (!r.ok) throw new Error("Falha ao carregar a conversa.");
      return r.json();
    },
    [session?.barbeariaId],
    { pular: !session },
  );

  useEffect(() => {
    if (!session) return () => {};
    const t = setInterval(recarregar, ATUALIZA_MS);
    return () => clearInterval(t);
  }, [session, recarregar]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dados?.mensagens.length]);

  if (!session) return null;

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
    if (!texto.trim() && !foto) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch("/api/suporte/conversa", {
        method: "POST",
        headers: await cabecalhosAutenticados(),
        body: JSON.stringify({ texto, foto, nome: session!.nome }),
      });
      const corpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(corpo.erro ?? "Não foi possível mandar a mensagem.");
      } else {
        setTexto("");
        setFoto(null);
        recarregar();
      }
    } catch {
      setErro("Falha de conexão.");
    }
    setEnviando(false);
  }

  const mensagens = dados?.mensagens ?? [];

  return (
    <div className="flex h-[calc(100vh-140px)] flex-col md:h-[calc(100vh-64px)]">
      <div>
        <p className="font-accent text-xs uppercase tracking-[0.2em] text-gold-bright">Suporte</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-bone">Fale com a Navalha</h1>
        <p className="mt-1 max-w-xl font-body text-sm text-bone-dim">
          {dados?.atendida
            ? "Alguém do suporte está na conversa."
            : "Manda sua dúvida — o suporte responde por aqui assim que vir."}
          {" "}Áudio e vídeo chegam numa próxima etapa.
        </p>
      </div>

      <div className="mt-6 flex-1 overflow-y-auto rounded-2xl border border-line-strong bg-ink-elev/40 p-4">
        {mensagens.length === 0 && (
          <p className="py-10 text-center font-body text-sm text-muted">
            Nenhuma mensagem ainda. Comece a conversa aqui embaixo.
          </p>
        )}
        <div className="flex flex-col gap-3">
          {mensagens.map((m) => (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                m.de === "barbearia"
                  ? "self-end bg-gold-bright/15 text-bone"
                  : "self-start border border-line-strong bg-ink-elev text-bone"
              }`}
            >
              {m.de === "suporte" && (
                <p className="font-accent text-[10px] font-semibold uppercase tracking-wide text-gold-bright">
                  {m.autor_nome || "Suporte"}
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
              {m.texto && <p className="mt-1 whitespace-pre-wrap font-body text-sm">{m.texto}</p>}
              <p className="mt-1 text-right font-body text-[10px] text-muted">{hora(m.criado_em)}</p>
            </div>
          ))}
          <div ref={fimRef} />
        </div>
      </div>

      {erro && <p className="mt-2 font-body text-xs text-off">{erro}</p>}

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
        <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line-strong text-bone-dim transition-colors hover:border-gold-bright/40 hover:text-gold-bright">
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
          placeholder="Escreva sua mensagem…"
          rows={1}
          className="max-h-32 flex-1 resize-none rounded-2xl border border-line-strong bg-transparent px-4 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright/50"
        />
        <button
          onClick={enviar}
          disabled={enviando || (!texto.trim() && !foto)}
          className="h-11 shrink-0 rounded-full bg-gold-bright px-5 font-body text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {enviando ? "…" : "Enviar"}
        </button>
      </div>
    </div>
  );
}
