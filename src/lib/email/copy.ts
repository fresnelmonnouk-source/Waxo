// Textes des e-mails de commande, repris de docs/copy/emails.md (Marcus). Variables au format {{name}} :
// name, orderNumber, total, deliveryDate, whatsapp, shopName, email. Marqueur de paragraphe {{items}} = liste des articles.
// Un paragraphe peut contenir des « \n » (retour à la ligne). L'espace insécable (U+00A0) est voulu avant ? ! : ; en français.

export type OrderEmailKind = "confirmation" | "paid" | "preparation" | "livraison" | "livree" | "annulee";
export type EmailLocale = "fr" | "en";

export type Variant = {
  subject: string;
  preheader: string;
  /** Paragraphes du corps, signature comprise. « {{items}} » = bloc des articles. */
  body: string[];
  cta?: string;
};

/** online = moyen de paiement en ligne ; cod = paiement à la livraison (retombe sur online si absent). */
export type KindCopy = { online: Variant; cod?: Variant };

/**
 * Phrase de remboursement de l'e-mail « annulée » (en ligne, payée). Marcus l'a marquée « à valider par Helena » :
 * tant que ce n'est pas fait, on utilise la formulation prudente (contact WhatsApp). Passer à true après validation.
 */
export const REFUND_CLAIM_VALIDATED = false;

const NB = " ";

