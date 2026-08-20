"use client";

import { useState, type FormEvent } from "react";
import { formatPhone, isValidPhone } from "@/lib/format";
import { getBarbeariaById, updateBarbearia } from "@/lib/mock-db";
import { useSession } from "@/lib/use-session";
import { WEEKDAYS, type Weekday } from "@/lib/types";

export default function LocalizacaoPage() {
  const session = useSession();
  const barbearia = session ? getBarbeariaById(session.barbeariaId) : undefined;

  const [loaded, setLoaded] = useState(false);
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [linkMaps, setLinkMaps] = useState("");
  const [buscandoLocal, setBuscandoLocal] = useState(false);
  const [dias, setDias] = useState<Weekday[]>([]);
  const [abertura, setAbertura] = useState("09:00");
  const [fechamento, setFechamento] = useState("20:00");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (barbearia && !loaded) {
    setTelefone(barbearia.telefone);
    setEndereco(barbearia.endereco);
    setLinkMaps(barbearia.linkMaps ?? "");
    setDias(barbearia.diasFuncionamento);
    setAbertura(barbearia.horarioAbertura);
    setFechamento(barbearia.horarioFechamento);
    setLoaded(true);
  }

  if (!session || session.role !== "dono" || !barbearia) return null;


  function toggleDia(dia: Weekday) {
    setDias((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia],
    );
    setSaved(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (!isValidPhone(telefone)) {
      setError("Informe um telefone válido, com DDD.");
      return;
    }
    if (dias.length === 0) {
      setError("Selecione ao menos um dia de funcionamento.");
      return;
    }
    if (abertura >= fechamento) {
      setError("O horário de fechamento precisa ser depois do de abertura.");
      return;
    }

    updateBarbearia(barbearia!.id, {
      telefone,
      endereco,
      linkMaps: linkMaps.trim() || undefined,
      diasFuncionamento: dias,
      horarioAbertura: abertura,
      horarioFechamento: fechamento,
    });
    setSaved(true);
  }

  function usarLocalizacaoAtual() {
    if (!navigator.geolocation) {
      setError("Seu navegador não suporta geolocalização.");
      return;
    }
    setError(null);
    setBuscandoLocal(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLinkMaps(`https://www.google.com/maps?q=${latitude},${longitude}`);
        setBuscandoLocal(false);
        setSaved(false);
      },
      () => {
        setError(
          "Não foi possível acessar sua localização. Verifique a permissão do navegador.",
        );
        setBuscandoLocal(false);
      },
    );
  }

  return (
    <div>
      <p className="font-accent text-xs uppercase tracking-[0.2em] text-gold-bright">
        Localização
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-bone">
        Endereço e horário de funcionamento
      </h1>
      <p className="mt-1 max-w-lg font-body text-sm text-bone-dim">
        Essas informações aparecem na sua página pública.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 max-w-xl space-y-5 rounded-2xl border border-line bg-ink-elev/60 p-6"
      >
        <label className="block">
          <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
            Telefone
          </span>
          <input
            type="tel"
            inputMode="numeric"
            value={telefone}
            onChange={(e) => {
              setTelefone(formatPhone(e.target.value));
              setSaved(false);
            }}
            maxLength={15}
            className="w-full rounded-xl border border-line-strong bg-white/[0.03] px-4 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
            Endereço
          </span>
          <input
            value={endereco}
            onChange={(e) => {
              setEndereco(e.target.value);
              setSaved(false);
            }}
            className="w-full rounded-xl border border-line-strong bg-white/[0.03] px-4 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
          />
        </label>

        <div>
          <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
            Link da localização (Google Maps)
          </span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={linkMaps}
              onChange={(e) => {
                setLinkMaps(e.target.value);
                setSaved(false);
              }}
              placeholder="https://maps.google.com/..."
              className="w-full rounded-xl border border-line-strong bg-white/[0.03] px-4 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
            />
            <button
              type="button"
              onClick={usarLocalizacaoAtual}
              disabled={buscandoLocal}
              className="shrink-0 rounded-xl border border-line-strong px-4 py-2.5 font-body text-xs font-semibold text-bone-dim transition-colors hover:border-gold-bright/40 hover:text-gold-bright disabled:opacity-60"
            >
              {buscandoLocal ? "Buscando..." : "Usar localização atual"}
            </button>
          </div>
        </div>

        <div>
          <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
            Dias de funcionamento
          </span>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => toggleDia(d.id)}
                className={`rounded-lg border px-3 py-1.5 font-body text-xs transition-colors ${
                  dias.includes(d.id)
                    ? "border-gold-bright/50 bg-gold-bright/10 text-gold-bright"
                    : "border-line text-bone-dim hover:border-line-strong"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
              Abre às
            </span>
            <input
              type="time"
              value={abertura}
              onChange={(e) => {
                setAbertura(e.target.value);
                setSaved(false);
              }}
              className="w-full rounded-xl border border-line-strong bg-white/[0.03] px-4 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
              Fecha às
            </span>
            <input
              type="time"
              value={fechamento}
              onChange={(e) => {
                setFechamento(e.target.value);
                setSaved(false);
              }}
              className="w-full rounded-xl border border-line-strong bg-white/[0.03] px-4 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
            />
          </label>
        </div>

        {error && (
          <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 font-body text-xs text-rose-300">
            {error}
          </p>
        )}
        {saved && !error && (
          <p className="rounded-lg border border-gold-bright/30 bg-gold-bright/5 px-3 py-2 font-body text-xs text-gold-bright">
            Alterações salvas.
          </p>
        )}

        <button
          type="submit"
          className="rounded-full bg-gold-bright px-6 py-3 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.02]"
        >
          Salvar alterações
        </button>
      </form>

      <div className="mt-6 max-w-xl">
        <div className="grid-field relative overflow-hidden rounded-2xl border border-line bg-ink-elev/60 p-10 text-center">
          <div className="relative">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mx-auto h-8 w-8 text-gold-bright"
            >
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <p className="mt-2 font-display text-lg font-semibold text-bone">
              {endereco || "Endereço não informado"}
            </p>
            {linkMaps ? (
              <a
                href={linkMaps}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block font-body text-xs text-cyan-bright hover:underline"
              >
                Abrir no Google Maps ↗
              </a>
            ) : (
              <p className="mt-1 font-body text-xs text-muted">
                Adicione um link de localização acima pra exibir aqui.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
