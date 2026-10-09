import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
export default {
  props: { modelValue: [String, Number], options: { type: Array, required: true }, label: { type: String, required: true }, controlId: { type: String, required: true } },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const root = ref(null), trigger = ref(null), open = ref(false), active = ref(0);
    const selected = computed(() => props.options.find(option => option.value === props.modelValue));
    let query = '', lastTyped = 0;
    function close() { open.value = false; }
    async function scrollActive() { await nextTick(); root.value?.querySelector(`[data-option-index="${active.value}"]`)?.scrollIntoView({ block: 'nearest' }); }
    function show() { open.value = true; active.value = Math.max(0, props.options.findIndex(option => option.value === props.modelValue)); scrollActive(); }
    function toggle() { open.value ? close() : show(); }
    function choose(option) { emit('update:modelValue', option.value); close(); nextTick(() => trigger.value?.focus()); }
    function move(index) { active.value = Math.max(0, Math.min(index, props.options.length - 1)); scrollActive(); }
    function keydown(event) {
      if (event.key === 'Tab') { close(); return; }
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (['Enter', ' '].includes(event.key)) { event.preventDefault(); open.value ? choose(props.options[active.value]) : show(); return; }
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); if (!open.value) show(); else move(active.value + (event.key === 'ArrowDown' ? 1 : -1)); return; }
      if (['Home', 'End'].includes(event.key)) { event.preventDefault(); if (!open.value) show(); move(event.key === 'Home' ? 0 : props.options.length - 1); return; }
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault(); if (!open.value) show();
        const now = Date.now(); query = now - lastTyped > 700 ? event.key : query + event.key; lastTyped = now;
        const index = props.options.findIndex(option => option.label.toLocaleLowerCase('ru').startsWith(query.toLocaleLowerCase('ru')));
        if (index >= 0) move(index);
      }
    }
    const outside = event => { if (!root.value?.contains(event.target)) close(); };
    function focusout(event) { if (event.relatedTarget && !root.value?.contains(event.relatedTarget)) close(); }
    onMounted(() => { document.addEventListener('pointerdown', outside); window.addEventListener('resize', close); });
    onUnmounted(() => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', close); });
    return { root, trigger, selected, open, active, toggle, choose, keydown, focusout };
  },
  template: `<div ref="root" class="select-control" :class="{'is-open':open}" @focusout="focusout">
    <button ref="trigger" type="button" class="select-trigger" role="combobox" :aria-label="label" :aria-expanded="open" aria-haspopup="listbox" :aria-controls="controlId" :aria-activedescendant="open ? controlId + '-' + active : undefined" @click="toggle" @keydown="keydown"><span>{{ selected?.label || '' }}</span><svg width="12" height="8" viewBox="0 0 12 8" aria-hidden="true"><path d="m1 1 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.5" /></svg></button>
    <ul v-if="open" :id="controlId" class="select-options" role="listbox" :aria-label="label">
      <li v-for="(option,index) in options" :key="option.value"><button type="button" role="option" tabindex="-1" :id="controlId+'-'+index" :data-option-index="index" :aria-selected="option.value===modelValue" class="select-option" :class="{'is-active':active===index,'is-selected':option.value===modelValue,'is-month':option.depth===1}" @mouseenter="active=index" @click="choose(option)">{{ option.label }}<span v-if="option.value===modelValue" aria-hidden="true">✓</span></button></li>
    </ul></div>`,
};
