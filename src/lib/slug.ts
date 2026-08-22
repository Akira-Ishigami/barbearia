/**
 * Transforma o nome da barbearia no endereço da página pública.
 *
 *   "Barbearia do Zé"  ->  "barbearia-do-ze"
 *
 * Sem acento e sem espaço porque é o que vai na URL — link com %C3%A9 no
 * meio é feio de mandar pro cliente e quebra em alguns aplicativos.
 */
export function gerarSlug(nome: string): string {
  return nome
    .normalize("NFD")
    // remove os acentos que o NFD separou da letra
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Um uuid tem 36 caracteres neste formato; slug nunca cai nele. */
export function pareceUuid(valor: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor);
}

/**
 * Caminho da página pública. Usa o nome quando a barbearia tem slug e cai
 * no uuid quando não tem — cadastros antigos ficaram sem.
 */
export function caminhoLoja(b: { slug?: string; id: string }): string {
  return `/loja/${b.slug || b.id}`;
}
