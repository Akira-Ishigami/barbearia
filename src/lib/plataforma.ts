import type { NextRequest } from "next/server";
import { supabaseAdmin } from "./supabase";

/**
 * Quem cuida da Navalha em si — não da barbearia.
 *
 * É proposital que isto NÃO passe por `autenticar()` (lib/auth-api): aquela
 * função exige uma linha em `usuarios`, que sempre pertence a uma barbearia.
 * O suporte não tem barbearia; a permissão dele vem da tabela
 * `plataforma_equipe`, casada pelo e-mail do token do Supabase Auth.
 *
 * `plataforma_equipe` não tem policy de RLS, então só o service role — ou
 * seja, só as rotas de API — consegue ler. O navegador nunca decide sozinho
 * se alguém é admin.
 */

export type NivelPlataforma = "admin" | "suporte";

export interface Plataforma {
  authUserId: string;
  email: string;
  nivel: NivelPlataforma;
  nome: string;
}

export async function autenticarPlataforma(
  request: NextRequest,
): Promise<Plataforma | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;

  const db = supabaseAdmin();

  const { data: auth, error } = await db.auth.getUser(token);
  if (error || !auth.user?.email) return null;

  const email = auth.user.email.trim().toLowerCase();

  const { data: membro } = await db
    .from("plataforma_equipe")
    .select("email, nome, nivel, ativo")
    .eq("email", email)
    .maybeSingle();

  if (!membro || membro.ativo === false) return null;

  // Carimba o último acesso sem travar a resposta — se falhar, paciência.
  db.from("plataforma_equipe")
    .update({ ultimo_acesso: new Date().toISOString() })
    .eq("email", email)
    .then(
      () => {},
      () => {},
    );

  return {
    authUserId: auth.user.id,
    email,
    nivel: membro.nivel === "admin" ? "admin" : "suporte",
    nome: (membro.nome as string) || email,
  };
}

/**
 * Mesma coisa, mas exigindo nível admin. Usada nas rotas que mexem em
 * dinheiro (assinatura, plano) e na própria equipe da plataforma — o
 * suporte enxerga tudo, mas não altera cobrança.
 */
export async function autenticarAdmin(request: NextRequest): Promise<Plataforma | null> {
  const quem = await autenticarPlataforma(request);
  return quem?.nivel === "admin" ? quem : null;
}

/** Trilha do que o suporte fez. Acesso amplo sem registro não se sustenta. */
export async function registrarAcao(
  quem: Plataforma,
  acao: string,
  barbeariaId: string | null,
  detalhe = "",
): Promise<void> {
  try {
    await supabaseAdmin().from("plataforma_log").insert({
      email: quem.email,
      acao,
      barbearia_id: barbeariaId,
      detalhe,
    });
  } catch {
    /* log é apoio: se falhar, a ação em si não pode quebrar */
  }
}
