# Audit sécurité — Raphaël — Rédacteur IA des fiches + livraison offerte par pack

- Date : 2026-10-14
- Repo : `waxo`, branche `feat/livraison-details`
- Périmètre : `git diff 1076ad6` + fichiers non suivis (rédacteur IA, gate « [à confirmer] », migration 0026, checkout, admin packs)
- Méthode : lecture du code (pas d'attaque live). Mesure locale des expressions régulières sur entrée hostile (script dans le scratchpad, aucun fichier du repo modifié).

## Stack et surface d'attaque

Next.js 16 (server actions) + Supabase (RLS, `place_order` SECURITY DEFINER), DeepSeek, Vercel.

Points d'entrée du change :
1. `draftProductAction` (server action admin) : `url`, `notes`, `rayon`, puis lecture d'une page tierce et appel au LLM.
2. `createProduct`, `updateProduct` et `setProductActive` (server actions admin) : gate « [à confirmer] ».
3. `createPack` et `updatePack` (server actions admin) : nouveau champ `freeShipping`.
4. `POST /api/checkout` et `GET /api/checkout/config` (publics) : estimation des frais. L'autorité reste `place_order`.
5. Migration `0026_pack_free_shipping.sql` : colonne `packs.free_shipping` et nouvelle version de `place_order`.

STRIDE : Tampering (calcul des frais), Information disclosure et Elevation (SSRF), DoS (CPU, regex).

---

## 🔴 CRITIQUES (bloquant)

Aucun.

## 🟠 IMPORTANTES

Aucune.

## 🟡 MINEURES / durcissement

### 🟡1 — Regex quadratiques dans l'extraction du texte : une page piégée bloque le serveur jusqu'au délai max de 60 s
- `src/lib/admin/ai/page-text.ts:56` : `.replace(/<[^>]*>/g, " ")`
- Même motif aux lignes 51, 53, 54, 77, 159 et 208 (`\b[^>]*>`).
- Confiance 9/10, VERIFIED (mesuré).
- Le commentaire d'en-tête (« aucun retour arrière catastrophique ») est inexact. Il n'y a pas d'explosion exponentielle, mais le coût est quadratique. Pour chaque `<` non refermé, `[^>]*` parcourt la chaîne jusqu'à la fin avant d'échouer.
- Mesures (Node local) :

  | Entrée | Taille | Durée |
  |---|---|---|
  | `"<".repeat(N)` | 100 Ko | 9,6 s |
  | `"<".repeat(N)` | 200 Ko | 37 s |
  | `"<nav "` répété | 200 Ko | 6 s |
  | `"<meta "` répété | 200 Ko | 5,2 s |

  Le plafond de lecture est de 2 Mo, ce qui représente environ 100 fois le cas à 200 Ko.
- Scénario d'exploit : un faux fournisseur envoie à l'admin le lien d'une « page produit ». Cette page est servie en `text/html` et contient 2 Mo de `<`. L'admin la colle dans « Rédiger avec l'IA ». La regex synchrone bloque la boucle d'événements. Le minuteur de 8 s ne peut pas se déclencher. La fonction tourne jusqu'au kill Vercel à 60 s, et l'admin n'obtient qu'une erreur.
  - Avec Fluid compute, les autres requêtes servies par la même instance sont gelées pendant ce temps.
  - En répétant (30 fois par heure par admin), on obtient environ 30 min de calcul facturé par heure.
- Pas d'exfiltration et pas de déclenchement anonyme possible, d'où la gravité mineure.
- Correctif minimal : remplacer `[^>]*` par `[^<>]*` dans les regex de balise des lignes 51, 53, 54, 56, 77, 159 et 208. La regex de la ligne 57 reste inchangée.
  - Mesuré après correctif : 2 Mo traités en environ 10 ms, quelle que soit l'entrée hostile (`<<<`, `<nav `, `<meta `, mélange).
  - Ajouter un test de non-régression : `extractPageText("<".repeat(2e6))` doit répondre en moins de 1 s.
- Variantes : le motif n'apparaît que dans `page-text.ts`, le seul module qui traite du HTML non fiable.

### 🟡2 — Injection de prompt depuis la page : la sortie n'est pas filtrée, et `fromLink` peut être falsifié
- `src/lib/admin/ai/product-writer-prompt.ts:52` : `const neutralize = (s: string) => s.replace(/<\s*\/?\s*(?:NOTES|PAGE|RAYON)\s*>/gi, " ");`
- `src/lib/admin/ai/product-writer.ts:96` : `const draft = input.url ? parsed.draft : { ...parsed.draft, fromLink: [] };`
- Confiance 7/10, VERIFIED (code tracé). L'effet réel dépend du modèle.
- La neutralisation des balises fonctionne pour les formes ASCII. Elle laisse passer quelques variantes : `</PAGE​>` (le caractère d'espace sans largeur n'est pas couvert par `\s`) et les chevrons pleine largeur `＜/PAGE＞`.
- Le vrai sujet n'est pas la balise. Une page piégée peut demander au modèle deux choses :
  - glisser dans la description un contact externe (« Commandez sur WhatsApp +229… », un lien) ;
  - renvoyer `fromLink: []`, pour que le panneau n'affiche pas « vient du lien, à vérifier ».
- Rien en sortie ne détecte un lien, un e-mail ou un numéro. `scrubText` ne s'applique qu'en entrée.
- Scénario : un concurrent ou un escroc prépare une page « fournisseur ». L'admin la colle, relit vite (aucun champ n'est signalé comme venant du lien) et publie. Les clients sont alors détournés vers un contact externe.
- Le contrôle principal reste la relecture humaine. Le modèle n'a ni outils ni secrets dans son contexte, donc pas d'exfiltration possible.
- Correctif minimal, dans `runProductWriter` après `parseProductDraft` :
  - si un champ du brouillon correspond à `https?:\/\/|www\.|@|\+?\d(?:[\s.-]?\d){7,}`, le vider (ou lui appliquer `scrubText`) ;
  - quand `input.url` est fourni, ne pas faire confiance à un `fromLink` vide : y ajouter au minimum tous les champs remplis qui contiennent des chiffres ou des mesures. L'option la plus simple est « url fourni → tous les champs remplis sont marqués à vérifier ».
  - Facultatif : élargir `neutralize` aux caractères de largeur nulle (`[\s​-‍﻿]*`) et à `＜＞`.

