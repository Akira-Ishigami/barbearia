/**
 * Localização das barbearias, pra ordenar a lista por proximidade.
 *
 * Não temos campo de latitude no banco: as coordenadas saem do próprio link
 * do Google Maps que o dono salva em Localização. Quem usou "usar
 * localização atual" tem coordenada exata; quem colou um link qualquer pode
 * não ter — por isso tudo aqui devolve `null` sem reclamar.
 */

export interface Coordenada {
  lat: number;
  lng: number;
}

/**
 * Tenta achar "-23.55,-46.63" dentro do link do Maps. Cobre os formatos
 * comuns: ?q=lat,lng, /@lat,lng,15z e !3dlat!4dlng.
 */
export function coordenadaDoLink(link: string | undefined): Coordenada | null {
  if (!link) return null;

  const padroes = [
    /[?&]q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
  ];

  for (const p of padroes) {
    const m = link.match(p);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}

/** Distância em quilômetros entre dois pontos (fórmula de haversine). */
export function distanciaKm(a: Coordenada, b: Coordenada): number {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function formatarDistancia(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km)} km`;
}

/**
 * Cidade escrita no endereço, pra agrupar e permitir busca por texto.
 *
 * O endereço é um campo livre, então isso é palpite: procuramos o pedaço
 * depois do travessão (formato que o preenchimento por CEP gera,
 * "Rua X, 12 — Bairro, Cidade/UF") e caímos no fim da string quando não há.
 */
export function cidadeDoEndereco(endereco: string): string {
  if (!endereco.trim()) return "";

  const depoisDoTravessao = endereco.split("—").pop() ?? endereco;
  const partes = depoisDoTravessao.split(",").map((p) => p.trim()).filter(Boolean);
  const ultima = partes[partes.length - 1] ?? "";

  // "Vilhena/RO" -> "Vilhena/RO"; texto muito longo provavelmente não é cidade.
  return ultima.length <= 40 ? ultima : "";
}

/**
 * Endereço do mapa embutido (`output=embed` não pede chave de API).
 *
 * Passar o link do Maps inteiro como `q=` faz o Google tratar a URL como
 * termo de busca e devolver o mundo inteiro — então quando o link tem
 * coordenada a gente extrai só ela, que é o que centraliza o pino. Sem
 * coordenada, cai no endereço escrito, que o Google geocodifica sozinho.
 */
export function mapaEmbedSrc(
  linkMaps: string | undefined,
  endereco: string,
  zoom = 16,
): string {
  const coord = coordenadaDoLink(linkMaps);
  const q = coord ? `${coord.lat},${coord.lng}` : endereco;
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=${zoom}&output=embed`;
}
