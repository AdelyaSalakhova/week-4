import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { formatMonth, periodLabel } from './analytics.js';

export default {
  props: { modelValue: { type: String, required: true }, months: { type: Array, required: true } },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const root = ref(null), trigger = ref(null), open = ref(false), viewedYear = ref('');
    const years = computed(() => [...new Set(props.months.map(item => item.month.slice(0, 4)))].sort());
    const yearIndex = computed(() => years.value.indexOf(viewedYear.value));
    const availableMonths = computed(() => new Set(props.months.map(item => item.month)));
    const label = computed(() => props.modelValue === 'all' ? periodLabel(props.months) : props.modelValue.length === 4 ? props.modelValue + ' год' : formatMonth(props.modelValue));
    const monthOptions = computed(() => Array.from({ length: 12 }, (_, index) => {
      const value = viewedYear.value + '-' + String(index + 1).padStart(2, '0');
      const name = new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'UTC' }).format(new Date(`2000-${String(index + 1).padStart(2, '0')}-01T00:00:00Z`));
      return { value, name, available: availableMonths.value.has(value) };
    }));
    function close() { open.value = false; }
    function focusTrigger() { nextTick(() => trigger.value?.focus()); }
    async function show() {
      viewedYear.value = props.modelValue === 'all' ? years.value.at(-1) : props.modelValue.slice(0, 4);
      open.value = true;
      await nextTick();
      (root.value?.querySelector('.period-popup [aria-pressed="true"]') || root.value?.querySelector('.period-month:not(:disabled)'))?.focus();
    }
    function toggle() { open.value ? close() : show(); }
    function choose(value) { emit('update:modelValue', value); close(); focusTrigger(); }
    function changeYear(direction) { viewedYear.value = years.value[yearIndex.value + direction] || viewedYear.value; }
    function keydown(event) { if (event.key === 'Escape' && open.value) { event.preventDefault(); event.stopPropagation(); close(); focusTrigger(); } }
    function triggerKeydown(event) { if (event.key === 'ArrowDown') { event.preventDefault(); show(); } }
    function monthKeydown(event, index) {
      const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 };
      if (!(event.key in steps) && !['Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === 'End' || steps[event.key] < 0 ? -1 : 1;
      let target = event.key === 'Home' ? 0 : event.key === 'End' ? 11 : index + steps[event.key];
      while (target >= 0 && target < 12 && !monthOptions.value[target].available) target += direction;
      if (target >= 0 && target < 12) root.value?.querySelectorAll('.period-month')[target]?.focus();
    }
    const outside = event => { if (!root.value?.contains(event.target)) close(); };
    function focusout(event) { if (event.relatedTarget && !root.value?.contains(event.relatedTarget)) close(); }
    onMounted(() => { document.addEventListener('pointerdown', outside); window.addEventListener('resize', close); });
    onUnmounted(() => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', close); });
    return { root, trigger, open, viewedYear, years, yearIndex, label, monthOptions, toggle, choose, changeYear, keydown, triggerKeydown, monthKeydown, focusout };
  },
  template: `<div ref="root" class="select-control period-picker" :class="{'is-open':open}" @focusout="focusout" @keydown="keydown">
    <button ref="trigger" type="button" class="select-trigger" aria-label="Период" :aria-expanded="open" aria-haspopup="dialog" aria-controls="period-popup" @click="toggle" @keydown="triggerKeydown"><span>{{ label }}</span><svg width="12" height="8" viewBox="0 0 12 8" aria-hidden="true"><path d="m1 1 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.5" /></svg></button>
    <div v-if="open" id="period-popup" class="period-popup" role="dialog" aria-label="Выбор периода">
      <div class="period-navigation"><button type="button" class="period-arrow" aria-label="Предыдущий год" :disabled="yearIndex <= 0" @click="changeYear(-1)"><svg width="8" height="12" viewBox="0 0 8 12" aria-hidden="true"><path d="m6 1-5 5 5 5" fill="none" stroke="currentColor" stroke-width="1.5" /></svg></button><span class="period-year" aria-live="polite">{{ viewedYear }}</span><button type="button" class="period-arrow" aria-label="Следующий год" :disabled="yearIndex >= years.length - 1" @click="changeYear(1)"><svg width="8" height="12" viewBox="0 0 8 12" aria-hidden="true"><path d="m1 1 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.5" /></svg></button></div>
      <div class="period-months" role="group" :aria-label="'Месяцы ' + viewedYear"><button v-for="(month,index) in monthOptions" :key="month.value" type="button" class="period-month" :class="{'is-selected':modelValue === month.value}" :disabled="!month.available" :aria-label="month.name + ' ' + viewedYear" :aria-pressed="modelValue === month.value" @keydown="monthKeydown($event,index)" @click="choose(month.value)">{{ month.name }}</button></div>
      <div class="period-actions"><button type="button" :class="{'is-selected':modelValue === viewedYear}" :aria-pressed="modelValue === viewedYear" @click="choose(viewedYear)">Весь год</button><button type="button" :class="{'is-selected':modelValue === 'all'}" :aria-pressed="modelValue === 'all'" @click="choose('all')">Весь период</button></div>
    </div></div>`,
};
