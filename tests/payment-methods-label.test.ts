// Moyens de paiement affichés depuis les réglages (brief RAG du 2026-10-13) : jamais « Visa » ni « carte » quand la carte
// est désactivée, seulement le paiement à la livraison quand le paiement en ligne n'est pas proposé.
import { createElement, type ComponentType, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { NextIntlClientProvider, createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import frShop from "@/messages/fr/shop.json";
import enShop from "@/messages/en/shop.json";
import frCommon from "@/messages/fr/common.json";
import enCommon from "@/messages/en/common.json";
import frAssistant from "@/messages/fr/assistant.json";
import enAssistant from "@/messages/en/assistant.json";
import frProduct from "@/messages/fr/product.json";
import enProduct from "@/messages/en/product.json";
import frPacks from "@/messages/fr/packs.json";
import enPacks from "@/messages/en/packs.json";
import {
  anyOnline,
  joinOr,
  methodsProse,
  onlineBrands,
  payLineKind,
  payLineText,
  type PayFlags,
} from "@/lib/payment/methods-label";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: unknown } & Record<string, unknown>) => {
    const { locale: _l, prefetch: _p, ...props } = rest;
    void _l;
    void _p;
    return createElement("a", { href, ...props }, children as never);
  },
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  usePathname: () => "/",
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("") }));
vi.mock("@/components/account/AccountMenu", () => ({ AccountMenu: () => null }));

const ALL: PayFlags = { momo: true, moov: true, celtiis: true, carte: true, cod: true };
const TODAY: PayFlags = { ...ALL, carte: false }; // réglages de production au 2026-10-13
const NO_CARD = /\bVisa\b|Mastercard|carte|\bcard\b/i;
const ONLINE_BRANDS = /MTN MoMo|Moov Money|Celtiis Cash|\bVisa\b|Mastercard/;

describe("methods-label : logique pure", () => {
  it("carte cochée et paiement en ligne proposé : opérateurs puis Visa, Mastercard", () => {
    expect(onlineBrands(ALL, true)).toEqual(["MTN MoMo", "Moov Money", "Celtiis Cash", "Visa", "Mastercard"]);
    expect(methodsProse(ALL, true, "fr")).toBe("par Mobile Money, par carte ou à la réception");
    expect(methodsProse(ALL, true, "en")).toBe("by Mobile Money, by card or on delivery");
  });
  it("carte désactivée : ni Visa ni carte", () => {
    expect(onlineBrands(TODAY, true)).toEqual(["MTN MoMo", "Moov Money", "Celtiis Cash"]);
    expect(methodsProse(TODAY, true, "fr")).toBe("par Mobile Money ou à la réception");
    expect(methodsProse(TODAY, true, "en")).toBe("by Mobile Money or on delivery");
  });
  it("seuls les opérateurs cochés", () => {
    expect(onlineBrands({ ...TODAY, moov: false, celtiis: false }, true)).toEqual(["MTN MoMo"]);
  });
  it("paiement en ligne non proposé (clé FedaPay absente) : aucun moyen en ligne, même cochés", () => {
    expect(onlineBrands(ALL, false)).toEqual([]);
    expect(anyOnline(ALL, false)).toBe(false);
    expect(methodsProse(ALL, false, "fr")).toBe("");
    expect(payLineKind(ALL, false)).toBe("codOnly");
  });
  it("carte seule, sans paiement à la livraison", () => {
    const pay = { momo: false, moov: false, celtiis: false, carte: true, cod: false };
    expect(methodsProse(pay, true, "fr")).toBe("par carte");
    expect(payLineKind(pay, true)).toBe("methods");
  });
  it("aucun moyen proposé : rien à afficher", () => {
    const none = { momo: false, moov: false, celtiis: false, carte: false, cod: false };
    expect(payLineKind(none, true)).toBe("none");
    expect(payLineText(none, true, "fr", { methods: () => "x", codOnly: () => "y" })).toBe("");
  });
  it("joinOr", () => {
    expect(joinOr([], "fr")).toBe("");
    expect(joinOr(["a"], "fr")).toBe("a");
    expect(joinOr(["a", "b", "c"], "fr")).toBe("a, b ou c");
    expect(joinOr(["a", "b"], "en")).toBe("a or b");
  });
});

