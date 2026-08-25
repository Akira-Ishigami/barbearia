"use client";

/**
 * Peças da visão geral da plataforma.
 *
 * Ficam separadas da página porque ela virou uma tela longa: com tudo no
 * mesmo arquivo, achar onde um número é desenhado passava a ser o trabalho
 * mais caro de mexer nela.
 *
 * Regras de leitura que valem pra todas as peças aqui:
 * — valor e rótulo usam a cor de texto, nunca a cor da série; quem carrega
 *   identidade é a barra ou o ponto ao lado, não o número;
 * — as barras são de uma série só, então não levam legenda: o título já
 *   diz o que está sendo medido;
 * — nada de dois eixos no mesmo gráfico. Duas medidas de grandeza
 *   diferente viram dois gráficos.
 */

export function dinheiro(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Valor compacto pro eixo: 1.2 mil em vez de 1.200,00. */
export function curto(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(".", ",")} mil`;
  return String(Math.round(v));
}

export function data(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
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

// ---------- Número em destaque ----------

type Tom = "neutro" | "ok" | "warn" | "off" | "cyan";

const CAIXA: Record<Tom, string> = {
  neutro: "border-line bg-ink-elev",
  ok: "border-ok-line bg-ok-soft",
  warn: "border-warn-line bg-warn-soft",
  off: "border-off-line bg-off-soft",
  cyan: "border-cyan/30 bg-cyan/[0.06]",
};

const ROTULO: Record<Tom, string> = {
  neutro: "text-bone-dim",
  ok: "text-ok",
  warn: "text-warn",
  off: "text-off",
  cyan: "text-cyan-bright",
};

export function Numero({
  titulo,
  valor,
  detalhe,
  tom = "neutro",
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  tom?: Tom;
}) {
  return (
    <div className={`rounded-2xl border p-5 ${CAIXA[tom]}`}>
      <p className={`font-body text-xs font-semibold uppercase tracking-wide ${ROTULO[tom]}`}>
        {titulo}
      </p>
      <p className="mt-2 font-accent text-3xl leading-none text-bone">{valor}</p>
      {detalhe && <p className="mt-1.5 font-body text-xs text-bone-dim">{detalhe}</p>}
    </div>
  );
}

// ---------- Barras por semana ----------

export interface Semana {
  inicio: string;
  cadastros: number;
  pedidos: number;
  movimentado: number;
}

/**
 * Uma série, dez semanas.
 *
 * Cadastros, pedidos e dinheiro são grandezas diferentes e por isso viram
 * três gráficos iguais lado a lado, e não um só com vários eixos — dois
 * eixos no mesmo desenho fazem qualquer par de linhas parecer relacionado.
 *
 * O topo é sempre o maior valor da própria série: o que essa leitura
 * responde é a forma (subiu? caiu?), não o valor absoluto, que já está
 * escrito ao lado.
 */
export function BarrasSemana({
  titulo,
  semanas,
  campo,
  formatar,
}: {
  titulo: string;
  semanas: Semana[];
  campo: "cadastros" | "pedidos" | "movimentado";
  formatar: (v: number) => string;
}) {
  const valores = semanas.map((s) => s[campo]);
  const maior = Math.max(1, ...valores);
  const total = valores.reduce((a, b) => a + b, 0);
  const ultima = valores[valores.length - 1] ?? 0;
  const anterior = valores[valores.length - 2] ?? 0;

  // Só faz sentido comparar quando havia de onde variar.
  const variacao =
    anterior > 0 ? Math.round(((ultima - anterior) / anterior) * 100) : null;

  return (
    <div className="rounded-2xl border border-line bg-ink-elev p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-bone-dim">
            {titulo}
          </p>
          <p className="mt-1.5 font-accent text-2xl leading-none text-bone">
            {formatar(ultima)}
          </p>
          <p className="mt-1 font-body text-[11px] text-muted">
            nesta semana · {formatar(total)} em 10 semanas
          </p>
        </div>
        {variacao !== null && (
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 font-body text-[11px] font-semibold ${
              variacao > 0
                ? "border-ok-line bg-ok-soft text-ok"
                : variacao < 0
                  ? "border-off-line bg-off-soft text-off"
                  : "border-line-strong text-muted"
            }`}
          >
            {variacao > 0 ? "↑" : variacao < 0 ? "↓" : "="} {Math.abs(variacao)}%
          </span>
        )}
      </div>

      <div className="mt-4 flex h-20 items-end gap-1">
        {semanas.map((s) => {
          const v = s[campo];
          const altura = (v / maior) * 100;
          return (
            <div key={s.inicio} className="group relative flex h-full flex-1 items-end">
              {/* Trilho: mostra onde a semana começa mesmo quando o valor é 0. */}
              <div className="absolute inset-x-0 bottom-0 top-0 rounded-[3px] bg-bone/[0.04]" />
              <div
                className="relative w-full rounded-[3px] bg-cyan transition-colors group-hover:bg-cyan-bright"
                style={{ height: `${Math.max(v > 0 ? 6 : 2, altura)}%` }}
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-line-strong bg-ink-elev-2 px-2 py-1 font-body text-[11px] text-bone shadow-lg group-hover:block">
                {formatar(v)}
                <span className="block text-[10px] text-muted">
                  semana de {data(s.inicio)}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-1.5 flex justify-between font-body text-[10px] text-muted">
        <span>{data(semanas[0]?.inicio)}</span>
        <span>hoje</span>
      </div>
    </div>
  );
}

// ---------- Lista de coisas pra resolver ----------

export interface ItemAtencao {
  id: string;
  nome: string;
  nota?: string;
}

/**
 * Um alerta. O ícone e o texto carregam o estado junto da cor — quem não
 * distingue as cores continua lendo o que está acontecendo.
 */
export function Alerta({
  icone,
  titulo,
  explicacao,
  itens,
  tom,
  aoAbrir,
}: {
  icone: string;
  titulo: string;
  explicacao: string;
  itens: ItemAtencao[];
  tom: "off" | "warn" | "neutro";
  aoAbrir?: (id: string) => void;
}) {
  if (itens.length === 0) return null;

  const cor = {
    off: "border-off-line bg-off-soft",
    warn: "border-warn-line bg-warn-soft",
    neutro: "border-line-strong bg-bone/[0.02]",
  }[tom];

  const texto = { off: "text-off", warn: "text-warn", neutro: "text-bone-dim" }[tom];

  return (
    <div className={`rounded-2xl border p-4 ${cor}`}>
      <div className="flex items-baseline gap-2">
        <span aria-hidden className="font-body text-sm">
          {icone}
        </span>
        <p className={`font-body text-sm font-semibold ${texto}`}>
          {titulo} · {itens.length}
        </p>
      </div>
      <p className="mt-0.5 font-body text-[11px] text-muted">{explicacao}</p>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {itens.slice(0, 8).map((i) => (
          <button
            key={i.id}
            onClick={() => aoAbrir?.(i.id)}
            className="rounded-full border border-line-strong bg-ink-elev/60 px-2.5 py-1 font-body text-[11px] text-bone-dim transition-colors hover:border-cyan/50 hover:text-cyan-bright"
          >
            {i.nome}
            {i.nota && <span className="text-muted"> · {i.nota}</span>}
          </button>
        ))}
        {itens.length > 8 && (
          <span className="px-1 py-1 font-body text-[11px] text-muted">
            +{itens.length - 8}
          </span>
        )}
      </div>
    </div>
  );
}
