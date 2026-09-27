/** 司机资料（与排程判断、本地保存分开维护） */
import type { Driver } from "../types";

export const DRIVERS: Driver[] = [
  { id: "drv-zhang", name: "张建国", phone: "13800000001", truckNo: "沪A·D1023", shiftStart: "06:00", shiftEnd: "14:00" },
  { id: "drv-li", name: "李海峰", phone: "13800000002", truckNo: "沪B·D2088", shiftStart: "14:00", shiftEnd: "02:00" },
  { id: "drv-wang", name: "王立新", phone: "13800000003", truckNo: "沪C·D3306", shiftStart: "08:00", shiftEnd: "16:00" }
];

export function driverById(id: string): Driver | undefined {
  return DRIVERS.find((driver) => driver.id === id);
}

export function driverName(id: string): string {
  return driverById(id)?.name ?? "未知司机";
}
