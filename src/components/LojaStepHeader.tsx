"use client";

export const ETAPAS = ["Itens", "Profissional", "Horário", "Seus dados", "Resumo"] as const;

export type EtapaIndex = 0 | 1 | 2 | 3 | 4;

/**
 * Cabeçalho do checkout: um passo por vez, com barra de progresso.
 * O nome da etapa atual aparece sempre; as outras viram só bolinhas no
 * celular pra não competir com o conteúdo.
 */
export function LojaStepHeader({
  barbeariaNome,
  etapa,
  onVoltar,
  pulaDados = false,
}: {
  barbeariaNome: string;
  etapa: EtapaIndex;
  onVoltar: () => void;
  /** Cliente logado não passa por "Seus dados" — o contador ignora a etapa. */
  pulaDados?: boolean;
}) {
  // Sem isso, quem pula a etapa 3 veria o contador saltar de 3/5 pra 5/5.
  const total = pulaDados ? ETAPAS.length - 1 : ETAPAS.length;
  const atual = pulaDados && etapa > 3 ? etapa : etapa + 1;
  const progresso = (atual / total) * 100;

  return (
    <div className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur-xl">
      <div className="mx-auto max-w-2xl px-6 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={onVoltar}
            className="flex shrink-0 items-center gap-1.5 font-body text-sm text-bone-dim transition-colors hover:text-bone"
          >
            <span aria-hidden>←</span> Voltar
          </button>
          <p className="truncate font-display text-sm font-semibold text-bone">{barbeariaNome}</p>
          <span className="shrink-0 font-accent text-[11px] text-muted">
            {atual}/{total}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink-elev-2">
            <div
              className="h-full rounded-full bg-bone transition-[width] duration-300 ease-out"
              style={{ width: `${progresso}%` }}
            />
          </div>
          <p className="shrink-0 font-accent text-[11px] uppercase tracking-[0.15em] text-bone">
            {ETAPAS[etapa]}
          </p>
        </div>
      </div>
    </div>
  );
}
