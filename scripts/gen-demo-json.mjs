// Génère src/lib/demo/catalog.json (repli sans Supabase) depuis docs/maquettes/waxo-data.js. Usage : npm run gen:demo
import { writeFileSync } from 'node:fs';
const m = await import(new URL('../docs/maquettes/waxo-data.js', import.meta.url).href);
const cats = m.CATS.map((c, i) => ({ id: c.id, labelFr: c.label, labelEn: { maison: 'Home', cuisine: 'Kitchen', beaute: 'Beauty', tech: 'Tech', bureau: 'Office', voyage: 'Travel' }[c.id], bg: c.bg, sort: i + 1 }));
const products = m.SEED_PRODUCTS.map((p) => ({
  id: p.id, categoryId: p.cat, price: p.price, comparePrice: p.old ?? null, stock: p.stock, sold: p.sold,
  ratingSeed: p.r0, ratingSeedCount: p.n0, keyword: p.word, bg: p.bg, imageUrl: null, createdAt: p.added,
  fr: { name: p.name, slug: p.id, description: p.desc },
}));
const reviews = m.SEED_REVIEWS.map((r) => ({ id: r.id, productId: r.pid, author: r.author, rating: r.rating, body: r.text, verified: true, seed: true, createdAt: r.date }));
writeFileSync(new URL('../src/lib/demo/catalog.json', import.meta.url), JSON.stringify({ categories: cats, products, reviews }, null, 1));
console.log('demo', products.length, 'produits', reviews.length, 'avis');

// ── Données de démo ADMIN (sans mots de passe) : src/lib/demo/admin.json ──
const users = m.SEED_USERS.filter((u) => u.role === 'client').map((u) => ({ id: u.id, first: u.first, last: u.last, phone: u.phone, email: u.email, address: u.address, news: u.news, created: u.created }));
writeFileSync(new URL('../src/lib/demo/admin.json', import.meta.url), JSON.stringify({
  orders: m.SEED_ORDERS, clients: users, messages: m.SEED_MESSAGES, subs: m.SEED_SUBS, couriers: m.SEED_COURIERS,
  ledger: m.SEED_LEDGER, expenseCats: m.EXP, cost: m.COST, settings: m.DEFAULT_SETTINGS, status: m.STATUS, kb: m.SEED_KB,
}, null, 1));
console.log('admin demo', m.SEED_ORDERS.length, 'commandes');
