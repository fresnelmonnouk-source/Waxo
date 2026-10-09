import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import fr from "@/messages/fr/account.json";
import en from "@/messages/en/account.json";
import { DEFAULT_SETTINGS } from "@/lib/catalog";
import { fmtXof } from "@/lib/money";

// Le lien i18n dépend du routeur Next : remplacé par un <a> simple pour le rendu serveur isolé.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => createElement("a", { href, ...rest }, children),
}));

async function render(doc: string, locale: "fr" | "en", settings = DEFAULT_SETTINGS) {
  const { LegalDoc } = await import("@/components/account/legal/LegalDoc");
  const { ShippingDoc } = await import("@/components/account/legal/ShippingDoc");
  const messages = locale === "fr" ? fr : en;
  const errors: string[] = [];
  const inner = doc === "shipping" ? createElement(ShippingDoc, { settings }) : createElement(LegalDoc, { doc: doc as "cgv", settings });
  const html = renderToStaticMarkup(
    // eslint-disable-next-line react/no-children-prop -- le typage de NextIntlClientProvider exige `children` dans les props
    createElement(NextIntlClientProvider, {
      locale,
      messages,
      children: inner,
      onError: (e) => {
        if (e.code !== "ENVIRONMENT_FALLBACK") errors.push(e.message);
      },
    }),
  );
  return { html, errors };
}

describe("pages légales : rendu avec les vrais messages et réglages", () => {
  for (const locale of ["fr", "en"] as const) {
    for (const doc of ["cgv", "cgu", "mentions", "privacy", "shipping"]) {
      it(`${doc} (${locale}) : aucune erreur de formatage, marqueurs « à compléter » présents où l'entité légale manque`, async () => {
        const { html, errors } = await render(doc, locale);
        expect(errors).toEqual([]);
        expect(html).not.toMatch(/\{[a-zA-Z]+\}/); // aucun paramètre non résolu
        expect(html).toContain("<mark");
      });
    }
  }

  it("injecte les réglages réels (franco, frais, délai de retour) et masque le paiement à la livraison s'il est coupé", async () => {
    const settings = { ...DEFAULT_SETTINGS, shipping: { ...DEFAULT_SETTINGS.shipping, freeFrom: 20000, returnDays: 14 }, pay: { ...DEFAULT_SETTINGS.pay, cod: false } };
    const cgv = await render("cgv", "fr", settings);
    expect(cgv.html).toContain(fmtXof(20000));
    expect(cgv.html).toContain("14 jours");
    expect(cgv.html).not.toContain("paiement à la livraison (espèces");
    const withCod = await render("cgv", "fr");
    expect(withCod.html).toContain("paiement à la livraison (espèces");
  });
});
