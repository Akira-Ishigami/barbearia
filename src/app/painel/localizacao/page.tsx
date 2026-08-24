"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { formatPhone, isValidPhone } from "@/lib/format";
import { getBarbearia, updateBarbearia } from "@/lib/db";
import { useAsync } from "@/lib/use-async";
import { useSession } from "@/lib/use-session";
import { EnderecoCepField } from "@/components/EnderecoCepField";
import { WEEKDAYS, type Weekday } from "@/lib/types";
import { PRESET_CAPA, PRESET_GALERIA, prepararFoto } from "@/lib/imagem";
import { gerarSlug } from "@/lib/slug";

export default function LocalizacaoPage() {
  const session = useSession();
  const { dados: barbearia, recarregar } = useAsync(
    () => getBarbearia(session!.barbeariaId),
    [session?.barbeariaId],
    { pular: session?.role !== "dono" },
  );

  const [loaded, setLoaded] = useState(false);
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [linkMaps, setLinkMaps] = useState("");
  const [slug, setSlug] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [buscandoLocal, setBuscandoLocal] = useState(false);
  const [dias, setDias] = useState<Weekday[]>([]);
  const [abertura, setAbertura] = useState("09:00");
  const [fechamento, setFechamento] = useState("20:00");
  const [horariosDia, setHorariosDia] = useState<
    Partial<Record<Weekday, { abre: string; fecha: string }>>
  >({});
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
    setSlug(barbearia.slug ?? "");
    setDias(barbearia.diasFuncionamento);
    setAbertura(barbearia.horarioAbertura);
    setFechamento(barbearia.horarioFechamento);
    setHorariosDia(barbearia.horariosDia ?? {});
    setFoto(barbearia.foto);
    setSobre(barbearia.sobre ?? "");
    setGaleria(barbearia.galeria ?? []);
    setLoaded(true);
  }

  if (!session || session.role !== "dono" || !barbearia) return null;

  // Em SSR não existe window; o campo só aparece depois de montar mesmo.
  const enderecoPublico = typeof window === "undefined" ? "" : window.location.origin;

  // A foto é redimensionada aqui no navegador, então não há limite de
  // tamanho de arquivo: pode mandar a foto original do celular.
  async function handleFoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const r = await prepararFoto(file, PRESET_CAPA);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setFoto(r.foto.dataUrl);
    setSaved(false);
  }

  async function handleGaleria(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (galeriaInputRef.current) galeriaInputRef.current.value = "";
    if (files.length === 0) return;

    setError(null);
    const resultados = await Promise.all(
      files.map((file) => prepararFoto(file, PRESET_GALERIA)),
    );

    const aceitas = resultados.flatMap((r) => (r.ok ? [r.foto.dataUrl] : []));
    const recusada = resultados.find((r) => !r.ok);

    if (aceitas.length) {
      setGaleria((atual) => [...atual, ...aceitas]);
      setSaved(false);
    }
    // Uma foto ruim no meio não descarta as boas — avisa só sobre ela.
    if (recusada && !recusada.ok) setError(recusada.error);
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

  /** Grava o horário próprio de um dia; o campo não mexido mantém o valor. */
  function setHorarioDoDia(dia: Weekday, abre?: string, fecha?: string) {
    setHorariosDia((prev) => {
      const atual = prev[dia] ?? { abre: abertura, fecha: fechamento };
      return {
        ...prev,
        [dia]: { abre: abre ?? atual.abre, fecha: fecha ?? atual.fecha },
      };
    });
    setSaved(false);
  }

  /** Volta o dia pro horário padrão da barbearia. */
  function limparHorarioDoDia(dia: Weekday) {
    setHorariosDia((prev) => {
      const copia = { ...prev };
      delete copia[dia];
      return copia;
    });
    setSaved(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (!isValidPhone(telefone)) {
      setError("Informe um telefone válido, com DDD.");
      return;
    }
    if (slug.trim() && slug.trim().length < 3) {
      setError("O endereço da página precisa ter ao menos 3 letras.");
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
    // Um dia com horário invertido geraria uma grade vazia sem explicação.
    for (const d of dias) {
      const h = horariosDia[d];
      if (h && h.abre >= h.fecha) {
        const nome = WEEKDAYS.find((w) => w.id === d)?.label ?? d;
        setError(`Em ${nome}, o horário de fechar precisa ser depois do de abrir.`);
        return;
      }
    }

    try {
      await updateBarbearia(barbearia!.id, {
        telefone,
        endereco,
        slug: slug.trim() || undefined,
        linkMaps: linkMaps.trim() || undefined,
        diasFuncionamento: dias,
        horarioAbertura: abertura,
        horarioFechamento: fechamento,
        // Só guarda exceção dos dias que abrem; dia fechado não tem horário.
        horariosDia: Object.fromEntries(
          Object.entries(horariosDia).filter(([d]) => dias.includes(d as Weekday)),
        ),
        foto,
        sobre: sobre.trim() || undefined,
        galeria,
      });
      recarregar();
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
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
      <div className="mx-auto max-w-xl">
        <p className="font-accent text-xs uppercase tracking-[0.2em] text-gold-bright">
          Localização
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-bone">
          Endereço e horário de funcionamento
        </h1>
        <p className="mt-1 font-body text-sm text-bone-dim">
          Essas informações aparecem na sua página pública.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mx-auto mt-6 max-w-xl space-y-5 rounded-2xl border border-line bg-ink-elev/60 p-6"
      >
        <div>
          <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
            Link da sua página
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-xl border border-line-strong bg-bone/[0.03] focus-within:border-gold-bright">
              <span className="flex select-none items-center whitespace-nowrap border-r border-line px-3 font-accent text-[11px] text-muted">
                /loja/
              </span>
              <input
                value={slug}
                onChange={(e) => {
                  // Normaliza enquanto digita pra não salvar acento nem espaço.
                  setSlug(gerarSlug(e.target.value));
                  setSaved(false);
                }}
                placeholder={gerarSlug(barbearia.nome)}
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-accent text-sm text-bone outline-none placeholder:text-muted"
              />
            </div>
            <button
              type="button"
              disabled={!slug.trim()}
              onClick={async () => {
                await navigator.clipboard
                  .writeText(`${enderecoPublico}/loja/${slug}`)
                  .catch(() => {});
                setCopiado(true);
                window.setTimeout(() => setCopiado(false), 2000);
              }}
              className={`shrink-0 rounded-xl border px-4 py-2.5 font-body text-xs font-semibold transition-colors disabled:opacity-40 ${
                copiado
                  ? "border-ok-line bg-ok-soft text-ok"
                  : "border-line-strong text-bone-dim hover:border-gold-bright/40 hover:text-gold-bright"
              }`}
            >
              {copiado ? "Copiado!" : "Copiar link"}
            </button>
          </div>
        </div>

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

        <EnderecoCepField
          valor={endereco}
          onChange={(v) => {
            setEndereco(v);
            setSaved(false);
          }}
        />

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

        {/* Um horário por dia: sábado que fecha mais cedo era o caso que o
            campo único não cobria. Quem trabalha no mesmo horário todo dia
            não precisa mexer em nada — o padrão continua valendo. */}
        <div>
          <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
            Dias e horários
          </span>
          <p className="mb-3 font-body text-[11px] text-muted">
            Marque os dias que abre. Toque no horário pra mudar só naquele dia.
          </p>

          <div className="space-y-2">
            {WEEKDAYS.map((d) => {
              const aberto = dias.includes(d.id);
              const h = horariosDia[d.id];
              const proprio = Boolean(h);
              return (
                <div
                  key={d.id}
                  className={`flex flex-wrap items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${
                    aberto ? "border-line-strong bg-bone/[0.02]" : "border-line opacity-60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleDia(d.id)}
                    aria-pressed={aberto}
                    className={`flex w-24 shrink-0 items-center gap-2 font-body text-sm transition-colors ${
                      aberto ? "text-bone" : "text-muted"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        aberto
                          ? "border-gold-bright bg-gold-bright text-ink"
                          : "border-line-strong"
                      }`}
                    >
                      {aberto && (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-2.5 w-2.5"
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                    </span>
                    {d.label}
                  </button>

                  {aberto ? (
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                      <input
                        type="time"
                        value={h?.abre ?? abertura}
                        onChange={(e) => setHorarioDoDia(d.id, e.target.value, undefined)}
                        className="rounded-lg border border-line-strong bg-bone/[0.03] px-2.5 py-1.5 font-accent text-sm text-bone outline-none focus:border-gold-bright"
                      />
                      <span className="font-body text-xs text-muted">às</span>
                      <input
                        type="time"
                        value={h?.fecha ?? fechamento}
                        onChange={(e) => setHorarioDoDia(d.id, undefined, e.target.value)}
                        className="rounded-lg border border-line-strong bg-bone/[0.03] px-2.5 py-1.5 font-accent text-sm text-bone outline-none focus:border-gold-bright"
                      />
                      {proprio && (
                        <button
                          type="button"
                          onClick={() => limparHorarioDoDia(d.id)}
                          title="Voltar pro horário padrão"
                          className="font-body text-[11px] text-bone-dim underline underline-offset-4 hover:text-bone"
                        >
                          usar padrão
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="font-body text-xs text-muted">Fechado</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Padrão pra quem não quer configurar dia a dia. */}
        <div className="grid grid-cols-2 gap-4 border-t border-line pt-5">
          <label className="block">
            <span className="mb-1.5 block font-body text-xs font-medium uppercase tracking-wide text-muted">
              Horário padrão — abre
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
              Horário padrão — fecha
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

      {/* Mapa de verdade em vez de um ícone: o dono confere na hora se o
          pino caiu no lugar certo, que é o que o cliente vai ver. */}
      <div className="mx-auto mt-6 max-w-xl">
        <div className="overflow-hidden rounded-2xl border border-line bg-ink-elev">
          {endereco.trim() ? (
            <iframe
              title="Mapa da barbearia"
              src={`https://www.google.com/maps?q=${encodeURIComponent(
                linkMaps.trim() || endereco,
              )}&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-72 w-full border-0"
            />
          ) : (
            <div className="flex h-72 items-center justify-center px-6 text-center">
              <p className="font-body text-sm text-muted">
                Preencha o endereço acima pra ver o mapa.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
            <div className="flex min-w-0 items-start gap-2.5">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mt-0.5 h-4 w-4 shrink-0 text-gold-bright"
              >
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <p className="min-w-0 font-body text-sm text-bone">
                {endereco || "Endereço não informado"}
              </p>
            </div>

            {endereco.trim() && (
              <a
                href={
                  linkMaps.trim() ||
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-full border border-line-strong px-4 py-2 font-body text-xs font-semibold text-bone-dim transition-colors hover:border-gold-bright/40 hover:text-gold-bright"
              >
                Abrir no Maps ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
