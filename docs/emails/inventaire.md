# Wá xɔ — inventaire des e-mails

Mis à jour le 2026-10-11. Trois circuits d'envoi, un seul design (`src/lib/email/layout.ts`).

| Circuit | Qui envoie | Expéditeur | Où se règle le design |
|---|---|---|---|
| **Compte** (Auth) | Supabase Auth, **via le SMTP de Resend** (à régler dans Supabase) | `Wá xɔ <compte@waxo.boutique>` | `supabase/email-templates/*.html`, générés par `scripts/gen-auth-emails.mjs`, poussés par `supabase config push` |
| **Commandes** | Le site, API Resend | `EMAIL_FROM` (`Wá xɔ <commandes@waxo.boutique>`) | `src/lib/email/template.ts` + `copy.ts` |
| **Boutique** (alertes internes) | Le site, API Resend | `EMAIL_FROM` → e-mail de contact (Réglages) ou `ORDER_NOTIFY_EMAIL` | `src/lib/email/shop.ts` |

Pourquoi le SMTP Resend dans Supabase : sans lui, les e-mails de compte partent de l'expéditeur par défaut de Supabase (`noreply@mail.app.supabase.io`), avec un modèle sans design, limités à quelques envois par heure et souvent classés en spam.

## 1. Compte (Supabase Auth) — FR/EN selon la langue d'inscription

| # | E-mail | Déclencheur | Utilisé aujourd'hui | Contenu clé |
|---|---|---|---|---|
| A1 | **Confirmez votre adresse** (`confirmation`) | Inscription | ✅ | Bouton « Confirmer mon adresse », lien de secours, « vous n'avez rien demandé ? ignorez » |
| A2 | **Réinitialisez votre mot de passe** (`recovery`) | Mot de passe oublié | ✅ | Bouton, validité 1 h, conseil de sécurité |
| A3 | **Confirmez votre nouvelle adresse** (`email_change`) | Changement d'e-mail (Supabase / futur écran) | ⚪ prêt | Ancienne → nouvelle adresse, bouton |
| A4 | **Votre lien de connexion** (`magic_link`) | Connexion sans mot de passe (non utilisée) | ⚪ prêt | Bouton, validité 1 h |
| A5 | **Vous êtes invité(e)** (`invite`) | Invitation depuis Supabase (ex. ajout d'un membre d'équipe) | ⚪ prêt | Bouton « Créer mon mot de passe » |
| A6 | **Votre code de vérification** (`reauthentication`) | Action sensible re-vérifiée | ⚪ prêt | Code à 6 chiffres |
| A7 | **Votre mot de passe a été modifié** (notification) | Après changement de mot de passe | ✅ activée | « Ce n'était pas vous ? Contactez-nous » |
| A8 | **Votre adresse e-mail a été modifiée** (notification) | Après changement d'e-mail | ✅ activée | Idem |

Contraintes Supabase : pas de variable personnalisée (le nom de la marque est écrit en dur), une seule version par modèle (langue choisie par condition sur `locale` enregistré à l'inscription, français par défaut), objet unique par modèle (en français). Aucune donnée saisie par l'utilisateur (prénom…) n'est insérée : rien ne peut être injecté dans le HTML.

## 2. Commandes (client) — FR/EN selon la langue de la commande

Textes de Marcus (`docs/copy/emails.md`), inchangés. Variante « paiement à la livraison » quand elle diffère.

| # | E-mail | Déclencheur | Étape du suivi |
|---|---|---|---|
| C1 | **Commande reçue / confirmée** | Commande passée (à la livraison : tout de suite ; en ligne : à la création) | Reçue |
| C2 | **Paiement reçu** | Paiement FedaPay confirmé (webhook, retour, cron) | Reçue → payée |
| C3 | **Nous préparons votre commande** | Admin : statut « préparation » | Préparée |
| C4 | **Votre commande est en route** | Admin : statut « livraison » | En route |
| C5 | **Commande livrée, merci** | Admin : statut « livrée » | Livrée |
| C6 | **Commande annulée** | Admin ou expiration (paiement jamais reçu) | — |

Destinataire : e-mail saisi à la commande, sinon celui du compte. Sans adresse : pas d'e-mail (le client est suivi par WhatsApp).

## 3. Boutique (interne, français)

| # | E-mail | Déclencheur | Pourquoi |
|---|---|---|---|
| S1 | **Nouvelle commande WX-…** | Commande à la livraison confirmée, ou commande en ligne payée | Être prévenu sans surveiller l'admin : client, téléphone, adresse, articles, total, bouton « Ouvrir dans l'admin » |

## 4. Plus tard (non construits, à décider)

| E-mail | Condition préalable |
|---|---|
| Newsletter (campagnes) | Écran d'envoi + désinscription en un clic (exigence Helena B7), expéditeur sur sous-domaine dédié |
| Accusé de réception du formulaire de contact | Utile si le volume de messages augmente |
| Alerte « nouveau message » pour la boutique | Idem |
| Demande d'avis quelques jours après livraison | Consentement marketing à vérifier (Helena) |
