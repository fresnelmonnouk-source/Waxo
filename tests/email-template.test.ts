import { describe, expect, it } from "vitest";
import { renderOrderEmail, escapeHtml, formatAmount, type OrderEmailData } from "@/lib/email/template";
import { deliveryExpression } from "@/lib/email/delivery";
import { EMAIL_COPY, type OrderEmailKind } from "@/lib/email/copy";

const base: OrderEmailData = {
  locale: "fr",
  number: "WX-10264",
  name: "Afi Houngbédji",
  items: [
    { name: "Lampe solaire", qty: 2, unitPrice: 4500 },
    { name: "Gourde", qty: 1, unitPrice: 3000 },
  ],
  total: 13000,
  pay: "momo",
  paid: true,
  deliveryDate: "demain",
  brand: { shopName: "Wá xɔ", whatsapp: "+229 01 00 00 00 00", waNumber: "2290100000000", email: "contact@waxo.bj", hours: "" },
  siteUrl: "https://waxo.bj",
};

const KINDS: OrderEmailKind[] = ["confirmation", "paid", "preparation", "livraison", "livree", "annulee"];

describe("gabarits e-mail", () => {
  it("rend les 6 types en FR et EN, en ligne et COD, sans variable non remplacée", () => {
    for (const locale of ["fr", "en"] as const) {
      for (const pay of ["momo", "cod"]) {
        for (const kind of KINDS) {
          const r = renderOrderEmail({ ...base, locale, pay, paid: pay !== "cod", deliveryDate: locale === "fr" ? "demain" : "tomorrow" }, kind);
          for (const s of [r.subject, r.preheader, r.html, r.text]) expect(s).not.toMatch(/\{\{\w+\}\}/);
          expect(r.subject).toContain("WX-10264");
          expect(r.subject).not.toMatch(/[\r\n]/);
          expect(r.html).toContain("<!doctype html>");
          expect(r.html).toContain(`lang="${locale}"`);
          expect(r.text.length).toBeGreaterThan(40);
        }
      }
    }
  });

  it("suit le texte de Marcus : objets et variantes", () => {
    expect(renderOrderEmail(base, "paid").subject).toBe("Paiement reçu pour la commande WX-10264");
    expect(renderOrderEmail({ ...base, pay: "cod", paid: false }, "confirmation").subject).toBe("Commande WX-10264 confirmée");
    expect(renderOrderEmail(base, "confirmation").subject).toBe("Commande WX-10264 bien reçue");
    expect(renderOrderEmail({ ...base, locale: "en", deliveryDate: "tomorrow" }, "livree").subject).toBe("Order WX-10264 delivered, thank you");
    const cod = renderOrderEmail({ ...base, pay: "cod", paid: false }, "livraison");
    expect(cod.text).toContain("Montant à régler à la réception");
    expect(cod.text).not.toContain("déjà payée");
    expect(renderOrderEmail(base, "livraison").text).toContain("déjà payée");
    expect(renderOrderEmail({ ...base, pay: "cod", paid: false }, "preparation").text).toContain("Préparez");
    expect(renderOrderEmail({ ...base, pay: "cod", paid: false }, "annulee").text).toContain("Vous n'avez rien à payer.");
  });

  it("n'affirme « déjà payée » que si le paiement est confirmé", () => {
    expect(renderOrderEmail({ ...base, paid: false }, "livraison").text).not.toContain("déjà payée");
  });

  it("remboursement : formulation prudente tant que Helena n'a pas validé", () => {
    const t = renderOrderEmail(base, "annulee").text;
    expect(t).toContain("contactez-nous sur WhatsApp");
    expect(t).not.toContain("est remboursé");
  });

  it("le CTA pointe vers le suivi dans la langue de la commande ; aucun CTA pour l'annulation", () => {
    expect(renderOrderEmail(base, "paid").html).toContain('href="https://waxo.bj/fr/suivi"');
    expect(renderOrderEmail({ ...base, locale: "en" }, "paid").html).toContain('href="https://waxo.bj/en/suivi"');
    expect(renderOrderEmail(base, "annulee").html).not.toContain("/suivi");
    expect(renderOrderEmail({ ...base, siteUrl: null }, "paid").html).not.toContain("/suivi");
    expect(renderOrderEmail({ ...base, siteUrl: 'javascript:alert(1)"' }, "paid").html).not.toContain("javascript");
  });

  it("échappe TOUTE donnée client (nom, articles) et neutralise l'injection dans l'objet", () => {
    const evil = renderOrderEmail(
      { ...base, name: '<img src=x onerror=alert(1)> "Z"', items: [{ name: '<script>alert("x")</script>', qty: 1, unitPrice: 100 }] },
      "paid",
    );
    expect(evil.html).not.toContain("<script>");
    expect(evil.html).not.toContain("<img src=x");
    expect(evil.html).not.toContain("onerror");
    // Seule image autorisée : le logo de la marque, servi par le site.
    expect(evil.html.match(/<img /g) ?? []).toHaveLength(1);
    expect(evil.html).toContain('src="https://waxo.bj/email/logo-light.png"');
    expect(evil.html).toContain("&lt;script&gt;");
    const crlf = renderOrderEmail({ ...base, number: "WX-1\r\nBcc: x@evil" }, "paid");
    expect(crlf.subject).not.toMatch(/[\r\n]/);
  });

  it("sans prénom : « Bonjour, » ; avec un nom complet : le prénom seulement", () => {
    expect(renderOrderEmail({ ...base, name: "  " }, "paid").text.startsWith("Bonjour,")).toBe(true);
    expect(renderOrderEmail({ ...base, locale: "en", name: "" }, "paid").text.startsWith("Hello,")).toBe(true);
    expect(renderOrderEmail(base, "paid").text.startsWith("Bonjour Afi,")).toBe(true);
  });

  it("montants : FR « 13 000 F », EN « 13,000 F » avec espace insécable avant F", () => {
    expect(formatAmount(13000, "fr")).toMatch(/^13\s000 F$/);
    expect(formatAmount(13000, "en")).toBe("13,000 F");
    expect(renderOrderEmail({ ...base, locale: "en", deliveryDate: "tomorrow" }, "paid").text).toContain("13,000");
  });

  it("espace insécable avant : ? ! ; en français", () => {
    const r = renderOrderEmail(base, "paid");
    expect(r.text).toContain("Livraison prévue : demain");
    expect(r.preheader).toContain("prévue :");
  });

  it("pied de page : coordonnées de la marque et mention du code secret", () => {
    const r = renderOrderEmail(base, "paid");
    expect(r.text).toContain("contact@waxo.bj");
    expect(r.text).toContain("Nous ne vous demanderons jamais votre code secret Mobile Money.");
    expect(r.html).toContain("https://wa.me/2290100000000");
    expect(renderOrderEmail({ ...base, locale: "en", deliveryDate: "tomorrow" }, "paid").text).toContain("We will never ask for your Mobile Money PIN.");
  });

  it("objets : chaque type existe dans les deux langues avec les mêmes variantes", () => {
    for (const kind of KINDS) {
      expect(Object.keys(EMAIL_COPY.fr[kind]).sort()).toEqual(Object.keys(EMAIL_COPY.en[kind]).sort());
    }
  });

  it("escapeHtml échappe les guillemets simples et doubles", () => {
    expect(escapeHtml(`"'<&>`)).toBe("&quot;&#39;&lt;&amp;&gt;");
  });
});

