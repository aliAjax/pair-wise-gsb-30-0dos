<script setup lang="ts">
import { computed } from "vue";
import { DRIVERS } from "../data/drivers";
import { useScheduleStore } from "../store/schedule";
import { deriveBlocks, shiftLengthMin, type Block } from "../lib/schedule";
import { atTime, fmtDuration, fmtTime, MINUTE } from "../lib/time";

const props = defineProps<{ dayKey: string }>();

const store = useScheduleStore();

const DAY_MS = 24 * 60 * MINUTE;
const dayStart = computed(() => atTime(props.dayKey, "00:00").getTime());
const ticks = Array.from({ length: 13 }, (_, i) => i * 2);

const orderMap = computed(() => new Map(store.orders.map((order) => [order.id, order])));

interface Row {
  driverId: string;
  name: string;
  shiftLabel: string;
  dutyLeft: number;
  dutyWidth: number;
  blocks: Array<Block & { left: number; width: number; title: string; tone: string }>;
  driveMin: number;
  restMin: number;
}

function pct(start: number, end: number) {
  const s = Math.max(start, dayStart.value);
  const e = Math.min(end, dayStart.value + DAY_MS);
  return {
    left: ((s - dayStart.value) / DAY_MS) * 100,
    width: Math.max(((e - s) / DAY_MS) * 100, 0)
  };
}

const rows = computed<Row[]>(() =>
  DRIVERS.map((driver) => {
    const trips = store.tripsByDriver(driver.id);
    const blocks = deriveBlocks(trips);
    const dutyStart = atTime(props.dayKey, driver.shiftStart).getTime();
    const dutyEnd = dutyStart + shiftLengthMin(driver) * MINUTE;

    const positioned = blocks
      .filter((block) => block.end > dayStart.value && block.start < dayStart.value + DAY_MS)
      .map((block) => {
        const pos = pct(block.start, block.end);
        const startDate = new Date(block.start);
        const endDate = new Date(block.end);
        const minutes = Math.round((block.end - block.start) / MINUTE);
        let title = "";
        let tone = block.kind === "drive" ? "drive" : "rest";
        if (block.kind === "drive") {
          const order = block.orderId ? orderMap.value.get(block.orderId) : undefined;
          const status = order?.status ?? "";
          tone = status === "运输中" ? "drive live" : status === "已到站" ? "drive done" : "drive";
          title = `${block.no} ${order?.station ?? ""} ${fmtTime(startDate)}–${fmtTime(endDate)}（${fmtDuration(minutes)}）· ${status}`;
        } else {
          tone = block.warn ? "rest warn" : "rest";
          title = `${block.warn ? "休息不足，应" : "强制"}休息 ${fmtDuration(minutes)} ${fmtTime(startDate)}–${fmtTime(endDate)}`;
        }
        if (block.warn && block.kind === "drive") tone = "drive warn";
        return { ...block, ...pos, title, tone };
      });

    return {
      driverId: driver.id,
      name: `${driver.name}｜${driver.truckNo}`,
      shiftLabel: `${driver.shiftStart}–${driver.shiftEnd}`,
      dutyLeft: pct(dutyStart, dutyEnd).left,
      dutyWidth: pct(dutyStart, dutyEnd).width,
      blocks: positioned,
      driveMin: Math.round(
        blocks.filter((b) => b.kind === "drive").reduce((acc, b) => acc + (b.end - b.start), 0) /
          MINUTE
      ),
      restMin: blocks.filter((b) => b.kind === "rest").length * 30
    };
  })
);
</script>

<template>
  <section class="panel timeline">
    <div class="toolbar">
      <h2>当班排程 · {{ dayKey }}</h2>
      <span class="legend">
        <i class="sw drive" />待发车
        <i class="sw live" />运输中
        <i class="sw done" />已到站
        <i class="sw rest" />休息30分
        <i class="sw warn" />休息不足
      </span>
    </div>

    <div class="axis">
      <span v-for="h in ticks" :key="h" :style="{ left: `${(h / 24) * 100}%` }">{{ h }}:00</span>
    </div>

    <div v-for="row in rows" :key="row.driverId" class="driver-row">
      <div class="driver-meta">
        <strong>{{ row.name }}</strong>
        <span class="shift-tag">当班 {{ row.shiftLabel }}</span>
        <span class="shift-tag">驾驶 {{ fmtDuration(row.driveMin) }}</span>
        <span class="shift-tag">休息 {{ row.restMin }} 分</span>
      </div>
      <div class="track">
        <div class="duty-band" :style="{ left: `${row.dutyLeft}%`, width: `${row.dutyWidth}%` }" />
        <div
          v-for="(block, i) in row.blocks"
          :key="`${block.kind}-${block.start}-${i}`"
          class="slot"
          :class="block.tone"
          :style="{ left: `${block.left}%`, width: `${Math.max(block.width, 0.6)}%` }"
          :title="block.title"
        >
          <span v-if="block.width > 3.5 && block.kind === 'drive'">{{ block.no }}</span>
          <span v-else-if="block.width > 3.5">休</span>
        </div>
      </div>
    </div>
  </section>
</template>
