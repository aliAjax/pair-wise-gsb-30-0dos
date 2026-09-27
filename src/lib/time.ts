export const MINUTE = 60_000;

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Date -> "YYYY-MM-DD"（本地时区） */
export function dateKeyOf(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayKey(): string {
  return dateKeyOf(new Date());
}

/** 当天 HH:mm 对应的 Date */
export function atTime(dayKey: string, hhmm: string): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

/** datetime-local 输入值（本地时区） */
export function toInputValue(date: Date): string {
  return `${dateKeyOf(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function fromInputValue(value: string): Date {
  return new Date(value);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTE);
}

export function fmtTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function fmtDateTime(date: Date): string {
  return `${dateKeyOf(date)} ${fmtTime(date)}`;
}

/** ISO 字符串 -> "MM-DD HH:mm" */
export function fmtIso(iso: string): string {
  const date = new Date(iso);
  return `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${fmtTime(date)}`;
}

/** 时长 -> "2小时30分" */
export function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分钟`;
  if (m === 0) return `${h}小时`;
  return `${h}小时${m}分`;
}
