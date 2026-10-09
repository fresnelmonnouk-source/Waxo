// Génère supabase/migrations/0002_seed_demo.sql depuis docs/maquettes/waxo-data.js (données de démonstration).
// Usage : node scripts/gen-seed.mjs
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const mod = await import(new URL('../docs/maquettes/waxo-data.js', import.meta.url).href);
const { SEED_PRODUCTS, SEED_REVIEWS, SEED_KB, SEED_COURIERS, SEED_LEDGER, COST } = mod;

const uuid = (ns, key) => {
  const h = createHash('md5').update(ns + ':' + key).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const out = ['-- GÉNÉRÉ par scripts/gen-seed.mjs — données de démonstration (retirables : voir bas de fichier).', 'begin;', ''];

const pid = (id) => uuid('product', id);

out.push('insert into public.products (id, category_id, price, compare_price, stock, sold, rating_seed, rating_seed_count, keyword, bg, active, created_at) values');
out.push(SEED_PRODUCTS.map((p) =>
  `  (${q(pid(p.id))}, ${q(p.cat)}, ${p.price}, ${p.old ?? 'null'}, ${p.stock}, ${p.sold}, ${p.r0}, ${p.n0}, ${q(p.word)}, ${q(p.bg)}, true, ${q(p.added)})`).join(',\n') + '\non conflict (id) do nothing;\n');

out.push('insert into public.product_costs (product_id, cost) values');
out.push(SEED_PRODUCTS.map((p) => `  (${q(pid(p.id))}, ${COST[p.id] ?? 0})`).join(',\n') + '\non conflict (product_id) do nothing;\n');

out.push('insert into public.product_translations (product_id, locale, name, slug, description) values');
out.push(SEED_PRODUCTS.map((p) => `  (${q(pid(p.id))}, 'fr', ${q(p.name)}, ${q(p.id)}, ${q(p.desc)})`).join(',\n') + '\non conflict (product_id, locale) do nothing;\n');

out.push('insert into public.reviews (id, product_id, author, rating, body, verified, seed, hidden, created_at) values');
out.push(SEED_REVIEWS.map((r) => `  (${q(uuid('review', r.id))}, ${q(pid(r.pid))}, ${q(r.author)}, ${r.rating}, ${q(r.text)}, true, true, false, ${q(r.date)})`).join(',\n') + '\non conflict (id) do nothing;\n');

out.push('insert into public.kb (id, tag, title, text, keywords) values');
out.push(SEED_KB.map((k) => `  (${q(uuid('kb', k.id))}, ${q(k.tag)}, ${q(k.title)}, ${q(k.text)}, ${q(k.keywords)})`).join(',\n') + '\non conflict (id) do nothing;\n');

out.push('insert into public.couriers (id, name, phone, zone, active) values');
out.push(SEED_COURIERS.map((c) => `  (${q(uuid('courier', c.id))}, ${q(c.name)}, ${q(c.phone)}, ${q(c.zone)}, ${c.active})`).join(',\n') + '\non conflict (id) do nothing;\n');

out.push('insert into public.ledger (id, date, cat, label, amount) values');
out.push(SEED_LEDGER.map((l) => `  (${q(uuid('ledger', l.id))}, ${q(l.date)}, ${q(l.cat)}, ${q(l.label)}, ${l.amount})`).join(',\n') + '\non conflict (id) do nothing;\n');

out.push('commit;', '',
  '-- Pour repartir de zéro avant la mise en prod réelle (à lancer par Fresnel) :',
  '-- delete from public.ledger; delete from public.reviews where seed; delete from public.products; delete from public.couriers; delete from public.kb;');

writeFileSync(new URL('../supabase/migrations/0002_seed_demo.sql', import.meta.url), out.join('\n'));
console.log('products', SEED_PRODUCTS.length, 'reviews', SEED_REVIEWS.length, 'kb', SEED_KB.length);
