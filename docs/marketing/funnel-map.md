# Waxo (Wá xɔ) — Carte des funnels

Auteure : Sofia (stratégie marketing). Date : 2026-10-09. Statut : proposition à valider par Kody / Fresnel.

## 0. Lecture de ce document

Légende utilisée partout : **[DÉMO]** = chiffre calculé sur les données de démonstration (`docs/maquettes/waxo-data.js`, 110 commandes générées par un générateur pseudo-aléatoire, pas de vraies ventes). **[CALCUL]** = dérivé de [DÉMO] ou des tarifs. **[HYPOTHÈSE]** = ordre de grandeur de départ, à remplacer par la mesure réelle après 4 semaines. Rien de marqué [HYPOTHÈSE] ne doit être présenté comme un fait.

**Règle Helena** : toute promesse chiffrée destinée au public (délais, "livraison le lendemain", "remboursé sous 7 jours", "stock réel", notes et nombres de ventes affichés) passe par Helena avant publication. Voir section 7.

Contexte retenu : boutique bilingue FR/EN, 24 produits (600 à 14 000 F, médiane ≈ 5 700 F [CALCUL]), 6 rayons, Cotonou, livraison J+1 à Cotonou/Calavi (1 000 F, offerte dès 15 000 F), 48-72 h ailleurs (2 500 F), paiement MoMo / Moov / Celtiis / carte / COD, assistant IA, WhatsApp = canal de confirmation. Fondateur solo.

## 1. Économie de base (ce qui borne tout le reste)

| Élément | Valeur | Statut |
|---|---|---|
| Panier produits moyen (hors livraison) | 11 173 F | [DÉMO] 114 commandes non annulées |
| Frais de livraison encaissés par commande | 1 074 F | [DÉMO] |
| Articles par commande | 1,69 | [DÉMO] |
| Marge produits par commande (prix − prix d'achat) | 5 439 F (≈ 49 % du prix) | [DÉMO] avec `COST` du fichier |
| Coût livreur par commande | ≈ 920 F | [CALCUL] ledger sept. : 34 000 F / 37 commandes |
| Emballage par commande | ≈ 300 F | [HYPOTHÈSE] (26 000 F cartons+sachets sur ~85 commandes) |
| Frais de paiement en ligne | ≈ 230 F | [HYPOTHÈSE] 3 % sur 62 % des commandes en ligne ; à vérifier dans le contrat FedaPay |
| **Marge de contribution par commande** | **≈ 5 000 F** | [CALCUL] 5 439 + 1 074 − 920 − 300 − 230 |
| Idem après pertes COD (échecs, voir §4) | ≈ 4 500 F | [HYPOTHÈSE] |

Conséquence directe : **le coût d'acquisition (CAC) maximal rentable sur une première commande est ≈ 4 500 F, et la cible saine ≤ 2 500 F.** Avec 45 000 F/mois de pub, cela fait 18 commandes payantes/mois à 2 500 F, 10 à 4 500 F. La publicité ne peut donc pas être le moteur principal à ce budget : WhatsApp, TikTok organique, bouche-à-oreille et micro-influenceuses doivent fournir la majorité du volume.

Mix paiement observé en démo : MoMo 38 %, Moov 14 %, Celtiis 9 %, carte 12 %, COD 27 % ; zone Cotonou/Calavi 84 %, autres villes 16 % [DÉMO]. Ce n'est pas du réel : le mix COD réel sera probablement plus haut au lancement [HYPOTHÈSE] (confiance faible d'un site inconnu).

## 2. Vue d'ensemble : un funnel à deux entrées

```
ACQUISITION                 CONSIDÉRATION              CONVERSION                 LIVRAISON / RÉTENTION
─────────────────────────   ────────────────────────   ────────────────────────   ──────────────────────────
A. Pub Facebook/Instagram → B. Fiche produit/catalogue → D. Panier → Checkout   → G. Confirmation WhatsApp
   - vers le site              (+ assistant IA)             (3 étapes ?)            (COD : appel/message)
   - vers WhatsApp (CTWA) ─────────────────────────────→ C. Conversation WhatsApp → H. Livraison J+1 / 48-72 h
B. Statuts WhatsApp / DM                                     → lien commande ou     I. Demande d'avis (J+2)
C. TikTok organique                                            commande manuelle    J. Réachat / parrainage
D. Influenceuses (statuts)                                                          (J+7, J+30)
E. Bouche-à-oreille / parrainage
F. SEO / recherche (long terme)
```

