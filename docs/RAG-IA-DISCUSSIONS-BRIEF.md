# Brief commun : RAG, IA de l'admin, espace discussion (2026-10-13)

Branche `feat/rag-ia-discussions`, partie de `main` = prod (`56a5f81`). Aucun commit, aucun push, aucune écriture en base : Kody commite et Fresnel applique les SQL.
Stack : Next 16 App Router, next-intl (/fr, /en), Supabase (RLS, migrations `supabase/migrations/`), Vercel (`dub1`), Resend, DeepSeek (`src/lib/assistant/llm.ts`), Turnstile (`src/lib/auth/turnstile.ts`, inerte sans clés), limiteur `src/lib/ratelimit.ts`, admin protégé par `assertAdmin()`.

## Décisions de Fresnel (validées)
- **Discussion** : un fil sur le site par **lien sécurisé**. Le client reçoit un e-mail « Vous avez une réponse » avec un lien privé, lit le fil et y répond. S'il est connecté, il le retrouve aussi dans « Mon compte ».
- **IA de l'admin** : elle analyse et rédige des **brouillons**. Rien n'est publié dans la base de connaissances sans le clic « Publier » d'un admin.
- **Moteur** : DeepSeek (déjà branché). **Aucune donnée personnelle de client n'est envoyée à DeepSeek** par l'IA de l'admin : pas de nom, téléphone, e-mail, adresse ni message client brut.
- **Retours hors Cotonou/Calavi** : le renvoi est à la charge du client, **sauf produit défectueux ou erreur de notre part** (à nos frais).

## Faits de la boutique (source de vérité : réglages en base + textes validés par Helena)
- Livraison Express : le jour même pour une commande passée avant l'heure limite (`settings.shipping.cutoff`, 20 h aujourd'hui), sinon le lendemain, 7 j/7, dimanche compris, à Cotonou et Abomey-Calavi (zone `cotonou`). Autres villes du Bénin : 48 à 72 h.
- Frais : zone Cotonou/Calavi `settings.shipping.cotonou` (1 000 F), autres villes `settings.shipping.autre` (2 500 F). Livraison offerte dès `settings.shipping.freeFrom` (15 000 F) **dans la zone Cotonou/Calavi seulement**.
- Paiement : Mobile Money en ligne (MTN MoMo, Moov Money, Celtiis Cash) via FedaPay quand il est proposé (`onlinePayAvailable`), carte bancaire **désactivée** aujourd'hui (`settings.pay.carte=false`), paiement à la livraison en espèces ou par Mobile Money à la porte (`settings.pay.cod`). Pour un paiement à la livraison, l'heure limite s'apprécie à la confirmation sur WhatsApp.
- Horaires : équipe joignable sur WhatsApp **7 j/7, de 8 h à 20 h** ; l'assistant IA du site répond 24 h/24.
- Retours : délai `settings.shipping.returnDays` (7 jours). Coût du renvoi : voir les décisions plus haut.
- Nom : « Wá xɔ » veut dire « venez acheter » en fon. Les titres Google utilisent « Waxo ».
- Textes validés à réutiliser **tels quels** : `src/messages/fr/account.json` (FAQ `Faq.*`, `Legal.*`), `src/messages/fr/shop.json`, `docs/copy/*`, et les pages CMS (`supabase/migrations/0013`, `0014`, `0017`).

## Règles pour tous
- Tu ne modifies **que** les fichiers de ton équipe (voir le tableau). Si tu as besoin d'un autre fichier, n'y touche pas : écris l'édition exacte dans ton rapport.
- Nouveaux textes : uniquement dans ton fichier de messages, FR et EN, sous un **nouveau** namespace racine. Les fichiers sont fusionnés par `Object.assign` : réutiliser un namespace existant l'écraserait. Pas de tiret cadratin « — ». Espaces insécables avant `: ; ? !` en français.
- Ne lance **jamais** `next build` ni `next dev`. Autorisés : `npx tsc --noEmit`, `npx eslint <tes fichiers>`, `npx vitest run`.
- Migrations : seulement le numéro qui t'est attribué. Elle doit être rejouable (`if not exists`, `on conflict`), avec RLS activée, `revoke execute` sur les fonctions `security definer` pour `public`, `anon` et `authenticated`, et `search_path` figé. Valide-la sur PGlite (`@electric-sql/pglite` dans `C:\Users\LUFFY MKD\.kody-qa\node_modules`) : application, réapplication, puis scénarios.
- Écris des tests vitest pour chaque comportement. Pour une route, importe le handler et mocke ses dépendances.
- Admin : interface en français seulement. Toute action commence par `assertAdmin()`. Les écritures passent par `service_role`, côté serveur.
- **Bilingue = toute la surface publique** : pages, e-mails, erreurs d'API.

## Propriété des fichiers et numéros de migration
| Équipe | Fichiers (exclusifs) |
|---|---|
| **RAG** | `src/lib/assistant/kb.ts`, `src/lib/demo/kb.json`, `supabase/migrations/0021_kb_seed.sql`, `docs/kb/**`, `src/components/shop/Footer.tsx`, `src/components/shop/HomeHero.tsx`, ligne `payAll` / `payCodOnly` des pages `produit/[slug]` et `packs/[slug]` (seulement ce bloc), `src/lib/payment/ready.ts`, nouveaux fichiers `src/lib/payment/methods-label.ts`, clés de paiement **existantes** de `shop.json` / `product.json` / `packs.json` (valeurs `Footer.payments*`, `Home.payCod*`, `Home.g2*`, `payAll`, `payCodOnly`) |
| **IA admin** | `src/app/admin/(panel)/assistant-ia/**` (nouveau), `src/components/admin/ai/**` (nouveau), `src/lib/admin/ai/**` (nouveau), `src/components/admin/settings/KbManager.tsx` et ses actions KB dans `src/app/admin/(panel)/reglages/actions.ts` (**uniquement les fonctions KB**), `supabase/migrations/0022_kb_drafts.sql` |
| **Discussion** | `supabase/migrations/0023_conversations.sql`, `src/lib/conversations/**` (nouveau), `src/app/api/conversations/**` (nouveau), `src/app/api/contact/route.ts`, `src/lib/assistant/escalation.ts`, `src/app/[lang]/(shop)/discussion/**` (nouveau, `noindex`), `src/app/[lang]/(shop)/contact/**`, les composants du compte client pour « Mes demandes » (nouveau fichier dans `src/components/account/`), `src/app/admin/(panel)/messages/**`, `src/components/admin/messages/**`, `src/lib/email/conversation.ts` (nouveau), `src/messages/{fr,en}/conversations.json` (namespace `Conversations`) |

Fichiers que Kody seul modifie : `src/components/admin/nav.ts` et `shell/meta.ts` (déjà faits : « Assistant IA » → `/admin/assistant-ia`, « Discussions » → `/admin/messages`), `src/i18n/request.ts`, `src/lib/seo/site.ts` (`PRIVATE_PATH_PREFIXES`). Si tu as besoin d'une modification dans l'un d'eux, décris-la dans ton rapport.
