"use client";

import { useEffect, useState } from "react";
import { supabase, supabaseConfigurado } from "./supabase-browser";
import type { Session, UserRole } from "./types";

/**
 * Sessão de quem está logado (dono ou barbeiro).
 *
 * A identidade vem do Supabase Auth; o papel e a barbearia vêm da tabela
 * `usuarios`, ligada pelo `auth_user_id`.
 *
 * `undefined` = ainda carregando · `null` = não logado.
 */
export type SessionState = Session | null | undefined;

async function carregarSessao(): Promise<Session | null> {
  if (!supabaseConfigurado()) return null;

  const db = supabase();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;

  const { data: usuario } = await db
    .from("usuarios")
    .select("id, nome, email, role, barbearia_id, barbearias(nome)")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();

  if (!usuario) return null;

  const barbearia = usuario.barbearias as unknown as { nome?: string } | null;

  return {
    userId: usuario.id as string,
    nome: usuario.nome as string,
    email: usuario.email as string,
    role: usuario.role as UserRole,
    barbeariaId: usuario.barbearia_id as string,
    barbeariaNome: barbearia?.nome ?? "Sua barbearia",
  };
}

export function useSession(): SessionState {
  const [sessao, setSessao] = useState<SessionState>(undefined);

  useEffect(() => {
    let cancelado = false;

    carregarSessao()
      .then((s) => {
        if (!cancelado) setSessao(s);
      })
      .catch(() => {
        if (!cancelado) setSessao(null);
      });

    if (!supabaseConfigurado()) return () => {};

    // Refaz a sessão quando entra ou sai — inclusive em outra aba.
    const { data: sub } = supabase().auth.onAuthStateChange(() => {
      carregarSessao()
        .then((s) => {
          if (!cancelado) setSessao(s);
        })
        .catch(() => {
          if (!cancelado) setSessao(null);
        });
    });

    return () => {
      cancelado = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return sessao;
}

export async function entrar(
  email: string,
  senha: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabaseConfigurado()) {
    return { ok: false, error: "Banco não configurado. Veja o SETUP.md." };
  }

  const { error } = await supabase().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: senha,
  });

  if (error) {
    // A mensagem crua do Supabase vem em inglês e vaza detalhe demais.
    return { ok: false, error: "E-mail ou senha incorretos." };
  }
  return { ok: true };
}

export async function sair() {
  if (supabaseConfigurado()) await supabase().auth.signOut();
}
