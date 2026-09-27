/**
 * 排程判断（纯函数，不碰界面与存储）：
 * 1. 同一司机时段不能重叠（含休息时段）；
 * 2. 累计驾驶到 4 小时前必须先休息 30 分钟，休息后累计清零；
 * 3. 派车 / 收车必须落在司机当班时段内（支持跨零点班次）。
 */
import type { CheckOutcome, Driver, Order } from "../types";
import { atTime, fmtDuration, fmtTime, MINUTE } from "./time";

export const MAX_DRIVE_MIN = 4 * 60; // 连续驾驶上限 4 小时
export const REST_MIN = 30; // 强制休息 30 分钟

export interface Trip {
  orderId: string;
  no: string;
  start: number;
  end: number;
}

export type BlockKind = "drive" | "rest";

export interface Block {
  kind: BlockKind;
  start: number;
  end: number;
  orderId?: string;
  no?: string;
  /** 异常时段（重叠 / 休息不足 / 单趟超时），用于时间轴标红 */
  warn?: boolean;
}

export function toTrip(order: Order): Trip | null {
  if (!order.driverId || !order.startAt || !order.durationMin) return null;
  const start = new Date(order.startAt).getTime();
  return { orderId: order.id, no: order.no, start, end: start + order.durationMin * MINUTE };
}

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** 班次时长（分钟），跨零点自动 +24h */
export function shiftLengthMin(driver: Driver): number {
  const [sh, sm] = driver.shiftStart.split(":").map(Number);
  const [eh, em] = driver.shiftEnd.split(":").map(Number);
  let length = eh * 60 + em - (sh * 60 + sm);
  if (length <= 0) length += 24 * 60;
  return length;
}

/** 覆盖某个时间点的班次窗口（当天班次 + 昨天开始跨到今天的班次） */
function shiftWindowsAt(driver: Driver, at: number): Array<{ start: number; end: number }> {
  const day = new Date(at);
  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const windows: Array<{ start: number; end: number }> = [];
  for (const offset of [0, -1]) {
    const base = new Date(day.getFullYear(), day.getMonth(), day.getDate() + offset);
    const start = atTime(key(base), driver.shiftStart).getTime();
    windows.push({ start, end: start + shiftLengthMin(driver) * MINUTE });
  }
  return windows;
}

