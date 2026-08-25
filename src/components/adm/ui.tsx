"use client";

import Link from "next/link";

/**
 * As peças da área da plataforma.
 *
 * A ideia que amarra tudo: **relatório impresso de operação**. Fio de
 * cabelo no lugar de caixa, rótulo em maiúscula miúda, número grande em
 * mono, serifa nos títulos. A tela é para ser relida todo dia — então ela
 * é organizada como uma folha que se percorre de cima pra baixo, e não
 * como um mural de cartões coloridos.
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

// ---------- estrutura da folha ----------

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
    <header className="adm-entra flex flex-wrap items-end justify-between gap-4 border-b border-line-strong pb-5">
      <div className="min-w-0">
        <p className="font-accent text-[11px] uppercase tracking-[0.22em] text-cyan">
          {secao}
        </p>
        <h1 className="mt-1.5 font-display text-[2.6rem] leading-[1.05] tracking-tight text-bone">
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

/** Divisão dentro da folha: régua fina com título miúdo por cima. */
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
      className="adm-entra mt-12"
      style={{ animationDelay: `${atraso}ms` }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-2">
        <h2 className="font-accent text-[11px] uppercase tracking-[0.22em] text-bone-dim">
          {titulo}
        </h2>
        {direita}
      </div>
      {nota && <p className="mt-2 font-body text-xs text-muted">{nota}</p>}
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
 * Um número da folha. Sem caixa: só a régua de cima, o rótulo miúdo e o
 * valor grande. Cartão com borda em volta de cada número transforma cinco
 * medidas em cinco objetos; a régua deixa os cinco lerem como uma linha.
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
  return (
    <div className="border-t border-line-strong pt-3">
      <p className="font-accent text-[10px] uppercase tracking-[0.16em] text-muted">
        {rotulo}
      </p>
      <p className={`tabular mt-1.5 font-accent text-[1.75rem] leading-none ${TINTA[tom]}`}>
        {valor}
      </p>
      {nota && <p className="mt-1.5 font-body text-[11px] leading-snug text-muted">{nota}</p>}
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
              <span className="tabular font-accent text-bone">
                {i.valor}
                <span className="ml-1.5 text-muted">{pct}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-[3px] w-full bg-bone/[0.07]">
              <div
                className={`h-full ${
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
    <div className="border-t border-line-strong pt-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-accent text-[10px] uppercase tracking-[0.16em] text-muted">
            {titulo}
          </p>
          <p className="tabular mt-1.5 font-accent text-[1.75rem] leading-none text-bone">
            {ultima}
          </p>
          <p className="mt-1 font-body text-[11px] text-muted">
            nesta semana · {total} em 10
          </p>
        </div>
        {variacao !== null && (
          <span
            className={`tabular shrink-0 font-accent text-[11px] ${
              variacao > 0 ? "text-ok" : variacao < 0 ? "text-off" : "text-muted"
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
              <div className="absolute inset-0 bg-bone/[0.035]" />
              <div
                className="relative w-full bg-cyan/70 transition-colors group-hover:bg-cyan"
                style={{ height: `${Math.max(v > 0 ? 8 : 2, (v / maior) * 100)}%` }}
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap border border-line-strong bg-ink-elev px-2 py-1 font-accent text-[10px] text-bone shadow-sm group-hover:block">
                {v} · semana de {data(s.inicio)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between font-accent text-[9px] uppercase tracking-wider text-muted">
        <span>{data(semanas[0]?.inicio)}</span>
        <span>hoje</span>
      </div>
    </div>
  );
}

// ---------- estados ----------

export type StatusAssinatura = "trial" | "ativa" | "vencida";

export const SELO: Record<StatusAssinatura, { texto: string; classe: string }> = {
  ativa: { texto: "Pagando", classe: "border-ok-line bg-ok-soft text-ok" },
  trial: { texto: "Em teste", classe: "border-warn-line bg-warn-soft text-warn" },
  vencida: { texto: "Vencida", classe: "border-off-line bg-off-soft text-off" },
};

/** Selo de estado. Sempre com a palavra — cor sozinha não informa. */
export function Selo({
  children,
  tom = "neutro",
}: {
  children: React.ReactNode;
  tom?: Tom;
}) {
  const cor = {
    neutro: "border-line-strong text-bone-dim",
    ok: "border-ok-line bg-ok-soft text-ok",
    warn: "border-warn-line bg-warn-soft text-warn",
    off: "border-off-line bg-off-soft text-off",
    acento: "border-cyan/40 bg-cyan/[0.07] text-cyan",
  }[tom];

  return (
    <span
      className={`inline-flex shrink-0 items-center border px-2 py-[3px] font-accent text-[10px] uppercase tracking-wider ${cor}`}
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
      className="group flex items-baseline gap-4 border-b border-line py-3 transition-colors hover:bg-bone/[0.025]"
    >
      <span className="tabular w-5 shrink-0 font-accent text-[11px] text-muted">
        {String(ordem).padStart(2, "0")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-body text-sm font-medium text-bone group-hover:text-cyan">
          {titulo}
        </span>
        <span className="mt-0.5 block font-body text-xs text-muted">{motivo}</span>
      </span>
      {prazo && (
        <span className={`shrink-0 font-accent text-[11px] ${TINTA[tom]}`}>{prazo}</span>
      )}
      <span
        aria-hidden
        className="shrink-0 font-accent text-xs text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-cyan"
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
    neutro: "border-line-strong bg-bone/[0.02] text-bone-dim",
    ok: "border-ok-line bg-ok-soft text-ok",
    warn: "border-warn-line bg-warn-soft text-warn",
    off: "border-off-line bg-off-soft text-off",
  }[tom];

  return (
    <p className={`border-l-2 py-2.5 pl-4 font-body text-sm leading-relaxed ${cor}`}>
      {children}
    </p>
  );
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <p className="border border-dashed border-line-strong px-6 py-10 text-center font-body text-sm text-muted">
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
      "border border-line-strong text-bone-dim hover:border-cyan hover:text-cyan",
    principal: "bg-bone text-ink hover:bg-cyan hover:text-white",
    perigo: "border border-off-line text-off hover:bg-off hover:text-white",
  }[tipo];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 font-body text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${cor}`}
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
      className="w-full border-b border-line-strong bg-transparent py-2 font-body text-sm text-bone outline-none transition-colors placeholder:text-muted focus:border-cyan"
    />
  );
}
