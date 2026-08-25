/**
 * Gerador de QR Code — modo byte, correção de erro nível M, versões 1 a 10.
 *
 * Escrito à mão de propósito: o único uso aqui é o código Pix, que tem
 * ~150 caracteres e cabe folgado na versão 10. Puxar uma biblioteca inteira
 * pra isso adicionaria dependência (e superfície de ataque) num projeto que
 * hoje só depende de Next, React e do cliente do Supabase.
 *
 * Nível M corrige ~15% do código — é o que o Banco Central recomenda pro
 * BR Code, e aguenta o QR ser lido de um celular meio sujo no balcão.
 *
 * A saída é uma matriz de booleanos (true = módulo preto). Quem desenha
 * decide se vira SVG, canvas ou tabela.
 */

// Por versão: quantos códigos de correção por bloco e como os blocos de
// dados se dividem ([quantidade de blocos, códigos de dados em cada um]).
const VERSOES: Record<number, { ecPorBloco: number; grupos: [number, number][] }> = {
  1: { ecPorBloco: 10, grupos: [[1, 16]] },
  2: { ecPorBloco: 16, grupos: [[1, 28]] },
  3: { ecPorBloco: 26, grupos: [[1, 44]] },
  4: { ecPorBloco: 18, grupos: [[2, 32]] },
  5: { ecPorBloco: 24, grupos: [[2, 43]] },
  6: { ecPorBloco: 16, grupos: [[4, 27]] },
  7: { ecPorBloco: 18, grupos: [[4, 31]] },
  8: { ecPorBloco: 22, grupos: [[2, 38], [2, 39]] },
  9: { ecPorBloco: 22, grupos: [[3, 36], [2, 37]] },
  10: { ecPorBloco: 26, grupos: [[4, 43], [1, 44]] },
};

/** Centros dos padrões de alinhamento de cada versão. */
const ALINHAMENTO: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

function totalDados(v: number): number {
  return VERSOES[v].grupos.reduce((t, [qtd, tam]) => t + qtd * tam, 0);
}

// ---------- Aritmética de Galois GF(256) ----------
// Reed-Solomon trabalha nesse corpo finito; multiplicar vira somar
// expoentes, então duas tabelas resolvem tudo.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // polinômio primitivo do QR
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function mul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

/**
 * Polinômio gerador de grau `grau`, usado pra calcular a correção.
 *
 * Sai do maior expoente pro menor — g[0] é sempre 1. A divisão abaixo
 * depende dessa ordem; invertida, ela gera códigos de correção que nenhum
 * leitor aceita.
 */
function gerador(grau: number): number[] {
  let poly = [1];
  for (let i = 0; i < grau; i++) {
    const novo = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      novo[j] ^= mul(poly[j], EXP[i]);
      novo[j + 1] ^= poly[j];
    }
    poly = novo;
  }
  return poly.reverse();
}

/** Códigos de correção de um bloco de dados. */
function correcao(dados: number[], quantos: number): number[] {
  const g = gerador(quantos);
  const resto = new Array<number>(quantos).fill(0);

  for (const byte of dados) {
    const fator = byte ^ resto[0];
    resto.shift();
    resto.push(0);
    for (let i = 0; i < quantos; i++) resto[i] ^= mul(g[i + 1], fator);
  }
  return resto;
}

// ---------- Bits ----------
class Bits {
  readonly valores: number[] = [];

  push(valor: number, tamanho: number) {
    for (let i = tamanho - 1; i >= 0; i--) this.valores.push((valor >>> i) & 1);
  }

  get tamanho() {
    return this.valores.length;
  }
}

/** Menor versão que comporta o texto. */
function escolherVersao(bytes: number): number {
  for (let v = 1; v <= 10; v++) {
    const contador = v <= 9 ? 8 : 16;
    const necessario = 4 + contador + bytes * 8;
    if (necessario <= totalDados(v) * 8) return v;
  }
  throw new Error("Texto grande demais pro QR (máximo suportado: versão 10).");
}

/** Cabeçalho + texto + preenchimento até fechar os códigos de dados. */
function montarDados(texto: string, versao: number): number[] {
  const bytes = new TextEncoder().encode(texto);
  const capacidade = totalDados(versao) * 8;

  const bits = new Bits();
  bits.push(0b0100, 4); // modo byte
  bits.push(bytes.length, versao <= 9 ? 8 : 16);
  for (const b of bytes) bits.push(b, 8);

  // Terminador de até 4 bits e fecha o último byte.
  bits.push(0, Math.min(4, capacidade - bits.tamanho));
  while (bits.tamanho % 8 !== 0) bits.push(0, 1);

  const codigos: number[] = [];
  for (let i = 0; i < bits.tamanho; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits.valores[i + j];
    codigos.push(byte);
  }

  // Preenchimento padrão do QR: 0xEC e 0x11 alternados até encher.
  const enchimento = [0xec, 0x11];
  for (let i = 0; codigos.length < totalDados(versao); i++) {
    codigos.push(enchimento[i % 2]);
  }
  return codigos;
}

