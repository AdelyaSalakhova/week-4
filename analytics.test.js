import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { monthsForYear, summarizeMonths, productsForMonths, categoriesForProducts, rankProducts } from './analytics.js';
const data = JSON.parse(readFileSync(new URL('./data/dashboard.json', import.meta.url), 'utf8'));

test('Заказы считаются отдельно от позиций; отменённые не входят в траты', () => {
  const total = summarizeMonths(data.months);
  assert.equal(total.orders, 480);
  assert.equal(total.delivered, 455);
  assert.equal(total.cancelled, 25);
  assert.equal(total.spent, 41535400);
  assert.equal(total.goodsSpent, 39399000);
  assert.equal(total.servicesSpent, 2136400);
  assert.equal(total.deliverySpent, 1880100);
  assert.equal(total.packagingSpent, 256300);
  assert.equal(total.savings, 769000);
  assert.equal(total.quantity, 1618);
  assert.equal(total.base - total.savings, total.goodsSpent);
});

test('Средняя скидка взвешена по количеству, а не по месяцам', () => {
  const blank = { orders: 1, delivered: 1, cancelled: 0, spent: 0, goodsSpent: 0, servicesSpent: 0, deliverySpent: 0, packagingSpent: 0, base: 10000 };
  const total = summarizeMonths([{ ...blank, savings: 100, quantity: 1 }, { ...blank, savings: 900, quantity: 3 }]);
  assert.equal(total.averageDiscount, 250);
  assert.equal(total.savingRate, 0.05);
  assert.equal(summarizeMonths([]).averageDiscount, null);
  assert.equal(summarizeMonths([]).averageCheck, null);
});

test('Суммы товаров и категорий совпадают с итогами каждого месяца', () => {
  for (const month of data.months) {
    const products = productsForMonths(data, [month]);
    const categories = categoriesForProducts(products);
    assert.equal(month.orders, month.delivered + month.cancelled);
    assert.equal(month.spent, month.goodsSpent + month.servicesSpent);
    assert.equal(month.servicesSpent, month.deliverySpent + month.packagingSpent);
    assert.equal(products.reduce((sum, p) => sum + p.spent, 0), month.goodsSpent);
    assert.equal(products.reduce((sum, p) => sum + p.quantity, 0), month.quantity);
    assert.equal(products.reduce((sum, p) => sum + p.savings, 0), month.savings);
    assert.equal(categories.reduce((sum, p) => sum + p.spent, 0), month.goodsSpent);
    for (const product of products) assert.ok(product.orders <= month.delivered && product.orders <= product.quantity);
  }
});

test('Выбор года и рейтинги работают на выбранном подмножестве', () => {
  const months = monthsForYear(data, '2026');
  assert.equal(months.length, 8);
  assert.ok(months.every(m => m.month.startsWith('2026-')));
  const products = productsForMonths(data, months);
  assert.equal(products.reduce((sum, p) => sum + p.spent, 0), summarizeMonths(months).goodsSpent);
  for (const metric of ['orders', 'quantity', 'spent']) {
    const top = rankProducts(products, metric, 5);
    assert.equal(top.length, 5);
    assert.ok(top.every((p, i) => !i || top[i - 1][metric] >= p[metric]));
  }
  assert.equal(monthsForYear(data, 'all').length, 60);
  assert.equal(productsForMonths(data, []).length, 0);
});

test('Публичные данные содержат только разрешённые поля сводки', () => {
  assert.deepEqual(Object.keys(data).sort(), ['items', 'meta', 'months']);
  assert.deepEqual(Object.keys(data.meta).sort(), ['currency', 'firstMonth', 'lastMonth', 'sourceRows', 'variant']);
  for (const month of data.months) assert.deepEqual(Object.keys(month).sort(), ['base','cancelled','delivered','deliverySpent','goodsSpent','month','orders','packagingSpent','quantity','savings','servicesSpent','spent']);
  for (const item of data.items) {
    assert.deepEqual(Object.keys(item).sort(), ['category','id','months','name']);
    assert.match(item.id, /^p\d+$/);
    assert.notEqual(item.category, 'Услуги Груши');
    for (const month of item.months) assert.deepEqual(Object.keys(month).sort(), ['base','month','orders','quantity','savings','spent']);
  }
});


test('Доставка и упаковка пересчитываются для года, месяца и пустого периода', () => {
  const year = summarizeMonths(monthsForYear(data, '2026'));
  assert.equal(year.deliverySpent, 175000);
  assert.equal(year.packagingSpent, 36100);
  const january = summarizeMonths(data.months.filter(month => month.month === '2026-01'));
  assert.equal(january.deliverySpent, 27700);
  assert.equal(january.packagingSpent, 5700);
  assert.equal(january.spent, january.goodsSpent + january.deliverySpent + january.packagingSpent);
  const empty = summarizeMonths([]);
  assert.equal(empty.deliverySpent, 0);
  assert.equal(empty.packagingSpent, 0);
});