Deux entrées à tracker séparément : **Entrée SITE** (visiteur arrive sur une page produit/accueil, mesure GA4/Pixel sous consentement) et **Entrée WHATSAPP** (conversation, mesurée hors-site : étiquettes WhatsApp Business + champ "comment nous avez-vous connus" au checkout). L'entrée WhatsApp est la plus probable pour une marque inconnue au Bénin [HYPOTHÈSE : confiance, réassurance et négociation passent par WhatsApp].

## 3. Funnel détaillé et taux de départ

Taux de départ à valider (tous [HYPOTHÈSE], recalibrer à N ≥ 300 sessions par étape) :

| Étape | Événement (GA4 / Pixel) | Taux visé M1 trafic froid payant | Taux visé trafic chaud (WhatsApp/influenceuse) |
|---|---|---|---|
| Session → vue produit | `view_item` / ViewContent | 55 % | 70 % |
| Vue produit → ajout panier | `add_to_cart` / AddToCart | 5 % | 10 % |
| Ajout panier → début checkout | `begin_checkout` / InitiateCheckout | 45 % | 60 % |
| Début checkout → commande | `purchase` / Purchase | 50 % | 65 % |
| **Session → commande** | | **≈ 0,6 %** | **≈ 2,7 %** |

Lecture : 55 % × 5 % × 45 % × 50 % ≈ 0,6 % (chaud : 70 % × 10 % × 60 % × 65 % ≈ 2,7 %). Avec 0,6 % et un clic à 50-120 F [HYPOTHÈSE], un achat sur trafic froid coûte 8 000 à 20 000 F : **non rentable** (CAC max 4 500 F). C'est la raison pour laquelle le plan 90 jours teste en priorité le clic vers WhatsApp (conversation) plutôt que le clic vers le site.

Limite statistique à connaître : détecter une hausse 1 % → 1,5 % de conversion globale demande ≈ 7 700 sessions par variante [CALCUL, puissance 80 %, α 5 %]. Détecter 6 % → 9 % sur l'ajout panier demande ≈ 1 200 sessions par variante. Avec 1 500 à 3 000 sessions/mois [HYPOTHÈSE], un vrai A/B test ne tranche que sur des étapes intermédiaires (ajout panier, début checkout) et sur des changements forts. Le reste se juge en avant/après avec garde-fous.

## 4. Goulots probables et points de friction

Classés par perte probable × facilité de correction. Chaque ligne = quoi mesurer pour confirmer.