### 🟡3 — Gate « [à confirmer] » : des variantes du marqueur passent
- `src/lib/admin/ai/product-writer-gate.ts:11` : `const TBC_RE = /\[\s*(?:[àa]\s+confirmer|to\s+be\s+confirmed|to\s+confirm|tbc)\s*\]/i;`
- Confiance 8/10, VERIFIED.
- Les chemins d'écriture sont bien tous couverts :
  - `createProduct` et `updateProduct` passent par `parseForm`, qui appelle `publishGate` ;
  - `setProductActive(true)` appelle `publishGateFromRows` ;
  - aucun autre écrivain de `products.active` (vérifié par grep sur `from("products")`) ;
  - aucune politique RLS d'écriture sur `products` ou `packs` pour anon/authenticated.
- Le trou est sémantique : la regex exige `]` juste après le mot-clé. Elle laisse donc passer :
  - `[à confirmer : taille]`, `[à confirmer (couleur)]` ;
  - `[à préciser]`, `[à vérifier]` ;
  - `[to be specified]` ;
  - un « à » en forme décomposée (NFD).
- Ces variantes sont plausibles quand le modèle veut être utile.
- Scénario : la fiche passe en ligne avec « Autonomie : [à confirmer : 6 ou 8 h] » visible par les clients. L'enjeu est la qualité et la conformité de l'annonce (Helena), pas une faille exploitable par un tiers.
- Correctif minimal : `/\[\s*(?:[àa]̀?\s+(?:confirmer|pr[ée]ciser|v[ée]rifier)|to\s+(?:be\s+)?(?:confirm(?:ed)?|specified|checked)|tbc)\b[^\]]{0,80}\]/i`, avec des cas de test pour chaque variante.

---

## Points examinés et conformes

### Anti-SSRF (`src/lib/admin/ai/fetch-page.ts`)
- `https:` uniquement. Un port explicite est refusé, ce qui laisse 443 implicite. Les identifiants dans l'URL sont refusés, la longueur est bornée à 2 000.
- Les IP littérales sont refusées, y compris les formes normalisées par WHATWG URL (`0x7f.1`, entier, `[::1]`).
- Les suffixes internes sont refusés.
- Le nom est résolu avec `all: true`, et la requête est refusée si une seule adresse est interdite.
- IPv6 : liste blanche 2000::/3 seulement. Cela exclut `::ffff:0:0/96`, `::/96`, NAT64 `64:ff9b::/96` et `64:ff9b:1::/48`, ULA, link-local et multicast. 6to4, Teredo et les plages de documentation sont exclus explicitement.
- IPv4 : tous les blocs RFC 6890 utiles sont couverts, dont `100.64/10` et `198.18/15`.
- Redirections en `manual`, 3 au plus. Chaque cible repasse par `validatePageUrl` puis par la vérification DNS.
- Budget de 8 s pour l'ensemble. Corps lu en flux et coupé à 2 Mo après décompression, donc pas de bombe gzip. Content-type `text/html` ou `text/plain` seulement. Le texte brut est échappé avant extraction.
- Tests présents : http, port 8443, IP mappée, NAT64, redirection vers privé, boucle de redirections.

