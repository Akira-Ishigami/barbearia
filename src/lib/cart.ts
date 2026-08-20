"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Produto, Servico } from "./types";

export interface CartServicoItem {
  servicoId: string;
  nome: string;
  preco: number;
  duracaoMin: number;
}

export interface CartProdutoItem {
  produtoId: string;
  nome: string;
  preco: number;
  quantidade: number;
  estoque: number;
}

export interface CartCliente {
  nome: string;
  telefone: string;
  email: string;
}

export interface CartAgendamento {
  barbeiroId: string;
  barbeiroNome: string;
  data: string;
  horaInicio: string;
  /** true quando o cliente deixou "sem preferência" e o sistema escolheu o profissional livre. */
  semPreferencia?: boolean;
}

export interface CartState {
  servicos: CartServicoItem[];
  produtos: CartProdutoItem[];
  cliente?: CartCliente;
  agendamento?: CartAgendamento;
  /** Profissional escolhido na Equipe do catálogo — só uma sugestão pro carrinho, o cliente pode trocar. */
  barbeiroPreferidoId?: string;
}

const EMPTY_CART: CartState = { servicos: [], produtos: [] };

function keyFor(barbeariaId: string) {
  return `navalha_carrinho_${barbeariaId}`;
}

function readCart(barbeariaId: string): CartState {
  if (typeof window === "undefined") return EMPTY_CART;
  try {
    const raw = window.localStorage.getItem(keyFor(barbeariaId));
    return raw ? (JSON.parse(raw) as CartState) : EMPTY_CART;
  } catch {
    return EMPTY_CART;
  }
}

function writeCart(barbeariaId: string, cart: CartState) {
  window.localStorage.setItem(keyFor(barbeariaId), JSON.stringify(cart));
  notify(barbeariaId);
}

const listeners = new Map<string, Set<() => void>>();

function notify(barbeariaId: string) {
  listeners.get(barbeariaId)?.forEach((l) => l());
}

// Cache the parsed snapshot per barbearia and only re-parse when the raw
// localStorage value actually changed — useSyncExternalStore needs a stable
// reference across calls when nothing changed.
const cache = new Map<string, { raw: string | null; snapshot: CartState }>();

function getSnapshot(barbeariaId: string): CartState {
  const raw =
    typeof window === "undefined" ? null : window.localStorage.getItem(keyFor(barbeariaId));
  const cached = cache.get(barbeariaId);
  if (cached && cached.raw === raw) return cached.snapshot;
  const snapshot = raw ? (JSON.parse(raw) as CartState) : EMPTY_CART;
  cache.set(barbeariaId, { raw, snapshot });
  return snapshot;
}

function getServerSnapshot(): CartState {
  return EMPTY_CART;
}

export function useCart(barbeariaId: string): CartState {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (!listeners.has(barbeariaId)) listeners.set(barbeariaId, new Set());
      listeners.get(barbeariaId)!.add(callback);
      window.addEventListener("storage", callback);
      return () => {
        listeners.get(barbeariaId)?.delete(callback);
        window.removeEventListener("storage", callback);
      };
    },
    [barbeariaId],
  );

  return useSyncExternalStore(
    subscribe,
    () => getSnapshot(barbeariaId),
    getServerSnapshot,
  );
}

export function addServicoToCart(barbeariaId: string, servico: Servico) {
  const cart = readCart(barbeariaId);
  if (cart.servicos.some((s) => s.servicoId === servico.id)) return;
  writeCart(barbeariaId, {
    ...cart,
    servicos: [
      ...cart.servicos,
      {
        servicoId: servico.id,
        nome: servico.nome,
        preco: servico.preco,
        duracaoMin: servico.duracaoMin,
      },
    ],
    // muda a quantidade de horários necessários — o horário escolhido antes pode não caber mais.
    agendamento: undefined,
  });
}

export function removeServicoFromCart(barbeariaId: string, servicoId: string) {
  const cart = readCart(barbeariaId);
  writeCart(barbeariaId, {
    ...cart,
    servicos: cart.servicos.filter((s) => s.servicoId !== servicoId),
    agendamento: undefined,
  });
}

export function setCartCliente(barbeariaId: string, cliente: CartCliente) {
  writeCart(barbeariaId, { ...readCart(barbeariaId), cliente });
}

export function setCartAgendamento(barbeariaId: string, agendamento: CartAgendamento) {
  writeCart(barbeariaId, { ...readCart(barbeariaId), agendamento });
}

export function setBarbeiroPreferido(barbeariaId: string, barbeiroId: string | undefined) {
  writeCart(barbeariaId, { ...readCart(barbeariaId), barbeiroPreferidoId: barbeiroId });
}

export function addProdutoToCart(barbeariaId: string, produto: Produto) {
  const cart = readCart(barbeariaId);
  const existente = cart.produtos.find((p) => p.produtoId === produto.id);
  if (existente) {
    setProdutoQtd(barbeariaId, produto.id, existente.quantidade + 1);
    return;
  }
  if (produto.estoque <= 0) return;
  writeCart(barbeariaId, {
    ...cart,
    produtos: [
      ...cart.produtos,
      {
        produtoId: produto.id,
        nome: produto.nome,
        preco: produto.preco,
        quantidade: 1,
        estoque: produto.estoque,
      },
    ],
  });
}

export function setProdutoQtd(barbeariaId: string, produtoId: string, quantidade: number) {
  const cart = readCart(barbeariaId);
  if (quantidade <= 0) {
    removeProdutoFromCart(barbeariaId, produtoId);
    return;
  }
  writeCart(barbeariaId, {
    ...cart,
    produtos: cart.produtos.map((p) =>
      p.produtoId === produtoId
        ? { ...p, quantidade: Math.min(quantidade, p.estoque) }
        : p,
    ),
  });
}

export function removeProdutoFromCart(barbeariaId: string, produtoId: string) {
  const cart = readCart(barbeariaId);
  writeCart(barbeariaId, {
    ...cart,
    produtos: cart.produtos.filter((p) => p.produtoId !== produtoId),
  });
}

export function clearCart(barbeariaId: string) {
  writeCart(barbeariaId, EMPTY_CART);
}

export function cartCount(cart: CartState): number {
  return cart.servicos.length + cart.produtos.reduce((sum, p) => sum + p.quantidade, 0);
}

export function cartTotal(cart: CartState): number {
  const servicos = cart.servicos.reduce((sum, s) => sum + s.preco, 0);
  const produtos = cart.produtos.reduce((sum, p) => sum + p.preco * p.quantidade, 0);
  return servicos + produtos;
}

export function cartIsEmpty(cart: CartState): boolean {
  return cart.servicos.length === 0 && cart.produtos.length === 0;
}
