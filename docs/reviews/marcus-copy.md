# Relecture copy Waxo — messages EN vs FR

Relecteur : Marcus. Périmètre : `src/messages/{fr,en}/*.json`. Aucun fichier de messages ni de code modifié.

Notation des clés : `fichier › Namespace.clé`. `[nbsp]` = espace insécable (U+00A0), `[nnbsp]` = fine insécable (U+202F).
Priorité : **P1** = à corriger avant mise en ligne (erreur, incohérence de promesse, claim) ; **P2** = à corriger (naturel, cohérence) ; **P3** = confort.

Fichiers `assistant`, `consent`, `packs` (FR et EN) : contiennent `{}`. Rien à relire. À faire passer chez moi dès qu'ils seront remplis.

---

## 1. Constats d'ensemble

1. **Orthographe EN non unifiée (P1).** Britannique dans `shop/product/checkout` (« favourites », « Catalogue », « Neighbourhood », « E-mail ») et américaine dans `account` (« favorites », « catalog », « Neighborhood », « Email », « color », « October 8, 2026 »). Recommandation : **britannique partout** (Bénin entouré de Togo, Nigeria, Ghana ; « email » sans trait d'union). Termes à aligner : catalogue, favourites, neighbourhood, colour, programme, `8 October 2026`.
2. **Contradiction sur le livreur (P1).** Le brief, la FAQ et les CGV disent que le livreur appelle **avant** d'arriver. `Home.step3Text` dit « à l'arrivée / on arrival » (et la charte graphique reprend cette phrase).
3. **« Cash on delivery » faux (P1).** Le paiement à la livraison accepte aussi Mobile Money. Le FR dit juste « Paiement à la livraison ». L'EN dit « Cash on delivery » à deux endroits.
4. **Claims non couverts par le brief (P1).** Voir la section 4 pour Helena.
5. **Typographie FR (P2).** Aucun problème avant `? ! : ;` (toutes les espaces sont insécables, vérifié par recherche). Problème : les heures « 18 h », « 8 h à 19 h », « 48 à 72 h » ont une espace **normale** dans `shop`, `product` et `checkout` (retour à la ligne possible entre le nombre et « h »), alors que `account` utilise l'insécable. Détail section 3.
6. **Accord de genre (P2).** « Connecté », « redirigé », « il me conviendra » imposent un genre. Reformuler à la forme neutre.
7. **Calques du français dans l'EN (P2).** « Whole catalogue », « Real stock, in our hands », « Deals of the moment », « Browse by aisle », « No idea what to get? », « our next news ».
8. **Ton.** Cohérent et conforme à la charte (vouvoiement, phrases courtes). Deux endroits trop raides : « Veuillez patienter… » et les erreurs de champ écrites en fragments (« Numéro à 10 chiffres commençant par 01. »).

---

## 2. Corrections proposées, clé par clé

### 2.1 Cohérence EN (orthographe, vocabulaire)

| Clé | Actuel | Proposé | Pourquoi |
|---|---|---|---|
| `account.json › Info.meta.favoris` (EN) | My favorites | My favourites | P1. Orthographe unique (britannique). |
| `account.json › Favorites.eyebrow`, `.title`, `.deviceNote`, `.emptyTitle`, `.error`, `.loading` (EN) | favorites | favourites | Idem. |
| `account.json › Account.orders.seeCatalog`, `Favorites.cta`, `About.ctaCatalog` (EN) | Browse the catalog | Browse the catalogue | Idem (`shop.json` écrit « Catalogue »). |
| `account.json › Account.profile.addressPh` (EN) | Neighborhood and landmark | Neighbourhood and landmark | Idem (`checkout.json` écrit « Neighbourhood »). |
| `account.json › Account.profile.email`, `Auth.email`, `Contact.email` (EN) | Email | Email | Garder « Email » et aligner `shop.json › Newsletter.email/labelEmail/placeholderEmail/errEmail` qui écrivent « E-mail ». |
| `shop.json › Newsletter.email`, `.labelEmail`, `.placeholderEmail`, `.errEmail` (EN) | E-mail / E-mail address / Invalid e-mail address. | Email / Email address / Invalid email address. | P2. Voir ci-dessus. |
| `account.json › Legal.effective` (EN) | Effective October 8, 2026 | Effective 8 October 2026 | Format britannique. |
| `account.json › Legal.cgv.s3.p` (EN, « color ») | a slight difference in color or packaging | a slight difference in colour or packaging | Orthographe. |
| `shop.json › Shell.mobile.login` (EN) | Log in | Sign in | P2. Le reste du site (`Auth`, `Account`) dit « Sign in ». |

### 2.2 Promesses et exactitude

| Clé | Actuel | Proposé | Pourquoi |
|---|---|---|---|
| `shop.json › Home.step3Text` (FR) | Le livreur vous appelle à l'arrivée. Vous payez si ce n'est pas déjà fait. | Le livreur vous appelle avant d'arriver. Si vous n'avez pas encore payé, vous réglez à la réception. | P1. Contredit « avant d'arriver » (CGV, FAQ, brief). |
| `shop.json › Home.step3Text` (EN) | The courier calls you on arrival. You pay then if you have not already. | The courier calls you before arriving. If you have not paid yet, you pay on delivery. | P1. Même raison. « You pay then » est lourd. |
| `shop.json › Shell.topbar.cod` (EN) | Cash on delivery accepted | Pay on delivery accepted | P1. Mobile Money est accepté à la livraison. |
| `shop.json › Footer.paymentsCod` (EN) | ` · Cash on delivery` | ` · Pay on delivery` | P1. Idem. |
| `shop.json › Home.step2Text` (FR) | Un message WhatsApp dans l'heure avec le créneau de livraison. | Un message WhatsApp vous confirme le créneau de livraison. | P1 claim. « Dans l'heure » n'est pas dans les promesses validées. |
| `shop.json › Home.step2Text` (EN) | A WhatsApp message within the hour with your delivery slot. | A WhatsApp message confirms your delivery slot. | P1. Idem. |
| `shop.json › Card.stockOut` (FR) | Épuisé, bientôt de retour | Épuisé pour le moment | P1 claim. « Bientôt de retour » promet un réassort. |
| `shop.json › Card.stockOut` (EN) | Sold out, back soon | Sold out for now | P1. Idem. |
| `product.json › Product.comingSoonTitle` (FR) | Ce produit revient bientôt. | Ce produit est momentanément épuisé. | P1 claim. |
| `product.json › Product.comingSoonTitle` (EN) | This product will be back soon. | This product is out of stock for now. | P1. |
| `checkout.json › Thanks.pendingNote` (FR) | Un reçu vous est envoyé par WhatsApp dès qu'il est validé. | Vous recevez une confirmation dès que le paiement est validé. | P1 claim. Un « reçu par WhatsApp » n'est pas dans les promesses. Aligner sur l'e-mail « Paiement reçu ». |
| `checkout.json › Thanks.pendingNote` (EN) | Payment is being confirmed. A receipt is sent to you on WhatsApp as soon as it is approved. | Payment is being confirmed. You will receive a confirmation as soon as it is approved. | P1. Idem. |
| `checkout.json › Thanks.eta48` (FR/EN) | Livraison prévue sous 48 h. / Delivery expected within 48 h. | À vérifier avec F3 | P1. Seuls « demain » (Cotonou/Calavi) et « 48 à 72 h » (autres villes) existent ailleurs. Un délai « 48 h » seul n'a pas de source. |
| `shop.json › Home.guarantees` (FR) | Nos garanties | Nos engagements | P2. « Garantie » a un sens juridique (garantie légale) ; l'EN dit déjà « Our promises ». |

### 2.3 Naturel de l'anglais (faux amis, calques)

| Clé | Actuel (EN) | Proposé (EN) | Pourquoi |
|---|---|---|---|
| `shop.json › Home.g3Title` | Real stock, in our hands | Real stock, kept in Cotonou | P2. « In our hands » est un calque de « chez nous ». |
| `shop.json › Home.promosTitle` | Deals of the moment | Current deals | P2. Gallicisme (« du moment »). |
| `shop.json › Home.browse` | Browse by aisle | Shop by category | P2. « Aisle » = allée de supermarché. Idem pour « another aisle » dans `Catalog.emptyText` → « another category ». |
| `shop.json › Home.selSubPersonal` | Chosen from the products you have looked at and your cart. It changes with every visit. | Based on what you have viewed and what is in your cart. It changes on every visit. | P2. Plus fluide. |
| `shop.json › Home.selSub` | A starter selection. It adapts as soon as you look at a few products. | A first selection. It adapts as soon as you view a few products. | P3. |
| `shop.json › Shell.mega.all`, `Shell.mobile.all`, `Catalog.titleAll`, `Footer.all` | Whole catalogue | Full catalogue (ou « All products ») | P2. « Whole catalogue » est un calque de « tout le catalogue ». |
| `shop.json › Shell.nav.promos`, `Catalog.col.promos`, `Footer.promos` | Deals | Deals | OK. Rien à changer. |
| `shop.json › Catalog.col.nouveautes` | Our new products | New arrivals | P3. Cohérent avec la nav (« New arrivals »). |
| `shop.json › Catalog.budgets.*` | Under 3 000 F / 3 000 to 7 000 F / Over 7 000 F | Under 3,000 F / 3,000 to 7,000 F / Over 7,000 F | P2. En anglais, séparateur de milliers = virgule. À aligner avec le formatage des prix côté code. |
| `shop.json › Shell.topbar.freeShip` | Free delivery from {amount} | Free delivery on orders over {amount} | P2. « From » est ambigu ; même correction dans `account.json › Faq.a2`, `Legal.cgv.s6`, `Legal.shipping.r1f` (« free from {freeShip} of purchases » → « free on orders over {freeShip} »). |
| `shop.json › Newsletter.okTitle` | You are in. | You're on the list. | P3. Plus chaleureux et plus clair. |
| `shop.json › Newsletter.okText` | You will receive our next news. | You will hear from us when new products arrive. | P2. « News » est indénombrable : « our next news » est incorrect. |
| `shop.json › Newsletter.text` | Restocks, deals and useful ideas. | New stock, deals and useful ideas. | P3. « Arrivages » = nouveaux produits, pas seulement réassorts. |
| `shop.json › Shell.homeAria` | Wá xɔ, back to the home page | Wá xɔ, go to the home page | P3. Libellé d'un lien, pas d'une action de retour. |
| `shop.json › Shell.search.none` | No product matches. | No matching products. | P3. |
| `product.json › Product.missingText` | It may have been removed from the catalogue. Here is something to replace it. | It may have been removed from the catalogue. Here are some alternatives. | P2. |
| `product.json › Product.suggestAlternative` (FR) | Proposer une alternative | Me proposer une alternative | P2. Le FR est ambigu (qui propose à qui ?). EN : « Suggest an alternative » → « Find me an alternative ». |
| `product.json › Reviews.commentPlaceholder` (EN) | what you liked or liked less | what you liked or did not like | P2. « Liked less » est un calque de « moins aimé ». |
| `checkout.json › Cart.emptyText` (EN) | No idea what to get? | Not sure what to get? | P2. Calque de « Pas d'idée ? ». |
| `checkout.json › Cart.upsellTitle` | À petit prix, à ajouter / Small extras to add | Petits articles à ajouter / A little extra? | P3. Le FR est bancal (rythme). |
| `checkout.json › Checkout.terms` (EN) | our terms and conditions of sale | our terms of sale | P2. Le pied de page dit « Terms of sale ». |
| `checkout.json › Checkout.confirmCod` (EN) | Confirm order · {total} | Confirm your order · {total} | P3. |
| `checkout.json › Thanks.line` (EN) | a WhatsApp message at +229 {phone} | a WhatsApp message on +229 {phone} | P3. |
| `checkout.json › Checkout.momoHelp` (EN) | Never share your secret code. | Never share your PIN. | P2. « PIN » est le mot courant. Même correction : `Faq.a3`, `Legal.cgu.s5` (« Mobile Money code » → « Mobile Money PIN »), `Legal.cgv.s5`, `Legal.privacy.s2` (« secret codes »). |
| `account.json › Faq.a1` (EN) | you are delivered the next day | your order arrives the next day | P2. « You are delivered » est maladroit. |
| `account.json › Faq.a5` (EN) | your customer area | your account | P3. |
| `account.json › Legal.shipping.colDelay` (EN) | Lead time | Delivery time | P2. « Lead time » est du jargon logistique B2B. |
| `account.json › Account.menu.admin`, `Account.page.admin` (EN) | Open the back office | Open admin | P3. |

### 2.4 Français

| Clé | Actuel (FR) | Proposé (FR) | Pourquoi |
|---|---|---|---|
| `common.json › Brand.tagline`, `shop.json › Shell.tagline`, `Footer.tagline` | Shopper depuis chez vous | Les petites choses utiles, livrées demain | P2. « Shopper » est un anglicisme familier, et la baseline actuelle ne dit pas la promesse de marque. Si la promesse reste dans le héro, alternative courte : « Faites vos achats depuis chez vous ». EN : « Small useful things, delivered tomorrow ». |
| `checkout.json › Cart.maxStock`, `product.json › Product.maxStock` | Stock maximum atteint : {count} disponible(s). | Il ne nous en reste que {count} en stock. | P2. « disponible(s) » est un pluriel facultatif visible. `shop.json › Shell.toast.maxStock` utilise déjà un vrai pluriel ICU : harmoniser. |
| `checkout.json › Checkout.loggedAs` | Connecté en tant que {name}. Vos informations sont préremplies. | Compte : {name}. Vos informations sont préremplies. | P2. Évite « connecté / connectée ». |
| `account.json › Account.page.recoveryNote` | Vous êtes connecté grâce au lien reçu par e-mail. | Le lien reçu par e-mail vous a ouvert votre compte. | P2. Même raison. |
| `checkout.json › Checkout.cardNote` | Vous serez redirigé vers la page sécurisée… | Nous vous redirigeons vers la page sécurisée de notre prestataire de paiement pour saisir votre carte. | P2. Évite « redirigé / redirigée ». |
| `product.json › Product.assistantQuestion` | est-ce qu'il me conviendra ? | est-ce que ce produit me conviendra ? | P2. « Il » est faux pour « la gourde ». |
| `product.json › Product.comingSoonText` | Laissez votre contact dans le formulaire de contact ou demandez… | Écrivez-nous, ou demandez une alternative à l'assistant. | P2. Répétition « contact ». EN : « Write to us, or ask the assistant for an alternative. » |
| `shop.json › Card.tagBest`, `product.json › Product.tagBest` | Best-seller | Plus vendu | P3. Cohérent avec la nav « Les plus vendus ». |
| `shop.json › Card.rank` | Numéro {n} des plus vendus | N° {n} des plus vendus | P3. |
| `shop.json › Home.heroEyebrow` | Stock à Cotonou · Expédié par nous | En stock à Cotonou · Emballé par nous | P2. « Expédié » évoque un envoi postal ; « Emballé par nous » reprend « on emballe » du paragraphe. EN : « Stock in Cotonou · Packed by us ». |
| `account.json › Auth.submitting` | Veuillez patienter… | Un instant… | P3. Moins administratif. EN « Please wait… » → « One moment… ». |
| `account.json › Account.menu.admin`, `Account.page.admin` | Ouvrir le back office | Ouvrir l'administration | P3. Anglicisme. |
| `account.json › Legal.effective` | En vigueur au 8 octobre 2026 | En vigueur depuis le 8 octobre 2026 | P3. |
| `account.json › About.photo` (FR/EN) | Photo de l'équipe ou du stock à ajouter | (à retirer avant production) | P1. Texte provisoire visible. À remplacer par la vraie photo. |

---

## 3. Typographie FR : espaces insécables

Constat : devant `? ! : ;` et dans « 3 000 F », tout est correct. Les espaces **normales** suivantes sont à remplacer par `[nbsp]` (U+00A0) :

| Clé | Actuel | Proposé |
|---|---|---|
| `shop.json › Home.g1Sub` | commande avant {hour} h | commande avant {hour}`[nbsp]`h |
| `shop.json › Footer.hours` | de 8 h à 19 h | de 8`[nbsp]`h à 19`[nbsp]`h |
| `product.json › Product.stockLow`, `.stockOk` | avant {cutoff} h | avant {cutoff}`[nbsp]`h |
| `product.json › Product.deliveryNote` | avant {cutoff} h | avant {cutoff}`[nbsp]`h |
| `checkout.json › Checkout.zoneCotonouSub` | entre 9 h et 19 h (commande avant {cutoff} h) | entre 9`[nbsp]`h et 19`[nbsp]`h (commande avant {cutoff}`[nbsp]`h) |
| `checkout.json › Checkout.zoneAutreSub` | Sous 48 à 72 h | Sous 48 à 72`[nbsp]`h |
| `checkout.json › Thanks.eta48`, `.etaOther` | sous 48 h / sous 48 à 72 h | sous 48`[nbsp]`h / sous 48 à 72`[nbsp]`h |
| `checkout.json › Thanks.line`, `Checkout.deliverTo` | +229 {phone} | +229`[nbsp]`{phone} (évite de couper le numéro) |
| `checkout.json › Cart.shipRemaining`, `Cart.shipFree` | (montant formaté par le code) | Vérifier que `{amount}` / `{total}` contient `[nbsp]` entre le nombre et « F » |

Le fichier `account.json` (FR) a déjà des insécables pour « {cutoff} h » et « 8 h à 19 h » : s'en servir comme référence.

Autres points typographiques :
- Guillemets FR « … » avec insécables : corrects (`titleQuery`, `assistantQuestion`, `Reviews.policy`).
- EN : guillemets “…” corrects. Pas d'espace avant `? ! : ;` en anglais (vérifié, conforme).
- Pluriels FR `one {# avis} other {# avis}` : valides (en français, `one` couvre 0 et 1).
- `Card.rating`, `Home.rating` : vérifier côté code que la note s'affiche « 4,8 » en FR et « 4.8 » en EN.

---

## 4. Claims à faire valider par Helena

Ces textes affirment plus que les promesses validées (livraison demain à Cotonou et Calavi avant l'heure limite, paiements listés, livreur appelle avant d'arriver, 7 jours, confirmation WhatsApp).

| Clé | Texte | Risque |
|---|---|---|
| `Home.step2Text` | « dans l'heure » | Délai de réponse promis. |
| `Card.stockOut`, `Product.comingSoonTitle` | « bientôt de retour / revient bientôt » | Réassort promis. |
| `Checkout.zoneCotonouSub` | « entre 9 h et 19 h » | Plage horaire promise. |
| `Checkout.zoneAutreSub`, `Thanks.etaOther`, `Faq.a1` | « 48 à 72 h » | Délai hors Cotonou. |
| `Thanks.eta48` | « sous 48 h » | Source inconnue. |
| `Thanks.pendingNote` | « reçu par WhatsApp » | Document promis. |
| `Account.orders.cancelled` | remboursement « sur le moyen de paiement utilisé » | Engagement de remboursement (repris dans l'e-mail FR-6 / EN-6, marqué à valider). |
| `Home.g3Sub`, `Faq.a7`, `About.c1p` | « Ce que vous voyez est disponible », « mis à jour à chaque commande » | Garantie de stock exact. |
| `Home.guarantees` | « Nos garanties » | Sens juridique. |
| `Legal.cgv.s4` | confirmation « par WhatsApp ou SMS » | SMS non mentionné ailleurs. |
| `Legal.cgv.s8` | défaut signalé « sous 48 h », retour pris en charge | Engagement distinct des 7 jours. |

---

## 5. Cinq améliorations de micro-copy à fort impact conversion

### 1. Héro : dire d'où et quand dès la première lecture
Problème : « livrées demain » ne précise ni le lieu ni l'heure limite ; le visiteur d'Abomey ou de Porto-Novo peut s'y croire éligible.
- Clé `shop.json › Home.lead`
  - FR actuel : Des objets du quotidien choisis pour leur utilité et leur prix. Vous commandez, on emballe, on livre.
  - FR proposé : Des objets du quotidien choisis pour leur utilité et leur prix. Commandez avant {hour}`[nbsp]`h : livraison demain à Cotonou et Calavi.
  - EN proposé : Everyday items picked for their usefulness and their price. Order before {hour}:00 for delivery tomorrow in Cotonou and Calavi.
- Clé `Home.seeProducts` : FR « Voir les {count} produits en stock » / EN « Browse the {count} products in stock ».
- Clé `Home.heroEyebrow` : voir 2.4.
- Note dev : passer `{hour}` à `lead` (déjà disponible pour `g1Sub`).
- À tester : lead avec heure limite contre lead actuel (clic sur le CTA héro).

### 2. Bouton de commande : montant dans le bouton + réassurance juste dessous
Problème : « Commander » seul, dans le panier, ne montre pas le montant ni ce qui rassure (pas de compte, paiement à la livraison, 7 jours).
- Clé `checkout.json › Cart.checkout`
  - FR actuel : Commander → proposé : Commander · {total}
  - EN actuel : Checkout → proposé : Order · {total}
  - Note dev : ajouter la variable `{total}` (le sous-total est déjà affiché plus haut).
- Clé `Checkout.confirmCod` FR : Confirmer ma commande · {total} (première personne : le client « fait » l'action).
- Nouvelle ligne sous le bouton (nouvelle clé, ex. `Cart.reassure`)
  - FR : Sans compte. {days} jours pour changer d'avis.
  - EN : No account needed. {days} days to change your mind.
  - Si le paiement à la livraison est actif, ajouter : « Vous pouvez payer à la réception. » / « You can pay on delivery. »
- À tester : « Commander · {total} » contre « Commander ».

### 3. Messages d'erreur : dire quoi faire, avec un exemple
Problème : les erreurs de champ sont des fragments (« Numéro à 10 chiffres commençant par 01. ») et les erreurs réseau ne rassurent pas.

| Clé | Actuel | Proposé FR | Proposé EN |
|---|---|---|---|
| `Checkout.errPhone` | Numéro à 10 chiffres commençant par 01. | Entrez un numéro à 10 chiffres qui commence par 01, par exemple 01 97 00 00 00. | Enter a 10-digit number starting with 01, for example 01 97 00 00 00. |
| `Checkout.errMomo` | Numéro Mobile Money à 10 chiffres commençant par 01. | Entrez le numéro Mobile Money à 10 chiffres (01…) qui recevra la demande de validation. | Enter the 10-digit Mobile Money number (01…) that will receive the approval request. |
| `Newsletter.errEmail` | Adresse e-mail invalide. | Cette adresse e-mail semble incomplète. Exemple : afi@exemple.com | This email address looks incomplete. Example: afi@example.com |
| `Checkout.errNetwork` | Connexion impossible. Vérifiez votre réseau et réessayez. | Pas de connexion pour le moment. Vérifiez votre réseau, puis réessayez. Votre panier est conservé. | No connection right now. Check your network, then try again. Your cart is saved. |
| `Checkout.errGeneric` | Une erreur est survenue. Réessayez dans quelques instants. | Un problème est survenu de notre côté. Réessayez dans un instant. Si cela continue, écrivez-nous sur WhatsApp. | Something went wrong on our side. Try again in a moment. If it keeps happening, write to us on WhatsApp. |

Réserve : « Votre panier est conservé » est vrai si le panier reste bien dans le stockage de l'appareil (la politique de confidentialité l'indique) ; F3 vérifie le comportement réel avant d'écrire la phrase.

### 4. Rupture de stock : ne pas laisser un cul-de-sac
Problème : « Épuisé » seul arrête l'achat. Le texte actuel promet un retour (claim) et renvoie vers un « formulaire de contact » sans le nommer. Objectif : retenir l'intention d'achat vers un produit en stock.

| Clé | Proposé FR | Proposé EN |
|---|---|---|
| `Card.stockOut` | Épuisé pour le moment | Sold out for now |
| `Product.stockOut` | Épuisé pour le moment. L'assistant peut vous proposer un produit proche. | Sold out for now. The assistant can suggest a similar product. |
| `Product.comingSoonTitle` | Ce produit est momentanément épuisé. | This product is out of stock for now. |
| `Product.comingSoonText` | Écrivez-nous, ou demandez une alternative à l'assistant. | Write to us, or ask the assistant for an alternative. |
| `Product.suggestAlternative` (bouton) | Voir un produit équivalent en stock | Show me an in-stock alternative |
| `Shell.toast.soldOut` | Ce produit est épuisé pour le moment. L'assistant peut vous proposer un équivalent. | This product is sold out for now. The assistant can suggest an equivalent. |
| `Shell.toast.maxStock` / `Cart.maxStock` | one : Il ne nous en reste qu'un en stock. other : Il ne nous en reste que # en stock. | one : We have only one left in stock. other : We have only # left in stock. |

À tester : bouton « Voir un produit équivalent en stock » contre « Proposer une alternative » (taux de clic, puis ajout au panier).

### 5. Page de remerciement : dire la suite en une phrase
Problème : `Thanks.line` mêle récapitulatif et prochaines étapes. Le client ne sait pas qu'il sera appelé, donc écrit sur WhatsApp pour demander « où est ma commande ? ».
- Clé `checkout.json › Thanks.line`
  - FR actuel : Commande <b>{number}</b> · {total} · {pay}. Vous recevez un message WhatsApp au +229 {phone} pour confirmer le créneau. {eta}
  - FR proposé : Commande <b>{number}</b> · {total} · {pay}. Nous vous écrivons sur WhatsApp au +229`[nbsp]`{phone} pour confirmer le créneau, puis le livreur vous appelle avant d'arriver. {eta}
  - EN proposé : Order <b>{number}</b> · {total} · {pay}. We will message you on WhatsApp on +229 {phone} to confirm the delivery slot, then the courier calls you before arriving. {eta}
- Effet attendu : moins de messages « où en est ma commande ? », attente mieux cadrée, cohérence avec les e-mails de `docs/copy/emails.md`.
- À tester : mesurer le volume de messages WhatsApp « suivi » avant/après.

---

## 6. Pour la suite

- Après correction des messages, relancer une recherche de `Cash on delivery`, `à l'arrivée`, `dans l'heure`, `bientôt` dans les deux langues.
- Les gabarits d'e-mails (`docs/copy/emails.md`) suivent déjà ces corrections : « Pay on delivery », « avant d'arriver », « PIN », orthographe britannique, 7 jours en dur.
