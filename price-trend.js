import { onMounted, ref, watch } from 'vue';
import { axisBottom, axisLeft, line, max, scaleLinear, scalePoint, select } from 'd3';
import { formatDiscount, formatMonth } from './analytics.js';

export default {
  props: { months: { type: Array, required: true }, selectedMonth: { type: String, default: null } },
  setup(props) {
    const element = ref(null);
    function draw() {
      if (!element.value) return;
      const width = 324, height = 138, left = 40, right = 28, top = 12, bottom = 30;
      const purchases = props.months.filter(month => month.price !== null);
      const x = scalePoint().domain(props.months.map(month => month.month)).range([left, width - right]);
      const y = scaleLinear().domain([0, (max(purchases, month => month.price / 100) || 1) * 1.1]).nice(3).range([height - bottom, top]);
      const svg = select(element.value).attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img')
        .attr('aria-label', `Средняя цена покупки за единицу по месяцам: ${purchases.map(month => `${formatMonth(month.month)} ${formatDiscount(month.price)}`).join('; ')}`);
      svg.selectAll('*').remove();
      svg.append('g').attr('class', 'chart-grid').attr('transform', `translate(${left},0)`)
        .call(axisLeft(y).ticks(3).tickSize(-(width - left - right)).tickFormat('')).call(group => group.select('.domain').remove());
      svg.append('g').attr('class', 'chart-axis').attr('transform', `translate(${left},0)`)
        .call(axisLeft(y).ticks(3).tickSize(0).tickPadding(6).tickFormat(value => new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(value)))
        .call(group => group.select('.domain').remove());
      const ticks = [...new Set([props.months[0]?.month, props.months[Math.floor((props.months.length - 1) / 2)]?.month, props.months.at(-1)?.month])].filter(Boolean);
      svg.append('g').attr('class', 'chart-axis').attr('transform', `translate(0,${height - bottom})`)
        .call(axisBottom(x).tickValues(ticks).tickSize(0).tickPadding(9).tickFormat(month => formatMonth(month, true).replace(/20(\d{2})$/, '$1')))
        .call(group => group.select('.domain').attr('stroke', '#dce2da'));
      svg.append('path').datum(props.months).attr('class', 'price-line')
        .attr('d', line().defined(month => month.price !== null).x(month => x(month.month)).y(month => y(month.price / 100)))
        .attr('fill', 'none').attr('stroke', '#28604b').attr('stroke-width', 2);
      svg.append('g').selectAll('circle').data(purchases).join('circle').attr('class', 'price-point')
        .attr('data-month', month => month.month).attr('data-price', month => month.price)
        .attr('cx', month => x(month.month)).attr('cy', month => y(month.price / 100))
        .attr('r', month => month.month === props.selectedMonth ? 4.5 : 3).attr('fill', '#28604b').attr('stroke', '#fff').attr('stroke-width', 1);
    }
    onMounted(draw);
    watch(() => [props.months, props.selectedMonth], draw, { flush: 'post' });
    return { element };
  },
  template: '<svg ref="element" class="price-trend-chart"></svg>',
};