export const EMAIL_COPY: Record<EmailLocale, Record<OrderEmailKind, KindCopy>> = {
  fr: {
    confirmation: {
      online: {
        subject: "Commande {{orderNumber}} bien reçue",
        preheader: "Nous confirmons votre paiement, puis nous préparons vos articles.",
        body: [
          "Bonjour {{name}},",
          "Merci, votre commande {{orderNumber}} est bien enregistrée.",
          "{{items}}",
          `Total${NB}: {{total}}`,
          "Nous confirmons votre paiement, puis nous préparons vos articles.\nLivraison prévue : {{deliveryDate}}.",
          "Nous vous écrivons sur WhatsApp pour confirmer le créneau.\nLe livreur vous appelle avant d'arriver.",
          "L'équipe {{shopName}}",
        ],
        cta: "Suivre ma commande",
      },
      cod: {
        subject: "Commande {{orderNumber}} confirmée",
        preheader: "Vous payez le livreur à la réception. Livraison prévue : {{deliveryDate}}.",
        body: [
          "Bonjour {{name}},",
          "Merci, votre commande {{orderNumber}} est confirmée.",
          "{{items}}",
          `Total à régler à la livraison${NB}: {{total}}, en espèces ou par Mobile Money.`,
          "Livraison prévue : {{deliveryDate}}.\nNous vous écrivons sur WhatsApp pour confirmer le créneau.\nLe livreur vous appelle avant d'arriver.",
          "L'équipe {{shopName}}",
        ],
        cta: "Suivre ma commande",
      },
    },
    paid: {
      online: {
        subject: "Paiement reçu pour la commande {{orderNumber}}",
        preheader: "Merci. Nous préparons vos articles. Livraison prévue : {{deliveryDate}}.",
        body: [
          "Bonjour {{name}},",
          "Nous avons bien reçu votre paiement de {{total}} pour la commande {{orderNumber}}. Merci.",
          "{{items}}",
          "Nous préparons vos articles.\nLivraison prévue : {{deliveryDate}}.\nLe livreur vous appelle avant d'arriver.",
          "L'équipe {{shopName}}",
        ],
        cta: "Suivre ma commande",
      },
    },
    preparation: {
      online: {
        subject: "Nous préparons votre commande {{orderNumber}}",
        preheader: "Vos articles sont en cours d'emballage. Livraison prévue : {{deliveryDate}}.",
        body: [
          "Bonjour {{name}},",
          "Bonne nouvelle : nous préparons votre commande {{orderNumber}}.",
          "{{items}}",
          "Nous emballons vos articles, puis le livreur prend le relais.\nLivraison prévue : {{deliveryDate}}.",
          "L'équipe {{shopName}}",
        ],
        cta: "Suivre ma commande",
      },
      cod: {
        subject: "Nous préparons votre commande {{orderNumber}}",
        preheader: "Vos articles sont en cours d'emballage. Livraison prévue : {{deliveryDate}}.",
        body: [
          "Bonjour {{name}},",
          "Bonne nouvelle : nous préparons votre commande {{orderNumber}}.",
          "{{items}}",
          "Nous emballons vos articles, puis le livreur prend le relais.\nLivraison prévue : {{deliveryDate}}.",
          "Préparez {{total}} pour le livreur, en espèces ou par Mobile Money.",
          "L'équipe {{shopName}}",
        ],
        cta: "Suivre ma commande",
      },
    },
    livraison: {
      online: {
        subject: "Votre commande {{orderNumber}} est en route",
        preheader: "Le livreur vous appelle avant d'arriver. Gardez votre téléphone à portée.",
        body: [
          "Bonjour {{name}},",
          "Votre commande {{orderNumber}} est en route.",
          `Livraison prévue : {{deliveryDate}}.\nLe livreur vous appelle avant d'arriver${NB}: gardez votre téléphone à portée de main.`,
          "{{paidLine}}",
          "L'équipe {{shopName}}",
        ],
        cta: "Suivre ma commande",
      },
      cod: {
        subject: "Votre commande {{orderNumber}} est en route",
        preheader: "Le livreur vous appelle avant d'arriver. Gardez votre téléphone à portée.",
        body: [
          "Bonjour {{name}},",
          "Votre commande {{orderNumber}} est en route.",
          `Livraison prévue : {{deliveryDate}}.\nLe livreur vous appelle avant d'arriver${NB}: gardez votre téléphone à portée de main.`,
          "Montant à régler à la réception : {{total}}, en espèces ou par Mobile Money.",
          "L'équipe {{shopName}}",
        ],
        cta: "Suivre ma commande",
      },
    },
    livree: {
      online: {
        subject: "Commande {{orderNumber}} livrée, merci",
        preheader: "Un article ne convient pas ? Vous avez 7 jours pour changer d'avis.",
        body: [
          "Bonjour {{name}},",
          "Votre commande {{orderNumber}} est livrée. Merci d'avoir commandé chez {{shopName}}.",
          "Un article ne convient pas ? Vous avez 7 jours pour changer d'avis : échange ou remboursement.\nÉcrivez-nous sur WhatsApp au {{whatsapp}} avec votre numéro de commande.",
          "L'équipe {{shopName}}",
        ],
        cta: "Voir ma commande",
      },
    },
    annulee: {
      online: {
        subject: "Commande {{orderNumber}} annulée",
        preheader: "Votre commande a été annulée. Une question ? Écrivez-nous sur WhatsApp.",
        body: [
          "Bonjour {{name}},",
          "Votre commande {{orderNumber}} ({{total}}) a été annulée.",
          "{{items}}",
          "{{refundLine}}",
          "Une question ? Écrivez-nous sur WhatsApp au {{whatsapp}} en indiquant le numéro {{orderNumber}}.\nVous pouvez repasser commande quand vous le souhaitez.",
          "L'équipe {{shopName}}",
        ],
      },
    },
  },
  en: {
    confirmation: {
      online: {
        subject: "Order {{orderNumber}} received",
        preheader: "We are confirming your payment, then we will pack your items.",
        body: [
          "Hello {{name}},",
          "Thank you, your order {{orderNumber}} is in.",
          "{{items}}",
          "Total: {{total}}",
          "We are confirming your payment, then we will pack your items.\nExpected delivery: {{deliveryDate}}.",
          "We will message you on WhatsApp to confirm the delivery slot.\nThe courier calls you before arriving.",
          "The {{shopName}} team",
        ],
        cta: "Track my order",
      },
      cod: {
        subject: "Order {{orderNumber}} confirmed",
        preheader: "You pay the courier on delivery. Expected delivery: {{deliveryDate}}.",
        body: [
          "Hello {{name}},",
          "Thank you, your order {{orderNumber}} is confirmed.",
          "{{items}}",
          "Total to pay on delivery: {{total}}, in cash or by Mobile Money.",
          "Expected delivery: {{deliveryDate}}.\nWe will message you on WhatsApp to confirm the delivery slot.\nThe courier calls you before arriving.",
          "The {{shopName}} team",
        ],
        cta: "Track my order",
      },
    },
    paid: {
      online: {
        subject: "Payment received for order {{orderNumber}}",
        preheader: "Thank you. We are packing your items. Expected delivery: {{deliveryDate}}.",
        body: [
          "Hello {{name}},",
          "We have received your payment of {{total}} for order {{orderNumber}}. Thank you.",
          "{{items}}",
          "We are packing your items.\nExpected delivery: {{deliveryDate}}.\nThe courier calls you before arriving.",
          "The {{shopName}} team",
        ],
        cta: "Track my order",
      },
    },
    preparation: {
      online: {
        subject: "We are packing your order {{orderNumber}}",
        preheader: "Your items are being packed. Expected delivery: {{deliveryDate}}.",
        body: [
          "Hello {{name}},",
          "Good news: we are packing your order {{orderNumber}}.",
          "{{items}}",
          "Once it is packed, the courier takes over.\nExpected delivery: {{deliveryDate}}.",
          "The {{shopName}} team",
        ],
        cta: "Track my order",
      },
      cod: {
        subject: "We are packing your order {{orderNumber}}",
        preheader: "Your items are being packed. Expected delivery: {{deliveryDate}}.",
        body: [
          "Hello {{name}},",
          "Good news: we are packing your order {{orderNumber}}.",
          "{{items}}",
          "Once it is packed, the courier takes over.\nExpected delivery: {{deliveryDate}}.",
          "Please have {{total}} ready for the courier, in cash or by Mobile Money.",
          "The {{shopName}} team",
        ],
        cta: "Track my order",
      },
    },
    livraison: {
      online: {
        subject: "Your order {{orderNumber}} is on its way",
        preheader: "The courier calls you before arriving. Keep your phone handy.",
        body: [
          "Hello {{name}},",
          "Your order {{orderNumber}} is on its way.",
          "Expected delivery: {{deliveryDate}}.\nThe courier calls you before arriving: keep your phone handy.",
          "{{paidLine}}",
          "The {{shopName}} team",
        ],
        cta: "Track my order",
      },
      cod: {
        subject: "Your order {{orderNumber}} is on its way",
        preheader: "The courier calls you before arriving. Keep your phone handy.",
        body: [
          "Hello {{name}},",
          "Your order {{orderNumber}} is on its way.",
          "Expected delivery: {{deliveryDate}}.\nThe courier calls you before arriving: keep your phone handy.",
          "Amount due on delivery: {{total}}, in cash or by Mobile Money.",
          "The {{shopName}} team",
        ],
        cta: "Track my order",
      },
    },
    livree: {
      online: {
        subject: "Order {{orderNumber}} delivered, thank you",
        preheader: "Something not right? You have 7 days to change your mind.",
        body: [
          "Hello {{name}},",
          "Your order {{orderNumber}} has been delivered. Thank you for ordering from {{shopName}}.",
          "Something not right? You have 7 days to change your mind: exchange or refund.\nWrite to us on WhatsApp at {{whatsapp}} with your order number.",
          "The {{shopName}} team",
        ],
        cta: "View my order",
      },
    },
    annulee: {
      online: {
        subject: "Order {{orderNumber}} cancelled",
        preheader: "Your order has been cancelled. Questions? Write to us on WhatsApp.",
        body: [
          "Hello {{name}},",
          "Your order {{orderNumber}} ({{total}}) has been cancelled.",
          "{{items}}",
          "{{refundLine}}",
          "A question? Write to us on WhatsApp at {{whatsapp}} and quote order {{orderNumber}}.\nYou are welcome to order again whenever you like.",
          "The {{shopName}} team",
        ],
      },
    },
  },
};

