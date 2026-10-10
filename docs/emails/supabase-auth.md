# Brancher les e-mails sur Resend et appliquer le design

Trois étapes à faire **une fois** (environ 20 minutes). Ensuite, tous les e-mails partent de `@waxo.boutique` avec le design du site.

## 1. Resend : vérifier le domaine `waxo.boutique`

1. resend.com → **Domains → Add Domain** → `waxo.boutique` (région : la plus proche, par exemple `eu-west-1`).
2. Resend affiche 3 ou 4 enregistrements DNS (MX/TXT « send », TXT DKIM `resend._domainkey`, éventuellement DMARC).
3. Hostinger → **Domaines → waxo.boutique → DNS / Nameservers → Gérer les enregistrements DNS** : ajouter chaque enregistrement tel quel (type, nom, valeur).
4. Revenir sur Resend → **Verify DNS Records**. Statut attendu : **Verified** (de quelques minutes à quelques heures).
5. Resend → **API Keys → Create API Key** (permission « Sending access », domaine `waxo.boutique`). La copier : elle ne s'affiche qu'une fois.

## 2. Supabase : envoyer les e-mails de compte par Resend (SMTP)

Supabase → **Authentication → Emails → SMTP Settings** → activer **Enable Custom SMTP** :

| Champ | Valeur |
|---|---|
| Sender email | `compte@waxo.boutique` |
| Sender name | `Wá xɔ` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | la clé API Resend (`re_…`) |

Enregistrer. Les e-mails d'inscription et de mot de passe oublié partent désormais de `compte@waxo.boutique`, sans la limite de quelques envois par heure de Supabase.

## 3. Supabase : appliquer le design (modèles)

Les modèles sont dans `supabase/email-templates/` (générés par `node scripts/gen-auth-emails.mjs`) et déclarés dans `supabase/config.toml`.

Depuis le dossier `waxo`, dans un terminal :

```
npx supabase login
npx supabase config diff --project-ref btarkkjimnkmiaxzonzq
npx supabase config push --project-ref btarkkjimnkmiaxzonzq
```

- `login` ouvre le navigateur une fois.
- `diff` montre ce qui va changer : les 6 modèles, les 2 notifications de sécurité, l'URL du site (`https://www.waxo.boutique`) et les URL de retour autorisées. Rien d'autre n'est modifié : le fichier ne déclare que ces réglages.
- `push` applique. Relancer `diff` ensuite : il ne doit plus rien signaler.

Sans terminal : Supabase → **Authentication → Emails → Templates**, puis pour chaque modèle (Confirm signup, Reset password, Change email address, Magic link, Invite user, Reauthentication) copier l'objet et le contenu du fichier `.html` correspondant.

## 4. Vercel : variables des e-mails de commande

| Variable | Valeur |
|---|---|
| `RESEND_API_KEY` | la même clé `re_…` |
| `EMAIL_FROM` | `Wá xɔ <commandes@waxo.boutique>` |
| `ORDER_NOTIFY_EMAIL` | facultatif : l'adresse qui reçoit les alertes « Nouvelle commande » (sinon l'e-mail de contact des Réglages) |

Redéployer après modification.

## Vérifier

1. Créer un compte de test sur le site : l'e-mail « Confirmez votre adresse e-mail » arrive de `compte@waxo.boutique`, avec le design.
2. « Mot de passe oublié » : e-mail « Choisissez un nouveau mot de passe ».
3. Une commande à la livraison avec un e-mail : le client reçoit « Commande confirmée », la boutique reçoit « Nouvelle commande ».
4. Resend → **Emails** : chaque envoi y apparaît (statut Delivered).

## À savoir

- La langue des e-mails de compte suit la langue d'inscription ; les comptes créés avant cette mise à jour reçoivent la version française. L'objet est toujours en français (limite de Supabase).
- Modifier un texte : éditer `scripts/gen-auth-emails.mjs`, relancer `node scripts/gen-auth-emails.mjs`, puis `config push`.
- Inventaire complet des e-mails : `docs/emails/inventaire.md`.
