<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { DRIVERS, driverName } from "../data/drivers";
import { useScheduleStore } from "../store/schedule";
import type { AssignInput, AssignMode, Order } from "../types";
import { MAX_DRIVE_MIN, REST_MIN } from "../lib/schedule";
import { addMinutes, fmtDuration, toInputValue } from "../lib/time";

const props = defineProps<{
  open: boolean;
  mode: AssignMode;
  order: Order | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "submit", mode: AssignMode, input: AssignInput): void;
}>();

const store = useScheduleStore();

const empty = (): AssignInput => ({
  driverId: "",
  startAt: toInputValue(addMinutes(new Date(), 30)),
  durationMin: 90,
  reason: ""
});

const input = reactive<AssignInput>(empty());
const checkMsg = ref("");

const title = computed(() =>
  props.mode === "assign" ? "派单排程" : props.mode === "reassign" ? "改派时段" : "释放时段"
);

watch(
  () => [props.open, props.order, props.mode],
  () => {
    checkMsg.value = "";
    if (!props.open || !props.order) return;
    if (props.mode === "assign") {
      Object.assign(input, empty());
    } else if (props.order.driverId && props.order.startAt && props.order.durationMin) {
      input.driverId = props.order.driverId;
      input.startAt = toInputValue(new Date(props.order.startAt));
      input.durationMin = props.order.durationMin;
      input.reason = "";
    }
  },
  { immediate: true }
);

function validate(): boolean {
  if (!props.order) return false;
  if (props.mode === "release") {
    const result = store.canRelease(props.order.id, input.reason);
    checkMsg.value = result.ok ? "" : result.reason;
    return result.ok;
  }
  const result =
    props.mode === "assign"
      ? store.canAssign(props.order.id, input)
      : store.canReassign(props.order.id, input);
  checkMsg.value = result.ok ? "" : result.reason;
  return result.ok;
}

function submit() {
  if (!validate()) return;
  emit("submit", props.mode, { ...input, durationMin: Number(input.durationMin) });
}
</script>

<template>
  <div v-if="open && order" class="modal-mask" @click.self="emit('close')">
    <div class="modal">
      <header class="modal-head">
        <h3>{{ title }} · {{ order.no }}</h3>
        <button type="button" class="icon-btn" @click="emit('close')">×</button>
      </header>

      <p class="modal-desc">
        {{ order.station }} / {{ order.fuel }} / {{ order.tons }} 吨
        <template v-if="order.driverId && order.startAt">
          ｜当前：{{ driverName(order.driverId) }} ·
          {{ toInputValue(new Date(order.startAt)).replace("T", " ") }}
        </template>
      </p>

      <template v-if="mode !== 'release'">
        <label class="modal-field">
          司机（当班时段）
          <select v-model="input.driverId" required>
            <option value="">请选择</option>
            <option v-for="d in DRIVERS" :key="d.id" :value="d.id">
              {{ d.name }}（{{ d.shiftStart }}–{{ d.shiftEnd }}，{{ d.truckNo }}）
            </option>
          </select>
        </label>
        <div class="modal-row">
          <label class="modal-field">
            发车时间
            <input v-model="input.startAt" type="datetime-local" required />
          </label>
          <label class="modal-field">
            预计用时（分钟）
            <input v-model.number="input.durationMin" type="number" min="1" max="240" required />
          </label>
        </div>
        <p class="rule-hint">
          单趟不超过 {{ fmtDuration(MAX_DRIVE_MIN) }}；累计驾驶满 {{ fmtDuration(MAX_DRIVE_MIN) }}
          前须休息 {{ REST_MIN }} 分钟，同一司机时段不可重叠。
        </p>
      </template>

      <label class="modal-field">
        {{ mode === "release" ? "释放原因（原时段将归还待安排区）" : "改派原因" }}
        <textarea
          v-model="input.reason"
          :placeholder="mode === 'release' ? '例如：车辆故障，改由备车顶班' : '例如：司机换班交接'"
        />
      </label>

      <p v-if="checkMsg" class="check-error">{{ checkMsg }}</p>

      <footer class="modal-foot">
        <button type="button" class="secondary" @click="emit('close')">取消</button>
        <button type="button" :class="{ danger: mode === 'release' }" @click="submit">
          {{ mode === "assign" ? "确认排程" : mode === "reassign" ? "确认改派" : "确认释放" }}
        </button>
      </footer>
    </div>
  </div>
</template>
