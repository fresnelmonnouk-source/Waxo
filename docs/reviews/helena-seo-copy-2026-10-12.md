# Revue conformité : textes SEO, H1, horaires, états (copy Marcus du 2026-10-12)

Date : 2026-10-13 · Reviewer : Helena · Cadre : `docs/compliance-checklist.md`, `docs/reviews/helena-conformite-J1.md`.

Évaluation de risque, pas un avis juridique formel. Cadre visé : droit de la consommation béninois, interdiction des pratiques commerciales trompeuses (Code du numérique et textes UEMOA sur la concurrence et la protection du consommateur). Aucun article n'est cité : textes exacts et sanctions à confirmer par un juriste local. Le principe retenu ici : une allégation (prix, délai, moyen de paiement) doit être vraie au moment où le client la lit, et ne pas contredire les CGV.

Périmètre lu : `docs/copy/seo-2026-10-12.md`, `src/messages/{fr,en}/seo.json`, `states.json`, `security.json`, `shop.json` (`Home.title`, `Footer.hours`, `Home.g4Sub`, `Home.step2Text`). Vérifications dans le code : `src/lib/checkout/shipping.ts`, `supabase/migrations/0015_campaigns.sql` (place_order), `0017_livraison_express.sql`, `src/components/shop/HomeHero.tsx`, `Footer.tsx`, `src/lib/catalog/packs.ts`, `src/components/admin/packs/PackDrawer.tsx`.

## Décision globale

Modifications requises. Deux points bloquants : (1) les moyens de paiement annoncés une fois FedaPay masqué, (2) la règle « 7 j/7 » face aux pages CGV et Livraison réellement en base. Le reste peut partir après les corrections proposées.

---

## Fait vérifié : livraison offerte

Elle vaut pour **Cotonou et Calavi**, pas pour Cotonou seul. Dans le code, la zone `cotonou` est la seule zone franco : `shipping.ts:20-24`, et `place_order` dans `0015_campaigns.sql:216-218`. Au paiement, cette zone s'affiche « Cotonou & Calavi » (`checkout.json › zoneCotonou`). Les textes du site (`Faq.a2`, `Legal.shipping.r1f`, `Express.noteZone`, `checkout.json › shipFree`, pages CMS 0017) sont cohérents avec le code. C'est le brief qui se trompe. Les metas ne parlent pas de gratuité : c'est OK. Si Fresnel veut en réalité limiter le franco à Cotonou seul, il faut changer le code ET ces textes : c'est une décision à lui faire confirmer.

---

## Bloquant

### B1. Moyens de paiement une fois FedaPay masqué (Mobile Money en ligne et carte)

- **Fichiers et clés** : `seo.json` FR et EN › `home`, `catalogue`, `faq`, `product.descriptionFallback`, `campaign.descriptionFallback`.
- **Problème** : dès que le paiement en ligne est masqué, il ne reste que le paiement à la livraison (en espèces ou par Mobile Money à la porte, voir `checkout.json › codSub`).
  - « carte » (meta FAQ) devient faux : c'est un moyen de paiement annoncé mais indisponible, donc une allégation trompeuse.
  - « paiement Mobile Money ou à la livraison » reste vrai à la lettre, mais il laisse entendre que Mobile Money est un paiement en ligne distinct. C'est ambigu, et le risque est moyen.
  - Ces metas deviennent aussi fausses si le paiement à la livraison est un jour désactivé dans l'admin.
- **Formulation robuste** (vraie dans les deux états de FedaPay, tant que le paiement à la livraison reste actif) :

| Clé | FR | EN |
|---|---|---|
| `home.description` | Boutique en ligne à Cotonou. Commandé avant 20 h, livré le jour même à Cotonou et Calavi, 7 j/7. Paiement à la livraison, en espèces ou Mobile Money. | Online shop in Cotonou. Order before 8 pm for same-day delivery in Cotonou and Calavi, 7 days a week. Pay on delivery, in cash or by Mobile Money. |
| `catalogue.description` | Achetez en ligne à Cotonou : maison, cuisine, beauté, tech, bureau, voyage. Commandé avant 20 h, livré le jour même. Payez à la livraison. | Shop online in Cotonou: home, kitchen, beauty, tech, office and travel. Order before 8 pm for same-day delivery. Pay on delivery. |
| `faq.description` | Livraison le jour même à Cotonou et Calavi pour toute commande avant 20 h, moyens de paiement, retours : toutes nos réponses. | Delivery times and fees, payment methods, returns: clear answers. Same day in Cotonou and Calavi for orders before 8 pm. |
| `product.descriptionFallback` | {name} à {price}. Commandé avant 20 h, livré le jour même à Cotonou et Calavi, 7 j/7. Paiement à la livraison, en espèces ou Mobile Money. | {name} for {price}. Order before 8 pm for same-day delivery in Cotonou and Calavi, 7 days a week. Pay on delivery, in cash or by Mobile Money. |
| `campaign.descriptionFallback` | Les offres {name}, pour une durée limitée. Commandé avant 20 h, livré le jour même à Cotonou et Calavi. Paiement à la livraison, en espèces ou Mobile Money. | {name} deals, for a limited time. Order before 8 pm for same-day delivery in Cotonou and Calavi. Pay on delivery, in cash or by Mobile Money. |

