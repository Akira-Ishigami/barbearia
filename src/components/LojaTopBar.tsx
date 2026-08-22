"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cartCount, cartTotal, useCart } from "@/lib/cart";
import { getClienteLogado } from "@/lib/cliente-db";
import { useAsync } from "@/lib/use-async";

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
  const pathname = usePathname();

  // Cliente logado é opcional: sem conta a loja funciona igual, então uma
  // falha aqui não pode atrapalhar o agendamento.
  const { dados: cliente } = useAsync(() => getClienteLogado(), []);

  return (
    <div className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* A tesoura é a marca da Navalha, não da barbearia: leva pro
              diretório, onde dá pra achar outras. O nome ao lado é que
              volta pro topo desta loja. */}
          <Link
            href="/barbearias"
            aria-label="Ver outras barbearias"
            title="Ver outras barbearias"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bone text-ink transition-transform hover:scale-105"
          >
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
          </Link>
          <Link
            href={`/loja/${barbeariaId}`}
            className="min-w-0 truncate font-display text-sm font-semibold tracking-tight text-bone transition-opacity hover:opacity-70"
          >
            {barbeariaNome}
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-2">
        <Link
          href={cliente ? "/minha-conta" : `/entrar?voltar=${encodeURIComponent(pathname)}`}
          aria-label={cliente ? "Minha conta" : "Entrar"}
          title={cliente ? cliente.nome : "Entrar na minha conta"}
          className="flex h-10 items-center gap-2 rounded-full border border-line-strong px-3 font-body text-xs font-semibold text-bone-dim transition-colors hover:border-bone/40 hover:text-bone"
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
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
          </svg>
          <span className="hidden sm:inline">
            {cliente ? cliente.nome.split(" ")[0] : "Entrar"}
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
    </div>
  );
}
