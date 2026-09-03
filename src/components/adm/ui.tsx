"use client";

import Link from "next/link";

/**
 * As peças da área da plataforma — console de operação, não folha impressa.
 *
 * Cartão branco de verdade contra um cinza neutro, selo de estado com
 * preenchimento sólido, número grande em negrito. Feita pra ser relida
 * todo dia sem esforço: rótulo nunca abaixo de 11px, cor de texto sempre
 * com contraste alto contra o fundo.
 *
 * Regras que valem em todas as peças:
 * — número e rótulo usam cor de texto, nunca a cor da série;
 * — nada de dois eixos no mesmo desenho: grandezas diferentes, gráficos
 *   diferentes;
 * — cor de estado nunca vem sozinha, sempre com palavra do lado.
 */

// ---------- formatação ----------

export function dinheiro(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function data(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function dataLonga(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function quando(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 60 * 24) return `há ${Math.floor(min / 60)}h`;
  const dias = Math.floor(min / (60 * 24));
  if (dias < 30) return `há ${dias}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

/** Dias a partir de hoje, em texto que já diz o que fazer. */
export function emDias(iso: string | null): string {
  if (!iso) return "—";
  const dias = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (dias < 0) return `venceu há ${Math.abs(dias)}d`;
  if (dias === 0) return "vence hoje";
  return `faltam ${dias}d`;
}

// ---------- estrutura da tela ----------

/** Cabeçalho de tela. O número da estação vem do menu, não daqui. */
export function Cabecalho({
  secao,
  titulo,
  linha,
  acao,
}: {
  secao: string;
  titulo: string;
  linha?: React.ReactNode;
  acao?: React.ReactNode;
}) {
  return (
    <header className="adm-entra flex flex-wrap items-end justify-between gap-4 pb-6">
      <div className="min-w-0">
        <span className="inline-flex items-center rounded-full bg-cyan px-2.5 py-1 font-accent text-[11px] font-bold uppercase tracking-wide text-white">
          {secao}
        </span>
        <h1 className="mt-3 font-display text-[2.1rem] font-bold leading-[1.15] tracking-tight text-bone">
          {titulo}
        </h1>
        {linha && (
          <p className="mt-2 max-w-2xl font-body text-sm leading-relaxed text-bone-dim">
            {linha}
          </p>
        )}
      </div>
      {acao && <div className="shrink-0">{acao}</div>}
    </header>
  );
}

/** Um bloco da tela: cartão branco de verdade, não fio de cabelo. */
export function Secao({
  titulo,
  nota,
  direita,
  children,
  atraso = 0,
}: {
  titulo: string;
  nota?: string;
  direita?: React.ReactNode;
  children: React.ReactNode;
  atraso?: number;
}) {
  return (
    <section
      className="adm-entra mt-5 rounded-2xl border border-line bg-ink-elev p-6 shadow-[0_1px_2px_rgba(12,14,19,0.04)]"
      style={{ animationDelay: `${atraso}ms` }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-bone">{titulo}</h2>
        {direita}
      </div>
      {nota && <p className="mt-1 font-body text-xs leading-relaxed text-muted">{nota}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

// ---------- números ----------

type Tom = "neutro" | "ok" | "warn" | "off" | "acento";

const TINTA: Record<Tom, string> = {
  neutro: "text-bone",
  ok: "text-ok",
  warn: "text-warn",
  off: "text-off",
  acento: "text-cyan",
};

/**
 * Um número da tela. Borda colorida à esquerda em vez de caixa fechada:
 * agrupa sem transformar cinco medidas em cinco cartões dentro de um
 * cartão.
 */
export function Medida({
  rotulo,
  valor,
  nota,
  tom = "neutro",
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  tom?: Tom;
}) {
  const borda: Record<Tom, string> = {
    neutro: "border-line-strong",
    ok: "border-ok",
    warn: "border-warn",
    off: "border-off",
    acento: "border-cyan",
  };
  return (
    <div className={`border-l-[3px] pl-3.5 ${borda[tom]}`}>
      <p className="font-body text-xs font-medium text-muted">{rotulo}</p>
      <p className={`tabular mt-1.5 font-display text-[1.9rem] font-bold leading-none ${TINTA[tom]}`}>
        {valor}
      </p>
      {nota && <p className="mt-1.5 font-body text-xs leading-snug text-muted">{nota}</p>}
    </div>
  );
}

/** Fila de medidas. Quatro por linha no desktop, duas no celular. */
export function Fila({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

// ---------- proporção ----------

export function Proporcao({
  itens,
  total,
}: {
  itens: { rotulo: string; valor: number; tom?: Tom }[];
  total: number;
}) {
  return (
    <div className="space-y-3.5">
      {itens.map((i) => {
        const pct = total ? Math.round((i.valor / total) * 100) : 0;
        return (
          <div key={i.rotulo}>
            <div className="flex items-baseline justify-between font-body text-xs">
              <span className="text-bone-dim">{i.rotulo}</span>
              <span className="tabular font-accent font-semibold text-bone">
                {i.valor}
                <span className="ml-1.5 font-body font-normal text-muted">{pct}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-elev-2">
              <div
                className={`h-full rounded-full ${
                  i.tom === "ok"
                    ? "bg-ok"
                    : i.tom === "warn"
                      ? "bg-warn"
                      : i.tom === "off"
                        ? "bg-off"
                        : "bg-cyan"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- série no tempo ----------

export interface Semana {
  inicio: string;
  cadastros: number;
  pedidos: number;
}

/**
 * Dez semanas de uma medida só.
 *
 * Uma série por desenho: cadastro e pedido são grandezas diferentes, e
 * dois eixos no mesmo gráfico fazem qualquer par de linhas parecer
 * relacionado. O topo é o maior valor da própria série — o que se lê aqui
 * é a forma, não o valor, que está escrito ao lado.
 */
export function Serie({
  titulo,
  semanas,
  campo,
}: {
  titulo: string;
  semanas: Semana[];
  campo: "cadastros" | "pedidos";
}) {
  const valores = semanas.map((s) => s[campo]);
  const maior = Math.max(1, ...valores);
  const total = valores.reduce((a, b) => a + b, 0);
  const ultima = valores[valores.length - 1] ?? 0;
  const anterior = valores[valores.length - 2] ?? 0;
  const variacao = anterior > 0 ? Math.round(((ultima - anterior) / anterior) * 100) : null;

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-body text-xs font-medium text-muted">{titulo}</p>
          <p className="tabular mt-1.5 font-display text-[1.9rem] font-bold leading-none text-bone">
            {ultima}
          </p>
          <p className="mt-1 font-body text-xs text-muted">nesta semana · {total} em 10</p>
        </div>
        {variacao !== null && (
          <span
            className={`tabular shrink-0 rounded-full px-2 py-0.5 font-accent text-[11px] font-bold ${
              variacao > 0
                ? "bg-ok-soft text-ok"
                : variacao < 0
                  ? "bg-off-soft text-off"
                  : "bg-ink-elev-2 text-muted"
            }`}
          >
            {variacao > 0 ? "▲" : variacao < 0 ? "▼" : "—"} {Math.abs(variacao)}%
          </span>
        )}
      </div>

      <div className="mt-4 flex h-16 items-end gap-[3px]">
        {semanas.map((s) => {
          const v = s[campo];
          return (
            <div key={s.inicio} className="group relative flex h-full flex-1 items-end">
              <div className="absolute inset-0 rounded-sm bg-ink-elev-2" />
              <div
                className="relative w-full rounded-sm bg-cyan/70 transition-colors group-hover:bg-cyan"
                style={{ height: `${Math.max(v > 0 ? 8 : 2, (v / maior) * 100)}%` }}
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-line-strong bg-bone px-2 py-1 font-accent text-[11px] font-medium text-ink-elev shadow-md group-hover:block">
                {v} · semana de {data(s.inicio)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between font-body text-[11px] text-muted">
        <span>{data(semanas[0]?.inicio)}</span>
        <span>hoje</span>
      </div>
    </div>
  );
}

// ---------- estados ----------

export type StatusAssinatura = "trial" | "ativa" | "vencida";

export const SELO: Record<StatusAssinatura, { texto: string; classe: string }> = {
  ativa: { texto: "Pagando", classe: "bg-ok text-white" },
  trial: { texto: "Em teste", classe: "bg-warn text-white" },
  vencida: { texto: "Vencida", classe: "bg-off text-white" },
};

/** Selo de estado: preenchimento sólido, nunca só a cor — sempre a palavra. */
export function Selo({
  children,
  tom = "neutro",
}: {
  children: React.ReactNode;
  tom?: Tom;
}) {
  const cor = {
    neutro: "bg-ink-elev-2 text-bone-dim",
    ok: "bg-ok text-white",
    warn: "bg-warn text-white",
    off: "bg-off text-white",
    acento: "bg-cyan text-white",
  }[tom];

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 font-body text-[11px] font-semibold ${cor}`}
    >
      {children}
    </span>
  );
}

// ---------- item de trabalho ----------

/**
 * Uma linha da lista de pendências. É o coração da tela inicial: cada
 * linha é uma coisa pra resolver, com o nome clicável, o porquê e o
 * prazo. Numerada porque se percorre de cima pra baixo, como checklist.
 */
export function Pendencia({
  ordem,
  titulo,
  motivo,
  prazo,
  tom = "warn",
  href,
}: {
  ordem: number;
  titulo: string;
  motivo: string;
  prazo?: string;
  tom?: Tom;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-ink-elev-2/70"
    >
      <span className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-elev-2 font-accent text-[11px] font-bold text-bone-dim">
        {String(ordem).padStart(2, "0")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-body text-sm font-semibold text-bone group-hover:text-cyan">
          {titulo}
        </span>
        <span className="mt-0.5 block truncate font-body text-xs text-muted">{motivo}</span>
      </span>
      {prazo && (
        <span className={`shrink-0 font-body text-xs font-semibold ${TINTA[tom]}`}>{prazo}</span>
      )}
      <span
        aria-hidden
        className="shrink-0 font-display text-base text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-cyan"
      >
        →
      </span>
    </Link>
  );
}

// ---------- avisos ----------

export function Aviso({
  tom = "neutro",
  children,
}: {
  tom?: "neutro" | "ok" | "warn" | "off";
  children: React.ReactNode;
}) {
  const cor = {
    neutro: "border-line-strong bg-ink-elev-2/50 text-bone-dim",
    ok: "border-ok bg-ok-soft text-ok",
    warn: "border-warn bg-warn-soft text-warn",
    off: "border-off bg-off-soft text-off",
  }[tom];

  return (
    <p className={`rounded-lg border-l-4 py-2.5 pl-4 pr-4 font-body text-sm leading-relaxed ${cor}`}>
      {children}
    </p>
  );
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-line-strong bg-ink-elev-2/30 px-6 py-10 text-center font-body text-sm text-muted">
      {children}
    </p>
  );
}

// ---------- botões ----------

export function Botao({
  children,
  onClick,
  tipo = "normal",
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tipo?: "normal" | "principal" | "perigo";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const cor = {
    normal:
      "border border-line-strong bg-ink-elev text-bone-dim hover:border-cyan hover:text-cyan",
    principal: "bg-bone text-ink-elev hover:bg-cyan",
    perigo: "border border-off-line text-off hover:bg-off hover:text-white",
  }[tipo];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-4 py-2.5 font-body text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${cor}`}
    >
      {children}
    </button>
  );
}

export function Campo({
  valor,
  aoMudar,
  placeholder,
  tipo = "text",
}: {
  valor: string;
  aoMudar: (v: string) => void;
  placeholder?: string;
  tipo?: string;
}) {
  return (
    <input
      type={tipo}
      value={valor}
      onChange={(e) => aoMudar(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-line-strong bg-ink-elev px-3.5 py-2.5 font-body text-sm text-bone outline-none transition-colors placeholder:text-muted focus:border-cyan"
    />
  );
}
