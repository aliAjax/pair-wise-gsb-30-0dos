<script setup lang="ts">
import { useScheduleStore } from "../store/schedule";
import { driverName } from "../data/drivers";
import type { Order } from "../types";
import { fmtDuration, fmtIso } from "../lib/time";
import { toTrip } from "../lib/schedule";

defineEmits<{
  (e: "reassign", order: Order): void;
  (e: "release", order: Order): void;
}>();

const store = useScheduleStore();

function endIso(order: Order): string {
  const trip = toTrip(order);
  if (!trip) return "";
  return new Date(trip.end).toISOString();
}

const FLOW_LABEL: Record<string, string> = {
  待发车: "出车",
  运输中: "到站确认"
};
</script>

<template>
  <section class="panel">
    <div class="toolbar">
      <h2>已排程配送单</h2>
      <span class="count-badge">{{ store.scheduledOrders.length }} 单占用时段</span>
    </div>

    <div class="card-list">
      <article
        v-for="order in store.scheduledOrders"
        :key="order.id"
        class="order-card"
        :class="`status-${order.status}`"
      >
        <div class="card-head">
          <strong>{{ order.no }}</strong>
          <span class="chip" :class="order.status">{{ order.status }}</span>
        </div>
        <p class="card-line">{{ order.station }} · {{ order.fuel }} · {{ order.tons }} 吨</p>

        <div v-if="order.startAt && order.durationMin" class="slot-line">
          <span>🚚 {{ driverName(order.driverId!) }}</span>
          <span>{{ fmtIso(order.startAt) }} 发车</span>
          <span>预计 {{ fmtDuration(order.durationMin) }}</span>
          <span>完成 {{ fmtIso(endIso(order)) }}</span>
        </div>

        <ul v-if="order.history.length" class="history">
          <li v-for="(h, i) in order.history" :key="i">
            <span class="history-tag">改派记录</span>
            原 {{ driverName(h.driverId) }} {{ fmtIso(h.startAt) }}–{{ fmtIso(h.endAt) }}
            （旧完成时间），已释放 · {{ h.reason }}
          </li>
        </ul>

        <div class="actions">
          <button v-if="order.status === '待发车'" type="button" @click="$emit('reassign', order)">
            改派
          </button>
          <button v-if="order.status === '待发车'" type="button" class="secondary" @click="$emit('release', order)">
            释放时段
          </button>
          <button
            v-if="order.status === '待发车' || order.status === '运输中'"
            type="button"
            @click="store.advance(order.id)"
          >
            {{ FLOW_LABEL[order.status] }}
          </button>
          <button type="button" class="danger" @click="store.remove(order.id)">删除</button>
        </div>
      </article>
    </div>
  </section>
</template>
