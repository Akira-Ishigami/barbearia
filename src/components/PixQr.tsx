"use client";

import { useMemo, useState } from "react";
import { gerarQr } from "@/lib/qr";

/**
 * Mostra o código Pix pro cliente pagar.
 *
 * O "copia e cola" vem primeiro de propósito: no celular, que é onde quase
 * todo mundo agenda, o QR na própria tela é inútil — não dá pra apontar a
 * câmera pra ela mesma. O QR fica logo abaixo, pra quem estiver no
 * computador ou for pagar do aparelho de outra pessoa.
 */
export function PixQr({
  brcode,
  total,
  beneficiario,
}: {
  brcode: string;
  total: number;
  beneficiario?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  // A matriz é cara de calcular e o código não muda enquanto a tela vive.
  const modulos = useMemo(() => {
    try {
      return gerarQr(brcode);
    } catch {
      return null;
    }
  }, [brcode]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(brcode);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Navegador sem permissão de área de transferência: seleciona o texto
      // pra pessoa copiar na mão em vez de ficar sem saída.
      const campo = document.getElementById("pix-codigo") as HTMLTextAreaElement | null;
      campo?.select();
    }
  }

  // 4 módulos de margem clara em volta — sem ela, muitos leitores não
  // encontram o código.
  const margem = 4;
  const lado = modulos ? modulos.length + margem * 2 : 0;

  return (
    <div className="rounded-2xl border border-line bg-ink-elev p-5">
      <p className="font-display text-base font-semibold text-bone">
        Pague {`R$ ${total.toFixed(2).replace(".", ",")}`} no Pix
      </p>
      {beneficiario && (
        <p className="mt-0.5 font-body text-xs text-muted">
          O valor já vai preenchido. No app do banco vai aparecer{" "}
          <strong className="text-bone-dim">{beneficiario}</strong>.
        </p>
      )}

      <button
        onClick={copiar}
        className="mt-4 w-full rounded-xl bg-bone px-5 py-3.5 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.01]"
      >
        {copiado ? "Código copiado!" : "Copiar código Pix"}
      </button>

      <textarea
        id="pix-codigo"
        readOnly
        value={brcode}
        rows={3}
        onFocus={(e) => e.currentTarget.select()}
        className="mt-3 w-full resize-none break-all rounded-xl border border-line bg-bone/[0.02] px-3 py-2.5 font-accent text-[10px] leading-relaxed text-muted outline-none focus:border-line-strong"
      />

      {modulos && (
        <div className="mt-4 flex flex-col items-center">
          <p className="font-body text-xs text-muted">ou aponte a câmera do banco</p>
          <div className="mt-2 rounded-xl bg-white p-3">
            <svg
              viewBox={`0 0 ${lado} ${lado}`}
              // shapeRendering evita a borda cinza que o antialias cria entre
              // os módulos e faz alguns leitores errarem.
              shapeRendering="crispEdges"
              className="h-44 w-44"
              role="img"
              aria-label="QR Code do pagamento Pix"
            >
              <rect width={lado} height={lado} fill="#ffffff" />
              {modulos.map((linha, y) =>
                linha.map((escuro, x) =>
                  escuro ? (
                    <rect
                      key={`${y}-${x}`}
                      x={x + margem}
                      y={y + margem}
                      width={1}
                      height={1}
                      fill="#000000"
                    />
                  ) : null,
                ),
              )}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
