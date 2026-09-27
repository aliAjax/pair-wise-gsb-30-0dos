/** 司机资料：换班后当班时段以 shiftStart / shiftEnd 表示，支持跨零点（如 14:00–02:00） */
export interface Driver {
  id: string;
  name: string;
  phone: string;
  truckNo: string;
  shiftStart: string; // "HH:mm"
  shiftEnd: string; // "HH:mm"，小于等于开始时间视为跨天
}

/** 待安排 / 已排程配送单统一结构。未通过排程的单始终保持“待安排”，留在待安排区 */
export type OrderStatus = "待安排" | "待发车" | "运输中" | "已到站";

/** 一次历史派工记录。改派 / 释放时把原时段、原因、旧完成时间留在这里 */
export interface Assignment {
  driverId: string;
  startAt: string; // ISO
  durationMin: number;
  endAt: string; // 旧完成时间（ISO）
  reason?: string; // 改派 / 释放原因
  changedAt: string; // ISO
}

export interface Order {
  id: string;
  no: string;
  station: string;
  fuel: string;
  tons: number;
  note?: string;
  status: OrderStatus;
  createdAt: string;
  /** 当前生效排程（待安排时为空） */
  driverId?: string;
  startAt?: string;
  durationMin?: number;
  /** 历次已释放的时段，保留原因与旧完成时间 */
  history: Assignment[];
}

export type AssignMode = "assign" | "reassign" | "release";

export interface AssignInput {
  driverId: string;
  startAt: string; // datetime-local 本地时间
  durationMin: number;
  reason?: string;
}

export type CheckOutcome = { ok: true } | { ok: false; reason: string };
