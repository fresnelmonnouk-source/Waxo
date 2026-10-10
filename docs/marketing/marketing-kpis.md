# Waxo (Wá xɔ) — KPIs et tableau de bord hebdomadaire

Auteure : Sofia. Date : 2026-10-09. Légende : [DÉMO] / [CALCUL] / [HYPOTHÈSE] (voir `funnel-map.md`). Toutes les cibles ci-dessous sont des **points de départ à recalibrer à la semaine 5** avec les premières données réelles. Les chiffres de démonstration (110 commandes générées) ne sont pas des résultats.

**Règle Helena** : aucune de ces cibles ne doit être reprise telle quelle dans un texte public (délais, remises, "X clients satisfaits"…) sans validation.

## 1. North Star et logique

**North Star : nombre de commandes livrées (et payées ou encaissées) par semaine.** Pourquoi pas le chiffre d'affaires : au lancement, une grosse commande isolée masque l'absence de rythme ; pourquoi pas les visites : vanity. Une commande livrée est la seule qui crée de la marge, de l'avis et du réachat.

Arbre de décision :
```
Commandes livrées / semaine
 = Acquisition (conversations + sessions) x Conversion (conv.->commande, session->commande)
   x Taux d'exécution (paiement abouti, COD honorée, livraison réussie)
```
Une alerte sur la première branche = problème de canal/message ; sur la deuxième = problème de site/script WhatsApp ; sur la troisième = problème opérationnel (le plus coûteux et le plus rapide à corriger).

## 2. Économie unitaire de référence

| Variable | Valeur | Statut |
|---|---|---|
| Panier produits moyen | 11 173 F | [DÉMO] |
| Marge de contribution / commande | ≈ 5 000 F (≈ 4 500 F après pertes COD) | [CALCUL/HYPOTHÈSE], détail `funnel-map.md` §1 |
| CAC maximum rentable (1re commande) | **4 500 F** | [CALCUL] |
| CAC cible | **≤ 2 500 F** | règle CAC < LTV/3 avec LTV 90 j ≈ 5 750 F → 1 900 F ; tolérance d'apprentissage jusqu'à 2 500 F (assumée) |
| Commandes pour couvrir marketing + charges fixes sur 90 jours | ≈ **80 commandes** (≈ 27/mois) | [CALCUL] (225 000 F marketing + ≈ 135 000 F loyer/hébergement du ledger) ÷ 4 500 F |

Scénarios 90 jours [HYPOTHÈSE], marge de contribution 4 500 F/commande, marketing 225 000 F, charges fixes ≈ 135 000 F (hors achats de stock, qui sont un flux de trésorerie, pas un coût) :

| Scénario | Commandes M1 / M2 / M3 | Total | Contribution | Résultat après marketing et charges fixes |
|---|---|---|---|---|
| Prudent | 8 / 15 / 25 | 48 | 216 000 F | ≈ −144 000 F |
| Base | 12 / 25 / 42 | 79 | ≈ 355 000 F | ≈ 0 F |
| Ambitieux | 18 / 38 / 60 | 116 | 522 000 F | ≈ +162 000 F |

Lecture : le trimestre de lancement est un investissement. Le point d'équilibre est autour de 80 commandes ; en dessous, ne pas augmenter la pub pour "forcer" : corriger d'abord l'exécution et la conversion.

## 3. Liste des KPIs (formules, cibles, seuils)

Un KPI primaire par objectif ; les autres sont des diagnostics.

### 3.1 KPIs du tableau de bord hebdomadaire (8)

| # | KPI | Formule | Source | Cible M1 → M3 | Seuil d'alerte |
|---|---|---|---|---|---|
| 1 | **Commandes livrées** (North Star) | `count(status='livree')` livrées dans la semaine | base | 3-4 → 9-12 /sem. | 2 semaines de suite sous la cible de 40 % |
| 2 | Panier moyen produits | `sum(subtotal) / nb commandes non annulées` | base | 10 500 → 12 000 F | < 9 000 F |
| 3 | Marge de contribution / commande | marge produits + frais livraison encaissés − coût livreur − emballage − frais paiement, par commande | base + carnet admin | ≥ 4 500 F | < 3 500 F |
| 4 | Dépenses marketing | pub Meta + influenceuses + incitations (carnet, catégorie Publicité) | carnet admin / Ads Manager | ≤ 45 000 F/mois pub ; total 90 j ≤ 225 000 F | dépassement de 10 % du budget mensuel |
| 5 | **CAC mélangé** | dépenses marketing ÷ nouvelles commandes **livrées** (1ers achats) | feuille | ≤ 4 500 F (M1) → ≤ 2 500 F (M3) | > 4 500 F pendant 2 semaines |
| 6 | Conversion session → commande | commandes tracées ÷ sessions, parmi visiteurs consentants | GA4 | 0,6-1 % → 1,5 % | < 0,5 % |
| 7 | Taux d'échec d'exécution | COD annulées ÷ COD créées ; et paiements en ligne non abouti ÷ commandes en ligne | base | COD ≤ 12 % ; paiement abouti ≥ 80 % | COD > 20 % ; paiement abouti < 65 % |
| 8 | Livraison J+1 tenue (Cotonou/Calavi) | commandes passées avant 18 h livrées le jour ouvré suivant ÷ commandes concernées | base | ≥ 85 % → 90 % | < 80 % |

