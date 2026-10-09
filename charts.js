import { axisBottom, axisLeft, line, max, scaleBand, scaleLinear, select } from 'd3';
import { formatMonth, formatMoney } from './analytics.js';
const GREEN = '#28604b';
const AMBER = '#ba7d33';
const axisNumber = value => value >= 1000 ? `${Math.round(value / 1000)} тыс.` : String(value);

export function drawMonthly(element, months, kind, selectedMonth, controls) {
  const width = element.clientWidth;
  const height = 210;
  const margin = { left: kind === 'spent' ? 49 : 31, right: 8, top: 10, bottom: 32 };
  const plotBottom = height - margin.bottom;
  const x = scaleBand().domain(months.map(month => month.month)).range([margin.left, width - margin.right]).padding(0.27);
  const value = month => kind === 'orders' ? month.orders : kind === 'spent' ? month.spent / 100 : month.quantity ? month.savings / month.quantity / 100 : null;
  const maximum = max(months, value) || 1;
  const y = scaleLinear().domain([0, maximum]).nice(4).range([plotBottom, margin.top]);
  const svg = select(element).selectAll('svg').data([null]).join('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height)
    .attr('role', 'group').attr('aria-label', `${kind === 'orders' ? 'Количество заказов' : kind === 'spent' ? 'Траты в рублях' : 'Средняя скидка в рублях за товар'} по месяцам`);
  svg.selectAll('*').remove();
  const yTicks = kind === 'orders' ? Math.min(4, maximum) : 4;
  svg.append('g').attr('class', 'chart-grid').attr('transform', `translate(${margin.left},0)`)
    .call(axisLeft(y).ticks(yTicks).tickSize(-(width - margin.left - margin.right)).tickFormat(''))
    .call(group => group.select('.domain').remove());
  svg.append('g').attr('class', 'chart-axis').attr('transform', `translate(${margin.left},0)`)
    .call(axisLeft(y).ticks(yTicks).tickSize(0).tickPadding(7).tickFormat(kind === 'orders' ? value => String(value) : axisNumber))
    .call(group => group.select('.domain').remove());
  if (selectedMonth) svg.append('rect').attr('class', 'month-selection')
    .attr('x', x(selectedMonth) - x.step() * 0.13).attr('y', margin.top).attr('width', x.step()).attr('height', plotBottom - margin.top).attr('fill', '#eef3ec');
  if (kind === 'orders') {
    svg.append('g').selectAll('rect').data(months).join('rect').attr('class', 'delivered-bar')
      .attr('x', month => x(month.month)).attr('y', month => y(month.delivered)).attr('width', x.bandwidth()).attr('height', month => plotBottom - y(month.delivered)).attr('fill', GREEN);
    svg.append('g').selectAll('rect').data(months).join('rect')
      .attr('x', month => x(month.month)).attr('y', month => y(month.orders)).attr('width', x.bandwidth()).attr('height', month => y(month.delivered) - y(month.orders)).attr('fill', '#cbd2cc');
  } else if (kind === 'spent') {
    svg.append('g').selectAll('rect').data(months).join('rect').attr('class', 'spent-bar')
      .attr('x', month => x(month.month)).attr('y', month => y(value(month))).attr('width', x.bandwidth()).attr('height', month => plotBottom - y(value(month))).attr('fill', '#83a590');
  } else {
    svg.append('path').datum(months).attr('class', 'discount-line').attr('d', line().defined(month => value(month) !== null).x(month => x(month.month) + x.bandwidth() / 2).y(month => y(value(month))))
      .attr('fill', 'none').attr('stroke', AMBER).attr('stroke-width', 2);
    svg.append('g').selectAll('circle').data(months.filter(month => value(month) !== null)).join('circle')
      .attr('cx', month => x(month.month) + x.bandwidth() / 2).attr('cy', month => y(value(month))).attr('r', months.length > 20 ? 2 : 3).attr('fill', AMBER);
  }
  const step = Math.max(1, Math.ceil(months.length / 6));
  const tickValues = months.filter((_, index) => index % step === 0).map(month => month.month);
  if (months.length > 1 && months.length - 1 - (tickValues.length - 1) * step > step * 0.65) tickValues.push(months.at(-1).month);
  const tickLabel = month => {
    const short = new Intl.DateTimeFormat('ru-RU', { month: 'short', timeZone: 'UTC' }).format(new Date(month + '-01T00:00:00Z')).replace('.', '');
    return months.length > 12 ? `${short} ${month.slice(2, 4)}` : short;
  };
  svg.append('g').attr('class', 'chart-axis month-axis').attr('transform', `translate(0,${plotBottom})`)
    .call(axisBottom(x).tickValues(tickValues).tickFormat(tickLabel).tickSize(0).tickPadding(12))
    .call(group => group.select('.domain').attr('stroke', '#dce2da'));
  svg.append('g').selectAll('rect').data(months).join('rect').attr('class', 'month-target')
    .attr('data-month', month => month.month).attr('tabindex', 0).attr('role', 'button')
    .attr('aria-label', month => `Выбрать ${formatMonth(month.month)}`).attr('aria-pressed', month => String(month.month === selectedMonth))
    .attr('x', month => x(month.month) - x.step() * 0.13).attr('y', margin.top).attr('width', x.step()).attr('height', plotBottom - margin.top)
    .attr('fill', 'transparent').attr('stroke', 'transparent')
    .on('pointerenter pointermove focus', (event, month) => controls.show(event, { kind: 'month', month }))
    .on('pointerleave blur', controls.hide)
    .on('click', (_, month) => controls.selectMonth(month.month))
    .on('keydown', (event, month) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); controls.selectMonth(month.month); } });
}

