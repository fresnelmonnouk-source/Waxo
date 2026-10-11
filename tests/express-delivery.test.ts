import { createElement, type ComponentType, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import frCommon from "@/messages/fr/common.json";
import enCommon from "@/messages/en/common.json";
import frShop from "@/messages/fr/shop.json";
import enShop from "@/messages/en/shop.json";
import frProduct from "@/messages/fr/product.json";
import enProduct from "@/messages/en/product.json";
import frPacks from "@/messages/fr/packs.json";
import enPacks from "@/messages/en/packs.json";
import frConsent from "@/messages/fr/consent.json";
import enConsent from "@/messages/en/consent.json";
import { cutoffParams, ExpressBadge, fmtCutoff } from "@/components/shop/ExpressBadge";
import { DeliveryNote, DeliveryPromise, HeroDeliveryProof, StockPromise } from "@/components/shop/DeliveryPromise";

// Livraison Express (direction Vincent, docs/design/livraison-express-2026-10-11.md) : textes, typographie et rendu serveur.

const NBSP = " ";
const msgs = {
  fr: { ...frCommon, ...frShop, ...frProduct, ...frPacks, ...frConsent },
  en: { ...enCommon, ...enShop, ...enProduct, ...enPacks, ...enConsent },
};

/** Toutes les chaînes d'un objet de messages, avec leur chemin. */
function strings(o: unknown, prefix = ""): [string, string][] {
  if (typeof o === "string") return [[prefix, o]];
  if (o && typeof o === "object") return Object.entries(o).flatMap(([k, v]) => strings(v, prefix ? `${prefix}.${k}` : k));
  return [];
}
const keys = (o: unknown) => strings(o).map(([k]) => k).sort();

// Les surfaces Express de la boutique (le tunnel et les e-mails appartiennent à d'autres chantiers).
const express = (l: "fr" | "en") => {
  const m = msgs[l];
  return {
    Express: m.Express,
    topbar: m.Shell.topbar,
    home: { heroEyebrow: m.Home.heroEyebrow, lead: m.Home.lead, g3Title: m.Home.g3Title, g3Sub: m.Home.g3Sub, g3Hour: m.Home.g3Hour },
    footer: { tagline: m.Footer.tagline, blurb: m.Footer.blurb },
    product: { stockOk: m.Product.stockOk, stockLow: m.Product.stockLow },
    packs: { stockOk: m.Packs.detail.stockOk, stockLow: m.Packs.detail.stockLow, meta: m.Packs.metaDescription },
    seo: m.Seo,
  };
};

describe("messages Livraison Express", () => {
  it("FR et EN ont exactement les mêmes clés", () => {
    expect(keys(enCommon)).toEqual(keys(frCommon));
    expect(keys(express("en"))).toEqual(keys(express("fr")));
    expect(keys(enProduct)).toEqual(keys(frProduct));
    expect(keys(enPacks)).toEqual(keys(frPacks));
    expect(keys(enConsent)).toEqual(keys(frConsent));
  });

  it("plus aucun texte obsolète (Livraison rapide, du lundi au samedi, 18 h, tiret cadratin)", () => {
    for (const l of ["fr", "en"] as const) {
      for (const [k, v] of strings(express(l))) {
        expect(v, k).not.toMatch(/rapide|fast delivery|lundi au samedi|monday to saturday|18\s?h|—/i);
      }
    }
  });

  it("l'heure limite n'est jamais codée en dur : variable {hour} (FR « 20 h » insécable, EN « 8 pm »)", () => {
    for (const l of ["fr", "en"] as const) {
      for (const [k, v] of strings(express(l))) {
        expect(v, k).not.toMatch(/\b(20|8)\s?(h|pm)\b/i);
      }
    }
    expect(frShop.Home.g3Sub).toContain("{hour}");
    expect(enShop.Home.g3Sub).toContain("{hour}");
  });

  it("« aujourd'hui / le jour même » toujours avec l'heure limite ET Cotonou & Calavi", () => {
    for (const l of ["fr", "en"] as const) {
      for (const [k, v] of strings(express(l))) {
        if (/aujourd'hui|jour même|today|same day|same-day/i.test(v)) {
          expect(v, k).toMatch(/\{cutoff\}|\{hour\}/);
          expect(v, k).toMatch(/Cotonou & Calavi/);
        }
      }
    }
  });

  it("typographie FR : espace insécable avant « : ; ! ? », dans « 20 h » (via fmtCutoff), « 7 j/7 », « 72 h »", () => {
    for (const [k, v] of strings(express("fr"))) {
      expect(v, k).not.toMatch(/ [:;!?]/); // espace normale avant ponctuation haute
      expect(v, k).not.toMatch(/\{cutoff\} h|7 j\/7|72 h/);
    }
    // Ponctuation haute collée (sans espace insécable) interdite en FR, hors variables ICU et balises.
    for (const [k, v] of strings(express("fr"))) {
      expect(v.replace(/\{[^{}]*\}|<\/?b>/g, ""), k).not.toMatch(/[^\u00a0][:;!?]/);
    }
  });

  it("le slogan n'est que dans l'OG et le pied de page, toujours suivi de sa preuve", () => {
    expect(frShop.Footer.tagline).toBe("Vos commandes livrées dans les meilleurs délais.");
    expect(enShop.Footer.tagline).toBe("Your orders, delivered as fast as we can.");
    expect(frConsent.Seo.ogTitle).toBe(frShop.Footer.tagline);
    expect(enConsent.Seo.ogTitle).toBe(enShop.Footer.tagline);
    expect(frShop.Footer.blurb).toContain("{hour}");
    expect(frConsent.Seo.ogSubtitle).toContain("{hour}");
    expect(enConsent.Seo.ogSubtitle).toContain("{hour}");
  });
});

describe("heure limite affichée", () => {
  it("FR « 20 h » insécable, EN « 8 pm »", () => {
    expect(fmtCutoff(20, "fr")).toBe(`20${NBSP}h`);
    expect(fmtCutoff(20, "en")).toBe(`8${NBSP}pm`);
    expect(fmtCutoff(11, "en")).toBe(`11${NBSP}am`);
    expect(fmtCutoff(12, "en")).toBe(`12${NBSP}pm`);
  });
  it("réglage invalide : retombe sur la valeur par défaut", () => {
    expect(cutoffParams(99, "fr")).toEqual({ cutoff: 20, hour: `20${NBSP}h` });
    expect(cutoffParams(18, "en")).toEqual({ cutoff: 18, hour: `6${NBSP}pm` });
  });
});

const Provider = NextIntlClientProvider as unknown as ComponentType<{
  locale: string;
  messages: Record<string, unknown>;
  timeZone: string;
  onError: (e: { code?: string }) => void;
  children?: ReactNode;
}>;

function render(locale: "fr" | "en", el: ReactElement) {
  const errors: unknown[] = [];
  const html = renderToString(
    createElement(
      Provider,
      {
        locale,
        timeZone: "Africa/Porto-Novo",
        messages: msgs[locale],
        onError: (e) => {
          if (e.code !== "ENVIRONMENT_FALLBACK") errors.push(e);
        },
      },
      el,
    ),
  );
  return { html: html.replace(/<!-- -->/g, ""), errors };
}

describe.each(["fr", "en"] as const)("rendu serveur (%s) : état neutre, vrai à toute heure", (locale) => {
  it("promesse : texte neutre au SSR (aucun écart d'hydratation possible)", () => {
    const { html, errors } = render(locale, createElement(DeliveryPromise, { surface: "stock", cutoff: 20 }));
    expect(errors).toEqual([]);
    expect(html).toBe(locale === "fr" ? `Livré le jour même à Cotonou &amp; Calavi si vous commandez avant 20${NBSP}h.` : `Delivered the same day in Cotonou &amp; Calavi if you order before 8${NBSP}pm.`);
  });

  it("topbar courte, ligne de preuve du héro, ligne de stock et note de livraison", () => {
    for (const el of [
      createElement(DeliveryPromise, { surface: "topbarShort", cutoff: 21 }),
      createElement(HeroDeliveryProof, { cutoff: 20 }),
      createElement(StockPromise, { label: "x", color: "#1F6B4A", cutoff: 20, soldOut: false }),
      createElement(DeliveryNote, { cotonou: 1000, autre: 2500, freeFrom: 15000, cod: true }),
    ]) {
      const { html, errors } = render(locale, el);
      expect(errors).toEqual([]);
      expect(html).toContain("Cotonou &amp; Calavi");
    }
    expect(render(locale, createElement(DeliveryPromise, { surface: "topbarShort", cutoff: 21 })).html).toContain(locale === "fr" ? `21${NBSP}h` : `9${NBSP}pm`);
  });

  it("note de livraison : tarifs issus des réglages (pas de 1 000 F supposé partout)", () => {
    const { html } = render(locale, createElement(DeliveryNote, { cotonou: 1000, autre: 2500, freeFrom: 15000, cod: false }));
    expect(html).toContain(`1${NBSP}000${NBSP}F`);
    expect(html).toContain(`15${NBSP}000${NBSP}F`);
    expect(html).toContain(`2${NBSP}500${NBSP}F`);
    expect(html).not.toMatch(/réception|on delivery/);
    const noFree = render(locale, createElement(DeliveryNote, { cotonou: 1000, autre: 2500, freeFrom: 0, cod: true })).html;
    expect(noFree).not.toMatch(/offerte|free from/);
    expect(noFree).toMatch(/réception|on delivery/);
  });

  it("rupture : aucune promesse de délai", () => {
    const { html } = render(locale, createElement(StockPromise, { label: "Épuisé", color: "#6B645A", cutoff: 20, soldOut: true }));
    expect(html).not.toMatch(/Cotonou/);
  });
});

describe("badge Express", () => {
  it("picto décoratif, texte lisible", () => {
    const html = renderToString(createElement(ExpressBadge, { label: "Express", size: "S", variant: "onLight" }));
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain(">Express</span>");
    expect(html).toContain("height:24px");
  });
});