/**
 * Intercala blocos de dados e de correção.
 *
 * O QR não guarda os blocos em sequência: ele pega o 1º byte de cada bloco,
 * depois o 2º de cada, e assim por diante. É o que faz um borrão no papel
 * estragar um pedaço de cada bloco em vez de destruir um bloco inteiro.
 */
function intercalar(codigos: number[], versao: number): number[] {
  const { ecPorBloco, grupos } = VERSOES[versao];

  const blocosDados: number[][] = [];
  const blocosEc: number[][] = [];
  let pos = 0;

  for (const [quantidade, tamanho] of grupos) {
    for (let i = 0; i < quantidade; i++) {
      const bloco = codigos.slice(pos, pos + tamanho);
      pos += tamanho;
      blocosDados.push(bloco);
      blocosEc.push(correcao(bloco, ecPorBloco));
    }
  }

  const saida: number[] = [];
  const maiorDado = Math.max(...blocosDados.map((b) => b.length));

  for (let i = 0; i < maiorDado; i++) {
    for (const bloco of blocosDados) if (i < bloco.length) saida.push(bloco[i]);
  }
  for (let i = 0; i < ecPorBloco; i++) {
    for (const bloco of blocosEc) saida.push(bloco[i]);
  }
  return saida;
}

// ---------- Matriz ----------
type Grade = (boolean | null)[][];

function novaGrade(tamanho: number): Grade {
  return Array.from({ length: tamanho }, () => new Array(tamanho).fill(null));
}

function desenharFinder(g: Grade, funcao: boolean[][], linha: number, coluna: number) {
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const y = linha + dy;
      const x = coluna + dx;
      if (y < 0 || y >= g.length || x < 0 || x >= g.length) continue;
      const dist = Math.max(Math.abs(dy - 3), Math.abs(dx - 3));
      g[y][x] = dist !== 2 && dist <= 3;
      funcao[y][x] = true;
    }
  }
}

/** Padrões fixos: localizadores, alinhamento, tempo e áreas reservadas. */
function desenharFuncoes(g: Grade, versao: number): boolean[][] {
  const n = g.length;
  const funcao: boolean[][] = Array.from({ length: n }, () => new Array(n).fill(false));

  desenharFinder(g, funcao, 0, 0);
  desenharFinder(g, funcao, 0, n - 7);
  desenharFinder(g, funcao, n - 7, 0);

  // Linhas de tempo: alternância que serve de régua pro leitor.
  for (let i = 0; i < n; i++) {
    if (!funcao[6][i]) {
      g[6][i] = i % 2 === 0;
      funcao[6][i] = true;
    }
    if (!funcao[i][6]) {
      g[i][6] = i % 2 === 0;
      funcao[i][6] = true;
    }
  }

  const centros = ALINHAMENTO[versao];
  for (const cy of centros) {
    for (const cx of centros) {
      // Os cantos são ocupados pelos localizadores.
      if ((cy === 6 && cx === 6) || (cy === 6 && cx === n - 7) || (cy === n - 7 && cx === 6)) {
        continue;
      }
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          g[cy + dy][cx + dx] = Math.max(Math.abs(dy), Math.abs(dx)) !== 1;
          funcao[cy + dy][cx + dx] = true;
        }
      }
    }
  }

  // Espaço do formato (nível de correção + máscara).
  for (let i = 0; i < 9; i++) {
    funcao[8][i] = true;
    funcao[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    funcao[8][n - 1 - i] = true;
    funcao[n - 1 - i][8] = true;
  }
  // Módulo sempre preto exigido pelo padrão.
  g[n - 8][8] = true;
  funcao[n - 8][8] = true;

  // A partir da versão 7 o número da versão vai gravado no código.
  if (versao >= 7) {
    const bits = versaoBits(versao);
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) === 1;
      const a = Math.floor(i / 3);
      const b = (i % 3) + n - 11;
      g[b][a] = bit;
      g[a][b] = bit;
      funcao[b][a] = true;
      funcao[a][b] = true;
    }
  }

  return funcao;
}

/** BCH(18,6) do número da versão. */
function versaoBits(versao: number): number {
  let resto = versao;
  for (let i = 0; i < 12; i++) resto = (resto << 1) ^ ((resto >>> 11) * 0x1f25);
  return (versao << 12) | resto;
}

/** BCH(15,5) do formato — nível M (00) combinado com a máscara. */
function formatoBits(mascara: number): number {
  const dados = mascara; // nível M = 00, então sobra só a máscara
  let resto = dados;
  for (let i = 0; i < 10; i++) resto = (resto << 1) ^ ((resto >>> 9) * 0x537);
  return ((dados << 10) | resto) ^ 0x5412;
}

function desenharFormato(g: Grade, mascara: number) {
  const n = g.length;
  const bits = formatoBits(mascara);

  for (let i = 0; i < 15; i++) {
    const bit = ((bits >>> i) & 1) === 1;

    // Cópia junto do localizador superior esquerdo.
    if (i < 6) g[i][8] = bit;
    else if (i < 8) g[i + 1][8] = bit;
    else if (i < 9) g[8][7] = bit;
    else g[8][14 - i] = bit;

    // Cópia espalhada nos outros dois cantos, pra sobreviver a um dano.
    if (i < 8) g[8][n - 1 - i] = bit;
    else g[n - 15 + i][8] = bit;
  }
}

