import { createApp, computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue/dist/vue.esm-bundler.js';
import { categoriesForProducts, categoryOrdersForMonths, productPriceHistory, formatCount, formatDiscount, formatMoney, formatMonth, formatPercent, monthsForYear, productsForMonths, rankProducts, summarizeMonths } from './analytics.js';
import { drawCategories, drawMonthly } from './charts.js';
import { productImage } from './images.js';
import DashboardSelect from './select-control.js';
import PeriodPicker from './period-picker.js';
import PriceTrend from './price-trend.js';
const dataUrl = new URL('./data/dashboard.json', import.meta.url).href;
createApp({
  components: { DashboardSelect, PeriodPicker, PriceTrend },
  setup() {
    const data = shallowRef(null), loading = ref(true), error = ref('');
    const year = ref('recent'), selectedMonth = ref(null), category = ref('all'), frequencyMetric = ref('quantity'), limit = ref(10);
    const ordersChart = ref(null), spendChart = ref(null), discountChart = ref(null), categoriesChart = ref(null);
    const tooltip = shallowRef(null);
    let observer, frame;
    const overviewMonths = computed(() => data.value ? monthsForYear(data.value, year.value) : []);
    const selectedMonths = computed(() => selectedMonth.value ? overviewMonths.value.filter(month => month.month === selectedMonth.value) : overviewMonths.value);
    const summary = computed(() => summarizeMonths(selectedMonths.value));
    const currentMonth = computed(() => selectedMonth.value || overviewMonths.value.at(-1)?.month);
    const currentSummary = computed(() => summarizeMonths(overviewMonths.value.filter(month => month.month === currentMonth.value)));
    const tooltipProductId = computed(() => tooltip.value?.kind === 'product' ? tooltip.value.product.id : null);
    const priceHistory = computed(() => data.value && tooltipProductId.value ? productPriceHistory(data.value, tooltipProductId.value, overviewMonths.value) : []);
    const lastPurchase = computed(() => priceHistory.value.filter(month => month.price !== null).at(-1));
    const periodSelection = computed({
      get: () => selectedMonth.value || year.value,
      set: value => { year.value = /^\d{4}-\d{2}$/.test(value) ? value.slice(0, 4) : value; selectedMonth.value = /^\d{4}-\d{2}$/.test(value) ? value : null; hideTooltip(); },
    });
    const products = computed(() => data.value ? productsForMonths(data.value, selectedMonths.value) : []);
    const categories = computed(() => categoriesForProducts(products.value, data.value ? categoryOrdersForMonths(data.value, selectedMonths.value) : []));
    const categoryOptions = computed(() => [...new Set((data.value?.items || []).map(item => item.category))].sort((a, b) => a.localeCompare(b, 'ru')));
    const categorySelectOptions = computed(() => [{ value: 'all', label: 'Все категории' }, ...categoryOptions.value.map(value => ({ value, label: value }))]);
    const limitOptions = [{ value: 5, label: 'Топ-5' }, { value: 10, label: 'Топ-10' }];
    const filteredProducts = computed(() => products.value.filter(product => category.value === 'all' || product.category === category.value));
    const frequencyTop = computed(() => rankProducts(filteredProducts.value, frequencyMetric.value, Number(limit.value)));
    const spendingTop = computed(() => rankProducts(filteredProducts.value, 'spent', Number(limit.value)));
    const frequencyMaximum = computed(() => frequencyTop.value[0]?.[frequencyMetric.value] || 1);
    const spendingMaximum = computed(() => spendingTop.value[0]?.spent || 1);
    const categoryGoodsTotal = computed(() => categories.value.reduce((sum, item) => sum + item.spent, 0));
    const hasFilters = computed(() => year.value !== 'recent' || selectedMonth.value !== null || category.value !== 'all');
    const tooltipStyle = computed(() => tooltip.value ? { left: `${tooltip.value.x}px`, top: `${tooltip.value.y}px` } : {});
    function hideTooltip() { tooltip.value = null; }
    function showTooltip(event, content) {
      const rect = event.currentTarget?.getBoundingClientRect();
      const x0 = event.type === 'focus' ? rect.left + rect.width / 2 : event.clientX;
      const y0 = event.type === 'focus' ? rect.top : event.clientY;
      const width = content.kind === 'product' ? 640 : 280;
      const height = content.kind === 'product' ? 510 : 290;
      let x = x0 + 15, y = y0 - height;
      if (x + width > window.innerWidth - 12) x = x0 - width - 15;
      if (y < 12) y = y0 + 18;
      tooltip.value = { ...content, x: Math.max(12, Math.min(x, window.innerWidth - width - 12)), y: Math.max(12, Math.min(y, window.innerHeight - height - 12)) };
      nextTick(() => {
        const element = document.getElementById('dashboard-tooltip');
        if (!element || !tooltip.value) return;
        const bounds = element.getBoundingClientRect();
        const top = Math.max(12, Math.min(tooltip.value.y, window.innerHeight - bounds.height - 12));
        if (top !== tooltip.value.y) tooltip.value = { ...tooltip.value, y: top };
      });
    }
    function selectMonth(month) { selectedMonth.value = selectedMonth.value === month ? null : month; hideTooltip(); }
    function selectCategory(name) { category.value = category.value === name ? 'all' : name; hideTooltip(); }
    function resetFilters() { year.value = 'recent'; selectedMonth.value = null; category.value = 'all'; frequencyMetric.value = 'quantity'; hideTooltip(); }
    const controls = { show: showTooltip, hide: hideTooltip, selectMonth, selectCategory };
    function renderMonthly() {
      if (!ordersChart.value) return;
      drawMonthly(ordersChart.value, overviewMonths.value, 'orders', selectedMonth.value, controls);
      drawMonthly(spendChart.value, overviewMonths.value, 'spent', selectedMonth.value, controls);
      drawMonthly(discountChart.value, overviewMonths.value, 'discount', selectedMonth.value, controls);
    }
    function renderCategories() { if (categoriesChart.value) drawCategories(categoriesChart.value, categories.value, category.value, controls); }
    watch(year, hideTooltip);
    watch([overviewMonths, selectedMonth], async () => { await nextTick(); renderMonthly(); renderCategories(); });
    watch([categories, category], async () => { hideTooltip(); await nextTick(); renderCategories(); });
    const dismiss = event => { if (event.key === 'Escape') hideTooltip(); };
    onMounted(async () => {
      try {
        const response = await fetch(dataUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const parsed = await response.json();
        if (!Array.isArray(parsed.months) || !Array.isArray(parsed.items)) throw new Error('Invalid data');
        data.value = parsed;
      } catch (cause) {
        console.error('Не удалось загрузить данные:', cause);
        error.value = 'Не удалось загрузить данные. Обновите страницу.';
      } finally { loading.value = false; }
      await nextTick();
      if (data.value) {
        renderMonthly(); renderCategories();
        observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { hideTooltip(); renderMonthly(); renderCategories(); }); });
        for (const element of [ordersChart.value, spendChart.value, discountChart.value, categoriesChart.value]) observer.observe(element);
      }
      window.addEventListener('scroll', hideTooltip, { passive: true });
      window.addEventListener('keydown', dismiss);
    });
    onUnmounted(() => { observer?.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('scroll', hideTooltip); window.removeEventListener('keydown', dismiss); });
    return { data, loading, error, year, selectedMonth, category, categoryOptions, categorySelectOptions, limitOptions, frequencyMetric, limit, summary, currentMonth, currentSummary, priceHistory, lastPurchase, periodSelection,
      ordersChart, spendChart, discountChart, categoriesChart, categories, filteredProducts, frequencyTop, spendingTop, frequencyMaximum, spendingMaximum,
      productImage, categoryGoodsTotal, hasFilters, tooltip, tooltipStyle, hideTooltip, showTooltip, resetFilters, formatCount, formatMoney, formatDiscount, formatPercent, formatMonth };
  },
}).mount('#app');
