<script setup lang="ts">
import { computed, ref } from "vue";
import OrderForm from "./components/OrderForm.vue";
import PendingOrders from "./components/PendingOrders.vue";
import ScheduledOrders from "./components/ScheduledOrders.vue";
import DriverTimeline from "./components/DriverTimeline.vue";
import AssignDialog from "./components/AssignDialog.vue";
import { useScheduleStore } from "./store/schedule";
import { DRIVERS } from "./data/drivers";
import { deriveBlocks } from "./lib/schedule";
import { todayKey } from "./lib/time";
import type { AssignInput, AssignMode, Order } from "./types";

const store = useScheduleStore();

const dayKey = ref(todayKey());

const dialogOpen = ref(false);
const dialogMode = ref<AssignMode>("assign");
const activeOrder = ref<Order | null>(null);

function openDialog(mode: AssignMode, order: Order) {
  dialogMode.value = mode;
  activeOrder.value = order;
  dialogOpen.value = true;
}

function handleSubmit(mode: AssignMode, input: AssignInput) {
  if (!activeOrder.value) return;
  const id = activeOrder.value.id;
  if (mode === "assign") store.assign(id, input);
  else if (mode === "reassign") store.reassign(id, input);
  else if (input.reason) store.release(id, input.reason);
  dialogOpen.value = false;
  activeOrder.value = null;
}

const metrics = computed(() => {
  const pending = store.pendingOrders.length;
  const scheduled = store.scheduledOrders.length;
  const inTransit = store.orders.filter((o) => o.status === "运输中").length;
  const totalTons = store.orders.reduce((acc, o) => acc + (Number(o.tons) || 0), 0);
  return [
    { label: "待安排", value: pending },
    { label: "已占用时段", value: scheduled },
    { label: "运输中", value: inTransit },
    { label: "总吨数", value: totalTons }
  ];
});

/** 今日各司机休息次数（重开后仍可核对休息安排） */
const restSummary = computed(() =>
  DRIVERS.map((driver) => {
    const trips = store.tripsByDriver(driver.id);
    const rests = deriveBlocks(trips).filter((block) => block.kind === "rest");
    return { name: driver.name, count: rests.length, warn: rests.some((b) => b.warn) };
  }).filter((item) => item.count > 0)
);

function resetDemo() {
  if (confirm("恢复演示数据？当前本地排程将被覆盖。")) store.resetDemo();
}
</script>

<template>
  <main class="app">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">石油行业 · 司机当班排程</p>
          <h1>油品配送排程台</h1>
          <p class="subtitle">
            换班后按当班司机派单：同一司机时段不重叠，连续驾驶满 4 小时前强制休息 30 分钟；
            校验不通过的单留在待安排区，改派释放原时段并留痕。
          </p>
        </div>
        <div class="stack">
          <span class="tag">Vue3</span>
          <span class="tag">Pinia</span>
          <span class="tag">localStorage</span>
          <button type="button" class="secondary" @click="resetDemo">恢复演示数据</button>
        </div>
      </header>

      <section class="metrics">
        <article v-for="metric in metrics" :key="metric.label" class="metric">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
        </article>
      </section>

      <section class="workspace">
        <OrderForm />
        <div class="main-col">
          <div class="day-bar">
            <label>查看日期 <input v-model="dayKey" type="date" /></label>
            <span v-for="r in restSummary" :key="r.name" class="rest-chip" :class="{ warn: r.warn }">
              {{ r.name }} 休息 {{ r.count }} 次{{ r.warn ? "（有冲突）" : "" }}
            </span>
          </div>

          <DriverTimeline :day-key="dayKey" />

          <div class="two-col">
            <PendingOrders @assign="openDialog('assign', $event)" />
            <ScheduledOrders
              @reassign="openDialog('reassign', $event)"
              @release="openDialog('release', $event)"
            />
          </div>
        </div>
      </section>
    </div>

    <AssignDialog
      :open="dialogOpen"
      :mode="dialogMode"
      :order="activeOrder"
      @close="dialogOpen = false"
      @submit="handleSubmit"
    />
  </main>
</template>
