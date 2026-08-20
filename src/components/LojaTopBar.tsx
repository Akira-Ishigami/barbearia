"use client";

import Link from "next/link";
import { cartCount, cartTotal, useCart } from "@/lib/cart";

/**
 * Barra fixa do catálogo: identidade à esquerda, carrinho à direita.
 * Quando o carrinho tem itens, o botão cresce e mostra o total — assim o
 * próximo passo fica sempre visível sem precisar de barra flutuante.
 */
export function LojaTopBar({
  barbeariaId,
  barbeariaNome,
}: {
  barbeariaId: string;
  barbeariaNome: string;
}) {
  const cart = useCart(barbeariaId);
  const count = cartCount(cart);
  const vazio = count === 0;

  return (
    <div className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <Link
          href={`/loja/${barbeariaId}`}
          className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-70"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bone text-ink">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.5 8.5l11 11M20 4 8.5 15.5" />
            </svg>
          </span>
          <span className="truncate font-display text-sm font-semibold tracking-tight text-bone">
            {barbeariaNome}
          </span>
        </Link>

        <Link
          href={`/loja/${barbeariaId}/carrinho`}
          aria-label={vazio ? "Ver carrinho" : `Ver carrinho, ${count} itens`}
          className={`flex shrink-0 items-center gap-2.5 rounded-full font-body text-sm font-semibold transition-transform hover:scale-[1.03] ${
            vazio
              ? "h-10 w-10 justify-center border border-line-strong text-bone-dim"
              : "bg-bone py-2.5 pl-4 pr-2.5 text-ink"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 shrink-0"
          >
            <path d="M6 8h12l-1.2 11a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6 8ZM9 8V6a3 3 0 0 1 6 0v2" />
          </svg>
          {!vazio && (
            <>
              <span className="font-accent text-xs">
                {cartTotal(cart).toFixed(2).replace(".", ",")}
              </span>
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-gold-bright px-1.5 font-accent text-[11px] text-white">
                {count}
              </span>
            </>
          )}
        </Link>
      </div>
    </div>
  );
}
