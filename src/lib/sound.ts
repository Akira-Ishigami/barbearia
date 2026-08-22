"use client";

/**
 * Alerta sonoro de agendamento novo.
 *
 * O navegador só deixa tocar áudio depois que a pessoa interagiu com a
 * página: um AudioContext criado fora de um clique nasce "suspended" e fica
 * mudo. Como o aviso vem de um timer, não de um clique, a versão anterior
 * criava um contexto novo a cada toque e nunca soava.
 *
 * Aqui o contexto é único e é destravado no primeiro gesto do usuário
 * (clique, toque ou tecla) — a partir daí os alertas seguintes tocam.
 */

let ctx: AudioContext | null = null;
let ouvindoGesto = false;

type WindowComWebkit = typeof window & { webkitAudioContext?: typeof AudioContext };

function criarContexto(): AudioContext | null {
  if (ctx) return ctx;
  const Ctx = window.AudioContext || (window as WindowComWebkit).webkitAudioContext;
  if (!Ctx) return null;
  try {
    ctx = new Ctx();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * Destrava o áudio no primeiro gesto. Chamado uma vez quando o painel abre;
 * sem isso o primeiro agendamento que chega não faz barulho.
 */
export function prepararSom() {
  if (typeof window === "undefined" || ouvindoGesto) return;
  ouvindoGesto = true;

  const destravar = () => {
    const c = criarContexto();
    if (c && c.state === "suspended") void c.resume();
  };

  // `once` porque depois do primeiro gesto o contexto já fica liberado.
  window.addEventListener("pointerdown", destravar, { once: true });
  window.addEventListener("keydown", destravar, { once: true });
  window.addEventListener("touchstart", destravar, { once: true });
}

export function playNotificationSound() {
  if (typeof window === "undefined") return;

  const c = criarContexto();
  if (!c) return;

  // Se a aba estava em segundo plano o contexto pode ter sido suspenso.
  if (c.state === "suspended") void c.resume();

  try {
    const agora = c.currentTime;

    function tom(freq: number, inicio: number, dur: number) {
      const osc = c!.createOscillator();
      const ganho = c!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      ganho.gain.setValueAtTime(0, agora + inicio);
      ganho.gain.linearRampToValueAtTime(0.25, agora + inicio + 0.02);
      ganho.gain.exponentialRampToValueAtTime(0.001, agora + inicio + dur);
      osc.connect(ganho);
      ganho.connect(c!.destination);
      osc.start(agora + inicio);
      osc.stop(agora + inicio + dur + 0.05);
    }

    tom(880, 0, 0.15);
    tom(1175, 0.16, 0.22);
  } catch {
    // Som é um extra: o aviso visual continua valendo.
  }
}
