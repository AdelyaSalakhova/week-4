const assets = import.meta.glob('./assets/items/*.{jpg,jpeg,png}', { eager: true, query: '?url', import: 'default' });
const images = new Map(Object.entries(assets).map(([path, url]) => [path.split('/').at(-1).replace(/\.[^.]+$/, ''), url]));
export const productImage = product => images.get(product.id) || null;