export function drawCategories(element, categories, selectedCategory, controls) {
  const width = element.clientWidth;
  const rowHeight = 34;
  const height = Math.max(70, categories.length * rowHeight);
  const labelWidth = Math.min(122, width * 0.42);
  const valueWidth = 76;
  const x = scaleLinear().domain([0, max(categories, category => category.spent) || 1]).range([0, Math.max(10, width - labelWidth - valueWidth - 14)]);
  const svg = select(element).selectAll('svg').data([null]).join('svg').attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height)
    .attr('role', 'group').attr('aria-label', 'Траты на товары по категориям. Нажмите на категорию для фильтрации рейтингов.');
  svg.selectAll('*').remove();
  const rows = svg.append('g').selectAll('g').data(categories).join('g').attr('class', 'category-row')
    .attr('data-category', category => category.name).attr('transform', (_, index) => `translate(0,${index * rowHeight})`)
    .attr('role', 'button').attr('tabindex', 0).attr('aria-label', category => `${category.name}, ${formatMoney(category.spent)}`)
    .attr('aria-pressed', category => String(category.name === selectedCategory))
    .attr('opacity', category => selectedCategory === 'all' || selectedCategory === category.name ? 1 : 0.4)
    .on('pointerenter pointermove focus', (event, category) => controls.show(event, { kind: 'category', category }))
    .on('pointerleave blur', controls.hide).on('click', (_, category) => controls.selectCategory(category.name))
    .on('keydown', (event, category) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); controls.selectCategory(category.name); } });
  rows.append('rect').attr('width', width).attr('height', rowHeight).attr('fill', 'transparent');
  rows.append('text').attr('x', 0).attr('y', 20).attr('class', 'category-label').text(category => category.name);
  rows.append('rect').attr('x', labelWidth).attr('y', 10).attr('width', category => x(category.spent)).attr('height', 12).attr('rx', 1).attr('fill', '#83a590');
  rows.append('text').attr('x', width - 1).attr('y', 20).attr('text-anchor', 'end').attr('class', 'category-value').text(category => formatMoney(category.spent));
}
