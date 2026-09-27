<script setup lang="ts">
import { useScheduleStore } from "../store/schedule";
import type { Order } from "../types";
import { fmtIso } from "../lib/time";

defineEmits<{
  (e: "assign", order: Order): void;
}>();

const store = useScheduleStore();
</script>

<template>
  <section class="panel pending-panel">
    <div class="toolbar">
      <h2>待安排区</h2>
      <span class="count-badge">{{ store.pendingOrders.length }} 单未排程</span>
    </div>
    <p class="hint">未通过排程校验（重叠 / 满 4 小时未休息 / 不在当班时段）的单会留在这里。</p>

    <div class="card-list">
      <div v-if="store.pendingOrders.length === 0" class="empty">待安排区已清空</div>
      <article v-for="order in store.pendingOrders" :key="order.id" class="order-card pending">
        <div class="card-head">
          <strong>{{ order.no }}</strong>
          <span class="chip">待安排</span>
        </div>
        <p class="card-line">{{ order.station }} · {{ order.fuel }} · {{ order.tons }} 吨</p>
        <p v-if="order.note" class="card-note">{{ order.note }}</p>
        <p class="card-time">建单 {{ fmtIso(order.createdAt) }}</p>
        <div class="actions">
          <button type="button" @click="$emit('assign', order)">派单排程</button>
          <button type="button" class="danger" @click="store.remove(order.id)">删除</button>
        </div>
      </article>
    </div>
  </section>
</template>
