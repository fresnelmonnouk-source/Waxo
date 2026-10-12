# Waxo : synthèse de l'audit complet et du chantier SEO (2026-10-12)

Sources : `victor-audit-2026-10-12.md`, `raphael-audit-2026-10-12.md`, `mia-audit-2026-10-12.md`,
`sofia-audit-seo-2026-10-12.md`, `tariq-audit-2026-10-12.md` (à intégrer à réception), plus la passe navigateur
et le crawl de la prod faits par Kody (Playwright Chrome 375/1280, curl).

Signal fort = constat trouvé par au moins 2 équipes de façon indépendante (marqué ×2, ×3…).

## Lot 0 : Fresnel, aujourd'hui (sans code)
- [ ] Admin → Réglages : désactiver MoMo, Moov et Celtiis tant que les clés FedaPay sont des clés d'essai (Raphaël C1, Sofia ×2).
- [ ] Appliquer `supabase/migrations/0018_site_reviews.sql`, puis feu vert pour pousser `eba17dd` (avis boutique).
- [ ] Ne pas déclarer le sitemap à la Search Console ni lancer de pub tant qu'il n'y a pas environ 20 vrais produits (Victor, Sofia).

## Lot 1 : Critique (code, Kody)
- C1 : refuser le mode d'essai FedaPay en production, à la fois dans `getPaymentProvider()` (`src/lib/payment/index.ts:28`) et dans `settleApprovedTransaction()` (`settle.ts:39`), sauf si `ALLOW_SANDBOX_PAYMENTS=1`. Enregistrer le mode dans `payments.raw` et afficher un badge « ESSAI » dans l'admin.

## Lot 2 : SEO technique (code, Kody, aucune donnée business requise)
1. Pages `not-found` et `error` localisées, aux couleurs de la boutique, avec `lang`, en-tête et pied de page. Aujourd'hui la 404 de Next s'affiche en anglais, sans `lang` (Victor S3, Kody ×2).
2. Open Graph par page : `og:title`, `og:description`, `og:url` et image de la fiche, via `withSeo`, qui doit réutiliser `pageMetadata` (Victor S4, Sofia, Mia ×3).
3. JSON-LD Product + Offer (XOF, disponibilité) + BreadcrumbList sur les fiches et les packs. `aggregateRating` seulement à partir de vrais avis, jamais de `rating_seed`. Corriger l'identifiant et le prix de `view_item` (Victor S1, Sofia, Mia ×3).
4. FAQ : toutes les réponses dans le HTML, repliées en CSS ou avec `<details>`, plus le JSON-LD FAQPage (Sofia).
5. Fil d'Ariane de la fiche : `?category=` → `?cat=` (Victor S9, Mia, Sofia ×3).
6. JSON-LD Organization enrichi : logo, `alternateName` « Waxo », `contactPoint` et zone desservie lus depuis les réglages (Victor S10, Sofia, Kody).
7. Changement de langue sur une fiche : retrouver le produit par son slug dans les deux langues, puis 308 vers le bon slug (Victor S2). *Décision D4.*
8. Fiche sans texte anglais : pas d'alternate EN, canonique FR (Victor S8, Sofia). *Décision D5.*
9. Base lente : ne plus servir les coordonnées factices `DEFAULT_SETTINGS` ni les rayons de démo (Victor S7). *Décision D6.*
10. Boutique vide : masquer les sections vides de l'accueil, afficher un vrai état vide au catalogue (« Arrivage en cours », sans « 0 produit »), et passer le catalogue en `noindex` tant qu'il est vide (Mia, Victor S14, Kody ×3).
11. Sitemap : `lastmod` (nécessite une colonne `products.updated_at`, migration 0019 à appliquer par Fresnel), pages de campagne actives.
12. Photos produit : remplacer les fonds CSS par des `<img>` ou `next/image` avec `alt` et `srcset` (Victor S6, Sofia, Mia ×3). Restreindre `remotePatterns` au projet Waxo (Raphaël F5). À faire avec Tariq (LCP).
13. Petits correctifs : `revalidate` sans effet (T2), un seul `withTimeout` (T3), manifest « livrées demain » (T4).

## Lot 3 : textes SEO (Marcus, puis Helena) — *après les décisions D1 et D2*
- Titles et meta descriptions uniques pour toutes les pages publiques, en FR et en EN.
- H1 de l'accueil portant « Cotonou » et « le jour même ».
- Une seule grille d'horaires (pied de page, contact, accueil, « dans l'heure »).
- Message WhatsApp pré-rempli, introductions des rayons et des pages par usage.

## Lot 4 : accessibilité et UX (Kody)
- Focus visible sur les fonds sombres : `.on-dark :focus-visible`.
- Case CGU de l'inscription : ajouter `aria-labelledby`.
- Tunnel de commande : layout `(checkout)` ou attribut `inert` sur la coque, pour que le clavier n'atteigne plus la boutique cachée derrière.
- Paiement échoué : garder le panier et proposer « réessayer », le paiement à la livraison ou WhatsApp.
- Admin : bouton « Ajouter un produit » dans l'en-tête de page (et « Exporter en CSV » de la newsletter), comme sur la maquette.
- Constats moyens de Mia (§4) : piège à focus du tiroir, `scroll-padding-top`, favoris fantômes, note « 0,0 », annonce des erreurs.

## Lot 5 : sécurité, niveau moyen
- Verrou de connexion compté par identifiant **et** adresse IP (Raphaël M2).
- CAPTCHA sur la commande et l'inscription (O2, ouvert depuis J1). *Décision D7.*
- Expiration plus rapide des commandes non payées (cron quotidien aujourd'hui, Raphaël M1 et Sofia ×2 ; à recouper avec le plan Vercel, voir Tariq).
- F1 : page de confirmation avec un bouton en POST pour `/api/auth/confirm`. F2 : e-mail d'alerte quand les clés de paiement changent.

## Lot 6 : à la charge de Fresnel (business)
- Clés FedaPay live, puis un vrai paiement de test par moyen de paiement.
- Entité légale : 14 « [à compléter] » sont visibles en prod sur `/fr/mentions-legales`.
- Search Console et Bing (TXT chez Hostinger), fiche Google Business Profile en zone desservie (vérification en 1 à 3 semaines), profils sociaux.
- Saisie des vrais produits avec la checklist SEO (Sofia §A3) : le slug est figé à la première sauvegarde.

## Lot 7 : plus tard
- Pages de rayon indexables, pages par usage, page « Livraison Cotonou & Calavi ».
- Guides (le guide cadeaux avant le 16 novembre).
- Enregistrer la source d'acquisition de chaque commande (UTM, parrain).
- Types Supabase générés (T1).

## Décisions à prendre (Fresnel)
- D1 : nom dans les titres Google : « Waxo » (recommandation de Sofia, c'est ce que les gens tapent) ou « Wá xɔ ».
- D2 : grille d'horaires réelle (service client, livraison, assistant).
- D3 : mentions légales : retirer les lignes vides ou les laisser en attendant l'entité (Helena).
- D4 : redirection 308 vers le bon slug au changement de langue (recommandé).
- D5 : fiche non traduite : canonique FR, sans alternate EN (recommandé).
- D6 : base en panne : erreur, la page en cache reste servie, plutôt que de fausses coordonnées (recommandé).
- D7 : CAPTCHA : Cloudflare Turnstile (gratuit, discret ; niveau B).
- Mia, à faire trancher par Vincent : en-tête collant en mobile, titre de la page de confirmation.
