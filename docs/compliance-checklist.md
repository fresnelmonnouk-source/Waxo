# Checklist de conformité avant mise en ligne : Waxo (Wá xɔ)

Maintenue par Helena. Créée le 2026-10-09 à partir de `docs/reviews/helena-conformite-J1.md` (les identifiants B/M/L renvoient à ce rapport).
Légende : [ ] à faire · [x] fait · 🔴 bloquant publication · 🟠 avant le premier encaissement · 🟡 recommandé.
Cadre : droit béninois (Code du numérique, loi n° 2017-20 modifiée ; APDP ; OHADA ; UEMOA), RGPD en référence. Tout point « à vérifier par un juriste local » est à confirmer avant publication. Évaluation de risque, pas un conseil juridique formel.

## 1. Identité légale et mentions

- [ ] 🔴 Statut de l'exploitant décidé (entrepreneur individuel / entreprenant / société) et confirmé par un juriste ou fiscaliste local (B4)
- [ ] 🔴 RCCM et IFU obtenus (ou statut simplifié équivalent), valeurs saisies dans `settings.legal` : jamais de valeur inventée (B4)
- [ ] 🔴 Raison sociale, forme, adresse, directeur de publication, hébergeur (nom, adresse, contact) renseignés dans les mentions légales (B4)
- [ ] 🔴 Aucun `<tbc>` / « [à compléter] » visible sur le site en production (CGV, CGU, mentions, confidentialité, livraison-retours)
- [ ] 🔴 Date « en vigueur » = date réelle de publication après validation, historique des versions conservé (B4)
- [ ] 🔴 Bandeau « modèle à valider » retiré SEULEMENT après validation par un juriste local
- [ ] 🔴 Vrais WhatsApp et e-mail de contact saisis en réglages, boîte e-mail testée en réception (B8)
- [ ] 🟠 Régime de TVA et facturation (e-MECeF ou équivalent) vérifiés ; mention « toutes taxes comprises » ajustée en conséquence (B4)
- [ ] 🟡 Photo « À propos » réelle avec autorisation des personnes, ou section supprimée (L1)

## 2. Pages légales : CGV, CGU, retours

- [ ] 🔴 Condition de retour hors Cotonou/Calavi décidée (qui paie) et écrite (M2, `shipping.condP`)
- [ ] 🟠 « 7 jours pour changer d'avis » : exclusions et « produit non utilisé » visibles près de chaque claim (accueil, fiche, panier, e-mails) (M2)
- [ ] 🟠 Cohérence « échange OU remboursement » : qui choisit ? (CGV art. 7 = client ; aligner `shipping.step3`) (M2)
- [ ] 🟠 CGV art. 8 : délai de signalement d'un défaut aligné sur les 7 jours + « sans limiter les droits légaux » (M3)
- [ ] 🟠 CGV : clauses commande non payée, refus de livraison COD (si pratique réelle), erreur de prix, langue (FR fait foi), recours du consommateur (M3)
- [ ] 🟠 CGV art. 4 : « WhatsApp ou SMS » remplacé par ce qui est réellement envoyé (validation Marcus/Helena)
- [ ] 🟠 CGV art. 5 : prestataire de paiement nommé et son statut vérifié ; carte réellement activée avant d'être annoncée (M13)
- [ ] 🟠 Version des CGV acceptée enregistrée avec chaque commande (M3)
- [ ] 🟠 Délai et procédure de remboursement écrits, testés sur : commande annulée payée, paiement reçu après annulation, montant différent (M13)
- [ ] 🟠 Droit de rétractation / retours : texte béninois applicable vérifié par un juriste local (M2)
- [ ] 🟡 Mention d'un recours (médiation / autorité de consommation) si l'obligation existe au Bénin : à vérifier

## 3. Promesses commerciales (claims)