(Les longueurs sont égales ou inférieures à celles de Marcus, sauf `campaign` FR, qui prend environ 20 caractères de plus que `{name}` : c'est acceptable.)

- **Même défaut ailleurs, hors metas.** C'est aussi bloquant au moment du masquage. Responsables : Kody et Marcus.
  - `shop.json › Home.payCod` (« Vous payez par Mobile Money, par carte ou à la réception »). `HomeHero.tsx:51` choisit seulement entre `payCod` et `payNoCod` selon le paiement à la livraison, et ignore les autres moyens. Avec FedaPay masqué, l'accueil annoncerait donc la carte.
  - `Home.g2CodSub` (« Ou MTN MoMo, Moov Money, Celtiis Cash, carte »).
  - `Footer.payments` (« MTN MoMo · Moov Money · Celtiis Cash · Visa · Mastercard »), affiché sans condition (`Footer.tsx:116`).
  - `product.json › payAll`, `packs.json › payAll`.
  - `consent.json` l. 28 (« Paiement Mobile Money ou carte »).
  - **Page CGV en base, art. 5** (« Nous acceptons MTN MoMo, Moov Money, Celtiis Cash et les cartes bancaires Visa ou Mastercard »). C'est un texte contractuel : le plus important des deux.
  - Correction conseillée : générer ces textes à partir de `settings.pay`, comme le fait déjà `{{pay.codCgv}}`. Textes pour l'état « paiement à la livraison seul » :
    - FR `payCod` / `payAll` : « Vous payez à la réception, en espèces ou par Mobile Money. » · EN : « You pay on delivery, in cash or by Mobile Money. »
    - FR `g2CodSub` : « En espèces ou par Mobile Money, à la porte » · EN : « In cash or by Mobile Money, at your door »
    - FR `Footer.payments` : « Paiement à la livraison : espèces ou Mobile Money » · EN : « Pay on delivery: cash or Mobile Money »
    - CGV art. 5, première phrase, FR : « Les moyens de paiement disponibles sont ceux affichés au moment de votre commande. Aujourd'hui : paiement à la livraison, en espèces ou par Mobile Money. » · EN : « The payment methods available are those shown when you place your order. Currently: payment on delivery, in cash or by Mobile Money. »
  - EN `Footer.paymentsCod` : remplacer « Cash on delivery » par « Pay on delivery » (déjà validé en J1).
- **Garde-fou opérationnel** : ne jamais désactiver le paiement à la livraison dans l'admin sans mettre à jour `seo.json`. Ajouter cette règle à la checklist.

### B2. « 7 j/7 » et « dimanche compris » face aux CGV et à la page Livraison en base

- **Fichiers et clés** : `seo.json` `home`, `livraisonRetours`, `product`, `contact` (« 7 j/7 ») et `shop.json › Footer.hours`.
- **Problème** : `0017_livraison_express.sql` ne remplace une page que si son texte est encore celui d'origine (l. 2-4). Si la page CGV ou la page Livraison a été retouchée dans l'admin, elle dit encore « du lundi au samedi… nous ne livrons pas le dimanche » (0014). Les metas et le contrat se contredisent alors. C'est trompeur, et en cas de litige c'est la version la plus favorable au client qui risque d'être retenue.
- **Correction** : avant la mise en ligne, exécuter cette requête dans Supabase. Le résultat attendu est 0 ligne :
  `select title from public.pages where body_md ilike '%lundi au samedi%' or body_md ilike '%pas le dimanche%' or body_md ilike '%monday to saturday%' or body_md ilike '%on sundays%';`
  Si une ligne remonte, corriger la page dans l'admin avec le texte de 0017. Aucune reformulation des metas n'est nécessaire.

---

## À corriger

### C1. « Petits prix » / « Low prices » (`seo.json › home.description` FR et EN)

- **Problème** : ce n'est pas une comparaison, c'est une allégation sur le niveau de prix. Elle est défendable si le vrai catalogue est surtout composé d'articles peu chers (par exemple la majorité sous 7 000 F, ce qui correspond aux filtres « Budget »). Aujourd'hui, le catalogue est encore celui de démonstration : on ne peut pas le vérifier. En anglais, « Low prices » est plus affirmatif.
- **Correction** : la retirer des metas (c'est déjà le cas dans les textes proposés en B1). La réintroduire seulement quand le vrai catalogue est en ligne et que la répartition des prix a été vérifiée. Même réserve pour « à petit prix » dans `consent.json`, `src/app/manifest.ts`, `account.json › c2p` et `src/lib/pages/defaults.ts`. Ce n'est pas bloquant, mais il faut le revoir au même moment.

### C2. Packs « moins chers que séparément » (`seo.json › packs.description` FR et EN, `packs.json` : `metaDescription`, `heading`, `lead`, `saveTitle`, `saveText` « toujours »)

- **Problème** : aucun garde-fou ne rend cette allégation vraie pour chaque pack publié.
  - `PackDrawer.tsx:214` se contente d'un avertissement si le pack coûte autant ou plus cher.
  - `src/lib/catalog/packs.ts` publie les packs sans filtrer ceux qui n'ont aucune économie.
  - Pendant une **campagne**, le prix des produits baisse. Un pack peut alors coûter plus cher que ses produits achetés séparément.
  - Conséquence : allégation de prix fausse pour certains packs, donc pratique trompeuse.
- **Correction (au choix)** :
  - (a) De préférence, côté code (Kody) : masquer côté public, ou refuser de publier, tout pack dont le prix est égal ou supérieur à la somme des prix **actuels** de ses produits (prix de campagne compris). Le texte peut alors rester tel quel.
  - (b) Sans garde-fou, texte neutre :
    - FR : « Packs de produits utiles choisis pour aller ensemble, en un seul colis. Commandé avant 20 h, livré le jour même à Cotonou et Calavi. »
    - EN : « Product bundles picked to go together, in a single parcel. Order before 8 pm for same-day delivery in Cotonou and Calavi. »
    - Avec cette option, `packs.json` doit aussi perdre « toujours » et « moins cher » au titre et dans l'accroche.

### C3. « 20 h » / « 8 pm » écrits en dur dans les metas (toutes les clés `seo.json` qui contiennent l'heure)

- **Problème** : c'est exact aujourd'hui, mais ça devient faux dès que `shipping.cutoff` change dans l'admin. Google garde aussi l'ancien extrait en cache pendant quelques jours.
- **Correction** :
  - De préférence : utiliser la variable `{hour}` (le même format que `shop.json › g3Sub`), alimentée par `settings.shipping.cutoff` dans `generateMetadata`. Kody doit vérifier que cette lecture ne rend pas les pages dynamiques (lecture sans cookies, voir les pages ISR).
  - À défaut : sous le champ « heure limite » de l'admin, afficher la mention « Changer aussi les descriptions SEO (seo.json) ».
  - **Ne jamais supprimer la condition pour contourner ce problème** : « livré le jour même » sans condition serait trompeur.
- **Point vert** : pour un paiement à la livraison, l'heure limite s'applique à l'heure de confirmation sur WhatsApp (`Faq.a1`, CGV). La meta ne peut pas tout dire : c'est acceptable, puisque la page de destination le précise.

### C4. Horaires : les textes sont OK, mais ils sont contredits ailleurs

- **Statut** : `Footer.hours`, `Home.g4Sub` et `contact.description` sont **OK** sur le fond.
- **Problème** : tant que d'autres sources disent autre chose, l'information donnée au client est incohérente. Les contradictions relevées :
  - le réglage en base `brand.hours` (« Du lundi au samedi, 24/24 »), qui laisse croire à une équipe disponible 24 h/24 : c'est faux ;
  - `account.json › Contact.intro` et `Contact.sentText` (du lundi au samedi, 8 h-19 h) ;
  - la fiche « Qui sommes-nous » de la base de l'assistant IA (seed `0002`, `src/lib/demo/kb.json:84`) : l'assistant répétera « lundi-samedi 8 h-19 h ».
- **Correction** : appliquer les textes de Marcus (§3, « À faire hors de mes fichiers ») avant de publier les metas.

### C5. Campagne terminée encore indexée (`seo.json › campaign.descriptionFallback`)

- **Statut** : « pour une durée limitée » est **vrai**. `ends_at` est obligatoire et une contrainte vérifie qu'il est postérieur à `starts_at` (`0015_campaigns.sql:13-21`).
- **Problème** : la page reste lisible après `ends_at`, car la règle RLS teste seulement `now() >= starts_at` (l. 40). Une campagne finie peut donc rester dans Google avec « offres… durée limitée ».
- **Correction (Kody)** : quand la campagne est finie, passer la page en `robots: noindex` ou la rediriger vers le catalogue. Je n'ai pas vérifié comment la page affiche l'état « terminée ».

---

## OK (avec conditions)

### O1. H1 `shop.json › Home.title`

FR « Les petites choses utiles, livrées le jour même à Cotonou. » / EN « Small useful things, delivered the same day in Cotonou. »

- **OK sous condition.** Correction d'un fait : la condition n'est pas « juste dessous ». Dans `HomeHero.tsx` (l. 49-55), l'ordre est le suivant : H1, puis le paragraphe `lead` sur le paiement, puis `HeroDeliveryProof`.
- **La promesse principale est acceptable si sa condition est lisible dans le même premier écran.** Atout : après 20 h, `HeroDeliveryProof` affiche en temps réel « livré demain », ce qui corrige la promesse générale.
- Conditions à vérifier avec Playwright :
  - à 375 px, `HeroDeliveryProof` est visible sans faire défiler la page ;
  - il est rendu côté serveur, et pas seulement après l'hydratation ;
  - sa taille et son contraste respectent le niveau AA.
- Si une de ces conditions n'est pas remplie : FR « Les petites choses utiles, livrées vite à Cotonou. » / EN « Small useful things, delivered fast in Cotonou. »

### O2. À propos « souvent le jour même » / « often the same day » (`seo.json › aPropos`)

OK : la formule est prudente et vraie pour la zone principale. Variante plus précise si souhaitée, FR : « …et les livrons chez vous, le jour même à Cotonou et Calavi. » / EN : « …and deliver them to your door, same day in Cotonou and Calavi. »

### O3. Titles et autres metas

OK : `home.title`, `livraisonRetours` (title et description, « Autres villes : 48 à 72 h » conforme à la page CMS), `catalogue.title`, `contact.title`, pages légales, `product.title` FR et EN, `pack`, `notFound`. Le title de l'accueil n'affiche pas de condition, mais la description affichée juste dessous dans Google la donne.

`{price}` dans `product` : passer le prix **en vigueur**, prix de campagne compris, et garder la revalidation ISR. Le décalage de l'extrait en cache chez Google est un risque faible.

### O4. `Home.g4Sub` et `contact.description` : transparence sur l'IA (recommandation)

C'est une bonne pratique, sans obligation béninoise identifiée (repère UE : transparence des chatbots). Je recommande d'écrire « assistant IA » :

- FR `g4Sub` : « L'assistant IA du site répond à toute heure. Notre équipe vous répond sur WhatsApp, 7 j/7, de 8 h à 20 h. »
- EN `g4Sub` : « Our AI site assistant answers any time. Our team replies on WhatsApp, 7 days a week, 8 am to 8 pm. »
- FR `contact.description` : « …et l'assistant IA du site 24 h/24… » · EN : « …and our AI site assistant answers 24/7… »

### O5. `Home.step2Text`

OK. C'est le texte validé en J1.

### O6. `states.json`

- **`NotFound`, `ErrorPage`** : OK.
- **`EmptyStates.filtersText`** : OK.
- **`EmptyStates.arrivalTitle` / `arrivalText`** (« Arrivage en cours », « arrivent très bientôt », « on s'en occupe ») : OK tant qu'un arrivage est réellement en cours. Si cet état risque de rester affiché longtemps, utiliser une version neutre, sans promesse de réassort (même règle qu'en J1) :
  - FR `arrivalEyebrow` « Boutique en préparation », `arrivalTitle` « Le catalogue se remplit », `arrivalText` « Les produits ne sont pas encore en ligne. Dites-nous ce que vous cherchez : nous vous répondons sur WhatsApp. »
  - EN `arrivalEyebrow` « Getting ready », `arrivalTitle` « The catalogue is filling up », `arrivalText` « Products are not online yet. Tell us what you are looking for: we will reply on WhatsApp. »

### O7. `security.json`

OK, rien à signaler sur le plan juridique.

- **`retry`** : « Payer à la livraison » ne s'affiche que si le paiement à la livraison est actif (`OrderConfirmation.tsx:165`). « Votre panier est conservé » doit rester techniquement vrai.
- **`confirm`** : l'avertissement anti-hameçonnage est bon.
- **`auth.captcha`** : neutre.
- Avec FedaPay masqué, l'écran « paiement échoué » ne devrait plus s'afficher pour les nouvelles commandes.

---

## À ajouter à `docs/compliance-checklist.md` (par Kody, je ne modifie que ce fichier)

- 🔴 Paiement en ligne masqué : plus aucun texte n'annonce la carte ou le Mobile Money en ligne (metas, accueil, pied de page, fiches, packs, CGV art. 5).
- 🔴 Pages CGV et Livraison en base : 0 occurrence de « lundi au samedi » ou « pas le dimanche » (requête B2).
- 🟠 Paiement à la livraison désactivé, ou heure limite modifiée, dans l'admin : mettre à jour `seo.json`, ou passer à `{hour}`.
- 🟠 Aucun pack public plus cher que ses produits achetés séparément, campagnes comprises.
