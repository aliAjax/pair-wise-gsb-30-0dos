/** 本地保存（localStorage），与司机资料、排程判断分开 */
import type { Order } from "../types";

const STORAGE_KEY = "hxwlfront-19-driver-schedule";

export function loadOrders(): Order[] | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Order[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveOrders(orders: Order[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

export function clearOrders(): void {
  localStorage.removeItem(STORAGE_KEY);
}
