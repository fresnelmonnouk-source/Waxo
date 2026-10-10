# Waxo (Wá xɔ) — Plan de lancement 90 jours

Auteure : Sofia. Date : 2026-10-09. Légende : [DÉMO] / [CALCUL] / [HYPOTHÈSE] (voir `funnel-map.md`). Documents liés : `funnel-map.md` (goulots), `analytics-stack.md` (mesure), `marketing-kpis.md` (seuils, tableau de bord).

**Règle Helena** : toute promesse chiffrée destinée au public (délais de livraison, frais, remises, parrainage, "stock réel", avis, nombres de ventes) est validée par Helena avant publication. Les montants de ce plan (récompense de parrainage, remises) sont des **ordres de grandeur internes**, jamais des textes publics.

## 1. Objectif et cadre

**Big Objective (SMART)** : atteindre **≈ 80 commandes livrées cumulées en 90 jours** (≈ 9-12 par semaine en semaine 12), avec un **CAC mélangé ≤ 2 500 F** sur les semaines 9 à 13 et une **marge de contribution ≥ 4 500 F par commande** (scénario "Base" de `marketing-kpis.md` §2 ; 80 commandes ≈ point d'équilibre marketing + charges fixes). Statut : cible [HYPOTHÈSE], recalibrée en semaine 5.

Framework : **Lean Marketing + Bullseye réduit** (5 canaux testés à petite échelle, un seul doublé) sur un funnel AARRR dont le maillon faible attendu est l'**activation** (conversation → commande) et l'**exécution** (COD, paiement, livraison), pas le trafic.

Contraintes : fondateur solo, ≈ 10-12 h/semaine de marketing disponibles [HYPOTHÈSE], budget publicitaire ≈ 45 000 F/mois, stock limité (stocks de démo : Lampe LED 5, Écouteurs 4, Presse-agrumes 3 — **à confirmer avec le stock réel avant toute pub**), CAC maximal rentable 4 500 F.

Principe : **jamais plus de 3 priorités simultanées**. Les choses non retenues sont dans le backlog (§7).

## 2. Les 5 expériences (classées par score ICE)

Échelle ICE (1-10) : Impact × Confiance × Facilité ÷ 10 pour un score sur 100. Tous les scores sont des jugements de Sofia [HYPOTHÈSE].

| Rang | Expérience | I | C | F | ICE | Phase |
|---|---|---|---|---|---|---|
| 1 | E3. Discipline d'exécution COD + prépaiement hors Cotonou (conditionnel) | 7 | 6 | 8 | 34 | 1 |
| 2 | E1. Pub Click-to-WhatsApp contre pub vers le site | 9 | 5 | 7 | 32 | 1 |
| 3 | E5. Avis vérifiés + relance post-achat + parrainage | 7 | 6 | 6 | 25 | 2 |
| 4 | E2. Packs et "souvent achetés ensemble" (panier) | 6 | 5 | 6 | 18 | 2 |
| 5 | E4. Micro-influenceuses et statuts WhatsApp | 7 | 4 | 6 | 17 | 3 |

Limite méthodologique commune : le trafic ne permet pas de test A/B concluant sur la conversion globale (≈ 7 700 sessions par variante pour 1 % → 1,5 %, `funnel-map.md` §3). Les expériences sont donc **comparatives par ordre de grandeur** (CAC, taux d'échec) avec critères pré-engagés, pas des tests de significativité. Une décision "gagné/perdu" exige le volume minimal indiqué dans chaque fiche.

### E1. Click-to-WhatsApp contre trafic vers le site (acquisition)
- **Hypothèse H1** : pour un trafic froid Facebook/Instagram à Cotonou/Calavi, une annonce qui ouvre une conversation WhatsApp produit un CAC ≤ 2 500 F, alors que la même annonce vers le site produit un CAC > 4 500 F.
- **Pourquoi** : sur trafic froid vers le site, ≈ 0,6 % de conversion [HYPOTHÈSE] × clic à 50-120 F [HYPOTHÈSE] = 8 000 à 20 000 F par commande (`funnel-map.md` §3). Une conversation WhatsApp permet de rassurer, recommander, confirmer le COD et récupérer le numéro. Estimation : 350 F par conversation [HYPOTHÈSE] ÷ 15 % de conversion en commande [HYPOTHÈSE] ≈ 2 300 F.
- **Dispositif (semaines 1-4, 45 000 F)** : 2 campagnes avec les mêmes 4 visuels. **A** : objectif Messages (WhatsApp), 25 000 F. **B** : objectif Trafic vers la fiche produit (UTM `facebook / paid_social`), 20 000 F. Un seul ensemble d'annonces par campagne (budget trop faible pour fragmenter), ciblage large Cotonou + Abomey-Calavi, 20-45 ans, laisser Meta optimiser. Produits d'appel : best-sellers à **stock réel suffisant** — Gourde (445 ventes démo), Chargeur 20 W, Batterie externe, Raquette anti-moustiques, Boîtes hermétiques ; éviter Lampe/Écouteurs tant que le stock est ≤ 5 [DÉMO].
- **Mesure** : coût par conversation (Ads Manager) ; conversation → commande (étiquettes WhatsApp + réf. de campagne) ; CAC = dépense ÷ commandes avec réf. ; côté B, `purchase` GA4/Pixel + source déclarée.
- **Succès** : A atteint ≥ 40 conversations **et** conversation → commande ≥ 15 % **ou** CAC ≤ 2 500 F. **Échec** : conversation → commande < 10 % après 40 conversations (alors le goulot est le script de réponse, pas l'annonce : on corrige avant de dépenser plus) ou CAC > 4 500 F après 10 000 F dépensés et 7 jours.
- **Décision** : si A gagne, semaines 5-13 : 80 % du budget pub sur A, 20 % sur retest d'un nouveau visuel. B est arrêtée sauf reciblage, qui n'est ouvert qu'à partir de 1 000 visiteurs consentants (audience trop petite avant).
- **Garde-fous** : délai de première réponse WhatsApp ≤ 15 min entre 8 h et 19 h (sinon le résultat mesure la lenteur du fondateur, pas l'annonce) ; pause des annonces quand Fresnel est indisponible.
- **Dépendances** : numéro WhatsApp réel (le `+229 01 00 00 00 00` actuel est fictif), WhatsApp Business configuré (catalogue produits, réponses rapides, étiquettes, message d'absence), copy (Marcus via Kody), liens avec réf. de campagne.

### E3. Exécution COD et paiement : réduire les pertes avant de dépenser plus (opérations)
- **Hypothèse H3** : une confirmation WhatsApp systématique en moins de 2 heures (réponse "OUI" + repère de livraison) maintient l'échec COD ≤ 12 %. Si l'échec dépasse 20 % sur ≥ 20 COD, exiger un **prépaiement mobile money hors Cotonou/Calavi** ramène l'échec de ces commandes sous 10 % sans perdre plus de 15 % de ces commandes.
- **Pourquoi** : un échec COD coûte un trajet (≈ 920 F) sans recette, ≈ 20 % d'une contribution de 4 500 F (`funnel-map.md` §4.4). C'est le levier le plus rapide et le moins cher : aucun budget, aucune pub, uniquement un process.
- **Dispositif (semaines 1-4, puis déclenché par seuil)** : (a) modèle de message de confirmation, envoyé par Fresnel à chaque COD ; case `cod_verified` cochée seulement après réponse ; pas de départ du livreur sans réponse. (b) Suivi hebdomadaire des échecs avec **motif** (injoignable / refus / absent). (c) Étape conditionnelle : si seuil franchi, activer le prépaiement hors Cotonou (décision de Fresnel, nécessite un petit changement de checkout par Kody ; à communiquer au public après validation Helena).
- **Mesure** : requêtes SQL "Échecs COD" et "Paiement en ligne abouti" de `marketing-kpis.md` §6 ; part de COD confirmées avant tournée.
- **Succès** : échec COD ≤ 12 % sur ≥ 20 COD. **Échec** : > 20 %. **Zone grise 12-20 %** : prolonger de 2 semaines.
- **Aussi à surveiller** : paiements en ligne non aboutis ; relancer par WhatsApp (message : "Votre paiement n'est pas arrivé, voici le lien") toute commande en ligne non payée après 15 min. Gain attendu [HYPOTHÈSE] : récupérer 20-30 % de ces commandes.

### E5. Avis vérifiés, relance post-achat, parrainage (rétention et bouche-à-oreille)
- **Hypothèse H5** : un message WhatsApp 2 jours après la livraison obtient un avis chez ≥ 25 % des clients, et les fiches des 8 best-sellers qui affichent ≥ 5 avis réels ont un taux vue produit → ajout panier ≥ 7 % contre 5 % pour les autres. Un parrainage simple fait venir ≥ 1 commande pour 10 clients livrés.
- **Pourquoi** : le catalogue actuel contient 48 avis et des compteurs de ventes de **démonstration** à retirer avant ouverture publique (risque de pratique trompeuse). La preuve sociale réelle est l'actif le plus important d'une marque inconnue (`funnel-map.md` §4.5). Le coût par commande de parrainage est le plus bas du plan : récompense interne envisagée 500-1 000 F [HYPOTHÈSE] contre un CAC publicitaire cible de 2 500 F.
- **Dispositif (semaines 5-8, la collecte démarre dès la semaine 1)** : (a) à J+2 : message "tout va bien ? une note en 1 minute" avec lien d'avis ; à J+7 : suggestion complémentaire liée à l'achat ; à J+30 : "pour un proche ?". (b) Parrainage : champ "recommandé par" (`referrer_code`) au checkout, récompense validée par Fresnel (plafond d'incitations 30 000 F sur 90 jours). (c) Les 20 premiers clients : message personnel de Fresnel.
- **Mesure** : avis par commande livrée ; note moyenne ; ajout panier des fiches avec/sans avis (comparaison observationnelle, indicative) ; commandes avec `referrer_code`.
- **Succès** : ≥ 25 % d'avis, ≥ 1 commande parrainée par 10 livrées. **Échec** : < 10 % d'avis → raccourcir la demande (note d'une étoile à 1 clic) avant de conclure.
- **Garde-fou** : jamais d'incitation conditionnée à une note positive ; mentions d'incitation conformes (Helena).

### E2. Packs et "souvent achetés ensemble" (panier moyen)
- **Hypothèse H2** : proposer les packs (P4) sur la fiche produit et dans le panier fait passer la part des commandes à ≥ 2 unités de 49 % [DÉMO] à ≥ 55 %, avec une marge de contribution par commande ≥ 4 500 F.
- **Pourquoi la "barre livraison offerte" n'est PAS retenue en priorité** : le seuil de 15 000 F est un coût de marge. À 49 % de marge, un panier qui monte de 12 000 à 15 000 F rapporte 0,49 × 3 000 ≈ 1 470 F mais fait perdre 1 000 F de frais de livraison encaissés : gain net ≈ +470 F. Un panier qui monte de 14 000 à 15 000 F perd 0,49 × 1 000 − 1 000 ≈ −510 F. La barre ne paie que pour les paniers qui ajoutent plus de ≈ 2 040 F [CALCUL]. À étudier avant tout test ; elle n'est utile que si le seuil est relevé ou si le coût du livreur baisse.
- **Dispositif (semaines 5-8)** : packs thématiques cohérents avec les best-sellers (ex. "Coupures de courant" : batterie + chargeur + lampe ; "Bureau" ; "Voyage"). **Règle de prix : la remise de pack ne doit pas dépasser 60 % de la marge produits cumulée du pack** (garde-fou interne) [HYPOTHÈSE de prudence]. Compare avant/après sur 4 semaines + 4 semaines précédentes.
- **Mesure** : % de commandes ≥ 2 unités ; panier moyen ; marge de contribution par commande (garde-fou : pas de baisse).
- **Succès** : ≥ 55 % de commandes à ≥ 2 unités **et** contribution/commande ≥ 4 500 F. **Échec** : contribution < 4 000 F ou aucune hausse après 25 commandes.
- Taille d'échantillon : détecter 49 % → 55 % de façon concluante demande ≈ 1 100 commandes par bras [CALCUL] : on juge sur la direction et la marge, pas sur la significativité.

### E4. Micro-influenceuses locales et statuts WhatsApp (acquisition par confiance)
- **Hypothèse H4** : une micro-influenceuse de Cotonou (audience locale, engagement fort) génère ≥ 8 commandes en 7 jours pour 20 000 F, soit un CAC ≤ 2 500 F, parce que la recommandation transfère la confiance qui manque à une marque inconnue.
- **Précédent** : le carnet [DÉMO] contient « Statuts WhatsApp sponsorisés (influenceuse) » à 20 000 F (15/09). C'est l'ordre de grandeur retenu.
- **Dispositif (semaines 9-12, 60 000 F au maximum)** : **une seule** influenceuse en premier (20 000 F). Critères : audience majoritairement Cotonou/Calavi, engagement (réponses, partages) plutôt que nombre d'abonnés, contenu "utile au quotidien". Format : démonstration réelle d'un produit en main + statut/story + lien avec réf. `influ_<prenom>` et code à citer au checkout (champ "recommandé par"). Les 2 suivantes ne sont financées que si la première fait ≥ 6 commandes en 7 jours.
- **Mesure** : commandes avec source déclarée ou code ; conversations WhatsApp ; CAC par influenceuse (feuille). Avertissement : l'attribution est déclarative ; attendre un biais de ±30 %.
- **Succès** : ≥ 8 commandes pour 20 000 F (CAC ≤ 2 500 F). **Seuil de renoncement** : < 4 commandes (CAC > 5 000 F). Entre les deux : renégocier (paiement partiel au résultat).
- **Garde-fou** : stock suffisant pour absorber 15 commandes en 7 jours sur les produits mis en avant ; collaboration commerciale signalée comme telle (Helena).

## 3. Calendrier

| Phase | Semaines | Priorités (max 3) | Livrables / jalons |
|---|---|---|---|
| 0. Pré-requis | S0-S1 | Prérequis, recette tracking | §4 coché ; recette 16 tests `analytics-stack.md` §8.1 ; décision "go" sur les 3 points de contrôle |
| 1. Fondations et tuyau | S1-S4 | E3 + E1 + (rappel hebdo KPI) | Verdict E1 et E3 en S4 ; 1ère ligne du tableau de bord en S1 |
| 2. Preuve et panier | S5-S8 | E5 + E2 + doublage du gagnant d'E1 | Recalibrage des cibles en S5 ; verdict E5/E2 en S8 |
| 3. Confiance et échelle | S9-S13 | E4 + doublage du gagnant + E3 maintenu | Bilan 90 jours en S13 : comparaison avec les scénarios |

Canaux "de fond" (hors expériences, toujours actifs, ≈ 5-6 h/semaine) : statuts WhatsApp quotidiens (1 produit, 1 photo réelle), TikTok organique 2-3 vidéos par semaine (démonstrations de 15-30 s, produit en main, prix visible), Instagram en reprise des mêmes vidéos, bouche-à-oreille personnel (voir E5). Aucun KPI de vanité n'est suivi pour ces canaux ; on suit les commandes avec source déclarée TikTok/WhatsApp/ami. Volume de départ : si au bout de 8 semaines TikTok ne produit ni commandes déclarées ni conversations, réduire à 1 vidéo/semaine.

## 4. Pré-requis de la semaine 0-1 (bloquants)

| # | Pré-requis | Responsable | Pourquoi |
|---|---|---|---|
| 1 | Numéro WhatsApp réel dans le site, les annonces et le pied de page | Fresnel + Kody | le numéro actuel est fictif ; toutes les expériences en dépendent |
| 2 | Retirer ou marquer les avis et compteurs "vendus" de démonstration | Kody + Helena | risque de pratique trompeuse ; E5 les remplace |
| 3 | Recette du suivi (16 tests) et colonnes `source`, `referrer_code` | Kody | mesurer avant d'agir |
| 4 | Vérifier le stock réel des produits d'appel ; fixer un plancher d'alerte | Fresnel | la lampe est à 5 unités en démo |
| 5 | Configurer WhatsApp Business : profil, catalogue, réponses rapides, étiquettes (Nouveau / Intéressé / Commande / Livré), message d'absence | Fresnel | E1 et E3 |
| 6 | Compte Meta Business, Pixel, vérification du domaine, GA4 selon `analytics-stack.md` §5 | Fresnel + Kody | |
| 7 | Cron d'expiration des commandes impayées plus fréquent (ou déclenchement externe) | Kody | une commande MoMo fantôme bloque le stock jusqu'à ~24 h |
| 8 | Validation Helena : promesses de livraison, remboursement, avis, consentement, parrainage | Helena | règle générale |

## 5. Budget (90 jours)

| Poste | Montant | Hypothèse / source |
|---|---|---|
| Publicité Meta (FB/IG) | 135 000 F | 3 × 45 000 F (budget du carnet de démonstration) |
| Micro-influenceuses | 60 000 F max | 3 × 20 000 F ; précédent carnet 20 000 F ; 2 sur 3 conditionnelles à E4 |
| Incitations (parrainage, geste commercial) | 30 000 F max | 500-1 000 F × ≈ 30-60 récompenses [HYPOTHÈSE] ; montant public → Helena |
| Outils | 0 F | GA4, Pixel, WhatsApp Business, Lighthouse gratuits |
| **Total plafond** | **225 000 F ≈ 343 €** | [CALCUL] à 655,957 F/€ |

Répartition par phase : P1 = 45 000 F (25 000 A + 20 000 B) ; P2 = 45 000 F pub + incitations ; P3 = 45 000 F pub + influenceuses + incitations. Rythme de dépense contrôlé chaque lundi ; dépassement de 10 % = pause (`marketing-kpis.md` §3.1).

Résultat attendu (scénario Base, `marketing-kpis.md` §2) : ≈ 79 commandes, contribution ≈ 355 000 F, après marketing et charges fixes ≈ 0 F. Le trimestre est un investissement en preuve sociale, en process et en base clients ; le succès se juge à la tendance (CAC et échecs en baisse, commandes hebdomadaires en hausse, avis réels) autant qu'au solde.

## 6. Risques et mitigations

| Risque | Probabilité / effet | Mitigation |
|---|---|---|
| Fondateur seul : réponses WhatsApp lentes, ventes perdues | Élevée / fort | SLA 15 min 8 h-19 h ; réponses rapides ; pause pub hors disponibilité ; plafond de conversations traitables par jour |
| Rupture de stock sur un produit poussé | Moyenne / fort | n'annoncer que les produits à stock réel ≥ 15 ; alerte à 3 |
| COD non honorée, pertes de trajets | Élevée / moyen | E3, seuil 20 % → prépaiement hors Cotonou |
| Paiements mobile money en échec, stock bloqué | Moyenne / moyen | relance à 15 min, cron plus fréquent |
| Mauvais suivi (consentement refusé, UTM perdues) | Moyenne / moyen | base = source de vérité, source déclarative, couverture suivie |
| Publicité refusée ou compte limité par Meta (nouvelle activité, pays) | Faible-moyenne / fort | vérification du compte dès la semaine 0 ; ne pas fonder tout le plan sur un compte unique ; WhatsApp et organique en parallèle |
| Avis ou promesses jugés trompeurs | Moyenne / fort | retrait des données de démo, validation Helena |
| Livraison J+1 non tenue | Moyenne / fort | KPI "J+1 tenue" ; réduire la promesse si < 80 % |
| Sur-interprétation de petits échantillons | Élevée / moyen | critères pré-engagés, volumes minimaux, décisions révisables |

## 7. Backlog (non retenu pour l'instant)

- Compte à rebours "commandez avant 18 h pour recevoir demain" : idée à faible coût, mais c'est une promesse chiffrée (Helena) et elle n'a d'effet que si la tenue du J+1 est ≥ 90 %.
- Barre "plus que X F pour la livraison offerte" : voir calcul d'E2, risque de marge négative.
- Google Ads, SEO, e-mail marketing, API de conversion Meta, heatmaps : trafic ou panier insuffisant ; à rouvrir au-delà de ≈ 30 commandes/mois.
- Reciblage : audiences < 1 000 personnes.
- Anglais : audience EN probablement faible au Bénin [HYPOTHÈSE] ; aucune pub en anglais avant que `language=en` dépasse 10 % des sessions.

## 8. Coordination

### À demander à Marcus via Kody (copy) — je ne rédige aucun texte
1. **Annonces Click-to-WhatsApp** : 4 visuels/angles pour 5 best-sellers ; angle "utile au quotidien", preuve (produit en main), prix visible, livraison demain à Cotonou/Calavi, paiement MoMo ou à la livraison ; ton factuel, FR, ≤ 125 caractères de texte principal. Aucune promesse chiffrée non validée par Helena.
2. **Scripts WhatsApp** : accueil, recommandation de produit, confirmation COD (demande de "OUI" + repère), relance de paiement en attente (15 min), demande d'avis (J+2), complément (J+7), réachat/parrainage (J+30).
3. **Brief influenceuse** : une page (ce qu'il faut montrer, ce qu'il ne faut pas promettre, mention de collaboration).
4. **Textes de packs** : noms et descriptions courtes des packs.

### À implémenter par Kody (technique)
Voir `analytics-stack.md` §9 : événements, anti-doublon `purchase`, `source` + `referrer_code`, liens WhatsApp avec réf., numéro réel, compteur de consentement (si validé), conservation des UTM à travers la redirection de langue, cron d'expiration plus fréquent, éventuel prépaiement hors Cotonou (conditionnel, E3), champ "recommandé par".

### À soumettre à Helena
Promesses chiffrées (J+1, 48-72 h, frais, remboursement 7 jours, "stock réel"), avis et compteurs, parrainage et incitations, mention de collaboration commerciale, consentement (bandeau, compteur anonyme, WhatsApp marketing).

## 9. Hypothèses à valider, par ordre d'importance

| # | Hypothèse | Test | Échéance |
|---|---|---|---|
| H1 | Click-to-WhatsApp donne un CAC ≤ 2 500 F | E1 | S4 |
| H3 | La confirmation WhatsApp tient l'échec COD ≤ 12 % | E3 | S4 |
| Hx | Marge de contribution réelle ≈ 4 500 F/commande | Carnet + base, première lecture | S4 |
| H5 | 25 % d'avis après relance J+2 | E5 | S8 |
| H2 | Les packs montent la part de commandes ≥ 2 unités sans baisser la marge | E2 | S8 |
| H4 | Une micro-influenceuse ≤ 2 500 F de CAC | E4 | S11 |
| Hy | Acceptation du consentement ≥ 40 % | compteur ou comparaison GA4/base | S2 |
| Hz | Coût par conversation WhatsApp 200-500 F | Ads Manager | S2 |
