"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Mensagem de volta do Mercado Pago depois de pagar a mensalidade.
 *
 * Quem confirma o pagamento é o webhook, e ele pode levar alguns segundos —
 * a pessoa costuma voltar pro painel antes disso. Sem este aviso ela veria o
 * banner de "período grátis" de novo e acharia que o pagamento não valeu.
 */
export function RetornoAssinatura({ onConfirmado }: { onConfirmado: () => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const resultado = params.get("assinatura");
  const [conferindo, setConferindo] = useState(resultado === "ok");

  useEffect(() => {
    if (resultado !== "ok") return;

    // Recarrega algumas vezes enquanto o webhook não chega. Para sozinho:
    // insistir pra sempre gastaria consulta à toa se o pagamento falhar.
    let tentativas = 0;
    const timer = window.setInterval(() => {
      tentativas++;
      onConfirmado();
      if (tentativas >= 5) {
        window.clearInterval(timer);
        setConferindo(false);
      }
    }, 3000);

    return () => window.clearInterval(timer);
  }, [resultado, onConfirmado]);

  if (!resultado) return null;

  function fechar() {
    // Tira o parâmetro da URL pra a mensagem não voltar num F5.
    router.replace("/painel");
  }

  if (resultado === "ok") {
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ok-line bg-ok-soft p-5">
        <div>
          <p className="font-body text-sm font-semibold text-bone">
            {conferindo ? "Confirmando seu pagamento…" : "Pagamento recebido!"}
          </p>
          <p className="mt-0.5 font-body text-xs text-bone-dim">
            {conferindo
              ? "Assim que o Mercado Pago confirmar, seu plano é liberado aqui — leva alguns segundos."
              : "Se o plano ainda não mudou, atualize a página em instantes."}
          </p>
        </div>
        <button
          onClick={fechar}
          className="shrink-0 rounded-full border border-line-strong px-4 py-2 font-body text-xs text-bone-dim hover:text-bone"
        >
          Fechar
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warn-line bg-warn-soft p-5">
      <div>
        <p className="font-body text-sm font-semibold text-bone">
          {resultado === "pendente"
            ? "Pagamento em análise"
            : "O pagamento não foi concluído"}
        </p>
        <p className="mt-0.5 font-body text-xs text-bone-dim">
          {resultado === "pendente"
            ? "Alguns meios levam um tempo pra compensar. Seu plano libera quando cair."
            : "Nada foi cobrado. Você pode tentar de novo quando quiser."}
        </p>
      </div>
      <button
        onClick={fechar}
        className="shrink-0 rounded-full border border-line-strong px-4 py-2 font-body text-xs text-bone-dim hover:text-bone"
      >
        Fechar
      </button>
    </div>
  );
}
