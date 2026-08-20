"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { formatPhone, isValidPhone } from "@/lib/format";
import { getBarbeariaById, updateBarbearia } from "@/lib/mock-db";
import { useSession } from "@/lib/use-session";
import { WEEKDAYS, type Weekday } from "@/lib/types";

const MAX_FOTO_BYTES = 1_500_000;

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
  const [foto, setFoto] = useState<string | undefined>(undefined);
  const [sobre, setSobre] = useState("");
  const [galeria, setGaleria] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galeriaInputRef = useRef<HTMLInputElement>(null);

  if (barbearia && !loaded) {
    setTelefone(barbearia.telefone);
    setEndereco(barbearia.endereco);
    setLinkMaps(barbearia.linkMaps ?? "");
    setDias(barbearia.diasFuncionamento);
    setAbertura(barbearia.horarioAbertura);
    setFechamento(barbearia.horarioFechamento);
    setFoto(barbearia.foto);
    setSobre(barbearia.sobre ?? "");
    setGaleria(barbearia.galeria ?? []);
    setLoaded(true);
  }

  if (!session || session.role !== "dono" || !barbearia) return null;

  function handleFoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FOTO_BYTES) {
      setError("A foto precisa ter no máximo 1,5MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setFoto(reader.result as string);
      setSaved(false);
    };
    reader.readAsDataURL(file);
  }

  function handleGaleria(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (files.some((f) => f.size > MAX_FOTO_BYTES)) {
      setError("Cada foto da galeria precisa ter no máximo 1,5MB.");
      if (galeriaInputRef.current) galeriaInputRef.current.value = "";
      return;
    }

    setError(null);
    Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          }),
      ),
    ).then((novas) => {
      setGaleria((atual) => [...atual, ...novas]);
      setSaved(false);
      if (galeriaInputRef.current) galeriaInputRef.current.value = "";
    });
  }

  function removerDaGaleria(index: number) {
    setGaleria((atual) => atual.filter((_, i) => i !== index));
    setSaved(false);
  }

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
      foto,
      sobre: sobre.trim() || undefined,
      galeria,
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
        <div>
          <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
            Foto de capa
          </span>
          <label className="flex h-28 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-line-strong bg-bone/[0.03] font-body text-xs text-muted hover:border-gold-bright/50">
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto} alt="" className="h-full w-full object-cover" />
            ) : (
              "Clique para escolher uma foto"
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFoto}
              className="hidden"
            />
          </label>
          {foto && (
            <button
              type="button"
              onClick={() => {
                setFoto(undefined);
                setSaved(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="mt-1.5 font-body text-[11px] text-off hover:underline"
            >
              remover foto
            </button>
          )}
        </div>

        <div>
          <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
            Fotos da barbearia
          </span>
          <p className="mb-2 font-body text-[11px] text-muted">
            Aparecem na galeria da página pública — o espaço, as cadeiras, o ambiente.
          </p>
          <div className="flex flex-wrap gap-2">
            {galeria.map((src, i) => (
              <div key={i} className="group relative h-20 w-24 overflow-hidden rounded-xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removerDaGaleria(i)}
                  aria-label={`Remover foto ${i + 1}`}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 font-body text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  ×
                </button>
              </div>
            ))}
            <label className="flex h-20 w-24 cursor-pointer items-center justify-center rounded-xl border border-dashed border-line-strong bg-bone/[0.03] font-body text-[11px] text-muted hover:border-gold-bright/50">
              + Adicionar
              <input
                ref={galeriaInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleGaleria}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
            Sobre a barbearia
          </span>
          <textarea
            value={sobre}
            onChange={(e) => {
              setSobre(e.target.value);
              setSaved(false);
            }}
            rows={3}
            maxLength={280}
            placeholder="Um texto curto contando a história ou o diferencial da barbearia."
            className="w-full resize-none rounded-xl border border-line-strong bg-bone/[0.03] px-4 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
          />
        </label>

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
            className="w-full rounded-xl border border-line-strong bg-bone/[0.03] px-4 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
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
            className="w-full rounded-xl border border-line-strong bg-bone/[0.03] px-4 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
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
              className="w-full rounded-xl border border-line-strong bg-bone/[0.03] px-4 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
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
              className="w-full rounded-xl border border-line-strong bg-bone/[0.03] px-4 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
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
              className="w-full rounded-xl border border-line-strong bg-bone/[0.03] px-4 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
            />
          </label>
        </div>

        {error && (
          <p className="rounded-lg border border-off-line bg-off-soft px-3 py-2 font-body text-xs text-off">
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
