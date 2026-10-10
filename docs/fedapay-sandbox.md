# FedaPay — brancher et tester en sandbox

Vérifié le 2026-10-10 dans la documentation officielle (docs.fedapay.com) et le code des SDK officiels.

## Ce qui est confirmé (et déjà implémenté)

| Point | Valeur | Où dans le code |
|---|---|---|
| Base API | sandbox `https://sandbox-api.fedapay.com/v1` · réel `https://api.fedapay.com/v1` | `src/lib/payment/config.ts` |
| Créer la transaction | `POST /transactions` (`description`, `amount` entier, `currency.iso`, `callback_url`, `customer`, `custom_metadata`) | `src/lib/payment/fedapay.ts` |
| Lien de paiement | `POST /transactions/{id}/token` → `{ token, url }` | idem |
| Relire une transaction | `GET /transactions/{id}` (source de vérité, jamais le corps du webhook) | idem |
| En-tête de signature | `X-FEDAPAY-SIGNATURE: t=<timestamp>,s=<hex>` | `src/lib/payment/signature.ts` |
| Calcul | HMAC-SHA256 de `"<timestamp>.<corps brut>"` avec le **secret du webhook** | idem |
| Tolérance | 5 min (défaut des SDK) ; chaque nouvel essai de FedaPay porte une signature neuve | idem |
| Secret du webhook | **différent** de la clé API : `wh_sandbox_…` / `wh_live_…`, propre à chaque endpoint, révélé dans FedaPay (Webhooks → l'endpoint → « Click to reveal ») ; essai et réel ont chacun le leur | espace admin |
| Événements | `transaction.created / approved / declined / canceled / transferred / updated` (+ `customer.*`) ; on ne traite que `transaction.approved` | `src/app/api/webhooks/fedapay/route.ts` |
| Réponse attendue | tout 2xx = succès ; sinon FedaPay réessaie (9 fois, délais exponentiels plafonnés à 2 min), puis **désactive le webhook après 10 échecs** | route : 503 si panne transitoire, 200 si rien à faire |
| HTTPS | obligatoire, TLS 1.2/1.3 seulement | Vercel |

Clé API : `sk_sandbox_…` / `sk_live_…`. Le mode (essai / réel) se déduit du préfixe de la clé.

## Deux façons de renseigner les clés

1. **Espace admin → Réglages → Paiement en ligne (FedaPay)** (recommandé) : saisie de la clé API et du secret du webhook, chiffrées (AES-256-GCM) avant stockage, jamais réaffichées en entier, bouton « Tester la connexion ». Demande la variable serveur `SETTINGS_ENCRYPTION_KEY` (16 caractères minimum, à garder : si elle change, les clés enregistrées doivent être ressaisies) — à défaut, elle est dérivée de `SUPABASE_SERVICE_ROLE_KEY`.
2. Variables d'environnement : `FEDAPAY_SECRET_KEY`, `FEDAPAY_WEBHOOK_SECRET` (`FEDAPAY_ENV` facultatif). Sert de repli : **ce qui est saisi en admin l'emporte**, secret par secret.

Autres variables utiles : `NEXT_PUBLIC_SITE_URL` (adresse du site : URL du webhook et retour de paiement), `CRON_SECRET` (cron d'expiration + rattrapage des paiements dont le webhook est perdu), `RECOVERY_COOKIE_SECRET` (facultatif).

## Pas à pas (sandbox)

1. FedaPay → espace de travail en mode **Essai** → API : copier la clé `sk_sandbox_…`.
2. FedaPay → **Webhooks** → ajouter `https://<votre-domaine>/api/webhooks/fedapay` (l'adresse exacte est affichée dans l'espace admin), cocher `transaction.approved`, enregistrer, révéler le secret `wh_sandbox_…`.
3. Espace admin → Réglages → Paiement : coller les deux, **Enregistrer**, puis **Tester la connexion**.
4. Faire une commande d'essai (Mobile Money avec les numéros de test FedaPay) et vérifier : commande payée, e-mail de confirmation, page « merci » à jour.
5. Rejouer la même notification depuis FedaPay (Webhooks → Logs → « Re-déclencher ») : la commande ne doit pas être payée deux fois (idempotence).
6. Passer au réel seulement après la recette : saisir `sk_live_…` + `wh_live_…` (la clé et le secret doivent être du même mode ; une confirmation est demandée).

## À surveiller

- Un webhook désactivé par FedaPay (10 échecs) ne notifie plus rien : le cron et la page « merci » rattrapent les paiements approuvés, mais il faut le réactiver dans FedaPay.
- FedaPay publie la liste des adresses IP d'où partent les webhooks : à ajouter en filtre côté hébergeur si souhaité (la signature reste la protection principale).
- Le XOF n'a pas de centimes : `amount` est le montant en francs entiers (déjà le cas : le total de la commande).
