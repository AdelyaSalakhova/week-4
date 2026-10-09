export function monthsForYear(data, year) {
  return data.months.filter(month => year === 'all' || month.month.startsWith(year + '-'));
}
export function summarizeMonths(months) {
  const total = { orders: 0, delivered: 0, cancelled: 0, spent: 0, goodsSpent: 0, servicesSpent: 0, deliverySpent: 0, packagingSpent: 0, savings: 0, base: 0, quantity: 0 };
  for (const month of months) for (const key of Object.keys(total)) total[key] += month[key];
  return { ...total, averageDiscount: total.quantity ? total.savings / total.quantity : null, savingRate: total.base ? total.savings / total.base : null, averageCheck: total.delivered ? total.spent / total.delivered : null };
}
export function productsForMonths(data, months) {
  const selected = new Set(months.map(month => month.month));
  return data.items.flatMap(item => {
    const records = item.months.filter(month => selected.has(month.month));
    const total = { orders: 0, quantity: 0, spent: 0, savings: 0, base: 0 };
    for (const record of records) for (const key of Object.keys(total)) total[key] += record[key];
    return records.length ? [{ id: item.id, name: item.name, category: item.category, ...total }] : [];
  });
}
export function categoriesForProducts(products) {
  const categories = new Map();
  for (const product of products) {
    const row = categories.get(product.category) || { name: product.category, spent: 0, quantity: 0, products: 0 };
    row.spent += product.spent; row.quantity += product.quantity; row.products++;
    categories.set(row.name, row);
  }
  return [...categories.values()].sort((a, b) => b.spent - a.spent || a.name.localeCompare(b.name, 'ru'));
}
export function rankProducts(products, metric, limit = 10) {
  return [...products].sort((a, b) => b[metric] - a[metric] || a.name.localeCompare(b.name, 'ru')).slice(0, limit);
}
const integer = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const currency = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });
const decimalCurrency = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const formatCount = value => integer.format(value);
export const formatMoney = cents => cents === null ? '—' : currency.format(cents / 100);
export const formatDiscount = cents => cents === null ? '—' : decimalCurrency.format(cents / 100);
export const formatPercent = value => value === null ? '—' : new Intl.NumberFormat('ru-RU', { style: 'percent', maximumFractionDigits: 1 }).format(value);
export function formatMonth(month, short = false) {
  const date = new Date(month + '-01T00:00:00Z');
  return new Intl.DateTimeFormat('ru-RU', { month: short ? 'short' : 'long', year: 'numeric', timeZone: 'UTC' }).format(date).replace(/\s*г\.$/, '').replace('.', '');
}
export function periodLabel(months) {
  if (!months.length) return 'Нет данных';
  return months.length === 1 ? formatMonth(months[0].month) : `${formatMonth(months[0].month)} — ${formatMonth(months.at(-1).month)}`;
}