const Provider = NextIntlClientProvider as unknown as ComponentType<{
  locale: string;
  messages: Record<string, unknown>;
  onError: (e: { code?: string }) => void;
  children?: ReactNode;
}>;

function render(locale: "fr" | "en", el: ReactElement) {
  const messages = locale === "fr" ? { ...frCommon, ...frShop, ...frAssistant } : { ...enCommon, ...enShop, ...enAssistant };
  const errors: unknown[] = [];
  const html = renderToString(
    createElement(Provider, { locale, messages, onError: (e) => void (e.code !== "ENVIRONMENT_FALLBACK" && errors.push(e)) }, el),
  );
  return { html, errors };
}

/** Texte visible (sans balises ni commentaires React), espaces normalisés. */
const text = (html: string) =>
  html
    .replace(/<!--.*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");

async function shop(locale: "fr" | "en") {
  const { getShopData, DEFAULT_SETTINGS } = await import("@/components/shop/data");
  return { d: await getShopData(locale), hours: DEFAULT_SETTINGS.brand.hours };
}

describe.each(["fr", "en"] as const)("rendu (%s)", (locale) => {
  it("pied de page : carte désactivée → opérateurs Mobile Money + livraison, ni Visa ni carte", async () => {
    const { Footer } = await import("@/components/shop/Footer");
    const { d, hours } = await shop(locale);
    const { html, errors } = render(
      locale,
      createElement(Footer, { brand: d.settings.brand, cod: true, pay: TODAY, online: true, lang: locale, defaultHours: hours }),
    );
    expect(errors).toEqual([]);
    const s = text(html);
    expect(s).toContain("MTN MoMo · Moov Money · Celtiis Cash · ");
    expect(s).toMatch(locale === "fr" ? /Paiement à la livraison/ : /Pay on delivery/);
    expect(s).not.toMatch(NO_CARD);
  });

  it("pied de page : carte cochée et paiement en ligne proposé → Visa · Mastercard", async () => {
    const { Footer } = await import("@/components/shop/Footer");
    const { d, hours } = await shop(locale);
    const { html } = render(locale, createElement(Footer, { brand: d.settings.brand, cod: false, pay: { ...ALL, cod: false }, online: true, lang: locale, defaultHours: hours }));
    expect(text(html)).toContain("MTN MoMo · Moov Money · Celtiis Cash · Visa · Mastercard");
  });

  it("pied de page : paiement en ligne non proposé → seulement la livraison", async () => {
    const { Footer } = await import("@/components/shop/Footer");
    const { d, hours } = await shop(locale);
    const { html, errors } = render(locale, createElement(Footer, { brand: d.settings.brand, cod: true, pay: ALL, online: false, lang: locale, defaultHours: hours }));
    expect(errors).toEqual([]);
    const s = text(html);
    expect(s).not.toMatch(ONLINE_BRANDS);
    expect(s).not.toMatch(NO_CARD);
    expect(s).toMatch(locale === "fr" ? /Paiement à la livraison : espèces ou Mobile Money/ : /Pay on delivery: cash or Mobile Money/);
  });

  it("pied de page sans `pay` (ancien appel) : jamais la carte", async () => {
    const { Footer } = await import("@/components/shop/Footer");
    const { d, hours } = await shop(locale);
    const { html } = render(locale, createElement(Footer, { brand: d.settings.brand, cod: true, online: true, lang: locale, defaultHours: hours }));
    expect(text(html)).toContain("MTN MoMo");
    expect(text(html)).not.toMatch(NO_CARD);
  });

  it("accueil : carte désactivée → phrase d'accroche et garantie sans carte", async () => {
    const { HomeHero } = await import("@/components/shop/HomeHero");
    const { d } = await shop(locale);
    const settings = { ...d.settings, pay: TODAY };
    const { html, errors } = render(locale, createElement(HomeHero, { products: d.products, settings, bestIds: d.bestIds, newIds: d.newIds, online: true }));
    expect(errors).toEqual([]);
    const s = text(html);
    expect(s).toContain(locale === "fr" ? "Vous payez par Mobile Money ou à la réception." : "Pay by Mobile Money or on delivery.");
    expect(s).toContain(locale === "fr" ? "Ou MTN MoMo, Moov Money, Celtiis Cash" : "Or MTN MoMo, Moov Money, Celtiis Cash");
    expect(s).not.toMatch(NO_CARD);
  });

  it("accueil : paiement en ligne non proposé → seulement la livraison", async () => {
    const { HomeHero } = await import("@/components/shop/HomeHero");
    const { d } = await shop(locale);
    const settings = { ...d.settings, pay: ALL };
    const { html, errors } = render(locale, createElement(HomeHero, { products: d.products, settings, bestIds: d.bestIds, newIds: d.newIds, online: false }));
    expect(errors).toEqual([]);
    const s = text(html);
    expect(s).not.toMatch(ONLINE_BRANDS);
    expect(s).not.toMatch(NO_CARD);
    expect(s).toContain(locale === "fr" ? "Vous payez à la réception, en espèces ou par Mobile Money." : "You pay on delivery, in cash or by Mobile Money.");
  });

  it("accueil : sans paiement à la livraison, carte seule → titre « carte », pas Mobile Money", async () => {
    const { HomeHero } = await import("@/components/shop/HomeHero");
    const { d } = await shop(locale);
    const settings = { ...d.settings, pay: { momo: false, moov: false, celtiis: false, carte: true, cod: false } };
    const { html, errors } = render(locale, createElement(HomeHero, { products: d.products, settings, bestIds: d.bestIds, newIds: d.newIds, online: true }));
    expect(errors).toEqual([]);
    const s = text(html);
    expect(s).toContain(locale === "fr" ? "Paiement par carte" : "Card payment");
    expect(s).toContain("Visa ");
    expect(s).not.toMatch(/MTN MoMo|Moov Money|Celtiis Cash/);
  });

  it("fiches produit et pack : bloc de paiement depuis les réglages", () => {
    const product = createTranslator({ locale, messages: locale === "fr" ? frProduct : enProduct, namespace: "Product" } as never) as unknown as (
      k: string,
      v?: Record<string, string>,
    ) => string;
    const pack = createTranslator({ locale, messages: locale === "fr" ? frPacks : enPacks, namespace: "Packs.detail" } as never) as unknown as (
      k: string,
      v?: Record<string, string>,
    ) => string;
    for (const t of [product, pack]) {
      const line = (pay: PayFlags, online: boolean) =>
        payLineText(pay, online, locale, { methods: (methods) => t("payAll", { methods }), codOnly: () => t("payCodOnly") });
      expect(line(TODAY, true)).toBe(locale === "fr" ? "Vous payez par Mobile Money ou à la réception." : "Pay by Mobile Money or on delivery.");
      expect(line(TODAY, true)).not.toMatch(NO_CARD);
      expect(line(ALL, true)).toBe(locale === "fr" ? "Vous payez par Mobile Money, par carte ou à la réception." : "Pay by Mobile Money, by card or on delivery.");
      expect(line(ALL, false)).toBe(locale === "fr" ? "Vous payez à la réception, en espèces ou par Mobile Money." : "You pay on delivery, in cash or by Mobile Money.");
      expect(line({ ...TODAY, cod: false }, true)).toBe(locale === "fr" ? "Vous payez par Mobile Money." : "Pay by Mobile Money.");
    }
  });
});