### DNS rebinding (TOCTOU signalé par l'auteur) : risque réel négligeable, ne pas épingler undici
- Le seul moyen de faire résoudre le nom vers une IP interne au moment du `fetch` est un DNS contrôlé par l'attaquant.
- Mais la connexion se fait obligatoirement en HTTPS sur le port 443, avec vérification du certificat pour le nom de l'attaquant (SNI). Aucun service interne (127.0.0.1, 169.254.169.254, runtime Lambda en HTTP sur 9001) ne peut présenter un certificat valide pour `evil.example`.
- La poignée de main TLS échoue, et l'action renvoie le même code `unreachable` qu'un site en panne. Il n'y a donc ni lecture ni oracle exploitable, au-delà d'une sonde aveugle « port 443 ouvert », sans intérêt sur Vercel.
- Aucun `NODE_TLS_REJECT_UNAUTHORIZED`, `rejectUnauthorized` ou `setGlobalDispatcher` dans `src` (vérifié par grep).
- Il faut en plus un admin authentifié, et le limiteur partagé (30 par heure, en base) s'applique avant tout réseau.
- Recommandation :
  - ne pas ajouter `undici` en dépendance directe ni épingler l'IP. Le gain est nul et cela ajoute une dépendance plus du code réseau à maintenir ;
  - parade la plus simple : traiter « https seul + port implicite + TLS vérifié » comme un invariant de sécurité. Le commentaire des lignes 16 à 20 devrait dire que c'est TLS qui neutralise le rebinding. Les tests existants (http refusé, port refusé) le verrouillent déjà ;
  - si un jour on autorise `http:` ou un port explicite, l'épinglage devient alors obligatoire.

### Autorisation, limiteur et fuite de données
- `draftProductAction` appelle `assertAdmin()` en premier. `getAdmin` vérifie `profiles.role` en base, jamais via cookie ou metadata.
- Zod `.strict()` borne url, notes et rayon. Le limiteur partagé (`rate_hit` en base, repli en mémoire) passe avant toute lecture de lien ou appel LLM.
- Rien n'est enregistré par l'action.
- `logWriter` ne journalise que des compteurs et des codes : les chaînes sont coupées à 24 caractères et filtrées par `[^\w-]`. Ni lien, ni notes, ni page, ni réponse.
- Le statut HTTP distant n'est pas renvoyé au client. Les messages d'erreur sont génériques.
- `scrubText` s'applique aux notes, à la page et au rayon avant l'envoi à DeepSeek, y compris pour les valeurs des variables d'environnement sensibles.
- Le panneau client (`AiWriterPanel.tsx`) ne fait aucun rendu HTML brut et n'a aucun `href` construit à partir de la page. Dans tout `src`, `dangerouslySetInnerHTML` n'apparaît que dans `ConsentBanner` et `JsonLdScript` (préexistants, `safeJsonLd`).
- Coût LLM : réservé aux admins, plafonné à 30 par heure et 4 096 jetons. Pas d'amplification possible pour un anonyme.

### Livraison offerte par pack (0026)
- `place_order` : le diff ligne à ligne avec 0025 ne porte que sur la branche pack (lecture de `p.free_shipping` avec le prix, puis `if not v_free_line`).
- `packs.free_shipping` est `boolean not null default false` : pas de NULL possible, donc pas de contournement par `not null`.
- `security definer set search_path = public`. Puis `revoke execute ... from public, anon, authenticated; grant ... to service_role;` (lignes 145-146) : conforme.
- Intégrité : les frais sont calculés uniquement en base, à partir de `packs.free_shipping` et `products.free_shipping` lus côté serveur. Le client ne transmet que `kind`, `id`, `qty` et `zone`.
  - `free` (`/api/checkout/config`) et `currentQuote` (`/api/checkout`) ne servent qu'à l'affichage et au garde-fou « frais modifiés ».
  - Le montant enregistré et facturé vient du retour de `place_order`.
- Manipulation client impossible :
  - un pack inactif est refusé (`pack_unavailable`) ;
  - un composant inactif ou en rupture est refusé (`out_of_stock`) ;
  - un `kind` inconnu est refusé (`invalid_kind`).
- Le choix de `zone = 'cotonou'` avec une adresse hors zone est un risque métier préexistant à 0025 et 0026, non introduit ici.
- RLS : seule la politique `packs_read` existe (lecture). Aucune écriture anon ou authenticated. `free_shipping` est une information publique, son exposition en lecture ne pose pas de problème.
- Admin packs : `assertAdmin` d'abord. `freeShipping` passe par Zod `z.boolean().optional()` puis `=== true`. Le repli « colonne absente » refuse d'écrire un pack coché.
- Les packs masqués par `hasRealSaving` restent commandables. C'est le comportement préexistant, désormais aligné entre affichage et base (décision V8). Ce n'est pas une faille.
- Remarque d'exploitation, sans impact sécurité : `0026_pack_free_shipping.sql` n'est pas enveloppé dans `begin; ... commit;`, contrairement au script `down`. Un échec partiel laisserait la colonne sans la fonction, ce qui reste sans danger : la colonne a une valeur par défaut et la fonction 0025 continue de tourner.

---

## Décision sécurité

✅ RAS côté bloquant : aucun 🔴, aucune 🟠. Release possible.

3 durcissements 🟡 recommandés. Le n°1 (regex, 7 caractères à changer, mesuré) est à faire avant la mise en ligne parce qu'il ne coûte presque rien. Les n°2 et n°3 peuvent suivre.

Ceci est un audit pragmatique, pas une certification. Pour un enjeu majeur, prévoir un pentest ou un audit professionnel.