/** Preenche os módulos livres em ziguezague, de baixo pra cima. */
function preencherDados(g: Grade, funcao: boolean[][], bytes: number[]) {
  const n = g.length;
  let indice = 0;

  const bit = (i: number) => ((bytes[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
  const total = bytes.length * 8;

  for (let direita = n - 1; direita >= 1; direita -= 2) {
    // A coluna 6 é a linha de tempo vertical: pula pra não desalinhar.
    const col = direita <= 6 ? direita - 1 : direita;

    for (let vertical = 0; vertical < n; vertical++) {
      for (let j = 0; j < 2; j++) {
        const x = col - j;
        const subindo = ((col + 1) & 2) === 0;
        const y = subindo ? n - 1 - vertical : vertical;

        if (!funcao[y][x]) {
          g[y][x] = indice < total ? bit(indice) : false;
          indice++;
        }
      }
    }
  }
}

const MASCARAS: ((y: number, x: number) => boolean)[] = [
  (y, x) => (y + x) % 2 === 0,
  (y) => y % 2 === 0,
  (_, x) => x % 3 === 0,
  (y, x) => (y + x) % 3 === 0,
  (y, x) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (y, x) => ((y * x) % 2) + ((y * x) % 3) === 0,
  (y, x) => (((y * x) % 2) + ((y * x) % 3)) % 2 === 0,
  (y, x) => (((y + x) % 2) + ((y * x) % 3)) % 2 === 0,
];

/**
 * Nota de "feiura" de uma máscara. O padrão define quatro penalidades; a
 * máscara escolhida é a de menor nota, porque manchas grandes e padrões
 * parecidos com o localizador confundem o leitor.
 */
function penalidade(g: Grade): number {
  const n = g.length;
  const em = (y: number, x: number) => g[y][x] === true;
  let total = 0;

  // 1) sequências de 5 ou mais módulos iguais
  for (let i = 0; i < n; i++) {
    for (const linha of [true, false]) {
      let cor = linha ? em(i, 0) : em(0, i);
      let corrida = 1;
      for (let j = 1; j < n; j++) {
        const atual = linha ? em(i, j) : em(j, i);
        if (atual === cor) {
          corrida++;
        } else {
          if (corrida >= 5) total += 3 + (corrida - 5);
          cor = atual;
          corrida = 1;
        }
      }
      if (corrida >= 5) total += 3 + (corrida - 5);
    }
  }

  // 2) blocos 2x2 da mesma cor
  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      const c = em(y, x);
      if (c === em(y, x + 1) && c === em(y + 1, x) && c === em(y + 1, x + 1)) total += 3;
    }
  }

  // 3) padrão parecido com o localizador (1:1:3:1:1 cercado de claro)
  const alvo = [true, false, true, true, true, false, true, false, false, false, false];
  const igual = (pegar: (k: number) => boolean, inicio: number, invertido: boolean) => {
    for (let k = 0; k < 11; k++) {
      if (pegar(inicio + (invertido ? 10 - k : k)) !== alvo[k]) return false;
    }
    return true;
  };
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= n - 11; j++) {
      if (igual((k) => em(i, k), j, false) || igual((k) => em(i, k), j, true)) total += 40;
      if (igual((k) => em(k, i), j, false) || igual((k) => em(k, i), j, true)) total += 40;
    }
  }

  // 4) desequilíbrio entre claro e escuro
  let escuros = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (em(y, x)) escuros++;
  const proporcao = (escuros * 100) / (n * n);
  total += Math.floor(Math.abs(proporcao - 50) / 5) * 10;

  return total;
}

/**
 * Gera a matriz do QR. `true` = módulo escuro.
 *
 * Quem desenha precisa deixar a margem clara em volta (4 módulos) — sem
 * ela muitos leitores não encontram o código.
 */
export function gerarQr(texto: string): boolean[][] {
  const bytes = new TextEncoder().encode(texto).length;
  const versao = escolherVersao(bytes);
  const tamanho = 17 + 4 * versao;

  const codigos = intercalar(montarDados(texto, versao), versao);

  let melhor: Grade | null = null;
  let melhorNota = Infinity;

  for (let mascara = 0; mascara < 8; mascara++) {
    const g = novaGrade(tamanho);
    const funcao = desenharFuncoes(g, versao);
    preencherDados(g, funcao, codigos);

    const aplicar = MASCARAS[mascara];
    for (let y = 0; y < tamanho; y++) {
      for (let x = 0; x < tamanho; x++) {
        if (!funcao[y][x] && aplicar(y, x)) g[y][x] = !g[y][x];
      }
    }
    desenharFormato(g, mascara);

    const nota = penalidade(g);
    if (nota < melhorNota) {
      melhorNota = nota;
      melhor = g;
    }
  }

  return melhor!.map((linha) => linha.map((m) => m === true));
}
