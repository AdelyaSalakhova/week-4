import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { categoryOrdersForMonths, productPriceHistory, monthsForYear, summarizeMonths, productsForMonths, categoriesForProducts, rankProducts } from './analytics.js';
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
  assert.deepEqual(Object.keys(data).sort(), ['categories', 'items', 'meta', 'months']);
  assert.deepEqual(Object.keys(data.meta).sort(), ['currency', 'firstMonth', 'lastMonth', 'sourceRows', 'variant']);
  for (const month of data.months) assert.deepEqual(Object.keys(month).sort(), ['base','cancelled','delivered','deliverySpent','goodsSpent','month','orders','packagingSpent','quantity','savings','servicesSpent','spent']);
  for (const category of data.categories) {
    assert.deepEqual(Object.keys(category).sort(), ['months', 'name']);
    for (const month of category.months) assert.deepEqual(Object.keys(month).sort(), ['month', 'orders']);
  }
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


test('Последние 24 месяца отсчитываются от последнего месяца данных, включая пустые месяцы', () => {
  const recent = monthsForYear(data, 'recent');
  assert.equal(recent.length, 24);
  assert.equal(recent[0].month, '2024-09');
  assert.equal(recent.at(-1).month, '2026-08');
  assert.ok(recent.every((month, index) => !index || new Date(month.month + '-01') - new Date(recent[index - 1].month + '-01') < 32 * 86400000));
  const fixture = { months: data.months.slice(-10).map((month, index) => ({ ...month, orders: index === 5 ? 0 : month.orders })) };
  assert.equal(monthsForYear(fixture, 'recent').length, 10);
  assert.equal(monthsForYear(fixture, 'recent')[5].orders, 0);
});

test('Цена за единицу взвешена по количеству; отсутствие покупок не превращается в нулевую цену', () => {
  const months = [{ month: '2026-01' }, { month: '2026-02' }, { month: '2026-03' }, { month: '2026-04' }];
  const fixture = { items: [{ id: 'p1', months: [{ month: '2026-01', quantity: 3, spent: 9000 }, { month: '2026-03', quantity: 2, spent: 8000 }] }] };
  const history = productPriceHistory(fixture, 'p1', months);
  assert.deepEqual(history.map(month => month.price), [3000, null, 4000, null]);
  assert.deepEqual(history.map(month => month.quantity), [3, 0, 2, 0]);
  assert.equal(productPriceHistory(fixture, 'p1', [months[0]]).filter(month => month.price !== null).length, 1);
  assert.equal(productPriceHistory(fixture, 'missing', months).every(month => month.price === null), true);
  for (const item of data.items) {
    const actual = productPriceHistory(data, item.id, data.months);
    assert.equal(actual.length, 60);
    for (const record of item.months) assert.equal(actual.find(month => month.month === record.month).price, record.spent / record.quantity);
  }
});

test('Категории используют уникальные заказы и взвешенную скидку вместо суммы заказов по товарам', () => {
  const fixture = [
    { category: 'A', spent: 9000, savings: 300, quantity: 3, orders: 3 },
    { category: 'A', spent: 8000, savings: 500, quantity: 5, orders: 2 },
  ];
  const category = categoriesForProducts(fixture, [{ name: 'A', orders: 3 }])[0];
  assert.equal(category.orders, 3);
  assert.equal(category.quantity, 8);
  assert.equal(category.averageDiscount, 100);
  assert.equal(category.spent, 17000);
  for (const months of [data.months, monthsForYear(data, 'recent'), monthsForYear(data, '2026'), [data.months.at(-1)]]) {
    const products = productsForMonths(data, months);
    const categories = categoriesForProducts(products, categoryOrdersForMonths(data, months));
    for (const category of categories) {
      assert.ok(category.orders > 0 && category.orders <= summarizeMonths(months).delivered);
      assert.ok(category.orders <= products.filter(product => product.category === category.name).reduce((sum, product) => sum + product.orders, 0));
    }
    assert.equal(categories.reduce((sum, category) => sum + category.savings, 0), summarizeMonths(months).savings);
    assert.equal(categories.reduce((sum, category) => sum + category.quantity, 0), summarizeMonths(months).quantity);
  }
});