- [ ] 🔴 Données de démonstration retirées de la production : avis (`seed`), `rating_seed`, `rating_seed_count`, `sold`, stocks fictifs, prix barrés fictifs (B1, B2)
- [ ] 🔴 Code : `getReviews` filtre `seed=false`, la note n'utilise plus `rating_seed` (B1)
- [ ] 🔴 Note moyenne et nombre d'avis affichés seulement sur de vrais avis publiés ; « Pas encore d'avis » sinon (B1)
- [ ] 🔴 Badge « Achat vérifié » posé uniquement sur une commande livrée du même compte (idéalement automatique) (B1, M6)
- [ ] 🔴 Moyens de paiement annoncés = moyens réellement opérationnels (`settings.pay`, `Footer.payments`, FAQ) (B9)
- [ ] 🟠 « Livré demain » : lieu + heure limite + jours toujours présents ; slogan global sans « demain » tant que le taux de livraison à J+1 n'est pas mesuré (M1)
- [ ] 🟠 Délais indicatifs et recours en cas de retard dans la CGV art. 6 (M1)
- [ ] 🟠 Heure limite calculée sur le fuseau de la boutique, dimanche et jours fériés gérés (M1)
- [ ] 🟠 Retrait de « dans l'heure », « bientôt de retour », « entre 9 h et 19 h », « reçu par WhatsApp », « sous 48 h » sans source (validation Marcus)
- [ ] 🟠 « Nos garanties » → « Nos engagements »
- [ ] 🟠 Prix barrés : prix de référence réellement pratiqué ≥ 30 jours, date de fin de promo, pas de promo permanente (M4)
- [ ] 🟠 « Best-seller » / « Plus vendus » : seuil minimal de ventes réelles ; « Nouveau » calculé par rapport à aujourd'hui (M5)
- [ ] 🟠 Texte de la politique d'avis : mode de vérification, pas de suppression d'avis négatifs, avis non rémunérés (M6)
- [ ] 🟡 Stock réel compté avant ouverture et à intervalle régulier (L5)
- [ ] 🟡 « Plus que N en stock » : seulement avec un stock réel, jamais de compte à rebours (L6)
- [ ] 🟡 Allégations produit étayées par le fournisseur : « sans BPA », « sans produit chimique », « sans irriter », « 50 % en 30 min », autonomies, étanchéité (L4)
- [ ] 🟡 Conformité et sécurité des produits électriques (chargeurs, batteries, lampes) confirmées auprès de l'importateur (L4)
- [ ] 🟡 Pas de franco ambigu en anglais : « free on orders of X or more » (L12)
- [ ] 🟡 Montants € / $ marqués « indicatifs, paiement en FCFA » quand le multi-devise sera livré (L9)

## 4. Données personnelles : RGPD / APDP

- [ ] 🔴 Formalités APDP accomplies (déclaration ou autorisation selon le traitement, transferts hors Bénin inclus) : régime vérifié par un juriste local ; référence saisie seulement ensuite (B5)
- [ ] 🔴 Phrase « le site fait l'objet d'une déclaration… » retirée tant que la formalité n'est pas faite (B5)
- [ ] 🔴 Politique de confidentialité complète : tableau finalité / données / base légale / durée / destinataires (B6)
- [ ] 🔴 Prestataires nommés (FedaPay, Supabase, Vercel, Resend, DeepSeek, Google, Meta, Sentry, WhatsApp) (B6)
- [ ] 🔴 Section « Transferts hors du Bénin » (B6, M11)
- [ ] 🔴 Section « Cookies et stockage local » avec tableau nom / finalité / durée / catégorie (B6, G3)
- [ ] 🟠 Droits complets (accès, rectification, opposition, suppression, portabilité, limitation, retrait du consentement), délai de réponse et vérification d'identité (B6, M10)
- [ ] 🟠 Sujet « Données personnelles » ajouté au formulaire de contact ; procédure interne écrite pour traiter une demande (M10)
- [ ] 🟠 Lien vers la confidentialité dans le tunnel de commande (M8)
- [ ] 🟠 Registre des sous-traitants (prestataire / données / pays / DPA accepté / date) tenu à jour (M11)
- [ ] 🟠 DPA acceptés : Supabase, Vercel, Resend, FedaPay, Sentry (M11)
- [ ] 🟠 Région Supabase choisie et documentée (M11)
- [ ] 🟠 Durées de conservation : tâches de purge automatiques (messages 1 an, comptes inactifs, etc.) OU texte reformulé (M9)
- [ ] 🟠 Durée de conservation comptable des commandes vérifiée par un fiscaliste local avant d'être écrite (M9)
- [ ] 🟠 Assistant IA : fournisseur nommé, avertissement dans la fenêtre, aucune donnée client envoyée au modèle, durée de conservation des conversations (M12)
- [ ] 🟠 Si un e-mail est collecté au checkout : facultatif, finalité « suivi de commande » seule, jamais pré-abonné à la newsletter (M14)
- [ ] 🟡 Mineurs : phrase dans la politique et les CGU (B6)
- [ ] 🟡 « Mot de passe haché » plutôt que « chiffré » (L2)
- [ ] 🟡 Suivi invité : limite de tentatives persistante (pas seulement en mémoire) (L8)
- [ ] 🟡 sessionStorage de dernière commande (nom, téléphone) cité dans la politique (L10)
- [ ] 🟡 Attribution (« Comment nous avez-vous connus ? », UTM) et étiquettes WhatsApp Business déclarées (L13)
- [ ] 🟡 Fichier d'incidents clients (refus COD) : n'existe que si déclaré dans la politique (M3)

