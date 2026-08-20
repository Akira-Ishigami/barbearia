export interface EnderecoCep {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export function formatCep(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function isValidCep(valor: string): boolean {
  return valor.replace(/\D/g, "").length === 8;
}

/**
 * Consulta o CEP no ViaCEP (gratuito, sem cadastro).
 * Devolve null quando o CEP não existe ou a consulta falha — quem chama
 * decide o que mostrar, e o endereço continua editável na mão.
 */
export async function buscarCep(cep: string): Promise<EnderecoCep | null> {
  const digitos = cep.replace(/\D/g, "");
  if (digitos.length !== 8) return null;

  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
    if (!resposta.ok) return null;

    const dados = await resposta.json();
    if (dados.erro) return null;

    return {
      logradouro: dados.logradouro ?? "",
      bairro: dados.bairro ?? "",
      cidade: dados.localidade ?? "",
      uf: dados.uf ?? "",
    };
  } catch {
    return null;
  }
}

/** Junta as partes num endereço só, do jeito que a página pública mostra. */
export function montarEndereco(
  e: EnderecoCep,
  numero: string,
  complemento?: string,
): string {
  const rua = [e.logradouro, numero.trim()].filter(Boolean).join(", ");
  const comComplemento = [rua, complemento?.trim()].filter(Boolean).join(" — ");
  const local = [e.bairro, [e.cidade, e.uf].filter(Boolean).join("/")]
    .filter(Boolean)
    .join(", ");
  return [comComplemento, local].filter(Boolean).join(" — ");
}
