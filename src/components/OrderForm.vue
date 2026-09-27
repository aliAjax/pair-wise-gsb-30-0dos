<script setup lang="ts">
import { reactive } from "vue";
import { useScheduleStore } from "../store/schedule";

const store = useScheduleStore();

const stations = ["城东站", "机场站", "新区站"];
const fuels = ["92号汽油", "95号汽油", "柴油"];

const form = reactive({
  station: "",
  fuel: "",
  tons: 10,
  note: ""
});

function submit() {
  if (!form.station || !form.fuel) return;
  store.createOrder({ ...form });
  form.station = "";
  form.fuel = "";
  form.tons = 10;
  form.note = "";
}
</script>

<template>
  <form class="panel" @submit.prevent="submit">
    <h2>新增配送计划</h2>
    <div class="form-grid">
      <label>
        目标油站
        <select v-model="form.station" required>
          <option value="">请选择</option>
          <option v-for="item in stations" :key="item" :value="item">{{ item }}</option>
        </select>
      </label>
      <label>
        油品
        <select v-model="form.fuel" required>
          <option value="">请选择</option>
          <option v-for="item in fuels" :key="item" :value="item">{{ item }}</option>
        </select>
      </label>
      <label>
        配送吨数
        <input v-model.number="form.tons" type="number" min="1" step="1" required />
      </label>
      <label>
        备注
        <textarea v-model="form.note" placeholder="现场要求或交接说明" />
      </label>
      <button type="submit">加入待安排</button>
    </div>
  </form>
</template>
