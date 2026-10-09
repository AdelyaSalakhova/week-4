"""Prepare monthly statistics; the original CSV remains local."""
import csv
import json
import sys
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

root = Path(__file__).resolve().parents[1]
if len(sys.argv) > 1:
    source = Path(sys.argv[1])
else:
    sources = list(root.glob('*.csv'))
    if len(sources) != 1:
        raise SystemExit('Provide the path to the source CSV as the first argument.')
    source = sources[0]
with source.open(encoding='utf-8-sig', newline='') as file:
    rows = list(csv.DictReader(file))
assert rows, 'Empty dataset'
required = {'order_id', 'order_date', 'status', 'item_name', 'category', 'price', 'price_discounted', 'discount', 'quantity', 'amount'}
assert required.issubset(rows[0]), 'Missing CSV columns'
number = lambda row, key: Decimal(row[key].replace(',', '.'))
cents = lambda value: int((value * 100).to_integral_exact())
services = 'Услуги Груши'
service_fields = {'Доставка': 'deliverySpent', 'Упаковка': 'packagingSpent'}
order_meta = {}
month_orders = defaultdict(lambda: {'all': set(), 'delivered': set(), 'cancelled': set()})
monthly = defaultdict(lambda: {'spent': 0, 'goodsSpent': 0, 'servicesSpent': 0, 'deliverySpent': 0, 'packagingSpent': 0, 'savings': 0, 'base': 0, 'quantity': 0})
items = {}
category_orders = defaultdict(lambda: defaultdict(set))
for row in rows:
    order, date, status = row['order_id'], row['order_date'], row['status']
    assert status in {'доставлен', 'отменен'}, 'Unknown order status'
    assert len(date) == 10 and date[4] == '-' and date[7] == '-', 'Invalid date'
    if order in order_meta:
        assert order_meta[order] == (date, status), 'Inconsistent order metadata'
    order_meta[order] = (date, status)
    month = date[:7]
    order_group = month_orders[month]
    order_group['all'].add(order)
    order_group['delivered' if status == 'доставлен' else 'cancelled'].add(order)
    quantity = int(number(row, 'quantity'))
    assert quantity == number(row, 'quantity') and quantity > 0
    price, paid, discount, amount = [number(row, key) for key in ['price', 'price_discounted', 'discount', 'amount']]
    assert min(price, paid, discount, amount) >= 0
    assert amount == paid * quantity, 'Line amount does not reconcile'
    assert discount == price - paid, 'Discount must be RUB per unit'
    if status != 'доставлен':
        continue
    is_service = row['category'] == services
    month_data = monthly[month]
    month_data['spent'] += cents(amount)
    month_data['servicesSpent' if is_service else 'goodsSpent'] += cents(amount)
    if is_service:
        assert row['item_name'] in service_fields, 'Unknown service type'
        month_data[service_fields[row['item_name']]] += cents(amount)
        continue
    savings, base = cents(discount * quantity), cents(price * quantity)
    month_data['savings'] += savings
    month_data['base'] += base
    month_data['quantity'] += quantity
    category_orders[row['category']][month].add(order)
    key = (row['category'], row['item_name'])
    if key not in items:
        items[key] = {'name': row['item_name'], 'category': row['category'], 'months': {}}
    record = items[key]['months'].setdefault(month, {'orders': set(), 'quantity': 0, 'spent': 0, 'savings': 0, 'base': 0})
    record['orders'].add(order)
    record['quantity'] += quantity
    record['spent'] += cents(amount)
    record['savings'] += savings
    record['base'] += base

first, last = min(month_orders), max(month_orders)
months = []
year, month_num = map(int, first.split('-'))
while f'{year:04d}-{month_num:02d}' <= last:
    month = f'{year:04d}-{month_num:02d}'
    orders = month_orders[month]
    months.append({'month': month, 'orders': len(orders['all']), 'delivered': len(orders['delivered']), 'cancelled': len(orders['cancelled']), **monthly[month]})
    month_num += 1
    if month_num == 13:
        year, month_num = year + 1, 1
assert all(month['servicesSpent'] == month['deliverySpent'] + month['packagingSpent'] for month in months)
catalog = []
for index, (_, item) in enumerate(sorted(items.items()), 1):
    catalog.append({'id': f'p{index:03d}', 'name': item['name'], 'category': item['category'], 'months': [
        {'month': month, **{key: len(value) if isinstance(value, set) else value for key, value in record.items()}}
        for month, record in sorted(item['months'].items())
    ]})
assert sum(month['orders'] for month in months) == len(order_meta)
assert sum(month['spent'] for month in months) == sum(cents(number(row, 'amount')) for row in rows if row['status'] == 'доставлен')
assert sum(record['spent'] for item in catalog for record in item['months']) == sum(month['goodsSpent'] for month in months)
assert sum(record['savings'] for item in catalog for record in item['months']) == sum(month['savings'] for month in months)
output = {'meta': {'variant': 'C', 'firstMonth': first, 'lastMonth': last, 'sourceRows': len(rows), 'currency': 'RUB'}, 'months': months, 'items': catalog, 'categories': [{'name': name, 'months': [{'month': month, 'orders': len(orders)} for month, orders in sorted(records.items())]} for name, records in sorted(category_orders.items())]}
serialized = json.dumps(output, ensure_ascii=False, separators=(',', ':'))
assert 'delivery_address' not in serialized and 'order_id' not in serialized
for row in rows:
    address = row.get('delivery_address', '').strip()
    if address:
        assert address not in serialized, 'Delivery address leaked into the public summary'
(root / 'data').mkdir(exist_ok=True)
(root / 'data' / 'dashboard.json').write_text(serialized, encoding='utf-8')
print(json.dumps({'months': len(months), 'products': len(catalog), 'orders': len(order_meta), 'deliveredSpendRub': sum(month['spent'] for month in months)/100}, ensure_ascii=True))