## 5. Newsletter et prospection

- [ ] 🔴 Case newsletter décochée par défaut à l'inscription, libellé explicite, séparée de la case CGU (B3)
- [ ] 🔴 Texte « désinscription en un clic » reformulé, ET mécanisme réel avant le premier envoi : lien tokenisé (e-mail), « STOP » (WhatsApp) (B7)
- [ ] 🟠 Double opt-in (confirmation par e-mail ou message WhatsApp) avant toute prospection (M7)
- [ ] 🟠 Ligne `newsletter_subs` issue de l'inscription créée seulement après confirmation de l'e-mail du compte (M7)
- [ ] 🟠 Preuve de consentement : date, canal, source, version du texte conservés (M7)
- [ ] 🟠 Fréquence annoncée (« 1 par semaine max ») réellement bornée (B7)
- [ ] 🟠 Opt-in WhatsApp Business respecté (politique WhatsApp) avant le premier message marketing (M7)
- [ ] 🟡 E-mails de commande : aucun contenu promotionnel ; pied de page avec lien confidentialité et raison sociale (M14)
- [ ] 🟡 `Auth.cgu` reformulé « J'ai lu… » (L3)

## 6. Cookies et suivi (G3 : Meta Pixel, GA4, Sentry)

- [ ] 🔴 Aucune requête vers Google / Meta ni cookie `_ga*`, `_fbp`, `_fbc` avant un choix explicite (test réseau Playwright, tests : avant choix, après refus, après retrait)
- [ ] 🔴 « Tout refuser » aussi visible et aussi simple que « Tout accepter » (même taille, contraste, niveau) ; fermer = refuser
- [ ] 🔴 Catégories séparées (mesure d'audience / publicité), interrupteurs décochés par défaut
- [ ] 🔴 Lien « Gérer mes cookies » dans le pied de page de toutes les pages
- [ ] 🟠 Retrait du consentement : purge des cookies ET arrêt effectif des envois (`ga-disable`, `fbq('consent','revoke')` ou rechargement)
- [ ] 🟠 Choix stocké avec date et version, redemandé après 6 mois et à chaque changement de prestataire
- [ ] 🟠 GA4 : Signaux Google désactivés, personnalisation publicitaire désactivée, pas de User-ID, conservation minimale, aucune donnée personnelle
- [ ] 🟠 Meta Pixel : `autoConfig=false`, pas d'Advanced Matching, `Purchase` seulement sur paiement confirmé, pas d'API de conversions sans consentement
- [ ] 🟠 `page_location` nettoyée (sans requête ni fragment) sur `/connexion`, `/inscription`, `/compte`, `/suivi` et liens de réinitialisation de mot de passe
- [ ] 🟠 Événement `search` non envoyé si le terme contient `@` ou ≥ 6 chiffres
- [ ] 🟠 Textes du bandeau corrigés (« données agrégées » retiré, mention du partage avec Meta, « Aucun traceur de mesure ou de publicité… »)
- [ ] 🟠 Sentry : `sendDefaultPii: false`, corps de requête / cookies / en-têtes nettoyés, pas de replay, inscrit dans la politique
- [ ] 🟠 CSP limitée aux domaines Google / Meta / Sentry utilisés
- [ ] 🟡 Compteur de consentement anonyme : sans cookie, sans identifiant, sans IP ni User-Agent stockés, agrégé, cité dans la politique
- [ ] 🟡 Politique : durées des cookies lues dans la doc officielle Google / Meta au moment de la rédaction
- [ ] 🟡 Régime exact des traceurs au Bénin confirmé par un juriste local (standard strict appliqué en attendant)

## 7. Paiement et mobile money

- [ ] 🔴 Provider réel branché (FedaPay) et testé de bout en bout avec de vrais paiements (MoMo, Moov, Celtiis, carte) avant d'annoncer ces moyens (B9)
- [ ] 🔴 Sans provider réel : seuls les moyens opérationnels actifs dans `settings.pay`
- [ ] 🟠 Webhook : signature vérifiée, idempotence, montant contrôlé (mark_paid) ; états en attente / payé / échec visibles pour le client
- [ ] 🟠 Statut du prestataire vérifié avant d'écrire « agréé » (sinon « prestataire de paiement tiers ») (M13)
- [ ] 🟠 Remboursement : procédure, délai et frais Mobile Money décidés et affichés (M2, M13)
- [ ] 🟠 Aucun surcoût selon le moyen de paiement, ou surcoût affiché avant validation
- [ ] 🟠 Annulation automatique des commandes en ligne non payées : délai réel (cron quotidien en Hobby) aligné sur le texte de la CGV (M3)
- [ ] 🟠 « Ne communiquez jamais votre code secret / PIN » conservé dans le checkout, la FAQ, les e-mails
- [ ] 🟡 Numéro Mobile Money saisi (`payerPhone`) : transmis au prestataire, non conservé en clair au-delà du besoin ; cité dans la politique
- [ ] 🟡 Facture / reçu : exigence e-MECeF ou équivalent vérifiée avant d'envoyer un « reçu » (M14)

## 8. Publicité et promotions

- [ ] 🟠 Chaque pub ne reprend que des claims validés (livraison avec lieu + heure limite, retours avec conditions, prix réels)
- [ ] 🟠 Aucun faux témoignage, aucune capture d'avis de démonstration, photos clients avec autorisation écrite
- [ ] 🟠 Promotions : date de fin, conditions écrites, prix de référence réel
- [ ] 🟠 Prospection WhatsApp / SMS / e-mail uniquement avec opt-in prouvé ; pas de listes achetées
- [ ] 🟡 Influenceurs : mention « Publicité » / « Partenariat rémunéré »
- [ ] 🟡 Jeux concours et parrainage récompensé : règlement écrit, régime d'autorisation vérifié par un juriste local
- [ ] 🟡 Politiques Meta / Google / TikTok relues pour les catégories vendues (beauté, tech)

## 9. Contrôle final avant publication

- [ ] 🔴 Relecture des textes légaux par un juriste ou avocat béninois (FR) ; traduction EN alignée, « le français fait foi »
- [ ] 🔴 Parcours réel testé : inscription (case newsletter décochée), commande COD, commande en ligne, annulation, remboursement, désinscription, suppression de compte
- [ ] 🔴 Recherche finale dans le code et les messages de : `seed`, `[à compléter]`, `+229 01 00 00 00 00`, `contact@waxo.bj`, `Cash on delivery`, `à l'arrivée`, `dans l'heure`, `bientôt`
- [ ] 🔴 Confirmation explicite de Fresnel avant tout déploiement en production
- [ ] 🟠 Date de revue suivante fixée (3 mois après le lancement, ou à chaque changement de prestataire, de tarif ou de promesse)

Fichiers de référence : `docs/reviews/helena-conformite-J1.md`, `docs/reviews/marcus-copy.md`, `docs/copy/emails.md`, `docs/marketing/analytics-stack.md`.
