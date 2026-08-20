import { WEEKDAYS, type Weekday } from "./types";

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(dateStr: string, days: number): string {
  const d = parseISODate(dateStr);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Monday-based start of the week containing `dateStr`. */
export function startOfWeek(dateStr: string): string {
  const d = parseISODate(dateStr);
  const jsDay = d.getDay(); // 0 = Sun ... 6 = Sat
  const diff = jsDay === 0 ? -6 : 1 - jsDay;
  d.setDate(d.getDate() + diff);
  return toISODate(d);
}

const JS_DAY_TO_WEEKDAY: Weekday[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

export function weekdayOf(dateStr: string): Weekday {
  return JS_DAY_TO_WEEKDAY[parseISODate(dateStr).getDay()];
}

export function formatDayLabel(dateStr: string): string {
  return parseISODate(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function formatWeekRangeLabel(weekStart: string): string {
  const end = addDays(weekStart, 6);
  return `${formatDayLabel(weekStart)} – ${formatDayLabel(end)}`;
}

/** Dates (Mon-first) for the week, limited to the weekdays the barbearia operates. */
export function weekDates(weekStart: string, diasFuncionamento: Weekday[]): string[] {
  return WEEKDAYS.filter((w) => diasFuncionamento.includes(w.id)).map((w) => {
    const offset = WEEKDAYS.findIndex((x) => x.id === w.id);
    return addDays(weekStart, offset);
  });
}

export function generateTimeSlots(
  abertura: string,
  fechamento: string,
  stepMin = 30,
): string[] {
  const [ah, am] = abertura.split(":").map(Number);
  const [fh, fm] = fechamento.split(":").map(Number);
  const start = ah * 60 + am;
  const end = fh * 60 + fm;
  const slots: string[] = [];
  for (let t = start; t < end; t += stepMin) {
    const h = String(Math.floor(t / 60)).padStart(2, "0");
    const m = String(t % 60).padStart(2, "0");
    slots.push(`${h}:${m}`);
  }
  return slots;
}
