# Rapport performance et fiabilité J1 — Tariq

Projet Waxo (Next.js 16.4 + Supabase, Vercel Hobby) · 2026-10-10 · périmètre : `0001_core.sql`, `0002_seed_demo.sql`, `src/lib/catalog`, `/api/checkout`, limiteurs, ISR, bundle.
Hors périmètre (ignoré) : admin, assistant, email, tracking, webhooks, cron (sauf lecture de l'appel `expire_stale_orders`).

**Méthode** : harnais PGlite (Postgres WASM) sur 0001+0002+0004+0006+0007, scripts dans le scratchpad (`p.mjs`, `r.mjs`, `v.mjs`, `rate.mjs`). Lecture d'un build antérieur `.next` (10:06, avant les derniers changements de code) pour les tailles. Aucun `next build`. Les durées PGlite (mono-thread, WASM) sont des ordres de grandeur, pas des temps Supabase. La concurrence réelle (deadlock) n'est pas reproductible dans PGlite : elle est établie par raisonnement.

**Verdict : ❌ à corriger avant mise en production** (3 🔴, 5 🟠). Les corrections SQL ci-dessous sont testées sur PGlite (up, re-up idempotent, down, re-up).

---

## 🔴 CRITIQUES

### T1. `cancel_order` annule une commande PAYÉE (course expiration / paiement) et ne laisse aucune trace de remboursement
- `0001_core.sql:461-470` (`cancel_order` ne lit pas `paid`), `:473-484` (`expire_stale_orders` filtre `paid = false` dans le curseur, pas sous verrou).
- Confiance 9/10 · empreinte `0001_core.sql:465:reliability`
- **Mesure (PGlite)** : `mark_paid` puis `cancel_order` → `true`, état `status=annulee, paid=true`, stock restitué, aucune ligne `payments` `needs_refund`. Chemin réel : le curseur de `expire_stale_orders` prend un instantané des commandes impayées ; pendant la boucle (jusqu'à 2 ms par commande en PGlite, donc une fenêtre qui grandit avec le lot), le webhook valide le paiement ; `cancel_order` verrouille la ligne, voit `status='nouvelle'` et annule. Résultat : client payé, commande annulée, stock rendu, aucun signal de remboursement. Le sens inverse (expiration d'abord, paiement tardif) est correct : `mark_paid` renvoie `order_cancelled` et crée `needs_refund` (vérifié).
- **Correctif** : section 4 et 5 du SQL 0008 : `cancel_order` crée `needs_refund` si `paid`; `expire_stale_orders` utilise `FOR UPDATE SKIP LOCKED`, qui ré-évalue `paid = false` sous verrou (un paiement validé entre-temps exclut la ligne ; un paiement en attente de verrou voit ensuite `annulee` et part en `needs_refund`).

### T2. Le stock se bloque 24 h : un cron par jour ne libère rien à temps, et les COD ne sont jamais libérés
- `vercel.json` : `0 3 * * *` ; `0001_core.sql:478` (`pay <> 'cod'`).
- Confiance 9/10 · empreinte `0001_core.sql:478:reliability`
- Raisonnement : avec les stocks du seed (3 à 5 unités sur plusieurs articles), une commande Mobile Money abandonnée bloque l'article jusqu'à 24 h 60 min ; une commande COD jamais (cf. Raphaël R1, Zoé 🔴1).
- **Correctifs** : (a) COD non vérifiés expirés après 48 h (SQL 0008 §5, mesuré : COD de 3 jours non vérifié annulé, COD vérifié et commande payée conservés) ; (b) planifier l'expiration dans Supabase avec `pg_cron` (gratuit, hors quota Vercel) : voir « pg_cron » plus bas. Le cron Vercel quotidien devient un filet de sécurité.
- Compatibilité : `rpc("expire_stale_orders", { p_minutes: 60 })` (cron actuel) continue de marcher, `p_cod_hours` a une valeur par défaut. Le cron app ne sélectionne que `pay <> cod` : les COD annulés par SQL ne reçoivent pas l'e-mail « annulee » (à décider).

### T3. Stock : deadlocks possibles et fuite de stock sur les packs
- Deadlock : `0001_core.sql:385-418` trie les lignes par `(kind, id)` mais les produits des packs sont verrouillés dans l'ordre de `pack_items` (`:407`), après les lignes `pack` (`'pack' < 'product'`), avant les lignes produit. Cart A = `pack X (P5,P9)` + produit `P1`, cart B = `pack Y (P1,P3)` + produit `P5` : A tient P5,P9 et attend P1 ; B tient P1,P3 et attend P5 → 40P01, une des deux commandes échoue en `server_error` 500 (non rejouée). `_restock_order` (`:343-357`) verrouille dans l'ordre inverse (produits puis packs, non triés) : même cycle possible entre annulation et commande. Confiance 7/10 (raisonnement, non reproduit).
- Fuite de stock (reproduit, 9/10) : `_restock_order` relit `pack_items` au moment de l'annulation. Pack à 2+1 unités commandé, composition réduite à 1+1 par l'admin, puis annulation : stock restitué 20/19 au lieu de 20/20 (−1 définitif). Pack supprimé avant annulation (`order_items.pack_id on delete set null`) : rien n'est restitué (9/8 au lieu de 10/10).
- **Correctif** (SQL 0008 §1-3) : un seul `SELECT … ORDER BY id FOR UPDATE` sur tous les produits touchés (packs dépliés) avant tout décrément ; restock agrégé et trié par `product_id` ; table `order_item_components` = instantané de la composition à la commande (les anciennes commandes retombent sur `pack_items` actuel). Mesuré : stock revenu à 20/20 dans les deux cas, pack vide refusé (`pack_unavailable`, Zoé 16).

---

## 🟠 IMPORTANTES

### T4. Plafond de quantité et commandes ouvertes : à imposer en base
- `guard.ts` (`MAX_QTY_PER_LINE=10`, `MAX_UNITS_PER_ORDER=20`) est dans la route seulement ; `place_order` accepte toujours 99 par ligne, 50 lignes, packs dépliés sans limite.
- **Correctif** (SQL 0008 §3) : mêmes plafonds en base (`quantity_limit` si ligne > 10 ou articles > 20, un pack compte `qty`), plus 60 unités physiques après dépliage, et 3 commandes ouvertes (non payées, `nouvelle`, 24 h) par téléphone, sérialisées par `pg_advisory_xact_lock` (pas de contournement par requêtes parallèles). Mesuré : 11 sur une ligne refusé, 24 unités refusé, 10+10 accepté, 4e commande ouverte refusée `too_many_open_orders`.
- **À faire côté app (Kody)** dans `src/lib/checkout/errors.ts` `mapPlaceOrderError` : `quantity_limit` → message `quantity_limit` de `guard.ts` (422), `too_many_open_orders` → `rate_limited` (429). Sans cela ils retombent en `server_error` 500. Ajouter aussi `40P01`/`40001` → un seul retry.
- Limite connue : un attaquant qui change de numéro contourne le plafond par téléphone (le plafond d'unités et l'expiration COD bornent le dommage ; le vrai frein est le limiteur partagé, T7).

### T5. Pages « statiques » figées au build, sauf la fiche produit
- Mesure `.next/prerender-manifest.json` : `revalidate=120` sur 48 fiches produit, `60` sur 4 pages commande, **`false` (jamais) sur 34 routes**, dont `/fr`, `/en`, `/catalogue`. Doc Next 16 : `revalidate = false` par défaut = cache indéfini, et « le plus bas `revalidate` de la route décide ».
- Effet : prix et stocks de l'accueil et du catalogue ne bougent plus jusqu'au prochain déploiement ; accueil à 8 900 F, fiche à 9 900 F. Pire : si Supabase est lent au build (timeout 4 s), le **repli démo est figé en production** sans possibilité de se corriger.
- **Correctif** : `export const revalidate = 120;` dans `src/app/[lang]/(shop)/layout.tsx` (s'applique à toutes les pages de la boutique) ; et en production ne pas basculer silencieusement sur la démo (Zoé 🟠5) : lever une erreur pour que l'ISR garde la dernière bonne page (Next conserve la version précédente si le rendu échoue).

### T6. Catalogue : requêtes dupliquées, avis non bornés, temps cumulés > budget 10 s
- `src/lib/catalog/index.ts:134-148,180-195` : chaque appel (`getProducts`, `getProductBySlug`, `getRelatedProducts`, `getProductsByIds`) refait `products + product_translations` ET `select product_id,rating from reviews` sans `limit` (plafond PostgREST 1 000 lignes : moyennes fausses silencieusement, aussi Zoé 🟠8). La fiche produit fait 4 lectures complètes du catalogue (`getProductBySlug` puis `Promise.all` de `getProducts` + `getRelatedProducts` + le layout `getShopData`).
- Pire cas d'une régénération ISR : 4 s (timeout séquentiel `getProductBySlug`) + 4 s (parallèle) = **≈ 8 s + rendu**, sous la limite Hobby de 10 s ; la minuterie `setTimeout` du `withTimeout` n'est jamais annulée (`index.ts:35-39`, à corriger comme `lib/auth/timeout.ts` qui fait `finally(clearTimeout)`).
- `/api/checkout/config` et `/api/products` relisent tout le catalogue pour renvoyer 2 à 50 stocks ; la clé de cache CDN inclut `ids` : chaque combinaison est un miss (Zoé 🟠9).
- **Correctifs** : (1) envelopper `fetchDbProducts` dans `cache()` de React (par rendu) et `unstable_cache(..., { revalidate: 60, tags: ['catalog'] })` (entre rendus) ; (2) remplacer la lecture des avis par une vue ou colonnes agrégées (`product_ratings(product_id, n, sum)`) ; (3) `/api/checkout/config` : retourner le stock de TOUS les produits (≈ 24 × 40 octets) sans `ids` dans la clé. Gain attendu : de 8 requêtes à 2 par régénération de fiche.

### T7. Limiteurs en mémoire : inefficaces en serverless ; alternative testée
- `src/lib/checkout/rate-limit.ts:4`, `src/lib/auth/rate-limit.ts:5` (+ copie dans `newsletter/route.ts`). Chaque instance a sa Map ; cold start = remise à zéro. Le limiteur de `newsletter` incrémente même quand il refuse (fenêtre qui se prolonge). `clientIp` : seau commun `"unknown"` si l'en-tête manque (auto-DoS) ; purge O(n) à chaque appel au-delà de 5 000 clés.
- **Alternative (zéro dépendance)** : fonction SQL `rate_hit(key, max, window_s)` atomique, table UNLOGGED, `service_role` seulement (SQL 0009 ci-dessous). Mesuré PGlite : 4 appels avec max 3 → `true,true,true,false`, fenêtre expirée → `true`, 0,43 ms, `anon` refusé. Coût réel : un aller-retour Supabase (≈ 30-80 ms) sur les routes protégées. À appeler avec un `withTimeout(800 ms)` et **fail-open** (si Supabase est lent, on laisse passer) afin que le limiteur ne devienne pas la cause de panne. Brancher d'abord `checkout`, `auth/login`, `forgot`, `signup`, `contact`, `reviews`, `track`. Option si la latence gêne : Upstash Redis (Marketplace Vercel).

### T8. Nombre de fonctions Vercel : ≫ 12 si une fonction par route
- Dénombrement actuel (`find src/app -name route.ts`) : **26 route handlers** dont 17 dans mon périmètre (auth 5, checkout 3 `config/route/status`, contact, me 4, newsletter, orders/track, products, reviews) + 9 hors périmètre (admin api 2, exports admin 4, assistant, cron, webhook fedapay). S'ajoutent : 3 pages ISR (`produit/[slug]`, `commande`, `commande/merci`), 14 pages admin dynamiques, et `proxy.ts`. Total potentiel ≈ 44 contre 12.
- Incertitude : je n'ai pas pu confirmer le regroupement des routes par le builder Vercel (pas de `vercel build` autorisé). À mesurer : `vercel build` puis compter `.vercel/output/functions/*.func`. Si > 12 : passer Pro, ou consolider.
- **Consolidation** (dispatchers + `rewrites()` dans `next.config.ts` pour garder les URL actuelles et ne rien changer au front) : `api/auth/[op]` (login, signup, forgot, logout) ; garder `auth/callback` ; `api/me/[[...op]]` (4 routes) ; `api/forms/[kind]` (contact, newsletter, reviews, orders/track) ; `api/checkout/[[...op]]` (route, config, status) ; `api/catalog` (products) fusionnable avec checkout/config ; `api/admin/[op]` (accountant, upload) et `admin/export/[kind]` (4 exports) ; cron + webhook + assistant conservés. Cible ≈ 11 handlers, mais les 14 pages admin dynamiques restent le point dur : à ce stade Vercel Pro (ou l'hébergement admin sur une autre URL) est plus simple que de les regrouper. Supprimer `api/cron/expire-orders` n'est pas conseillé (filet de sécurité + rattrapage FedaPay), mais le cron quotidien reste le seul autorisé sur Hobby.

### T9. `/api/checkout` : chaîne d'appels réseau sans borne de temps
- `src/app/api/checkout/route.ts` : `createSessionClient().auth.getUser()` (réseau, sans timeout), `place_order` (sans timeout), mise à jour `idem_key`, `await sendOrderEmail` (COD, avant la réponse), puis `createCheckout` FedaPay. 4 à 6 allers-retours séquentiels sous un plafond de 10 s : sur un Supabase lent, 504 alors que la commande existe déjà (l'idempotence `idem_key` limite les doublons, bonne chose).
- **Correctifs** : `withTimeout(…, 2000)` autour de `getUser` (déjà fait pour `proxy`), e-mail via `after()` de `next/server` (réponse immédiate), `AbortController` de 6 s sur FedaPay, journaliser (`console.error` avec n° de commande) le cas « commande créée mais paiement non lancé ».
- `src/proxy.ts`/`lib/supabase/proxy.ts` : pour tout visiteur avec cookie de session, `getUser()` part vers Supabase à CHAQUE requête (pages statiques et API), jusqu'à 3 s de blocage. Préférer `getClaims()` (vérification locale du JWT) dans le proxy ; garder `getUser()` pour les actions sensibles.

---

## 🟢 MINEURES

- **RLS coûteuse (mesurée)** : 200 000 commandes, rôle `authenticated`. `select count(*) from orders` : **1 846 ms** avec `public.is_admin()` appelée par ligne (fonction `SECURITY DEFINER` donc non inlinée), **31 ms** avec `(select public.is_admin())` ; `order_items` : 1 871 ms → 89 ms. La liste « mes commandes » d'un client (filtrée par `user_id`) reste à 1,8 ms : le gain concerne les lectures admin globales (tableau de bord, exports). Correctif : SQL 0008 §6 (21 politiques réécrites).
- **Index de clés étrangères manquants** : `order_items(product_id, pack_id)`, `pack_items(product_id)`, `reviews(user_id)`, `orders(courier_id)`. Ajoutés par 0008 §7 (+ `orders(phone)` partiel pour le plafond, + index COD). `payments(order_id)` existe déjà (0007).
- **Expiration par lots** : un appel qui annule 33 260 commandes prend 74 s dans UNE transaction (PGlite : 2,2 ms/commande) ; en prod sur Postgres natif ce sera plus rapide mais le principe reste : lot borné à 500, `SKIP LOCKED` (dans 0008 §5). `EXPLAIN` du filtre : 43 ms pour 33 260 lignes, `orders_status_idx` utilisé.
- **`order_seq`** : chaque `place_order` échoué consomme un numéro (3 échecs → 10766 → 10769). Sans conséquence comptable (ce n'est pas un numéro de facture) mais des trous visibles de `WX-…` ; aucun correctif nécessaire.
- **Données non bornées** : `webhook_events` et `payments.raw` croissent sans purge. Purger `webhook_events` > 90 jours via pg_cron.
- **`mark_paid`** (idempotence correcte, vérifiée) : un second paiement distinct (autre référence) sur une commande déjà payée retourne `duplicate` sans trace. À loguer en `needs_refund` si `p_ref` diffère (non fait ici : risque de faux positifs selon FedaPay).
- **Bundle** (lecture du build 10:06, avant les derniers ajouts) : accueil = HTML 141 Ko (29 Ko gzip), 13 scripts **772 Ko bruts / 236 Ko gzip** de JS de premier chargement, polices 13 fichiers 367 Ko. À 400 kbit/s réels, ≈ 5 s de JS seul. Le « flight data » inline pèse 89 Ko sur l'accueil. `searchIndex` est embarqué dans CHAQUE page par le layout : 248 octets/produit mesurés → 6 Ko à 24 produits, **48 Ko à 200, 242 Ko à 1 000 produits** par page. Correctif : charger l'index de recherche à la demande (`/api/products?q=` ou fichier JSON statique mis en cache) au premier focus sur la recherche. Objectif de budget : JS premier chargement < 170 Ko gzip. Analyseur de bundle non lancé (pas de build).
- **Mémoire/ISR** : 86 routes préfabriquées dont 48 fiches produit en revalidation 120 s : 48 × 8 lectures par cycle si tout est visité (cf. T6, deviendrait 48 × 2).

---

## Migration de données : ✅ expand-contract, réversible (note 5/5)

- 0008 = additif (nouvelle table, fonctions remplacées par `create or replace`, nouveaux index, politiques recréées) ; `expire_stale_orders` change de signature (`int` → `int, int` avec défaut) : le cron actuel marche tel quel.
- Aucune colonne retirée, aucun verrou long (tables de J1 petites ; sur grosse table créer les index hors transaction avec `CONCURRENTLY`).
- Retour arrière : 0008_down restaure les définitions exactes de 0001. Seul le snapshot `order_item_components` est perdu (les restitutions de commandes de packs en cours retombent sur le comportement 0001).
- Test PGlite : up → re-up (idempotent) → scénarios → down → commande à 11 unités de nouveau acceptée (état 0001 restauré) → re-up OK.

**Concurrence** : verrouillage unifié (T3), course paiement/expiration (T1). **Observabilité** : aucune alerte sur `needs_refund` ni sur `40P01` ; ajouter un `console.error` structuré (`[checkout] place_order`) avec le code SQL, et un compteur admin des `payments.status='needs_refund'`.

---

## pg_cron (expiration toutes les 10 minutes, hors quota Vercel)

À exécuter dans l'éditeur SQL Supabase après avoir activé l'extension `pg_cron` (Database → Extensions). Non testé dans PGlite.

```sql
select cron.schedule('waxo-expire-orders', '*/10 * * * *', $$select public.expire_stale_orders(60, 48)$$);
select cron.schedule('waxo-purge', '17 3 * * *',
  $$delete from public.webhook_events where created_at < now() - interval '90 days';
    delete from public.rate_limits where window_start < now() - interval '1 day'$$);
-- Retour arrière :
-- select cron.unschedule('waxo-expire-orders'); select cron.unschedule('waxo-purge');
```

Si le webhook FedaPay est manqué, le cron applicatif `/api/cron/expire-orders` rattrape les paiements approuvés avant d'expirer ; avec pg_cron toutes les 10 min, une commande peut être expirée avant ce rattrapage quotidien : garder `/api/checkout/status` (qui règle à la volée) et passer le délai d'expiration en ligne de 60 à 90 minutes si FedaPay est lent.

---

## SQL à appliquer : `supabase/migrations/0008_order_reliability.sql` (à créer par Kody, texte exact testé)

```sql
-- Waxo 0008 (PROPOSITION Tariq, non appliquée) : fiabilité commandes/stock.
-- Corrige : plafonds de quantité, ordre de verrouillage unique, snapshot de composition des packs,
-- expiration des COD non vérifiés, annulation d'une commande payée (needs_refund), course expiration/paiement,
-- politiques RLS en initplan, index de clés étrangères. Idempotent. Retour arrière : 0008_down.sql.
-- À passer APRÈS 0001..0007 (0007 fournit déjà payments_order_idx et orders.idem_key).
begin;

-- 1. Snapshot du contenu des packs au moment de la commande (le restock ne dépend plus de pack_items actuel)
create table if not exists public.order_item_components (
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  qty int not null check (qty >= 1),
  primary key (order_item_id, product_id)
);
create index if not exists order_item_components_product_idx on public.order_item_components(product_id);
alter table public.order_item_components enable row level security;
revoke all on public.order_item_components from anon, authenticated;

-- 2. Restitution du stock : agrégée et verrouillée dans l'ordre croissant de product_id
create or replace function public._restock_order(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select s.product_id, sum(s.q)::int as q from (
      select oi.product_id, oi.qty as q
        from public.order_items oi where oi.order_id = p_order and oi.product_id is not null
      union all
      select c.product_id, c.qty
        from public.order_item_components c join public.order_items oi on oi.id = c.order_item_id
        where oi.order_id = p_order
      union all  -- commandes antérieures à 0003 (pas de snapshot) : composition actuelle du pack
      select pi.product_id, oi.qty * pi.qty
        from public.order_items oi join public.pack_items pi on pi.pack_id = oi.pack_id
        where oi.order_id = p_order and oi.pack_id is not null
          and not exists (select 1 from public.order_item_components c where c.order_item_id = oi.id)
    ) s
    group by s.product_id
    order by s.product_id
  loop
    update public.products set stock = stock + r.q, sold = greatest(sold - r.q, 0) where id = r.product_id;
  end loop;
end $$;

-- 3. place_order : plafonds, verrou unique ordonné, snapshot packs, plafond de commandes ouvertes par téléphone
create or replace function public.place_order(
  p_items jsonb, p_customer jsonb, p_zone text, p_pay text, p_user uuid default null
) returns table (order_id uuid, order_number text, subtotal int, shipping_fee int, total int)
language plpgsql security definer set search_path = public as $$
declare
  v_ship jsonb; v_pay jsonb; v_free int; v_fee int;
  v_ord uuid; v_num text; v_sub int := 0;
  l record; c record; v_price int; v_name text; v_n int; v_item uuid; v_phone text;
  v_units int; v_expanded int; v_maxline int;
  c_max_line     constant int := 10; -- unités max par ligne (= MAX_QTY_PER_LINE de guard.ts)
  c_max_units    constant int := 20; -- articles max par commande, un pack compte pour qty (= MAX_UNITS_PER_ORDER)
  c_max_expanded constant int := 60; -- unités physiques max une fois les packs dépliés
  c_max_open     constant int := 3;  -- commandes ouvertes non payées par téléphone sur 24 h
begin
  if p_zone not in ('cotonou','autre') then raise exception 'invalid_zone'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'invalid_items'; end if;

  select value into v_pay from public.settings where key = 'pay';
  if coalesce((v_pay ->> p_pay)::boolean, false) is not true then raise exception 'payment_method_disabled'; end if;
  select value into v_ship from public.settings where key = 'shipping';
  if v_ship is null then raise exception 'shipping_not_configured'; end if;

  -- Plafonds (avant tout verrou)
  if exists (
    select 1 from (select x.kind, x.id, sum(x.qty)::int as qty
                   from jsonb_to_recordset(p_items) as x(kind text, id uuid, qty int) group by x.kind, x.id) a
    where a.qty is null or a.qty < 1
  ) then raise exception 'invalid_qty'; end if;

  select coalesce(sum(a.qty), 0)::int,
         coalesce(sum(case when a.kind = 'pack'
                           then a.qty * coalesce((select sum(pi.qty) from public.pack_items pi where pi.pack_id = a.id), 0)
                           else a.qty end), 0)::int,
         coalesce(max(a.qty), 0)::int
    into v_units, v_expanded, v_maxline
  from (select x.kind, x.id, sum(x.qty)::int as qty
        from jsonb_to_recordset(p_items) as x(kind text, id uuid, qty int) group by x.kind, x.id) a;
  if v_maxline > c_max_line or v_units > c_max_units or v_expanded > c_max_expanded then raise exception 'quantity_limit'; end if;

  -- Plafond de commandes ouvertes par téléphone (verrou consultatif : pas de contournement par requêtes parallèles)
  v_phone := trim(p_customer ->> 'phone');
  perform pg_advisory_xact_lock(hashtext('wx_open:' || coalesce(v_phone, '')));
  select count(*) into v_n from public.orders
    where phone = v_phone and status = 'nouvelle' and paid = false and created_at > now() - interval '24 hours';
  if v_n >= c_max_open then raise exception 'too_many_open_orders'; end if;

  -- UN SEUL verrou, dans l'ordre croissant de product_id, pour tous les produits touchés (produits + packs dépliés)
  perform 1 from public.products p
   where p.id in (
     select x.id from jsonb_to_recordset(p_items) as x(kind text, id uuid, qty int) where x.kind = 'product'
     union
     select pi.product_id from jsonb_to_recordset(p_items) as x(kind text, id uuid, qty int)
       join public.pack_items pi on pi.pack_id = x.id where x.kind = 'pack')
   order by p.id for update;

  insert into public.orders (user_id, name, phone, email, address, note, zone, pay)
  values (p_user, trim(p_customer ->> 'name'), v_phone, nullif(trim(p_customer ->> 'email'), ''),
          trim(p_customer ->> 'address'), nullif(trim(p_customer ->> 'note'), ''), p_zone, p_pay)
  returning id, number into v_ord, v_num;

  for l in
    select x.kind, x.id, sum(x.qty)::int as qty
    from jsonb_to_recordset(p_items) as x(kind text, id uuid, qty int)
    group by x.kind, x.id order by x.kind, x.id
  loop
    if l.kind = 'product' then
      select p.price, t.name into v_price, v_name
      from public.products p join public.product_translations t on t.product_id = p.id and t.locale = 'fr'
      where p.id = l.id and p.active;
      if not found then raise exception 'product_unavailable'; end if;
      update public.products set stock = stock - l.qty, sold = sold + l.qty where id = l.id and stock >= l.qty;
      get diagnostics v_n = row_count;
      if v_n = 0 then raise exception 'out_of_stock'; end if;
      insert into public.order_items (order_id, product_id, name, unit_price, qty) values (v_ord, l.id, v_name, v_price, l.qty);

    elsif l.kind = 'pack' then
      select p.price, t.name into v_price, v_name
      from public.packs p join public.pack_translations t on t.pack_id = p.id and t.locale = 'fr'
      where p.id = l.id and p.active;
      if not found then raise exception 'pack_unavailable'; end if;
      if not exists (select 1 from public.pack_items where pack_id = l.id) then raise exception 'pack_unavailable'; end if;
      insert into public.order_items (order_id, pack_id, name, unit_price, qty) values (v_ord, l.id, v_name, v_price, l.qty)
        returning id into v_item;
      for c in select product_id, qty from public.pack_items where pack_id = l.id order by product_id loop
        update public.products set stock = stock - c.qty * l.qty, sold = sold + c.qty * l.qty
          where id = c.product_id and active and stock >= c.qty * l.qty;
        get diagnostics v_n = row_count;
        if v_n = 0 then raise exception 'out_of_stock'; end if;
        insert into public.order_item_components (order_item_id, product_id, qty) values (v_item, c.product_id, c.qty * l.qty);
      end loop;
    else
      raise exception 'invalid_kind';
    end if;
    v_sub := v_sub + v_price * l.qty;
  end loop;

  v_free := coalesce((v_ship ->> 'freeFrom')::int, 0);
  v_fee := case when p_zone = 'cotonou' and v_free > 0 and v_sub >= v_free then 0
                when p_zone = 'cotonou' then coalesce((v_ship ->> 'cotonou')::int, 0)
                else coalesce((v_ship ->> 'autre')::int, 0) end;

  update public.orders set subtotal = v_sub, shipping_fee = v_fee, total = v_sub + v_fee where id = v_ord;
  return query select v_ord, v_num, v_sub, v_fee, v_sub + v_fee;
end $$;

-- 4. cancel_order : une commande PAYEE annulée laisse une trace de remboursement
create or replace function public.cancel_order(p_order uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare o record;
begin
  select id, status, paid, total into o from public.orders where id = p_order for update;
  if not found or o.status in ('annulee','livree') then return false; end if;
  update public.orders set status = 'annulee' where id = o.id;
  if o.paid and not exists (select 1 from public.payments where order_id = o.id and status = 'needs_refund') then
    insert into public.payments (order_id, provider, provider_ref, status, amount)
    values (o.id, 'system', 'cancel_after_paid', 'needs_refund', o.total);
  end if;
  perform public._restock_order(o.id);
  return true;
end $$;

-- 5. expire_stale_orders : COD non vérifiés inclus ; lot borné ; verrou + re-test de paid (course avec mark_paid)
drop function if exists public.expire_stale_orders(int);
create or replace function public.expire_stale_orders(p_minutes int default 60, p_cod_hours int default 48) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in
    select id from public.orders
    where status = 'nouvelle' and paid = false
      and ( (pay <> 'cod' and created_at < now() - make_interval(mins => p_minutes))
         or (pay = 'cod' and cod_verified = false and created_at < now() - make_interval(hours => p_cod_hours)) )
    order by created_at
    limit 500
    for update skip locked      -- re-évalue "paid = false" sous verrou : un paiement validé entre-temps l'exclut
  loop
    if public.cancel_order(r.id) then n := n + 1; end if;
  end loop;
  return n;
end $$;

revoke execute on function public._restock_order(uuid) from public, anon, authenticated;
revoke execute on function public.place_order(jsonb, jsonb, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.cancel_order(uuid) from public, anon, authenticated;
revoke execute on function public.expire_stale_orders(int, int) from public, anon, authenticated;
grant execute on function public._restock_order(uuid) to service_role;
grant execute on function public.place_order(jsonb, jsonb, text, text, uuid) to service_role;
grant execute on function public.cancel_order(uuid) to service_role;
grant execute on function public.expire_stale_orders(int, int) to service_role;

-- 6. RLS : is_admin()/auth.uid() évalués UNE fois par requête (initplan) au lieu d'une fois par ligne
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders for select using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists order_items_read on public.order_items;
create policy order_items_read on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = (select auth.uid()) or (select public.is_admin()))));
drop policy if exists favorites_own on public.favorites;
create policy favorites_own on public.favorites for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists products_read on public.products;
create policy products_read on public.products for select using (active or (select public.is_admin()));
drop policy if exists product_tr_read on public.product_translations;
create policy product_tr_read on public.product_translations for select
  using (exists (select 1 from public.products p where p.id = product_id and (p.active or (select public.is_admin()))));
drop policy if exists packs_read on public.packs;
create policy packs_read on public.packs for select using (active or (select public.is_admin()));
drop policy if exists pack_tr_read on public.pack_translations;
create policy pack_tr_read on public.pack_translations for select
  using (exists (select 1 from public.packs p where p.id = pack_id and (p.active or (select public.is_admin()))));
drop policy if exists pack_items_read on public.pack_items;
create policy pack_items_read on public.pack_items for select
  using (exists (select 1 from public.packs p where p.id = pack_id and (p.active or (select public.is_admin()))));
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select using (not hidden or (select public.is_admin()));
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (is_public or (select public.is_admin()));
drop policy if exists product_costs_admin on public.product_costs;
create policy product_costs_admin on public.product_costs for select using ((select public.is_admin()));
drop policy if exists couriers_admin on public.couriers;
create policy couriers_admin on public.couriers for select using ((select public.is_admin()));
drop policy if exists payments_admin on public.payments;
create policy payments_admin on public.payments for select using ((select public.is_admin()));
drop policy if exists messages_admin on public.messages;
create policy messages_admin on public.messages for select using ((select public.is_admin()));
drop policy if exists newsletter_admin on public.newsletter_subs;
create policy newsletter_admin on public.newsletter_subs for select using ((select public.is_admin()));
drop policy if exists kb_admin on public.kb;
create policy kb_admin on public.kb for select using ((select public.is_admin()));
drop policy if exists ledger_admin on public.ledger;
create policy ledger_admin on public.ledger for select using ((select public.is_admin()));

-- 7. Index : clés étrangères non indexées + plafond de commandes ouvertes
create index if not exists order_items_product_idx on public.order_items(product_id) where product_id is not null;
create index if not exists order_items_pack_idx on public.order_items(pack_id) where pack_id is not null;
create index if not exists orders_unverified_cod_idx on public.orders(created_at)
  where status = 'nouvelle' and paid = false and pay = 'cod' and cod_verified = false;
create index if not exists pack_items_product_idx on public.pack_items(product_id);
create index if not exists reviews_user_idx on public.reviews(user_id) where user_id is not null;
create index if not exists orders_courier_idx on public.orders(courier_id) where courier_id is not null;
create index if not exists orders_open_phone_idx on public.orders(phone) where status = 'nouvelle' and paid = false;

commit;
```

## Retour arrière : `supabase/migrations/0008_down.sql` (stocké hors du dossier des migrations)

```sql
-- Waxo 0008_down (PROPOSITION Tariq) : retour exact à l'état 0001. Perd uniquement le snapshot order_item_components.
begin;
drop function if exists public.expire_stale_orders(int, int);
-- Restitue le stock d'une commande (produits + contenu des packs).
create or replace function public._restock_order(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select product_id, qty from public.order_items where order_id = p_order and product_id is not null loop
    update public.products set stock = stock + r.qty, sold = greatest(sold - r.qty, 0) where id = r.product_id;
  end loop;
  for r in
    select pi.product_id, (oi.qty * pi.qty) as q
    from public.order_items oi join public.pack_items pi on pi.pack_id = oi.pack_id
    where oi.order_id = p_order and oi.pack_id is not null
  loop
    update public.products set stock = stock + r.q, sold = greatest(sold - r.q, 0) where id = r.product_id;
  end loop;
end $$;
-- p_customer : {"name","phone","email","address","note"}
create or replace function public.place_order(
  p_items jsonb, p_customer jsonb, p_zone text, p_pay text, p_user uuid default null
) returns table (order_id uuid, order_number text, subtotal int, shipping_fee int, total int)
language plpgsql security definer set search_path = public as $$
declare
  v_ship jsonb; v_pay jsonb; v_free int; v_fee int;
  v_ord uuid; v_num text; v_sub int := 0;
  l record; pi record; v_price int; v_name text; v_n int;
begin
  if p_zone not in ('cotonou','autre') then raise exception 'invalid_zone'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'invalid_items'; end if;

  select value into v_pay from public.settings where key = 'pay';
  if coalesce((v_pay ->> p_pay)::boolean, false) is not true then raise exception 'payment_method_disabled'; end if;
  select value into v_ship from public.settings where key = 'shipping';
  if v_ship is null then raise exception 'shipping_not_configured'; end if;

  insert into public.orders (user_id, name, phone, email, address, note, zone, pay)
  values (p_user, trim(p_customer ->> 'name'), trim(p_customer ->> 'phone'), nullif(trim(p_customer ->> 'email'), ''),
          trim(p_customer ->> 'address'), nullif(trim(p_customer ->> 'note'), ''), p_zone, p_pay)
  returning id, number into v_ord, v_num;

  -- Lignes agrégées et triées (ordre stable → pas de deadlock entre commandes concurrentes)
  for l in
    select x.kind, x.id, sum(x.qty)::int as qty
    from jsonb_to_recordset(p_items) as x(kind text, id uuid, qty int)
    group by x.kind, x.id order by x.kind, x.id
  loop
    if l.qty is null or l.qty < 1 or l.qty > 99 then raise exception 'invalid_qty'; end if;

    if l.kind = 'product' then
      select p.price, t.name into v_price, v_name
      from public.products p join public.product_translations t on t.product_id = p.id and t.locale = 'fr'
      where p.id = l.id and p.active for update of p;
      if not found then raise exception 'product_unavailable'; end if;
      update public.products set stock = stock - l.qty, sold = sold + l.qty where id = l.id and stock >= l.qty;
      get diagnostics v_n = row_count;
      if v_n = 0 then raise exception 'out_of_stock'; end if;
      insert into public.order_items (order_id, product_id, name, unit_price, qty) values (v_ord, l.id, v_name, v_price, l.qty);

    elsif l.kind = 'pack' then
      select p.price, t.name into v_price, v_name
      from public.packs p join public.pack_translations t on t.pack_id = p.id and t.locale = 'fr'
      where p.id = l.id and p.active;
      if not found then raise exception 'pack_unavailable'; end if;
      for pi in select product_id, qty from public.pack_items where pack_id = l.id order by product_id loop
        update public.products set stock = stock - pi.qty * l.qty, sold = sold + pi.qty * l.qty
          where id = pi.product_id and active and stock >= pi.qty * l.qty;
        get diagnostics v_n = row_count;
        if v_n = 0 then raise exception 'out_of_stock'; end if;
      end loop;
      insert into public.order_items (order_id, pack_id, name, unit_price, qty) values (v_ord, l.id, v_name, v_price, l.qty);
    else
      raise exception 'invalid_kind';
    end if;
    v_sub := v_sub + v_price * l.qty;
  end loop;

  v_free := coalesce((v_ship ->> 'freeFrom')::int, 0);
  -- Franco : Cotonou & Calavi seulement (règle de la maquette) ; autres villes = tarif plein.
  v_fee := case when p_zone = 'cotonou' and v_free > 0 and v_sub >= v_free then 0
                when p_zone = 'cotonou' then coalesce((v_ship ->> 'cotonou')::int, 0)
                else coalesce((v_ship ->> 'autre')::int, 0) end;

  update public.orders set subtotal = v_sub, shipping_fee = v_fee, total = v_sub + v_fee where id = v_ord;
  return query select v_ord, v_num, v_sub, v_fee, v_sub + v_fee;
end $$;
-- Annulation (admin / expiration) : statut + restitution du stock, une seule fois.
create or replace function public.cancel_order(p_order uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare o record;
begin
  select id, status into o from public.orders where id = p_order for update;
  if not found or o.status in ('annulee','livree') then return false; end if;
  update public.orders set status = 'annulee' where id = o.id;
  perform public._restock_order(o.id);
  return true;
end $$;

-- Libère le stock des commandes en ligne jamais payées.
create or replace function public.expire_stale_orders(p_minutes int default 60) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from public.orders
    where status = 'nouvelle' and paid = false and pay <> 'cod'
      and created_at < now() - make_interval(mins => p_minutes)
  loop
    if public.cancel_order(r.id) then n := n + 1; end if;
  end loop;
  return n;
end $$;
-- Aucune de ces fonctions n'est appelable par anon/authenticated : uniquement service_role (API serveur).
revoke execute on function public._restock_order(uuid) from public, anon, authenticated;
revoke execute on function public.place_order(jsonb, jsonb, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.mark_paid(uuid, text, text, text, int, jsonb) from public, anon, authenticated;
revoke execute on function public.cancel_order(uuid) from public, anon, authenticated;
revoke execute on function public.expire_stale_orders(int) from public, anon, authenticated;
grant execute on function public._restock_order(uuid) to service_role;
grant execute on function public.place_order(jsonb, jsonb, text, text, uuid) to service_role;
grant execute on function public.mark_paid(uuid, text, text, text, int, jsonb) to service_role;
grant execute on function public.cancel_order(uuid) to service_role;
grant execute on function public.expire_stale_orders(int) to service_role;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
-- Lecture publique
drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select using (true);
drop policy if exists products_read on public.products;
create policy products_read on public.products for select using (active or public.is_admin());
drop policy if exists product_tr_read on public.product_translations;
create policy product_tr_read on public.product_translations for select
  using (exists (select 1 from public.products p where p.id = product_id and (p.active or public.is_admin())));
drop policy if exists packs_read on public.packs;
create policy packs_read on public.packs for select using (active or public.is_admin());
drop policy if exists pack_tr_read on public.pack_translations;
create policy pack_tr_read on public.pack_translations for select
  using (exists (select 1 from public.packs p where p.id = pack_id and (p.active or public.is_admin())));
drop policy if exists pack_items_read on public.pack_items;
create policy pack_items_read on public.pack_items for select
  using (exists (select 1 from public.packs p where p.id = pack_id and (p.active or public.is_admin())));
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select using (not hidden or public.is_admin());
drop policy if exists pages_read on public.pages;
create policy pages_read on public.pages for select using (true);
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (is_public or public.is_admin());
drop policy if exists fx_read on public.fx_rates;
create policy fx_read on public.fx_rates for select using (true);

-- Propriétaire / admin
drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists order_items_read on public.order_items;
create policy order_items_read on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));
drop policy if exists favorites_own on public.favorites;
create policy favorites_own on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Admin seulement (lecture) — toute écriture passe par service_role
drop policy if exists product_costs_admin on public.product_costs;
create policy product_costs_admin on public.product_costs for select using (public.is_admin());
drop policy if exists couriers_admin on public.couriers;
create policy couriers_admin on public.couriers for select using (public.is_admin());
drop policy if exists payments_admin on public.payments;
create policy payments_admin on public.payments for select using (public.is_admin());
drop policy if exists messages_admin on public.messages;
create policy messages_admin on public.messages for select using (public.is_admin());
drop policy if exists newsletter_admin on public.newsletter_subs;
create policy newsletter_admin on public.newsletter_subs for select using (public.is_admin());
drop policy if exists kb_admin on public.kb;
create policy kb_admin on public.kb for select using (public.is_admin());
drop policy if exists ledger_admin on public.ledger;
create policy ledger_admin on public.ledger for select using (public.is_admin());
drop index if exists public.order_items_product_idx;
drop index if exists public.order_items_pack_idx;
drop index if exists public.orders_unverified_cod_idx;
drop index if exists public.pack_items_product_idx;
drop index if exists public.reviews_user_idx;
drop index if exists public.orders_courier_idx;
drop index if exists public.orders_open_phone_idx;
drop table if exists public.order_item_components;
commit;
```

## Limiteur partagé : `0009_rate_limits.sql` (T7, optionnel, testé)

```sql
-- Waxo 0009 (PROPOSITION Tariq, non appliquée) : limiteur de débit partagé (remplace les Map en mémoire).
-- Fenêtre fixe, un seul aller-retour, atomique (upsert). Table UNLOGGED : pas de WAL, perdue au crash (acceptable).
begin;
create unlogged table if not exists public.rate_limits (
  key text primary key,
  hits int not null,
  window_start timestamptz not null default now()
);
alter table public.rate_limits enable row level security;   -- aucune politique : service_role uniquement
revoke all on public.rate_limits from anon, authenticated;
create index if not exists rate_limits_window_idx on public.rate_limits(window_start);

-- true = appel autorisé ; false = limite atteinte.
create or replace function public.rate_hit(p_key text, p_max int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_hits int;
begin
  insert into public.rate_limits as r (key, hits, window_start) values (left(p_key, 200), 1, now())
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;
revoke execute on function public.rate_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_hit(text, int, int) to service_role;

-- Purge (à planifier avec pg_cron, voir plus bas) : delete from public.rate_limits where window_start < now() - interval '1 day';
commit;
-- Retour arrière : drop function if exists public.rate_hit(text, int, int); drop table if exists public.rate_limits;
```

## Mapping côté app (Kody)

- `src/lib/checkout/errors.ts` `mapPlaceOrderError` : `quantity_limit` → message `quantity_limit` (422) ; `too_many_open_orders` → `rate_limited` (429) ; `40P01` / `40001` → un retry puis `server_error`.
- `src/app/[lang]/(shop)/layout.tsx` : `export const revalidate = 120;`
- `src/lib/catalog/index.ts` : `cache()` + `unstable_cache`, `clearTimeout` dans `withTimeout`, agrégat d'avis en SQL, pas de repli démo en production.
- Ordre d'application : 0008, puis pg_cron, puis (optionnel) 0009 et le branchement de `rate_hit`.
