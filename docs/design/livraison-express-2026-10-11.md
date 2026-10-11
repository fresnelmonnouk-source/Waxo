# Livraison Express : direction artistique (2026-10-11)

Auteur : Vincent (DA). Statut : proposition à valider par Fresnel avant exécution (Mia pour l'UI, Léo pour l'OG et l'e-mail).
Périmètre : direction seulement, aucun code modifié.

---

## 0. Analyse : ce que ces informations disent vraiment

Fresnel demande de ne pas « simplement placer » les infos. Voici ce que j'en tire.

1. **Le vrai levier n'est pas le mot « Express », c'est l'heure : 20 h.** « Express » est un mot que tout le monde utilise. « Avant 20 h, livré le jour même », personne d'autre ne le dit à Cotonou. 20 h est tard (l'ancienne règle disait 18 h) : on peut commander en rentrant du travail. **L'heure devient le signe distinctif de la marque** : le picto est une horloge qui marque 20 h, et « 20 h » devient un chiffre-signature typographique (OG, garanties).
2. **Le dimanche est une preuve, pas un détail.** « 7 j/7, dimanche compris » rassure à l'endroit exact où l'acheteur béninois doute (« ils livrent le dimanche ? »). On le dit en clair, et on le dit au bon moment (samedi soir : « livré demain, dimanche »).
3. **La promesse change selon l'heure : le texte doit changer aussi.** Une promesse fixe « le jour même » est fausse à 21 h. Une phrase qui suit l'horloge (« livré aujourd'hui » / « livré demain ») est **vraie à toute heure** et convertit mieux qu'un slogan, parce qu'elle répond à la question de l'acheteur : « si je commande maintenant, je l'ai quand ? ».
4. **Le slogan « Vos commandes livrées dans les meilleurs délais » est faible seul.** En français, « dans les meilleurs délais » est une formule administrative qui sous-entend souvent « on ne sait pas quand ». Il ne doit **jamais apparaître sans sa preuve** (« le jour même avant 20 h »). Il sert de **baseline de marque** (signature institutionnelle), la règle des 20 h sert de **preuve**. Le slogan va là où l'on parle de la marque (OG, e-mails, pied de page), pas là où l'on décide un achat.
5. **Paiement à la livraison = le délai part de la confirmation WhatsApp.** C'est une vraie friction : il faut l'annoncer AVANT (au choix du paiement), pas après. Bien formulé, cela devient une preuve de sérieux (« un vrai humain vous confirme »).
6. **Tous les produits sont Express à Cotonou.** Donc un badge Express sur chaque fiche ou chaque carte produit n'apporte aucune information : c'est du bruit. La signature se mérite : elle apparaît là où l'on PROMET, pas partout.

**Big Idea visuelle : « 20 h ». La livraison Waxo se raconte par une heure, pas par un éclair.**

---

## 1. Règles de vérité (non négociables)

- « le jour même » / « aujourd'hui » : TOUJOURS accompagné de « avant 20 h » ET de « Cotonou & Calavi » (dans la même phrase ou le même composant).
- Jamais « en 1 h », « en quelques heures », « immédiat », « instantané ».
- Autres villes : « 48 à 72 h », jamais « Express ».
- Prix : « 1 000 F », « offerte dès 15 000 F ». Aucune autre réduction de livraison, aucun prix barré de livraison.
- Paiement à la livraison : « le délai part de la confirmation WhatsApp » doit être visible au tunnel.
- Heure de référence : fuseau **Africa/Porto-Novo** (UTC+1). « Avant 20 h » = jusqu'à 19 h 59.
- Typo FR : espace insécable avant « : ; ! ? », `20&nbsp;h`, `7&nbsp;j/7`, `15&nbsp;000&nbsp;F`, `48 à 72&nbsp;h`, `24&nbsp;h/24`. Pas de tiret cadratin : utiliser le point médian « · », la virgule ou le point.
- À corriger partout (Kody, recherche globale) : l'ancien texte « Dès le lendemain à Cotonou & Calavi si vous commandez avant 18 h, du lundi au samedi » est désormais FAUX, ainsi que « Livraison rapide ».

---

## 2. La signature « Express » (composant réutilisable)

### 2.1 Picto « Horloge 20 h »

Horloge dont les aiguilles marquent 8 h (donc 20 h), avec trois traits de vitesse à gauche. Même grammaire que les icônes de la maquette : viewBox 24, trait 2, extrémités arrondies, pas de remplissage. Pas d'éclair (cliché « startup ») ni de sablier (cliché « gain de temps »).

```html
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="14" cy="12" r="7"/>
  <path d="M14 8v4l-3 1.75"/>
  <path d="M2 9h3M1 12h3M2 15h3"/>
</svg>
```

- Taille minimale : 14 px. En dessous, ne pas l'utiliser (texte seul).
- Couleur : `currentColor`, piloté par la variante (voir 2.3).
- Toujours `aria-hidden="true"` : le sens est porté par le texte.
- Aucune animation (pas de rotation d'aiguilles, pas de clignotement d'urgence). L'urgence vient du texte, pas du mouvement.

### 2.2 Badge

Pilule, typo de titre de la marque (Unbounded) pour le distinguer des badges promo (Onest, terracotta) et des étiquettes d'eyebrow (Onest capitales).

| Propriété | S | M | L (OG uniquement) |
|---|---|---|---|
| Hauteur | 24 px | 28 px | 56 px |
| Padding | 0 10px 0 7px | 0 12px 0 9px | 0 26px 0 20px |
| Picto | 14 px | 16 px | 30 px |
| Gap picto/texte | 5 px | 6 px | 12 px |
| Police | Unbounded 600, 11 px | Unbounded 600, 12 px | Unbounded 600, 26 px |
| Interlettrage | 0.01em | 0.01em | 0 |

Commun : `display:inline-flex; align-items:center; border-radius:999px; line-height:1; white-space:nowrap;` Casse normale (pas de capitales).

Texte du badge : **FR « Express » · EN « Express »**. Le mot « Livraison » est porté par le contexte autour (jamais « Livraison Express » dans la pilule, trop long).

### 2.3 Variantes de couleur

| Variante | Usage | Fond | Texte | Picto | Contraste texte |
|---|---|---|---|---|---|
| `sur-clair` | fonds crème #F4F1EA ou blancs #FFFFFF | #141210 | #F4F1EA | #FFC93C | ≈ 17:1 |
| `sur-sombre` | fonds encre #141210 (héro, OG) | #F4F1EA | #141210 | #C2410C | ≈ 17:1 (picto ≈ 4,5:1, seuil non-texte 3:1) |
| `inline` | topbar, titres de cartes, lignes de texte | aucun | hérite | #FFC93C sur encre, #C2410C sur clair | hérite |

Pourquoi ces couleurs : le jaune #FFC93C en FOND est réservé à l'assistant IA et aux CTA secondaires, le terracotta profond #C2410C en FOND aux promos et erreurs, le vert #1F6B4A au stock et à la validation. La signature Express prend donc **l'inversion encre/crème** (les deux couleurs fondatrices), avec le jaune ou le terracotta uniquement en accent sur le picto. Aucune collision de sens avec le système existant.

### 2.4 Où NE PAS mettre la signature

- Cartes produit du catalogue, listes, carrousels « promos du moment » : tous les produits sont Express, le badge n'informe pas.
- À côté ou par-dessus un badge promo (-19 %) : deux pilules qui se battent.
- Header principal, navigation, bouton panier, bouton assistant.
- Zone « Autres villes du Bénin » (ce n'est pas Express).
- Pages légales, FAQ (texte seul).
- Règle d'or : **une seule signature visible par écran** (un badge OU un picto inline, pas les deux dans le même viewport, sauf topbar + badge héro qui sont séparés par le header).

---

## 3. Moteur de texte « selon l'heure »

Une seule source de vérité (module pur, réutilisé partout) qui renvoie l'état selon l'heure Africa/Porto-Novo.

| État | Quand | FR | EN |
|---|---|---|---|
| `jour` | 00 h 00 à 19 h 59 | Commandez avant 20&nbsp;h, livré aujourd'hui | Order before 8&nbsp;pm, delivered today |
| `soir` | 20 h 00 à 23 h 59, sauf samedi | Commandez maintenant, livré demain | Order now, delivered tomorrow |
| `samedi-soir` | samedi 20 h 00 à 23 h 59 | Commandez maintenant, livré demain dimanche | Order now, delivered tomorrow, Sunday |
| `neutre` (rendu serveur, avant hydratation) | toujours au SSR/ISR | Le jour même si vous commandez avant 20&nbsp;h | Same day if you order before 8&nbsp;pm |

- Le texte `neutre` est rendu côté serveur (pages statiques/ISR), puis remplacé côté client après montage : pas d'écart d'hydratation, et une phrase vraie même sans JavaScript.
- Pas de compte à rebours à la minute (bruit visuel, et faux pour le paiement à la livraison confirmé plus tard).
- Ces phrases ne valent que pour Cotonou & Calavi : chaque surface ajoute la zone.

---

## 4. Accueil

### 4.1 Topbar (fond #141210)

Actuel : « Livraison rapide à Cotonou & Calavi · Livraison offerte dès 15 000 F · Paiement à la livraison accepté ».

**Desktop (3 messages, ordre inchangé)**

| # | FR | EN | Forme |
|---|---|---|---|
| 1 | [picto] **Livraison Express**&nbsp;: le jour même avant 20&nbsp;h à Cotonou & Calavi | [icon] **Express Delivery**: same day before 8&nbsp;pm in Cotonou & Calavi | variante `inline` : picto 14 px #FFC93C, « Livraison Express » Onest 600 #F4F1EA, reste Onest 400 #F4F1EA |
| 2 | Livraison offerte dès **15&nbsp;000&nbsp;F** | Free delivery from **15,000&nbsp;F** | seul « 15 000 F » en #FFC93C 600 (aujourd'hui toute la phrase est jaune : on concentre l'accent sur le chiffre) |
| 3 | Payez à la réception | Pay on delivery | #F4F1EA 400 |

Taille : 13 px Onest, comme aujourd'hui. Le picto est le SEUL picto de la topbar.

**Mobile (< 640 px)** : un seul message, le n° 1 en version courte : « [picto] **Express**&nbsp;: livré aujourd'hui avant 20&nbsp;h, Cotonou & Calavi » / EN « [icon] **Express**: delivered today before 8&nbsp;pm, Cotonou & Calavi ». Après 20 h, la topbar suit le moteur (état `soir`) : « [picto] **Express**&nbsp;: commandez maintenant, livré demain ». Pas de carrousel défilant automatique (accessibilité, et 3 messages qui tournent ne se lisent pas).

Pourquoi : la topbar est vue sur chaque page ; c'est l'endroit où la règle des 20 h s'installe dans la tête du client par répétition, sans badge.

### 4.2 Héro (fond #141210)

- **Titre** : inchangé (« Les petites choses utiles, livrées vite chez vous. »). Il promet déjà la vitesse ; la ligne Express en apporte la preuve.
- **Sur-titre** : « STOCK À COTONOU · EXPÉDIÉ PAR NOUS » devient **« STOCK À COTONOU · LIVRÉ PAR NOUS 7&nbsp;J/7 »** / EN **« STOCKED IN COTONOU · DELIVERED BY US 7 DAYS A WEEK »**. Style actuel conservé (Onest 600, 13 px, capitales, interlettrage 0.08em, #E2552B). « Livré » est plus vrai qu'« expédié » (vous ne passez pas par un transporteur) et « 7 j/7 » introduit le dimanche dès la première ligne.
- **Ligne de preuve (nouvelle)**, entre le paragraphe et la carte assistant, marge haute 20 px, marge basse 28 px :
  - Badge M `sur-sombre` « Express » + texte Onest 500, 15 px, #F4F1EA, gap 12 px.
  - FR : [badge] « Commandé avant 20&nbsp;h, livré le jour même à Cotonou & Calavi. Dimanche compris. »
  - EN : [badge] « Ordered before 8&nbsp;pm, delivered the same day in Cotonou & Calavi. Sundays too. »
  - Après 20 h (moteur, état `soir`) : « Commandez maintenant, livré demain à Cotonou & Calavi. Dimanche compris. »
  - Mobile : badge sur sa propre ligne au-dessus du texte si le texte dépasse 2 lignes.
- **Paragraphe** : retirer « Vous commandez, on emballe, on livre. » (doublon avec la carte « Shopper depuis chez vous » et la ligne de preuve). Garder : « Des objets du quotidien choisis pour leur utilité et leur prix. Vous payez par Mobile Money, par carte ou à la réception. »
- **Slogan** : pas dans le héro (le titre fait déjà ce travail ; deux promesses de vitesse empilées = surcharge).

Pourquoi ça convertit : le titre crée le désir (« vite »), la ligne de preuve le rend crédible et datable (« avant 20 h », « dimanche »), au-dessus de la ligne de flottaison, à côté de l'action.

### 4.3 Bloc « Nos garanties » (fond #141210, 4 colonnes)

On NE met PAS d'icônes dans les 4 cartes (la grille « icône dans un cercle + titre + 2 lignes » est le motif IA le plus reconnaissable). La hiérarchie vient de la typographie : la carte Livraison reçoit le chiffre-signature.

| Carte | Titre FR / EN | Texte FR | Texte EN |
|---|---|---|---|
| 1 | Shopper depuis chez vous / Shop from home | Vous commandez, on emballe, on livre. | You order, we pack, we deliver. |
| 2 | Payez à la réception / Pay on delivery | Ou MTN MoMo, Moov Money, Celtiis Cash, carte. | Or MTN MoMo, Moov Money, Celtiis Cash, card. |
| 3 | **Livraison Express** / **Express Delivery** | Commandé avant 20&nbsp;h, livré le jour même à Cotonou & Calavi. 7&nbsp;j/7, dimanche compris. Autres villes&nbsp;: 48 à 72&nbsp;h. | Ordered before 8&nbsp;pm, delivered the same day in Cotonou & Calavi. 7 days a week, Sundays too. Other cities: 48 to 72&nbsp;h. |
| 4 | Assistant en ligne 24&nbsp;h/24 / Online assistant 24/7 | inchangé | inchangé |

Carte 3, traitement spécifique :
- Titre en variante `inline` : picto 16 px #FFC93C devant « Livraison Express » (Onest 600, 16 px, #F4F1EA). C'est le seul picto du bloc.
- Chiffre-signature : **« 20&nbsp;h »** placé à DROITE du titre de la carte 3, sur la même ligne de base (Unbounded 600, 20 px, #FFC93C). Les titres des 4 cartes restent alignés et une seule carte porte l'accent. (Écarté : un grand chiffre au-dessus du titre, qui obligerait à décorer les 3 autres cartes pour garder l'alignement.)
- Texte : Onest 400, 14 px, #F4F1EA à 72 %, comme aujourd'hui.
- Tarif : NE PAS le mettre dans cette carte (déjà dans la topbar, et il revient au tunnel). Moins, mais mieux.

Pourquoi : c'est la seule des 4 garanties qui est un différenciateur mesurable. Le « 20 h » jaune se mémorise ; le reste reste calme.

---

## 5. Fiche produit (fond crème)

### 5.1 Ligne de stock (sous le prix)

Actuel : « En stock. Commandez maintenant, livraison express à Cotonou. »

- Pastille ronde 8 px #1F6B4A + « En stock. » Onest 600 14 px #1F6B4A, suivi du texte moteur en Onest 400 14 px #4A443C :
  - `jour` FR : « En stock. Commandez avant 20&nbsp;h, livré aujourd'hui à Cotonou & Calavi. »
  - `jour` EN : « In stock. Order before 8&nbsp;pm, delivered today in Cotonou & Calavi. »
  - `soir` FR : « En stock. Commandez maintenant, livré demain à Cotonou & Calavi. »
  - `soir` EN : « In stock. Order now, delivered tomorrow in Cotonou & Calavi. »
  - `samedi-soir` : « …livré demain dimanche à Cotonou & Calavi. » / « …delivered tomorrow, Sunday, in Cotonou & Calavi. »
  - `neutre` (SSR) : « En stock. Livré le jour même à Cotonou & Calavi si vous commandez avant 20&nbsp;h. »
- Pas de badge ici : le vert dit « disponible », le texte dit « quand ». Un badge en plus = trois signaux sur deux lignes.
- Rupture de stock : aucune promesse de délai (texte stock actuel seul).

### 5.2 Note de livraison sous le bouton « Ajouter au panier »

Bloc unique, fond #FFFFFF, bordure 1 px #E2DCCF, rayon 12 px (`--radius-field`), padding 14px 16px, deux lignes :

- Ligne 1 : badge S `sur-clair` « Express » + « Cotonou & Calavi · 1&nbsp;000&nbsp;F, offerte dès 15&nbsp;000&nbsp;F » (Onest 500, 14 px, #141210).
  EN : [badge] « Cotonou & Calavi · 1,000&nbsp;F, free from 15,000&nbsp;F »
- Ligne 2 : « Autres villes du Bénin&nbsp;: 48 à 72&nbsp;h. Paiement à la réception possible. » (Onest 400, 13 px, #6B645A).
  EN : « Other cities in Benin: 48 to 72&nbsp;h. Pay on delivery available. »
- C'est **le seul badge Express de la fiche produit.**

Pourquoi : juste après le geste d'achat, on lève les trois dernières objections (combien, quand, et si je ne suis pas à Cotonou) sans détourner l'œil du bouton.

### 5.3 Recommandé, hors périmètre immédiat : panier

Barre de progression livraison offerte : « Plus que 3&nbsp;500&nbsp;F pour la livraison offerte. » / « 3,500&nbsp;F more for free delivery. » Trait 4 px, fond #E2DCCF, remplissage #1F6B4A ; à 15 000 F atteint : « Livraison offerte. » en #1F6B4A. Pas de badge Express dans le panier.

---

## 6. Tunnel de commande

### 6.1 Choix de la zone (deux cartes radio, empilées sur mobile, côte à côte ≥ 768 px)

Carte : fond #FFFFFF, bordure 1 px #E2DCCF, rayon 20 px (`--radius-card`), padding 18px 20px. Sélectionnée : bordure 2 px #141210 (pas de couleur vive : la sélection est un état, pas une promo).

**Carte A, Cotonou & Calavi**
- Ligne titre : « Cotonou & Calavi » (Onest 600, 16 px, #141210) + badge S `sur-clair` « Express » aligné à droite du titre.
- Délai (Onest 400, 14 px, #4A443C) : « Le jour même si vous commandez avant 20&nbsp;h, sinon le lendemain. 7&nbsp;j/7. »
  EN : « Same day if you order before 8&nbsp;pm, otherwise the next day. 7 days a week. »
- Prix (à droite, Onest 600, 15 px) : « 1&nbsp;000&nbsp;F » #141210, ou « Offerte » #1F6B4A si sous-total ≥ 15 000 F (pas de prix barré).

**Carte B, Autres villes du Bénin**
- Titre : « Autres villes du Bénin » / « Other cities in Benin ». **Pas de badge.**
- Délai : « 48 à 72&nbsp;h après confirmation de la commande. » / « 48 to 72&nbsp;h after order confirmation. »
- Prix : même règle que A (à confirmer par Fresnel : le tarif 1 000 F s'applique-t-il bien aux autres villes ?).

**Ligne d'estimation** sous les deux cartes (Onest 500, 14 px, #141210, picto horloge 16 px #C2410C en `inline`) :
- A + état `jour` : « Livraison prévue&nbsp;: aujourd'hui. » / « Estimated delivery: today. »
- A + `soir` : « Livraison prévue&nbsp;: demain. » ; samedi soir : « demain, dimanche. »
- B : « Livraison prévue&nbsp;: entre le mardi 14 et le jeudi 16 octobre. » (dates réelles calculées, J+2 à J+3) / « Estimated delivery: between Tuesday 14 and Thursday 16 October. »

### 6.2 Note paiement à la réception (affichée quand ce mode est choisi)

Encadré fond #E5EFE7, texte #141210, rayon 12 px, padding 12px 14px, Onest 400 14 px, sans picto :
- FR : « Paiement à la réception&nbsp;: nous vous confirmons la commande sur WhatsApp. Le délai de livraison démarre à cette confirmation. »
- EN : « Pay on delivery: we confirm your order on WhatsApp. The delivery time starts from that confirmation. »

Pourquoi le vert d'arrière-plan : c'est une information de confiance (un humain confirme), pas un avertissement. Surtout pas de rouge ni de jaune.

### 6.3 Confirmation

- Titre (Unbounded 600, 28 px) : « Commande reçue. » / « Order received. »
- Bloc estimation : fond #141210, rayon 20 px, padding 20px 24px, badge M `sur-sombre` « Express » (zone A uniquement) puis :
  - Paiement en ligne, zone A, commande avant 20 h : « Livraison prévue aujourd'hui à Cotonou & Calavi. » (Unbounded 600, 20 px, #F4F1EA)
  - Paiement en ligne, zone A, après 20 h : « Livraison prévue demain. » (« demain, dimanche » le samedi soir)
  - Paiement à la réception, zone A : « Livrée le jour de votre confirmation WhatsApp si elle a lieu avant 20&nbsp;h, sinon le lendemain. » + sous-ligne Onest 14 px #F4F1EA 72 % : « Gardez votre téléphone à portée de main. »
  - Zone B : pas de badge, « Livraison prévue entre le [date] et le [date]. »
- L'estimation est calculée et **stockée au moment de la commande** (ou de la confirmation WhatsApp pour le paiement à la réception), pour que la page, l'e-mail et le suivi disent la même chose.
- EN correspondants : « Delivery expected today in Cotonou & Calavi. » · « Delivery expected tomorrow. » · « Delivered on the day of your WhatsApp confirmation if before 8&nbsp;pm, otherwise the next day. » · « Keep your phone close. »

---

## 7. Image de partage OG (1200 × 630)

Canal principal : WhatsApp. L'aperçu y est souvent rogné ou réduit : l'essentiel doit tenir dans le carré central 630 × 630 et rester lisible en vignette.

- Fond #141210 plein. Marges 72 px.
- Haut gauche : logo « Wá xɔ » crème #F4F1EA (« ɔ » #E2552B), hauteur 40 px.
- Bloc texte (gauche, largeur max 640 px), centré verticalement :
  - Badge L `sur-sombre` « Express ».
  - 24 px plus bas, slogan en Unbounded 600, 54 px, interligne 1.05, #F4F1EA :
    FR « Vos commandes livrées dans les meilleurs délais. » / EN « Your orders, delivered as fast as we can. »
  - 20 px plus bas, preuve en Onest 500, 26 px, #F4F1EA à 80 % :
    FR « Cotonou & Calavi&nbsp;: le jour même avant 20&nbsp;h. 7&nbsp;j/7. » / EN « Cotonou & Calavi: same day before 8&nbsp;pm. 7 days a week. »
- Droite : chiffre-signature **« 20&nbsp;h »** en Unbounded 700, 300 px, #FFC93C, ferré en bas à droite et coupé volontairement par le bord droit (environ 15 % hors cadre). C'est l'image : pas de photo de livreur, pas de scooter, pas d'éclair.
- Bas gauche : « waxo.boutique » Onest 500, 20 px, #F4F1EA à 60 %.
- Poids cible < 300 Ko (PNG optimisé ou JPEG qualité 85) pour l'aperçu WhatsApp.
- Une version par langue (`og-fr`, `og-en`).

Pourquoi : ici, et seulement ici avec l'e-mail, le slogan est la vedette, parce que l'OG parle de la marque à quelqu'un qui ne la connaît pas encore. La preuve juste en dessous empêche « meilleurs délais » de sonner creux.

---

## 8. En-tête des e-mails de commande

Contraintes e-mail : pas de SVG (Gmail, Outlook), pas de polices web fiables. Le badge est donc une cellule de tableau, le picto un PNG.

- Bande d'en-tête : largeur 600 px, fond #141210, padding 24px 32px.
  - Gauche : logo PNG crème, hauteur 28 px (@2x).
  - Sous le logo, baseline : FR « Vos commandes livrées dans les meilleurs délais. » / EN « Your orders, delivered as fast as we can. » en 13 px, #F4F1EA à 70 %, pile Onest, Arial, sans-serif.
- **Pas de badge dans l'en-tête** (il serait répété sur chaque e-mail, y compris « commande annulée »).
- Premier bloc du corps (e-mails « commande confirmée » et « en route » uniquement, zone Cotonou & Calavi uniquement) : bloc fond #F4F1EA, rayon 12 px, padding 16px 20px :
  - Badge e-mail : `<td>` fond #141210, `border-radius:999px`, padding 5px 12px 5px 9px, PNG du picto 14 × 14 (rendu @2x, trait #FFC93C), texte « Express » 12 px gras #F4F1EA, pile Unbounded, Arial Black, sans-serif.
  - Ligne d'estimation (texte stocké à la commande, section 6.3), 16 px gras #141210.
- Léo exporte : `express-picto-sun@2x.png` (28 × 28, trait #FFC93C, fond transparent) et `express-picto-terracotta@2x.png` (trait #C2410C).

---

## 9. Récapitulatif de présence (anti-surcharge)

| Surface | Slogan | Badge Express | Picto inline | « 20 h » chiffre-signature |
|---|---|---|---|---|
| Topbar | non | non | oui (1) | non |
| Héro | non | oui (M, sur-sombre) | non | non |
| Garanties | non | non | oui (carte 3) | oui (petit, 20 px) |
| Fiche produit | non | oui (S, note sous bouton) | non | non |
| Cartes produit / catalogue | non | **non** | non | non |
| Tunnel : zone A | non | oui (S) | oui (estimation) | non |
| Tunnel : zone B | non | **non** | oui (estimation) | non |
| Confirmation | non | oui (M, zone A) | non | non |
| OG | **oui** | oui (L) | non | **oui (300 px)** |
| E-mails | **oui** (baseline) | oui (corps, zone A) | non | non |
| Pied de page (recommandé) | **oui** (baseline sous le logo, 13 px, #F4F1EA 70 %) | non | non | non |

---

## 10. Briefs d'exécution (à dispatcher par Kody)

- **Mia (UI)** : composant `ExpressBadge` (tailles S/M, variantes `sur-clair` / `sur-sombre`) + `ExpressPicto` (inline), module pur « état selon l'heure » (section 3), application aux surfaces 4, 5, 6 ; vérification axe-core et captures desktop + 390 px, à 10 h et à 21 h simulées, plus samedi 21 h.
- **Léo (graphique)** : OG FR/EN (section 7), PNG du picto pour e-mails (section 8), logo crème PNG si absent.
- **Marcus (copy)** : relecture FR/EN des textes ci-dessus ; le slogan EN proposé (« Your orders, delivered as fast as we can. ») est une adaptation, pas une traduction littérale, à valider.
- **Kody** : remplacement global des textes obsolètes (« Livraison rapide », « avant 18 h », « du lundi au samedi »), y compris FAQ, CGV, assistant IA (prompt et base de connaissance), e-mails.

## 11. Points à confirmer par Fresnel

1. Le tarif 1 000 F (offert dès 15 000 F) s'applique-t-il aussi aux autres villes ?
2. Les 48 à 72 h des autres villes comptent-elles aussi le dimanche ?
3. Validation de l'adaptation anglaise du slogan.
