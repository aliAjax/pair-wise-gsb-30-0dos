/** 首次启动的演示数据：当天订单，含已占用时段、跨班司机与一单待安排 */
import type { Order } from "../types";
import { atTime, todayKey } from "../lib/time";

function seedOrder(partial: Omit<Order, "createdAt" | "history"> & { history?: Order["history"] }): Order {
  return { createdAt: new Date().toISOString(), history: [], ...partial };
}

export function seedOrders(): Order[] {
  const today = todayKey();
  const at = (hhmm: string) => atTime(today, hhmm).toISOString();
  return [
    seedOrder({
      id: "seed-1001",
      no: "D-1001",
      station: "城东站",
      fuel: "92号汽油",
      tons: 18,
      note: "早高峰前送达",
      status: "运输中",
      driverId: "drv-zhang",
      startAt: at("06:30"),
      durationMin: 120
    }),
    seedOrder({
      id: "seed-1002",
      no: "D-1002",
      station: "机场站",
      fuel: "柴油",
      tons: 12,
      note: "机场油库直送",
      status: "待发车",
      driverId: "drv-zhang",
      startAt: at("09:00"),
      durationMin: 90
    }),
    seedOrder({
      id: "seed-1003",
      no: "D-1003",
      station: "新区站",
      fuel: "95号汽油",
      tons: 20,
      status: "待发车",
      driverId: "drv-zhang",
      startAt: at("11:00"),
      durationMin: 150
    }),
    seedOrder({
      id: "seed-1004",
      no: "D-1004",
      station: "城东站",
      fuel: "柴油",
      tons: 10,
      note: "换班后首趟，等李海峰接班",
      status: "待安排"
    }),
    seedOrder({
      id: "seed-1005",
      no: "D-1005",
      station: "机场站",
      fuel: "95号汽油",
      tons: 16,
      status: "待发车",
      driverId: "drv-li",
      startAt: at("15:00"),
      durationMin: 120
    }),
    seedOrder({
      id: "seed-1006",
      no: "D-1006",
      station: "新区站",
      fuel: "92号汽油",
      tons: 8,
      status: "已到站",
      driverId: "drv-wang",
      startAt: at("08:30"),
      durationMin: 60,
      history: [
        {
          driverId: "drv-zhang",
          startAt: at("07:00"),
          durationMin: 60,
          endAt: at("08:00"),
          reason: "张建国临时请假，改派王立新",
          changedAt: at("06:50")
        }
      ]
    })
  ];
}
