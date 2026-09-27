import { defineStore } from "pinia";
import type { AssignInput, Assignment, CheckOutcome, Order, OrderStatus } from "../types";
import { seedOrders } from "../data/seed";
import { driverById } from "../data/drivers";
import { loadOrders, saveOrders } from "../lib/storage";
import { checkCandidate, toTrip, type Trip } from "../lib/schedule";
import { fromInputValue } from "../lib/time";

interface State {
  orders: Order[];
}

export const useScheduleStore = defineStore("schedule", {
  state: (): State => ({
    orders: loadOrders() ?? seedOrders()
  }),

  getters: {
    pendingOrders(state): Order[] {
      return state.orders.filter((order) => order.status === "待安排");
    },
    scheduledOrders(state): Order[] {
      return state.orders
        .filter((order) => order.status !== "待安排")
        .sort((a, b) => (a.startAt ?? "").localeCompare(b.startAt ?? ""));
    },
    /** 各司机当前占用行程（待安排订单不占时段） */
    tripsByDriver(): (driverId: string) => Trip[] {
      return (driverId: string) =>
        this.orders
          .filter((order: Order) => order.status !== "待安排" && order.driverId === driverId)
          .map(toTrip)
          .filter((trip: Trip | null): trip is Trip => trip !== null);
    }
  },

  actions: {
    persist() {
      saveOrders(this.orders);
    },

    /** 预校验：返回是否可排及原因，不改动数据 */
    canAssign(orderId: string, input: AssignInput): CheckOutcome {
      const order = this.orders.find((item) => item.id === orderId);
      if (!order) return { ok: false, reason: "配送单不存在" };
      if (order.status !== "待安排") {
        return { ok: false, reason: "仅待安排区的单据可以派单" };
      }
      return this.evaluate(orderId, input);
    },

    /** 改派预校验：通过前原时段保持不动 */
    canReassign(orderId: string, input: AssignInput): CheckOutcome {
      const order = this.orders.find((item) => item.id === orderId);
      if (!order) return { ok: false, reason: "配送单不存在" };
      if (!input.reason?.trim()) return { ok: false, reason: "改派必须填写原因" };
      if (order.status === "待安排") return { ok: false, reason: "该单尚未排程，不能改派" };
      if (order.status !== "待发车") {
        return { ok: false, reason: "仅待发车的单据允许改派，运输中 / 已到站不可调整" };
      }
      return this.evaluate(orderId, input);
    },

    /** release 回到待安排区（仅校验原因） */
    canRelease(orderId: string, reason?: string): CheckOutcome {
      const order = this.orders.find((item) => item.id === orderId);
      if (!order) return { ok: false, reason: "配送单不存在" };
      if (!reason?.trim()) return { ok: false, reason: "释放时段必须填写原因" };
      if (order.status !== "待发车") {
        return { ok: false, reason: "仅待发车的单据允许释放时段" };
      }
      return { ok: true };
    },

    /** 用排程规则校验（司机资料来自 data/drivers，判断逻辑来自 lib/schedule） */
    evaluate(orderId: string, input: AssignInput): CheckOutcome {
      const driver = driverById(input.driverId);
      if (!driver) return { ok: false, reason: "请选择司机" };
      const start = fromInputValue(input.startAt).getTime();
      if (!Number.isFinite(start)) return { ok: false, reason: "请选择有效的发车时间" };
      const existing = this.tripsByDriver(input.driverId).filter(
        (trip) => trip.orderId !== orderId
      );
      const order = this.orders.find((item) => item.id === orderId);
      return checkCandidate(driver, existing, {
        orderId,
        no: order?.no ?? "",
        start,
        durationMin: Number(input.durationMin)
      });
    },

    assign(orderId: string, input: AssignInput) {
      const order = this.orders.find((item) => item.id === orderId);
      if (!order || !this.canAssign(orderId, input).ok) return;
      order.driverId = input.driverId;
      order.startAt = fromInputValue(input.startAt).toISOString();
      order.durationMin = Number(input.durationMin);
      order.status = "待发车";
      this.persist();
    },

    /** 改派：先释放原时段（记录原因 + 旧完成时间），再占用新时段 */
    reassign(orderId: string, input: AssignInput) {
      const order = this.orders.find((item) => item.id === orderId);
      if (!order || !this.canReassign(orderId, input).ok) return;
      this.archiveCurrent(order, input.reason);
      order.driverId = input.driverId;
      order.startAt = fromInputValue(input.startAt).toISOString();
      order.durationMin = Number(input.durationMin);
      order.status = "待发车";
      this.persist();
    },

    /** 释放原时段，单据回到待安排区 */
    release(orderId: string, reason: string) {
      const order = this.orders.find((item) => item.id === orderId);
      if (!order || !this.canRelease(orderId, reason).ok) return;
      this.archiveCurrent(order, reason);
      order.driverId = undefined;
      order.startAt = undefined;
      order.durationMin = undefined;
      order.status = "待安排";
      this.persist();
    },

    /** 把当前占用时段写入历史，留下原因和旧完成时间 */
    archiveCurrent(order: Order, reason?: string) {
      if (order.driverId && order.startAt && order.durationMin) {
        const startMs = new Date(order.startAt).getTime();
        const record: Assignment = {
          driverId: order.driverId,
          startAt: order.startAt,
          durationMin: order.durationMin,
          endAt: new Date(startMs + order.durationMin * 60000).toISOString(),
          reason,
          changedAt: new Date().toISOString()
        };
        order.history = [...order.history, record];
      }
    },

    advance(orderId: string) {
      const flow: OrderStatus[] = ["待安排", "待发车", "运输中", "已到站"];
      const order = this.orders.find((item) => item.id === orderId);
      if (!order) return;
      const index = flow.indexOf(order.status);
      if (index >= 0 && index < flow.length - 1) {
        order.status = flow[index + 1];
        this.persist();
      }
    },

    createOrder(data: Pick<Order, "station" | "fuel" | "tons" | "note">) {
      const order: Order = {
        id: crypto.randomUUID(),
        no: `D-${Math.floor(1000 + Math.random() * 9000)}`,
        station: data.station,
        fuel: data.fuel,
        tons: data.tons,
        note: data.note,
        status: "待安排",
        createdAt: new Date().toISOString(),
        history: []
      };
      this.orders = [order, ...this.orders];
      this.persist();
    },

    remove(orderId: string) {
      this.orders = this.orders.filter((order) => order.id !== orderId);
      this.persist();
    },

    resetDemo() {
      this.orders = seedOrders();
      this.persist();
    }
  }
});
