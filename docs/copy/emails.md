# Waxo (Wá xɔ) — E-mails transactionnels de commande (FR + EN)

Rédaction : Marcus. À reprendre tel quel par F3 pour les gabarits Resend.
Les claims sont limités à ceux fournis par le brief. Helena valide.

---

## Étape 0 — Consignes de marque déduites (10 lignes)

1. Vouvoiement systématique (« vous »). En anglais : « you », jamais d'argot.
2. Phrases courtes, un fait par phrase, verbes au présent (« Le livreur vous appelle avant d'arriver »).
3. Promesse pivot : « Les petites choses utiles, livrées demain » ; la livraison lendemain ne vaut que pour Cotonou et Calavi, commande avant l'heure limite.
4. Concret avant tout : montants, numéro WX-…, créneau, moyen de paiement. Pas de superlatifs creux (« incroyable », « exceptionnel »).
5. Chaleur sobre : « Merci », « c'est commandé », « Bonne nouvelle ». Pas de points d'exclamation en série, pas d'emojis.
6. Réassurance factuelle plutôt que slogan : WhatsApp confirme, le livreur appelle avant d'arriver, 7 jours pour changer d'avis.
7. Paiements toujours nommés dans le même ordre : MTN MoMo, Moov Money, Celtiis Cash, carte, paiement à la livraison (espèces ou Mobile Money).
8. Sécurité dite simplement : on ne demande jamais le code secret ni le mot de passe.
9. Typographie FR : espace insécable avant ? ! : ; et entre un nombre et « h » ou « F » ; « e-mail » avec trait d'union ; « Mobile Money » avec majuscules.
10. Anglais : même ton direct, une seule orthographe (voir la relecture : recommandation britannique), « Pay on delivery » et non « Cash on delivery », « PIN » plutôt que « secret code ».

---

## Conventions pour F3

### Variables (format `{{name}}`)

| Variable | Contenu attendu |
|---|---|
| `{{name}}` | Prénom du client si connu, sinon nom complet. Si vide : supprimer la ligne « Bonjour {{name}}, » et mettre « Bonjour, » / « Hello, ». |
| `{{orderNumber}}` | Numéro public, ex. `WX-10258`. |
| `{{total}}` | Total TTC déjà formaté avec devise, ex. `12 500 F` (FR) ou `12,500 F` (EN). Espace insécable en FR. |
| `{{items}}` | Bloc liste des articles (une ligne par article : quantité × nom). Compte pour 1 mot. |
| `{{deliveryDate}}` | Expression qui complète « Livraison prévue : … » / « Expected delivery: … », en minuscules, 25 caractères maximum. Exemples FR : `demain`, `sous 48 à 72 h`, `le jeudi 15 octobre`. Exemples EN : `tomorrow`, `within 48 to 72 hours`, `on Thursday 15 October`. Calculée par le serveur (jamais « demain » après l'heure limite). |
| `{{trackUrl}}` | Lien de suivi de la commande. |
| `{{shopName}}` | `Wá xɔ`. |
| `{{whatsapp}}` | Numéro WhatsApp de la boutique, déjà formaté. |
| `{{email}}` | E-mail de contact de la boutique (pas celui du client). |

Aucune autre variable n'est utilisée. Le nombre de jours de retour est écrit en dur (« 7 jours / 7 days »). Si le réglage change, ce texte est à mettre à jour.

### Variantes
- Chaque e-mail a une variante **EN LIGNE** (MTN MoMo, Moov Money, Celtiis Cash, carte) et, quand le texte diffère, une variante **COD** (paiement à la livraison).
- Choisir la variante côté serveur d'après le moyen de paiement de la commande. Pas de variable supplémentaire.
- L'e-mail 2 (« Paiement reçu ») n'existe qu'en ligne. Il ne part jamais pour une commande COD.
- La variante EN LIGNE des e-mails 4 et 5 suppose un paiement confirmé. Si le paiement est encore en attente, ne pas envoyer la phrase « déjà payée ».

### Gabarit commun
- Largeur 600 px, texte 16 px, un seul bouton (CTA) quand il y a un CTA.
- Version texte brut obligatoire, avec les mêmes phrases.
- Pas d'image obligatoire. Logo en en-tête (mot-symbole, « ɔ » en terre cuite).
- Mots : « corps » comptés hors objet, pré-en-tête, CTA et pied de page.

### Pied de page (identique pour les 6)

**FR**
```
{{shopName}} · Cotonou, Bénin
WhatsApp {{whatsapp}} · {{email}}
Vous recevez ce message parce que vous avez passé commande sur {{shopName}}.
Nous ne vous demanderons jamais votre code secret Mobile Money.
```

**EN**
```
{{shopName}} · Cotonou, Benin
WhatsApp {{whatsapp}} · {{email}}
You are receiving this message because you placed an order with {{shopName}}.
We will never ask for your Mobile Money PIN.
```

Signature en fin de corps : « L'équipe {{shopName}} » / « The {{shopName}} team ».

---

# FRANÇAIS

## FR-1 · Confirmation de commande
Déclencheur : commande enregistrée (statut `nouvelle`).

### Variante EN LIGNE
- **Objet** (28 car.) : `Commande {{orderNumber}} bien reçue`
- **Pré-en-tête** (66 car.) : `Nous confirmons votre paiement, puis nous préparons vos articles.`
- **Corps** (≈ 50 mots) :

```
Bonjour {{name}},

Merci, votre commande {{orderNumber}} est bien enregistrée.

{{items}}
Total : {{total}}

Nous confirmons votre paiement, puis nous préparons vos articles.
Livraison prévue : {{deliveryDate}}.

Nous vous écrivons sur WhatsApp pour confirmer le créneau.
Le livreur vous appelle avant d'arriver.

L'équipe {{shopName}}
```
- **CTA** : `Suivre ma commande` → `{{trackUrl}}`

### Variante COD
- **Objet** (27 car.) : `Commande {{orderNumber}} confirmée`
- **Pré-en-tête** (≤ 83 car.) : `Vous payez le livreur à la réception. Livraison prévue : {{deliveryDate}}.`
- **Corps** (≈ 55 mots) :

```
Bonjour {{name}},

Merci, votre commande {{orderNumber}} est confirmée.

{{items}}
Total à régler à la livraison : {{total}}, en espèces ou par Mobile Money.

Livraison prévue : {{deliveryDate}}.
Nous vous écrivons sur WhatsApp pour confirmer le créneau.
Le livreur vous appelle avant d'arriver.

L'équipe {{shopName}}
```
- **CTA** : `Suivre ma commande` → `{{trackUrl}}`

---

## FR-2 · Paiement reçu (en ligne uniquement)
Déclencheur : paiement confirmé par le prestataire.

- **Objet** (39 car.) : `Paiement reçu pour la commande {{orderNumber}}`
- **Pré-en-tête** (≤ 81 car.) : `Merci. Nous préparons vos articles. Livraison prévue : {{deliveryDate}}.`
- **Corps** (≈ 50 mots) :

```
Bonjour {{name}},

Nous avons bien reçu votre paiement de {{total}} pour la commande {{orderNumber}}. Merci.

{{items}}

Nous préparons vos articles.
Livraison prévue : {{deliveryDate}}.
Le livreur vous appelle avant d'arriver.

L'équipe {{shopName}}
```
- **CTA** : `Suivre ma commande` → `{{trackUrl}}`
- Variante COD : sans objet.

---

## FR-3 · En préparation
Déclencheur : statut `preparation`.

- **Objet** (38 car.) : `Nous préparons votre commande {{orderNumber}}`
- **Pré-en-tête** (≤ 85 car.) : `Vos articles sont en cours d'emballage. Livraison prévue : {{deliveryDate}}.`
- **Corps EN LIGNE** (≈ 45 mots) :

```
Bonjour {{name}},

Bonne nouvelle : nous préparons votre commande {{orderNumber}}.

{{items}}

Nous emballons vos articles, puis le livreur prend le relais.
Livraison prévue : {{deliveryDate}}.

L'équipe {{shopName}}
```
- **Ligne ajoutée en COD**, avant la signature :
```
Préparez {{total}} pour le livreur, en espèces ou par Mobile Money.
```
- **CTA** : `Suivre ma commande` → `{{trackUrl}}`

---

## FR-4 · En livraison
Déclencheur : statut `livraison`.

- **Objet** (36 car.) : `Votre commande {{orderNumber}} est en route`
- **Pré-en-tête** (73 car.) : `Le livreur vous appelle avant d'arriver. Gardez votre téléphone à portée.`
- **Corps EN LIGNE** (≈ 50 mots) :

```
Bonjour {{name}},

Votre commande {{orderNumber}} est en route.

Livraison prévue : {{deliveryDate}}.
Le livreur vous appelle avant d'arriver : gardez votre téléphone à portée de main.

Votre commande est déjà payée, vous n'avez rien à régler.

L'équipe {{shopName}}
```
- **Corps COD** : remplacer la ligne « Votre commande est déjà payée… » par :
```
Montant à régler à la réception : {{total}}, en espèces ou par Mobile Money.
```
- **CTA** : `Suivre ma commande` → `{{trackUrl}}`

---

## FR-5 · Livrée
Déclencheur : statut `livree`.

- **Objet** (31 car.) : `Commande {{orderNumber}} livrée, merci`
- **Pré-en-tête** (67 car.) : `Un article ne convient pas ? Vous avez 7 jours pour changer d'avis.`
- **Corps** (≈ 55 mots, identique EN LIGNE et COD) :

```
Bonjour {{name}},

Votre commande {{orderNumber}} est livrée. Merci d'avoir commandé chez {{shopName}}.

Un article ne convient pas ? Vous avez 7 jours pour changer d'avis : échange ou remboursement.
Écrivez-nous sur WhatsApp au {{whatsapp}} avec votre numéro de commande.

L'équipe {{shopName}}
```
- **CTA** : `Voir ma commande` → `{{trackUrl}}`

---

## FR-6 · Annulée
Déclencheur : statut `annulee`.

- **Objet** (25 car.) : `Commande {{orderNumber}} annulée`
- **Pré-en-tête** (71 car.) : `Votre commande a été annulée. Une question ? Écrivez-nous sur WhatsApp.`
- **Corps EN LIGNE** (≈ 65 mots) :

```
Bonjour {{name}},

Votre commande {{orderNumber}} ({{total}}) a été annulée.

{{items}}

Si vous aviez payé en ligne, le montant est remboursé sur le moyen de paiement utilisé.

Une question ? Écrivez-nous sur WhatsApp au {{whatsapp}} en indiquant le numéro {{orderNumber}}.
Vous pouvez repasser commande quand vous le souhaitez.

L'équipe {{shopName}}
```
  - **[CLAIM À VALIDER PAR HELENA]** : la phrase « le montant est remboursé… » reprend `Account.orders.cancelled`. Si elle n'est pas validée, la remplacer par : `Si vous aviez payé en ligne, contactez-nous sur WhatsApp au {{whatsapp}} au sujet du remboursement.`
- **Corps COD** : remplacer la phrase de remboursement par :
```
Vous n'avez rien à payer.
```
- **CTA** : aucun (le contact WhatsApp est dans le texte). Raison : un seul geste utile, et `{{trackUrl}}` ne mène pas à la boutique.

---

# ENGLISH

## EN-1 · Order confirmation

### ONLINE variant
- **Subject** (24 chars): `Order {{orderNumber}} received`
- **Preheader** (61 chars): `We are confirming your payment, then we will pack your items.`
- **Body** (≈ 55 words):

```
Hello {{name}},

Thank you, your order {{orderNumber}} is in.

{{items}}
Total: {{total}}

We are confirming your payment, then we will pack your items.
Expected delivery: {{deliveryDate}}.

We will message you on WhatsApp to confirm the delivery slot.
The courier calls you before arriving.

The {{shopName}} team
```
- **CTA**: `Track my order` → `{{trackUrl}}`

### COD variant
- **Subject** (24 chars): `Order {{orderNumber}} confirmed`
- **Preheader** (≤ 78 chars): `You pay the courier on delivery. Expected delivery: {{deliveryDate}}.`
- **Body** (≈ 60 words):

```
Hello {{name}},

Thank you, your order {{orderNumber}} is confirmed.

{{items}}
Total to pay on delivery: {{total}}, in cash or by Mobile Money.

Expected delivery: {{deliveryDate}}.
We will message you on WhatsApp to confirm the delivery slot.
The courier calls you before arriving.

The {{shopName}} team
```
- **CTA**: `Track my order` → `{{trackUrl}}`

---

## EN-2 · Payment received (online only)

- **Subject** (36 chars): `Payment received for order {{orderNumber}}`
- **Preheader** (≤ 83 chars): `Thank you. We are packing your items. Expected delivery: {{deliveryDate}}.`
- **Body** (≈ 50 words):

```
Hello {{name}},

We have received your payment of {{total}} for order {{orderNumber}}. Thank you.

{{items}}

We are packing your items.
Expected delivery: {{deliveryDate}}.
The courier calls you before arriving.

The {{shopName}} team
```
- **CTA**: `Track my order` → `{{trackUrl}}`
- COD variant: not applicable.

---

## EN-3 · Being prepared

- **Subject** (35 chars): `We are packing your order {{orderNumber}}`
- **Preheader** (≤ 74 chars): `Your items are being packed. Expected delivery: {{deliveryDate}}.`
- **Body, ONLINE** (≈ 45 words):

```
Hello {{name}},

Good news: we are packing your order {{orderNumber}}.

{{items}}

Once it is packed, the courier takes over.
Expected delivery: {{deliveryDate}}.

The {{shopName}} team
```
- **Line added for COD**, before the sign-off:
```
Please have {{total}} ready for the courier, in cash or by Mobile Money.
```
- **CTA**: `Track my order` → `{{trackUrl}}`

---

## EN-4 · Out for delivery

- **Subject** (34 chars): `Your order {{orderNumber}} is on its way`
- **Preheader** (61 chars): `The courier calls you before arriving. Keep your phone handy.`
- **Body, ONLINE** (≈ 45 words):

```
Hello {{name}},

Your order {{orderNumber}} is on its way.

Expected delivery: {{deliveryDate}}.
The courier calls you before arriving: keep your phone handy.

Your order is already paid, so there is nothing to pay.

The {{shopName}} team
```
- **Body, COD**: replace the "already paid" line with:
```
Amount due on delivery: {{total}}, in cash or by Mobile Money.
```
- **CTA**: `Track my order` → `{{trackUrl}}`

---

## EN-5 · Delivered

- **Subject** (35 chars): `Order {{orderNumber}} delivered, thank you`
- **Preheader** (57 chars): `Something not right? You have 7 days to change your mind.`
- **Body** (≈ 55 words, same for ONLINE and COD):

```
Hello {{name}},

Your order {{orderNumber}} has been delivered. Thank you for ordering from {{shopName}}.

Something not right? You have 7 days to change your mind: exchange or refund.
Write to us on WhatsApp at {{whatsapp}} with your order number.

The {{shopName}} team
```
- **CTA**: `View my order` → `{{trackUrl}}`

---

## EN-6 · Cancelled

- **Subject** (25 chars): `Order {{orderNumber}} cancelled`
- **Preheader** (66 chars): `Your order has been cancelled. Questions? Write to us on WhatsApp.`
- **Body, ONLINE** (≈ 60 words):

```
Hello {{name}},

Your order {{orderNumber}} ({{total}}) has been cancelled.

{{items}}

If you paid online, the amount is refunded to the payment method you used.

A question? Write to us on WhatsApp at {{whatsapp}} and quote order {{orderNumber}}.
You are welcome to order again whenever you like.

The {{shopName}} team
```
  - **[CLAIM TO BE VALIDATED BY HELENA]**: the refund sentence mirrors `Account.orders.cancelled`. If not validated, replace with: `If you paid online, please contact us on WhatsApp at {{whatsapp}} about your refund.`
- **Body, COD**: replace the refund sentence with:
```
You have nothing to pay.
```
- **CTA**: none (WhatsApp contact is in the text).

---

## Récapitulatif des claims utilisés (pour Helena)

| Claim | E-mails | Source |
|---|---|---|
| Livraison prévue `{{deliveryDate}}` (demain à Cotonou/Calavi si commande avant l'heure limite) | 1, 2, 3, 4 | Brief |
| Confirmation par WhatsApp (créneau) | 1 | Brief |
| Le livreur appelle avant d'arriver | 1, 2, 4 | Brief |
| Paiement : MTN MoMo, Moov Money, Celtiis Cash, carte, à la livraison (espèces ou Mobile Money) | 1, 3, 4 (COD) | Brief + `Checkout.codNote` |
| 7 jours pour changer d'avis, échange ou remboursement | 5 | Brief |
| Remboursement d'un paiement en ligne sur le moyen utilisé | 6 | `Account.orders.cancelled` (hors brief, à valider) |
| On ne demande jamais le code secret / PIN | Pied de page | `Faq.a3` |

Non utilisés volontairement : « dans l'heure », « entre 9 h et 19 h », « bientôt de retour », délais de remboursement, SMS.

## Pistes en réserve (non incluses)
- Dans FR-5 / EN-5, un second CTA « Donner mon avis » : écarté, car seuls les clients inscrits peuvent publier un avis et il n'existe qu'une variable d'URL.
- Dans FR-3, une photo du colis préparé : à tester si l'équipe peut la fournir.
