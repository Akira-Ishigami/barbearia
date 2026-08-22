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

/**
 * Variância do laplaciano abaixo disso indica imagem sem detalhe real —
 * tipicamente uma foto pequena que alguém ampliou antes de enviar. O valor
 * é conservador de propósito: imagem levemente suave passa, só barra o que
 * está claramente borrado.
 */
const NITIDEZ_MINIMA = 12;

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

/**
 * Mede o detalhe da imagem pela variância do laplaciano — quanto mais
 * bordas nítidas, maior o valor.
 *
 * Serve pra pegar o caso que apareceu em produção: uma imagem de 161x91
 * ampliada pra 1920 antes de subir. As dimensões passavam na checagem, mas
 * a foto não tinha detalhe nenhum e ficava borrada ocupando a tela toda.
 */
function medirNitidez(ctx: CanvasRenderingContext2D, largura: number, altura: number): number {
  // Amostra reduzida: medir na resolução cheia é caro e não muda o veredito.
  const passo = Math.max(1, Math.floor(Math.max(largura, altura) / 320));
  const w = Math.floor(largura / passo);
  const h = Math.floor(altura / passo);
  if (w < 3 || h < 3) return Number.POSITIVE_INFINITY;

  let dados: Uint8ClampedArray;
  try {
    dados = ctx.getImageData(0, 0, largura, altura).data;
  } catch {
    // Canvas "sujo" por imagem de outra origem: não dá pra medir, deixa passar.
    return Number.POSITIVE_INFINITY;
  }

  const cinza = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((y * passo) * largura + x * passo) * 4;
      cinza[y * w + x] = 0.299 * dados[i] + 0.587 * dados[i + 1] + 0.114 * dados[i + 2];
    }
  }

  let soma = 0;
  let somaQuad = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap =
        cinza[i - w] + cinza[i + w] + cinza[i - 1] + cinza[i + 1] - 4 * cinza[i];
      soma += lap;
      somaQuad += lap * lap;
      n++;
    }
  }
  if (n === 0) return Number.POSITIVE_INFINITY;
  const media = soma / n;
  return somaQuad / n - media * media;
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

  if (medirNitidez(ctx, largura, altura) < NITIDEZ_MINIMA) {
    return {
      ok: false,
      error:
        "Essa imagem está borrada — parece uma foto pequena que foi ampliada. " +
        "Use o arquivo original, sem esticar, senão ela aparece assim pro cliente.",
    };
  }

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