function dayLabel(at: number): string {
  const d = new Date(at);
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 发车与收车是否都在当班时段内 */
export function checkShift(driver: Driver, start: number, end: number): CheckOutcome {
  const window = shiftWindowsAt(driver, start).find((w) => start >= w.start && start < w.end);
  if (!window) {
    return {
      ok: false,
      reason: `发车时间不在 ${driver.name} 当班时段（${driver.shiftStart}–${driver.shiftEnd}）内`
    };
  }
  if (end > window.end) {
    return {
      ok: false,
      reason: `预计 ${fmtTime(new Date(end))} 收车，超出 ${driver.name} 当班结束时间 ${fmtTime(new Date(window.end))}`
    };
  }
  return { ok: true };
}

/**
 * 由行程推导司机完整时间轴：驾驶块 + 休息块。
 * 规则：相邻两趟间隔 ≥30 分钟视为已休息，累计驾驶清零；
 * 否则累计叠加，累计到 4 小时前必须插入 30 分钟休息（不足则标 warn）。
 */
export function deriveBlocks(trips: Trip[]): Block[] {
  const sorted = [...trips].sort((a, b) => a.start - b.start);
  const blocks: Block[] = [];
  let accumulated = 0;
  let prevEnd: number | null = null;

  for (const trip of sorted) {
    const duration = trip.end - trip.start;
    if (prevEnd !== null) {
      const gap = trip.start - prevEnd;
      if (gap >= REST_MIN * MINUTE) {
        blocks.push({ kind: "rest", start: prevEnd, end: prevEnd + REST_MIN * MINUTE });
        accumulated = 0;
      } else if (gap >= 0 && accumulated + duration > MAX_DRIVE_MIN * MINUTE) {
        // 累计驾驶将满 4 小时，但间隔不足 30 分钟，无法安排休息
        blocks.push({ kind: "rest", start: prevEnd, end: prevEnd + REST_MIN * MINUTE, warn: true });
        accumulated = 0;
      }
    }
    blocks.push({
      kind: "drive",
      start: trip.start,
      end: trip.end,
      orderId: trip.orderId,
      no: trip.no,
      warn: duration > MAX_DRIVE_MIN * MINUTE
    });
    accumulated += duration;
    prevEnd = Math.max(prevEnd ?? trip.end, trip.end);
  }
  return blocks;
}

export interface Candidate {
  orderId: string;
  no: string;
  start: number;
  durationMin: number;
}

/**
 * 校验一趟候选行程能否排给司机。
 * existingTrips 为该司机当前已占用行程（改派时调用方需先剔除本单）。
 */
export function checkCandidate(
  driver: Driver,
  existingTrips: Trip[],
  candidate: Candidate
): CheckOutcome {
  if (!Number.isFinite(candidate.durationMin) || candidate.durationMin <= 0) {
    return { ok: false, reason: "预计用时必须大于 0 分钟" };
  }
  if (candidate.durationMin > MAX_DRIVE_MIN) {
    return {
      ok: false,
      reason: `单趟预计用时 ${fmtDuration(candidate.durationMin)} 超过连续驾驶上限 ${fmtDuration(MAX_DRIVE_MIN)}，请拆分配送`
    };
  }
  const start = candidate.start;
  const end = start + candidate.durationMin * MINUTE;

  const shift = checkShift(driver, start, end);
  if (!shift.ok) return shift;

  const trips = existingTrips.filter((trip) => trip.orderId !== candidate.orderId);

  // 1. 同一司机时段不能重叠
  const hit = trips.find((trip) => overlaps(start, end, trip.start, trip.end));
  if (hit) {
    return {
      ok: false,
      reason: `与已排行程 ${hit.no}（${fmtTime(new Date(hit.start))}–${fmtTime(new Date(hit.end))}）时段重叠`
    };
  }

  // 2. 休息规则：合并候选行程后重新推导
  const candidateTrip: Trip = { orderId: candidate.orderId, no: candidate.no, start, end };
  const blocks = deriveBlocks([...trips, candidateTrip]);

  // 2a. 候选行程不得与休息时段重叠
  const restHit = blocks.find(
    (block) => block.kind === "rest" && overlaps(start, end, block.start, block.end)
  );
  if (restHit) {
    const prev = blocks
      .filter((block) => block.kind === "drive" && block.end <= restHit.start)
      .sort((a, b) => b.end - a.end)[0];
    const earliest = prev ? prev.end + REST_MIN * MINUTE : restHit.end;
    const restLabel = restHit.warn ? "应安排强制休息" : "已安排休息";
    return {
      ok: false,
      reason:
        `累计驾驶将满 ${fmtDuration(MAX_DRIVE_MIN)}，${fmtTime(new Date(restHit.start))} 起${restLabel} ${REST_MIN} 分钟，` +
        `与本次发车冲突${prev && prev.no ? `（前一程 ${prev.no}）` : ""}。` +
        `最早可发车时间 ${dayLabel(earliest)} ${fmtTime(new Date(earliest))}`
    };
  }

  // 2b. 插入候选行程不能挤掉既有后续行程的强制休息
  const squeezed = blocks.find((block) => block.kind === "rest" && block.warn);
  if (squeezed) {
    const victim = [...trips]
      .sort((a, b) => a.start - b.start)
      .find((trip) => overlaps(squeezed.start, squeezed.end, trip.start, trip.end));
    const suffix = victim
      ? `，后续行程 ${victim.no} 需推迟到 ${fmtTime(new Date(squeezed.end))} 后发车`
      : "";
    return {
      ok: false,
      reason:
        `插入本趟后，${fmtTime(new Date(squeezed.start))} 起连续驾驶将满 ${fmtDuration(MAX_DRIVE_MIN)}，` +
        `无法安排 ${REST_MIN} 分钟休息${suffix}。请调整本趟发车时间或改派其他司机。`
    };
  }
  return { ok: true };
}