### 4.1 Mobile 3G / appareils d'entrée de gamme (Tecno, Infinix, Itel d'après la base de connaissances)
1. **Poids de la page catalogue** : 24 cartes avec photos. Photos admin ≤ 1 200 px (WebP/JPEG ~0,82) = ordre de 80-150 Ko chacune [HYPOTHÈSE]. Sans lazy-loading et tailles responsives, ≈ 2-3 Mo à charger sur un réseau réel de 1-3 Mbps [HYPOTHÈSE] = 8-20 s. Mesure : Lighthouse mobile throttlé ("Slow 4G") hebdomadaire, cible LCP ≤ 3 s ; CrUX/PageSpeed Insights quand le trafic le permet.
2. **Scripts tiers** : gtag ~100 Ko et fbevents ~70 Ko [HYPOTHÈSE, ordre de grandeur] chargés seulement après consentement, en `async`, après la première interaction. Ne jamais les charger avant le consentement (c'est aussi la règle légale choisie).
3. **Bandeau de consentement** : s'il couvre le bouton d'ajout au panier ou le CTA sur écran 360 px, il coûte des conversions. Mesure : taux de clic sur le premier CTA avant/après choix. Cible : bandeau bas de page, ≤ 25 % de la hauteur d'écran.
4. **Redirection vers la page FedaPay** (paiement en ligne) : page lourde, perte de contexte. Mesure : part des commandes en ligne restées "nouvelle / non payée" après 15 min (voir 4.3).
5. **Assistant IA** : réponse LLM lente sur 3G. Le mode déterministe doit répondre en < 2 s ; le LLM n'ajoute que le ton (par conception). Mesure : temps de première réponse, abandon après ouverture.
6. **Hors-ligne partiel** : coupures de réseau en plein checkout. Mesure : écarts `begin_checkout` sans issue + erreurs API.

### 4.2 Friction formulaire / checkout
7. **Téléphone** : la validation de la maquette n'accepte que `01` + 8 chiffres (10 chiffres, nouveau plan de numérotation béninois). Un client qui tape un ancien numéro à 8 chiffres ou un format "+229 97 11 22 33" mal compris est bloqué. À vérifier avec Kody : message d'erreur clair + accepter/normaliser les formats courants. Mesure : événement d'erreur de champ (voir analytics-stack §3.10).
8. **Adresse** : les adresses au Bénin sont descriptives ("derrière la station, portail bleu"). Le champ doit demander un repère, pas une rue. Le livreur appelle de toute façon : le téléphone est la vraie adresse.
9. **Heure limite 18 h** : une commande à 18 h 05 part J+2, pas J+1 [CALCUL d'après la règle de livraison]. Le client doit le savoir avant de payer, pas dans l'e-mail. Idée de compte à rebours "commandez avant 18 h pour recevoir demain" : mise en backlog (`lancement-90-jours.md` §7), car c'est une promesse chiffrée (Helena) qui n'a de sens que si le J+1 est tenu à ≥ 90 %.
10. **Frais de livraison hors Cotonou 2 500 F** : sur un panier moyen de 11 173 F, c'est 22 % [CALCUL]. Les 16 % de commandes hors Cotonou [DÉMO] sont les plus sensibles. Mesure : abandon au checkout par zone (paramètre `delivery_zone`).
11. **Seuil de livraison offerte 15 000 F** : le panier moyen est à 11 173 F et 28 des 114 commandes démo (25 %) sont entre 10 000 et 15 000 F [DÉMO]. Attention : pousser ces paniers vers le seuil n'est pas forcément rentable. À 49 % de marge, passer de 12 000 à 15 000 F rapporte ≈ +1 470 F de marge mais coûte 1 000 F de frais de livraison encaissés (gain net ≈ +470 F) ; de 14 000 à 15 000 F le résultat est négatif (≈ −510 F) [CALCUL]. Le piloter par la marge de contribution par commande, pas par le panier ; leviers préférés : packs et ventes liées (voir `lancement-90-jours.md`, E2).

### 4.3 Mobile money et paiement en ligne (MTN MoMo / Moov Money / Celtiis Cash)
12. **Validation par USSD / notification** : le client doit confirmer avec son code sur son téléphone ; réseau lent ou code oublié = échec silencieux. Mesure : `paid / commandes en ligne créées` (taux de paiement abouti), cible ≥ 80 % [HYPOTHÈSE].
13. **Stock bloqué par les commandes impayées** : `expire_stale_orders` libère après 60 min, mais le cron Vercel Hobby ne tourne qu'une fois par jour : une commande MoMo abandonnée peut garder le stock jusqu'à ~24 h. Avec des stocks faibles (Écouteurs 4, Presse-agrumes 3, Diffuseur 6 [DÉMO]) une seule commande fantôme provoque une fausse rupture. Action : demande à Kody (appel du cron plus fréquent via plan Pro ou déclenchement externe) ; suivre `commandes en ligne non payées > 60 min`.
14. **Paiement hors du site** : le client paie par USSD mais ferme l'onglet avant le retour : la commande reste "non payée" alors que l'argent est parti (cas "needs_refund" / montant incohérent gérés côté base). Mesure hebdomadaire : paiements `needs_refund` + `amount_mismatch` = 0.
15. **Carte** : 12 % en démo ; faible usage probable [HYPOTHÈSE]. Ne pas investir de temps d'optimisation avant d'avoir des données.
16. **Confiance** : un site inconnu qui demande de l'argent mobile avant livraison. Réassurance à tester : avis réels, photo du dépôt/équipe, numéro WhatsApp visible au checkout, mention "aucun membre de l'équipe ne demande jamais de code secret" (déjà dans la base de connaissances ; à confirmer par Helena avant mise en avant).

### 4.4 Paiement à la livraison (COD) — le plus gros risque de marge
17. **Refus / absence à la livraison** : en démo, seules 4,2 % des commandes sont annulées (5/119) [DÉMO, non représentatif]. En réel, 10-20 % d'échecs COD est un ordre de grandeur courant en commerce COD d'Afrique de l'Ouest [HYPOTHÈSE, à mesurer]. Chaque échec coûte un trajet livreur (≈ 920 F [CALCUL]) sans recette : à 15 % d'échec, perte ≈ 140 F/commande COD en moyenne, mais bien plus sur la marge de contribution d'une petite commande (≈ 3 000-4 000 F).
18. **Confirmation WhatsApp** avant expédition (déjà prévue) : c'est le principal filtre. Mesure : délai de réponse client, % de COD confirmées avant départ du livreur (`cod_verified` existe dans la table `orders`). Cible : ≥ 85 % des COD confirmées avant tournée [HYPOTHÈSE].
19. **COD hors Cotonou** : un colis de 48-72 h par transporteur interurbain refusé à l'arrivée est très coûteux (aller-retour 2 × 2 500 F + délai) [HYPOTHÈSE sur le coût de retour]. Hypothèse H-COD : exiger un paiement mobile money (ou acompte) hors Cotonou/Calavi réduit les échecs ; coût : baisse possible de conversion sur 16 % des commandes. À décider par Fresnel, test en plan 90 jours (expérience 3).

### 4.5 Confiance et preuve sociale
20. **Avis et compteurs de démonstration** : les 48 avis et les compteurs "vendus" (412, 389...) du catalogue sont des données de démonstration. Les publier comme réels est une pratique commerciale trompeuse (risque juridique et de réputation). Action : remplacer par des avis réels vérifiés (achat livré) avant ouverture publique ; en attendant, ne pas afficher de note ni de nombre de ventes. Décision à porter à Helena (voir §7).
21. **Marque inconnue** : "Wá xɔ" (venez acheter en fon) est mémorable localement mais n'a aucune notoriété. La réassurance visuelle (photos réelles des produits en main, vidéos, dépôt) compense : TikTok/WhatsApp sont des canaux de preuve avant d'être des canaux de volume.

## 5. Parcours après achat (rétention) — où se joue la marge

Séquence proposée, 100 % WhatsApp (e-mail secondaire : e-mails transactionnels Resend déjà prévus) :

| Moment | Action | Objectif | Mesure |
|---|---|---|---|
| T+0 | Confirmation WhatsApp avec créneau (déjà prévu) | Réduire COD non honorées, rassurer | % confirmées < 2 h |
| Livraison | Appel livreur (déjà prévu) | Livrer au 1er passage | % livrées 1er passage |
| Livrée + 2 jours | Message "Tout va bien ? Une note en 1 minute ?" avec lien d'avis | Créer l'actif n°1 : des avis vrais | % commandes livrées avec avis ≥ 25 % [HYPOTHÈSE] |
| Livrée + 7 jours | Message complémentaire lié au produit (ex. lampe → batterie externe) | Panier 2 | taux de réachat 30 j |
| Livrée + 30 jours | "Il vous en faut pour un proche ?" + parrainage | Bouche-à-oreille | commandes avec "recommandé par" |

Réachat à 90 jours visé : 15 % [HYPOTHÈSE]. Il fixe la LTV 90 jours ≈ 5 000 F × 1,15 ≈ 5 750 F de contribution → règle CAC < LTV/3 ≈ 1 900 F, mais en démarrage on tolère ≤ 2 500 F pour apprendre (assumé, voir lancement-90-jours.md).

Newsletter : la maquette collecte e-mail ou WhatsApp. Au Bénin le canal WhatsApp (liste de diffusion / statuts) a plus de chance de lecture que l'e-mail [HYPOTHÈSE]. Attention : le consentement pour messages marketing WhatsApp doit être recueilli et conservé (Helena, section 7).

## 6. Données à capturer pour que ce funnel soit pilotable

Aujourd'hui `orders` ne stocke ni la source d'acquisition ni les UTM (vérifié dans `0001_core.sql`) et le code ne contient aucun mécanisme de code promo ou de parrainage. Sans cela, on ne pourra pas répondre à la question "quel canal a produit cette commande ?". Demandes à Kody (sans modifier le code ici) :
1. Champ facultatif au checkout "Comment nous avez-vous connus ?" (liste : Facebook, Instagram, TikTok, WhatsApp/statut, ami(e)/famille, influenceuse [nom], autre) enregistré dans la commande (colonne `source`, texte court ; valeur déclarative, sans consentement tiers puisque c'est la réponse volontaire du client).
2. Colonne `referrer_code` (texte court, facultatif) pour le code influenceuse/parrain. Pas de remise automatique tant que Fresnel n'a pas décidé d'une remise (chiffre public → Helena).
3. Bouton WhatsApp avec message pré-rempli contenant une référence de campagne (voir analytics-stack §6).

## 7. Points à soumettre à Helena (juridique/conformité) avant publication

- Promesses chiffrées : "livraison le lendemain avant 18 h", "48 à 72 h", "1 000 F / offerte dès 15 000 F", "remboursement sous 7 jours", "le stock affiché est réel", "7 jours pour retourner".
- Avis, notes et compteurs de ventes de démonstration (retirer ou marquer).
- Consentement : bandeau strict, durée de 6 mois, conservation du choix, cadre applicable au Bénin (Code du numérique / APDP) pour le suivi publicitaire et pour toute mesure sans cookie.
- Consentement marketing WhatsApp/e-mail (newsletter) et message de désabonnement.
- Toute remise, offre de parrainage ou jeu concours (montants affichés au public).
