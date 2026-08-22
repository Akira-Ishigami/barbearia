"use client";

/**
 * Prepara a foto no navegador antes de guardar.
 *
 * Antes o arquivo ia direto pro banco em base64, sem passar por aqui. Isso
 * criava dois problemas ao mesmo tempo: foto de celular (5–8 MB) era
 * recusada pelo limite de tamanho, e miniatura salva da web (161x91, o caso
 * que apareceu em produção) era aceita e depois esticada pra tela inteira,
 * ficando borrada.
 *
 * Agora a imagem é redesenhada num canvas: entra em qualquer tamanho, sai
 * na resolução certa e com peso controlado — e resolução pequena demais é
 * recusada na hora, com explicação.
 */

export interface PresetFoto {
  /** Maior lado da imagem final, em pixels. */
  ladoMax: number;
  /** 0–1. Acima de 0.9 o arquivo incha sem ganho visível. */
  qualidade: number;
  /** Abaixo disso a foto apareceria esticada e borrada. */
  larguraMinima: number;
  /** Como esse uso aparece na mensagem de erro. */
  descricao: string;
}

export const PRESET_CAPA: PresetFoto = {
  ladoMax: 1920,
  qualidade: 0.85,
  larguraMinima: 700,
  descricao: "a foto de capa ocupa a tela inteira",
};

export const PRESET_GALERIA: PresetFoto = {
  ladoMax: 1280,
  qualidade: 0.82,
  larguraMinima: 500,
  descricao: "as fotos da galeria aparecem grandes",
};

/** Serviços e produtos aparecem em cards pequenos. */
export const PRESET_CATALOGO: PresetFoto = {
  ladoMax: 800,
  qualidade: 0.82,
  larguraMinima: 200,
  descricao: "a foto aparece no card do catálogo",
};

/**
 * Barbeiro. Não é só o círculo do painel: na página pública a mesma foto
 * vira um card em retrato, grande — daí o lado maior generoso.
 */
export const PRESET_AVATAR: PresetFoto = {
  ladoMax: 800,
  qualidade: 0.85,
  larguraMinima: 300,
  descricao: "a foto do barbeiro aparece grande na página pública",
};

export interface FotoPronta {
  dataUrl: string;
  largura: number;
  altura: number;
  kb: number;
}

async function carregar(file: File): Promise<{ bitmap: ImageBitmap } | { img: HTMLImageElement }> {
  // `from-image` respeita a orientação EXIF — sem isso foto tirada de lado
  // no celular fica deitada.
  if (typeof createImageBitmap === "function") {
    try {
      return { bitmap: await createImageBitmap(file, { imageOrientation: "from-image" }) };
    } catch {
      /* navegador sem suporte à opção; cai no <img> abaixo */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("falha ao ler"));
      el.src = url;
    });
    return { img };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepararFoto(
  file: File,
  preset: PresetFoto,
): Promise<{ ok: true; foto: FotoPronta } | { ok: false; error: string }> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Escolha um arquivo de imagem." };
  }

  let origem: { bitmap: ImageBitmap } | { img: HTMLImageElement };
  try {
    origem = await carregar(file);
  } catch {
    return { ok: false, error: "Não consegui abrir essa imagem. Tente outra." };
  }

  const fonte = "bitmap" in origem ? origem.bitmap : origem.img;
  const largura0 = "bitmap" in origem ? origem.bitmap.width : origem.img.naturalWidth;
  const altura0 = "bitmap" in origem ? origem.bitmap.height : origem.img.naturalHeight;

  if (!largura0 || !altura0) {
    return { ok: false, error: "Não consegui ler as dimensões dessa imagem." };
  }

  if (largura0 < preset.larguraMinima) {
    if ("bitmap" in origem) origem.bitmap.close();
    return {
      ok: false,
      error:
        `Essa imagem tem só ${largura0}px de largura e ficaria borrada — ${preset.descricao}. ` +
        `Use uma com pelo menos ${preset.larguraMinima}px (evite miniaturas salvas da internet).`,
    };
  }

  // Só reduz; ampliar não cria detalhe, apenas engorda o arquivo.
  const escala = Math.min(1, preset.ladoMax / Math.max(largura0, altura0));
  const largura = Math.round(largura0 * escala);
  const altura = Math.round(altura0 * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    if ("bitmap" in origem) origem.bitmap.close();
    return { ok: false, error: "Seu navegador não conseguiu processar a imagem." };
  }

  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(fonte as CanvasImageSource, 0, 0, largura, altura);
  if ("bitmap" in origem) origem.bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", preset.qualidade);

  return {
    ok: true,
    foto: {
      dataUrl,
      largura,
      altura,
      kb: Math.round((dataUrl.length * 3) / 4 / 1024),
    },
  };
}