describe("date de livraison annoncée", () => {
  // 2026-10-07 (mercredi) 10:00 UTC = 11:00 à Cotonou.
  const wed = Date.UTC(2026, 9, 7, 10, 0);
  const args = { cutoff: 18, locale: "fr" as const };

  it("Cotonou avant l'heure limite : demain ; après : sous 48 h", () => {
    expect(deliveryExpression({ zone: "cotonou", createdAt: wed, now: wed, ...args })).toBe("demain");
    const late = Date.UTC(2026, 9, 7, 18, 0); // 19 h locales
    expect(deliveryExpression({ zone: "cotonou", createdAt: late, now: late, ...args })).toBe("sous 48 h");
  });
  it("autres villes : 48 à 72 h ; EN traduit", () => {
    expect(deliveryExpression({ zone: "autre", createdAt: wed, now: wed, ...args })).toBe("sous 48 à 72 h");
    expect(deliveryExpression({ zone: "autre", createdAt: wed, now: wed, cutoff: 18, locale: "en" })).toBe("within 48 to 72 hours");
  });
  it("jamais « demain » le jour même ou après coup, jamais le dimanche", () => {
    const nextDay = wed + 86_400_000;
    expect(deliveryExpression({ zone: "cotonou", createdAt: wed, now: nextDay, ...args })).toBe("aujourd'hui");
    // Samedi 10 octobre 2026, avant la limite : le lendemain (dimanche) est repoussé au lundi.
    const sat = Date.UTC(2026, 9, 10, 9, 0);
    expect(deliveryExpression({ zone: "cotonou", createdAt: sat, now: sat, ...args })).toBe("sous 48 h");
    const mon = Date.UTC(2026, 9, 12, 9, 0);
    expect(deliveryExpression({ zone: "cotonou", createdAt: sat, now: mon, ...args })).toBe("aujourd'hui");
  });
  it("reste dans la limite de 25 caractères du gabarit", () => {
    for (const locale of ["fr", "en"] as const) {
      for (const zone of ["cotonou", "autre"]) {
        for (const h of [8, 20]) {
          const t = Date.UTC(2026, 9, 7, h - 1, 0);
          expect(deliveryExpression({ zone, createdAt: t, now: t, cutoff: 18, locale }).length).toBeLessThanOrEqual(25);
        }
      }
    }
  });
});
