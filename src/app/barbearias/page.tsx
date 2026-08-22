"use client";

import Link from "next/link";
import { useState } from "react";
import { getBarbeariasPublicas } from "@/lib/db";
import { useAsync } from "@/lib/use-async";
import { caminhoLoja } from "@/lib/slug";
import { WEEKDAYS, type Barbearia } from "@/lib/types";
import {
  cidadeDoEndereco,
  coordenadaDoLink,
  distanciaKm,
  formatarDistancia,
  type Coordenada,
} from "@/lib/geo";

interface ComDistancia {
  barbearia: Barbearia;
  cidade: string;
  km: number | null;
}

export default function BarbeariasPage() {
  const [busca, setBusca] = useState("");
  const [minhaPos, setMinhaPos] = useState<Coordenada | null>(null);
  const [buscandoPos, setBuscandoPos] = useState(false);
  const [erroPos, setErroPos] = useState<string | null>(null);

  const { dados, carregando } = useAsync(() => getBarbeariasPublicas(), []);

  function usarMinhaLocalizacao() {
    if (!navigator.geolocation) {
      setErroPos("Seu navegador não informa a localização.");
      return;
    }
    setErroPos(null);
    setBuscandoPos(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMinhaPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setBuscandoPos(false);
      },
      () => {
        setErroPos(
          "Não consegui acessar sua localização. Você pode buscar pelo nome ou cidade.",
        );
        setBuscandoPos(false);
      },
    );
  }

  const termo = busca.trim().toLowerCase();

  const lista: ComDistancia[] = (dados ?? [])
    .map((b) => {
      const coord = coordenadaDoLink(b.linkMaps);
      return {
        barbearia: b,
        cidade: cidadeDoEndereco(b.endereco),
        km: minhaPos && coord ? distanciaKm(minhaPos, coord) : null,
      };
    })
    .filter(({ barbearia, cidade }) => {
      if (!termo) return true;
      return (
        barbearia.nome.toLowerCase().includes(termo) ||
        barbearia.endereco.toLowerCase().includes(termo) ||
        cidade.toLowerCase().includes(termo)
      );
    })
    .sort((a, b) => {
      // Com localização, as mais perto primeiro. Quem não tem coordenada vai
      // pro fim — não some da lista, só não dá pra ordenar por distância.
      if (a.km !== null && b.km !== null) return a.km - b.km;
      if (a.km !== null) return -1;
      if (b.km !== null) return 1;
      return a.barbearia.nome.localeCompare(b.barbearia.nome);
    });

  const semCoordenada =
    minhaPos !== null && lista.length > 0 && lista.every((l) => l.km === null);

  return (
    <div className="grain flex flex-1 flex-col bg-ink">
      <header className="border-b border-line px-6 py-5">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold/40 bg-gold/10 text-gold-bright">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.5 8.5l11 11M20 4 8.5 15.5" />
              </svg>
            </span>
            <span className="font-display text-lg font-semibold text-bone">
              Navalha
            </span>
          </Link>
          <Link
            href="/cadastro"
            className="rounded-full border border-line-strong px-4 py-2 font-body text-xs font-semibold text-bone-dim hover:border-gold-bright/40 hover:text-gold-bright"
          >
            Cadastrar minha barbearia
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
        <p className="font-accent text-xs uppercase tracking-[0.2em] text-gold-bright">
          Barbearias
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-bone sm:text-4xl">
          Encontre uma barbearia perto de você
        </h1>

        <div className="mt-7 flex flex-wrap gap-2">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Busque por nome ou cidade"
            className="min-w-0 flex-1 rounded-xl border border-line-strong bg-bone/[0.03] px-4 py-3 font-body text-sm text-bone outline-none placeholder:text-muted focus:border-gold-bright"
          />
          <button
            onClick={usarMinhaLocalizacao}
            disabled={buscandoPos}
            className={`shrink-0 rounded-xl border px-4 py-3 font-body text-sm font-semibold transition-colors disabled:opacity-60 ${
              minhaPos
                ? "border-gold-bright/40 bg-gold-bright/10 text-gold-bright"
                : "border-line-strong text-bone-dim hover:border-gold-bright/40 hover:text-gold-bright"
            }`}
          >
            {buscandoPos
              ? "Localizando…"
              : minhaPos
                ? "Ordenado por distância"
                : "Perto de mim"}
          </button>
        </div>

        {erroPos && <p className="mt-3 font-body text-xs text-off">{erroPos}</p>}
        {semCoordenada && (
          <p className="mt-3 font-body text-xs text-muted">
            Nenhuma barbearia cadastrou a localização no mapa ainda, então não dá
            pra ordenar por distância.
          </p>
        )}

        <div className="mt-8 space-y-3">
          {carregando && (
            <p className="rounded-2xl border border-dashed border-line-strong px-4 py-12 text-center font-body text-sm text-bone-dim">
              Carregando barbearias…
            </p>
          )}

          {!carregando && lista.length === 0 && (
            <p className="rounded-2xl border border-dashed border-line-strong px-4 py-12 text-center font-body text-sm text-bone-dim">
              {termo
                ? `Nenhuma barbearia encontrada para "${busca}".`
                : "Nenhuma barbearia cadastrada ainda."}
            </p>
          )}

          {lista.map(({ barbearia: b, cidade, km }) => (
            <Link
              key={b.id}
              href={caminhoLoja(b)}
              className="flex items-center gap-4 rounded-2xl border border-line bg-ink-elev/60 p-4 transition-colors hover:border-gold-bright/40"
            >
              {b.foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={b.foto}
                  alt={b.nome}
                  className="h-16 w-16 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-bone/5 font-display text-xl text-bone-dim">
                  {b.nome.charAt(0).toUpperCase()}
                </span>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-sm font-semibold text-bone">
                  {b.nome}
                </p>
                <p className="truncate font-body text-xs text-bone-dim">
                  {b.endereco || cidade || "Endereço não informado"}
                </p>
                <p className="mt-0.5 font-body text-[11px] text-muted">
                  {b.diasFuncionamento
                    .map((d) => WEEKDAYS.find((w) => w.id === d)?.label)
                    .filter(Boolean)
                    .join(" · ")}{" "}
                  · {b.horarioAbertura}–{b.horarioFechamento}
                </p>
              </div>

              {km !== null && (
                <span className="shrink-0 rounded-full bg-gold-bright/10 px-3 py-1 font-accent text-[11px] text-gold-bright">
                  {formatarDistancia(km)}
                </span>
              )}
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