/** Lignes variables selon l'état de paiement (marqueurs {{paidLine}} et {{refundLine}}). */
export const SPECIAL_LINES: Record<
  EmailLocale,
  { paid: string; refundValidated: string; refundCautious: string; nothingToPay: string; greetingAnonymous: string }
> = {
  fr: {
    paid: "Votre commande est déjà payée, vous n'avez rien à régler.",
    refundValidated: "Si vous aviez payé en ligne, le montant est remboursé sur le moyen de paiement utilisé.",
    refundCautious: "Si vous aviez payé en ligne, contactez-nous sur WhatsApp au {{whatsapp}} au sujet du remboursement.",
    nothingToPay: "Vous n'avez rien à payer.",
    greetingAnonymous: "Bonjour,",
  },
  en: {
    paid: "Your order is already paid, so there is nothing to pay.",
    refundValidated: "If you paid online, the amount is refunded to the payment method you used.",
    refundCautious: "If you paid online, please contact us on WhatsApp at {{whatsapp}} about your refund.",
    nothingToPay: "You have nothing to pay.",
    greetingAnonymous: "Hello,",
  },
};

export const EMAIL_FOOTER: Record<EmailLocale, string[]> = {
  fr: [
    "{{shopName}} · Cotonou, Bénin",
    "WhatsApp {{whatsapp}} · {{email}}",
    "Vous recevez ce message parce que vous avez passé commande sur {{shopName}}.",
    "Nous ne vous demanderons jamais votre code secret Mobile Money.",
  ],
  en: [
    "{{shopName}} · Cotonou, Benin",
    "WhatsApp {{whatsapp}} · {{email}}",
    "You are receiving this message because you placed an order with {{shopName}}.",
    "We will never ask for your Mobile Money PIN.",
  ],
};

export const ITEMS_QTY_LABEL: Record<EmailLocale, string> = { fr: "Qté", en: "Qty" };
