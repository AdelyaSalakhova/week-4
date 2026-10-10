import { onMounted, ref, watch } from 'vue';
import { axisBottom, axisLeft, line, max, scaleLinear, scalePoint, select } from 'd3';
import { formatDiscount, formatMonth } from './analytics.js';

const monthNames = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const priceNumber = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });

export default {
  props: { months: { type: Array, required: true }, selectedMonth: { type: String, default: null } },
  setup(props) {
    const element = ref(null);
    function draw() {
      if (!element.value) return;
      const width = 604, rowHeight = 158, left = 46, right = 14, top = 12, bottom = 46;
      const purchases = props.months.filter(month => month.price !== null);
      const rows = Array.from({ length: Math.max(1, Math.ceil(props.months.length / 24)) }, (_, index) => props.months.slice(index * 24, (index + 1) * 24));
      // A common scale keeps prices comparable between timeline rows.
      const y = scaleLinear().domain([0, max(purchases, month => month.price / 100) || 1]).nice(4).range([rowHeight - bottom, top]);
      const svg = select(element.value).attr('viewBox', `0 0 ${width} ${rows.length * rowHeight}`).attr('role', 'img')
        .attr('aria-label', `Средняя цена покупки за единицу по месяцам: ${purchases.map(month => `${formatMonth(month.month)} ${formatDiscount(month.price)}`).join('; ')}`);
      svg.selectAll('*').remove();
      for (const [index, months] of rows.entries()) {
        const plot = svg.append('g').attr('class', 'price-timeline-row').attr('transform', `translate(0,${index * rowHeight})`);
        const x = scalePoint().domain(months.map(month => month.month)).range([left, width - right]);
        plot.append('g').attr('class', 'chart-grid').attr('transform', `translate(${left},0)`)
          .call(axisLeft(y).ticks(3).tickSize(-(width - left - right)).tickFormat('')).call(group => group.select('.domain').remove());
        plot.append('g').attr('class', 'chart-axis price-y-axis').attr('transform', `translate(${left},0)`)
          .call(axisLeft(y).ticks(3).tickSize(0).tickPadding(6).tickFormat(value => priceNumber.format(value)))
          .call(group => group.select('.domain').remove());
        plot.append('g').attr('class', 'chart-axis price-month-axis').attr('transform', `translate(0,${rowHeight - bottom})`)
          .call(axisBottom(x).tickValues(months.map(month => month.month)).tickSize(3).tickPadding(7).tickFormat(month => monthNames[Number(month.slice(5)) - 1]))
          .call(group => group.select('.domain').attr('stroke', '#dce2da'))
          .call(group => group.selectAll('.tick line').attr('stroke', '#dce2da'));
        const years = [];
        for (const month of months) {
          const year = month.month.slice(0, 4);
          if (years.at(-1)?.year !== year) years.push({ year, months: [] });
          years.at(-1).months.push(month.month);
        }
        for (const year of years) {
          plot.append('text').attr('class', 'price-year-label').attr('text-anchor', 'middle')
            .attr('x', (x(year.months[0]) + x(year.months.at(-1))) / 2).attr('y', rowHeight - 6).text(year.year);
        }
        plot.append('path').datum(months).attr('class', 'price-line')
          .attr('d', line().defined(month => month.price !== null).x(month => x(month.month)).y(month => y(month.price / 100)))
          .attr('fill', 'none').attr('stroke', '#28604b').attr('stroke-width', 2);
        plot.append('g').selectAll('circle').data(months.filter(month => month.price !== null)).join('circle').attr('class', 'price-point')
          .attr('data-month', month => month.month).attr('data-price', month => month.price)
          .attr('cx', month => x(month.month)).attr('cy', month => y(month.price / 100))
          .attr('r', month => month.month === props.selectedMonth ? 4.5 : 3).attr('fill', '#28604b').attr('stroke', '#fff').attr('stroke-width', 1);
      }
    }
    onMounted(draw);
    watch(() => [props.months, props.selectedMonth], draw, { flush: 'post' });
    return { element };
  },
  template: '<svg ref="element" class="price-trend-chart"></svg>',
};