### 3.2 KPIs de diagnostic (à lire seulement si un des 8 clignote)

| KPI | Formule | Source | Cible | Alerte |
|---|---|---|---|---|
| Conversations WhatsApp (pub) | conversations démarrées via annonces Messages | Ads Manager | – | – |
| Coût par conversation | dépense de la campagne ÷ conversations | Ads Manager | 200-500 F [HYPOTHÈSE] | > 600 F |
| Conversation → commande | commandes avec réf. de campagne ÷ conversations | étiquettes WA + base | 15-25 % [HYPOTHÈSE] | < 10 % après 40 conversations |
| Délai de première réponse WhatsApp (8 h-19 h) | médiane | WhatsApp Business (statistiques) | ≤ 15 min | > 60 min |
| Vue produit → ajout panier | `add_to_cart` ÷ `view_item` | GA4 | 5-8 % | < 3 % |
| Ajout panier → début checkout | `begin_checkout` ÷ `add_to_cart` | GA4 | 45-60 % | < 35 % |
| Début checkout → achat | `purchase` ÷ `begin_checkout` | GA4 | 50-65 % | < 40 % |
| Soumission → paiement abouti (en ligne) | `purchase` ÷ `add_payment_info` (paiement en ligne) | GA4 | ≥ 80 % | < 65 % |
| COD confirmées avant tournée | `cod_verified` ÷ COD créées | base | ≥ 85 % | < 70 % |
| Part COD | commandes `pay='cod'` ÷ total | base | information | > 50 % hors Cotonou : voir expérience 3 |
| Part commandes hors Cotonou | `zone='autre'` ÷ total | base | information | – |
| Commandes ≥ 15 000 F (livraison offerte) | `subtotal>=15000` ÷ total | base | information (19 % en démo) ; ne pas en faire un objectif : pousser les paniers vers le seuil peut réduire la marge (`lancement-90-jours.md` E2) | – |
| Commandes à ≥ 2 unités | commandes avec quantité totale ≥ 2 ÷ total | base | 49 % démo → ≥ 55 % (E2) avec contribution ≥ 4 500 F | contribution < 4 000 F |
| Avis par commande livrée | avis publiés ÷ livraisons | base | ≥ 25 % à M3 | < 10 % |
| Note moyenne des avis réels | moyenne | base | ≥ 4,3 | < 4,0 |
| Réachat 30 j / 90 j | clients ayant 2 commandes livrées ÷ clients livrés | base (téléphone normalisé) | 8 % / 15 % [HYPOTHÈSE] | – (lisible seulement après J+90) |
| Couverture du suivi | `purchase` GA4 ÷ commandes en base | GA4 + base | 35-70 % | < 25 % ou > 105 % |
| Taux d'acceptation du consentement | acceptés ÷ choix | compteur anonyme (si validé) | 40-60 % [HYPOTHÈSE] | < 25 % (bandeau trop intrusif ?) |
| LCP mobile (Slow 4G) | Lighthouse, page accueil et fiche produit | Lighthouse | ≤ 3,0 s | > 4,5 s |
| Ruptures | produits à stock ≤ 3 avec ≥ 1 vente sur 14 j | base | 0 rupture sur les 8 meilleures ventes | rupture d'un top 8 |
| Recherches sans résultat | `search` avec `results_count=0` | GA4 | – | > 10 % des recherches |

### 3.3 Ce qu'on ne suit PAS comme objectif
Followers, likes, vues TikTok, impressions, reach, ouvertures de la newsletter. Ils servent à comprendre un canal (une vidéo qui a 20 000 vues et 0 commande est une information), jamais d'objectif.

## 4. Tableau de bord minimal (20 minutes, chaque lundi)

Une feuille de calcul, une ligne par semaine. Les lignes sont remplies dans cet ordre (les 4 premières viennent de la base, donc fiables) :

| Semaine du… | Commandes livrées | Panier moyen | Marge de contribution totale | Dépenses marketing | CAC mélangé | Sessions (GA4) | Conv. session→commande | Échecs COD % / Paiement abouti % | Livraison J+1 % | Note/remarques |
|---|---|---|---|---|---|---|---|---|---|---|

Rituel :
1. Remplir la ligne (base + carnet + GA4 + Ads Manager).
2. Comparer chaque KPI au seuil d'alerte (colonne 3.1). **Pas de décision sur une semaine isolée** pour les taux (trop peu de données) : regarder la moyenne glissante 2 semaines ; pour les opérations (échecs, retards), une seule semaine suffit.
3. Choisir **une** action pour la semaine (pas plus de 3 priorités simultanées dans le plan).
4. Noter l'apprentissage dans `docs/marketing/` (fichier `marketing-learnings.md` à créer à la semaine 4).

## 5. Règles de décision (pré-engagées, pour ne pas décider sous émotion)

| Situation | Décision |
|---|---|
| Une campagne a dépensé ≥ 10 000 F **et** ≥ 7 jours, CAC > 4 500 F | Pause, changer le visuel/ciblage, une seule variable. |
| Une campagne CAC ≤ 2 500 F sur ≥ 8 commandes | Augmenter de 20 % maximum tous les 4 jours ; jamais doubler d'un coup. |
| Conversation → commande < 10 % après 40 conversations | Ne pas dépenser plus ; retravailler le script de réponse WhatsApp (brief copy à Marcus via Kody). |
| Échec COD > 20 % sur ≥ 20 COD | Activer la règle de prépaiement hors Cotonou/Calavi (expérience 3) et/ou confirmation obligatoire. |
| Paiement en ligne abouti < 65 % | Priorité n°1 technique : parcours MoMo, durée d'expiration, relances WhatsApp des commandes en attente. |
| Couverture du suivi < 25 % | Vérifier balises, CSP et bandeau avant toute décision basée sur GA4. |
| Livraison J+1 < 80 % | Réduire la promesse affichée (via Helena) ou avancer l'heure limite avant de recruter du trafic. |
| Stock d'un best-seller ≤ 3 | Arrêter la pub qui le pousse, réapprovisionner. |

Tailles d'échantillon minimales pour conclure : un taux d'étape (ajout panier) = ≈ 1 200 sessions par variante pour voir 6 % → 9 % ; la conversion globale 1 % → 1,5 % = ≈ 7 700 sessions par variante [CALCUL] : inatteignable au démarrage, donc pour la conversion globale on juge en avant/après avec garde-fous, pas en "test A/B concluant".

## 6. Requêtes de lecture (SQL, Supabase SQL editor, lecture seule)

À exécuter par Fresnel ou Kody ; elles reposent sur les colonnes de `0001_core.sql` (`orders`: `status`, `pay`, `zone`, `subtotal`, `shipping_fee`, `total`, `paid`, `paid_at`, `cod_verified`, `created_at`, `delivered_at`). Fuseau Africa/Porto-Novo.

```sql
-- Commandes, livrées, annulées, panier moyen (par semaine)
select date_trunc('week', created_at at time zone 'Africa/Porto-Novo')::date as semaine,
       count(*) filter (where status <> 'annulee') as commandes,
       count(*) filter (where status = 'livree')   as livrees,
       count(*) filter (where status = 'annulee')  as annulees,
       round(avg(subtotal) filter (where status <> 'annulee')) as panier_moyen,
       sum(subtotal) filter (where status <> 'annulee')        as ca_produits
from public.orders group by 1 order by 1 desc limit 12;

-- Échecs COD
select date_trunc('week', created_at at time zone 'Africa/Porto-Novo')::date as semaine,
       count(*) as cod,
       count(*) filter (where status = 'annulee') as cod_annulees,
       round(100.0 * count(*) filter (where status = 'annulee') / count(*), 1) as pct_echec
from public.orders where pay = 'cod' group by 1 order by 1 desc;

-- Paiement en ligne abouti
select date_trunc('week', created_at at time zone 'Africa/Porto-Novo')::date as semaine,
       count(*) as en_ligne,
       count(*) filter (where paid) as payees,
       round(100.0 * count(*) filter (where paid) / count(*), 1) as pct_abouti
from public.orders where pay <> 'cod' group by 1 order by 1 desc;

-- Livraison J+1 tenue (Cotonou/Calavi, commande avant 18 h, lundi-vendredi)
select count(*) as concernees,
       round(100.0 * count(*) filter (where (delivered_at at time zone 'Africa/Porto-Novo')::date
             <= (created_at at time zone 'Africa/Porto-Novo')::date + 1) / count(*), 1) as pct_j1
from public.orders
where zone = 'cotonou' and status = 'livree'
  and (created_at at time zone 'Africa/Porto-Novo')::time < '18:00'
  and extract(isodow from created_at at time zone 'Africa/Porto-Novo') between 1 and 5;
```
Remarques : l'heure limite 18 h est un réglage (`cutoff`) ; si Fresnel la change, adapter la requête. `cod_annulees` inclut les annulations demandées par le client avant expédition (acceptable en première lecture ; si besoin, distinguer plus tard le motif "refus à la livraison").

## 7. Fréquence de revue

| Rythme | Contenu |
|---|---|
| Quotidien (5 min, après 19 h) | Commandes du jour, ruptures, paiements en attente > 60 min, réponses WhatsApp en retard |
| Hebdo (lundi, 20 min) | Tableau §4, une action pour la semaine |
| Mensuel (1 h) | Marge de contribution du mois vs carnet, recalibrage des cibles, bilan des expériences |
| Fin de 90 jours | Comparaison avec scénarios §2, décision de scaler / pivoter canal / corriger l'opérationnel |
