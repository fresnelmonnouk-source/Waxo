import { createElement, type ComponentType, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import frShop from "@/messages/fr/shop.json";
import enShop from "@/messages/en/shop.json";
import frCommon from "@/messages/fr/common.json";
import enCommon from "@/messages/en/common.json";
import frPacks from "@/messages/fr/packs.json";
import enPacks from "@/messages/en/packs.json";
import frAssistant from "@/messages/fr/assistant.json";
import enAssistant from "@/messages/en/assistant.json";

// Rendu serveur de la coque et des sections avec les VRAIS messages : une clé manquante ou un message ICU cassé fait échouer le test.
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
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("cat=cuisine&sort=asc") }));
vi.mock("@/components/account/AccountMenu", () => ({ AccountMenu: () => null }));

// Le typage du fournisseur impose `children` en prop ; on le passe en argument (règle react/no-children-prop).
const Provider = NextIntlClientProvider as unknown as ComponentType<{
  locale: string;
  messages: Record<string, unknown>;
  onError: (e: { code?: string }) => void;
  children?: ReactNode;
}>;

async function render(locale: "fr" | "en", build: () => Promise<ReactElement> | ReactElement) {
  const messages = locale === "fr" ? { ...frCommon, ...frShop, ...frAssistant, ...frPacks } : { ...enCommon, ...enShop, ...enAssistant, ...enPacks };
  const errors: unknown[] = [];
  const el = await build();
  const html = renderToString(
    createElement(
      Provider,
      {
        locale,
        messages,
        onError: (e) => {
          if (e.code !== "ENVIRONMENT_FALLBACK") errors.push(e);
        },
      },
      el,
    ),
  );
  return { html, errors };
}

async function data(locale: "fr" | "en") {
  const { getShopData } = await import("@/components/shop/data");
  return getShopData(locale);
}

describe.each(["fr", "en"] as const)("rendu serveur (%s)", (locale) => {
  it("accueil : héro, rayons, aperçu, sélection, meilleures ventes, étapes", async () => {
    const d = await data(locale);
    const { HomeHero } = await import("@/components/shop/HomeHero");
    const { BestSellers, CategoryTiles, HomeCatalog, HowItWorks } = await import("@/components/shop/HomeSections");
    const { Selection } = await import("@/components/shop/Selection");
    const parts = [
      createElement(HomeHero, { products: d.products, settings: d.settings, bestIds: d.bestIds, newIds: d.newIds }),
      createElement(CategoryTiles, { categories: d.categories }),
      createElement(HomeCatalog, { products: d.products, total: d.products.length }),
      createElement(Selection, { products: d.products, newIds: d.newIds, bestIds: d.bestIds }),
      createElement(BestSellers, { products: d.products, bestIds: d.bestIds }),
      createElement(HowItWorks),
    ];
    for (const part of parts) {
      const { html, errors } = await render(locale, () => part);
      expect(errors).toEqual([]);
      expect(html.length).toBeGreaterThan(100);
    }
  });

  it("coque : bandeau, en-tête, newsletter, pied de page, toast", async () => {
    const d = await data(locale);
    const { TopBar } = await import("@/components/shop/TopBar");
    const { Header } = await import("@/components/shop/Header");
    const { Newsletter } = await import("@/components/shop/Newsletter");
    const { Footer } = await import("@/components/shop/Footer");
    const { ShopToast } = await import("@/components/shop/ShopToast");
    const { DEFAULT_SETTINGS } = await import("@/components/shop/data");
    const parts = [
      createElement(TopBar, { freeFrom: d.settings.shipping.freeFrom, cod: true }),
      createElement(Header, { categories: d.categories, searchIndex: d.searchIndex, total: d.products.length }),
      createElement(Newsletter),
      createElement(Footer, { brand: d.settings.brand, cod: true, lang: locale, defaultHours: DEFAULT_SETTINGS.brand.hours }),
      createElement(ShopToast),
    ];
    for (const part of parts) {
      const { errors } = await render(locale, () => part);
      expect(errors).toEqual([]);
    }
  });

  it("menu Packs : lien présent par défaut, absent quand les packs sont désactivés (en-tête)", async () => {
    const d = await data(locale);
    const { Header } = await import("@/components/shop/Header");
    const base = { categories: d.categories, searchIndex: d.searchIndex, total: d.products.length };
    const on = await render(locale, () => createElement(Header, base));
    const off = await render(locale, () => createElement(Header, { ...base, packsEnabled: false }));
    expect(on.html).toContain('href="/packs"');
    expect(off.html).not.toContain('href="/packs"');
    expect(off.errors).toEqual([]);
  });

  it("catalogue : version statique et version interactive (?cat=cuisine&sort=asc)", async () => {
    const d = await data(locale);
    const { CatalogStatic } = await import("@/components/shop/CatalogStatic");
    const { CatalogView } = await import("@/components/shop/CatalogView");
    const a = await render(locale, () => createElement(CatalogStatic, { products: d.products, newIds: d.newIds, bestIds: d.bestIds }));
    expect(a.errors).toEqual([]);
    const b = await render(locale, () => createElement(CatalogView, { products: d.products, categories: d.categories, newIds: d.newIds, bestIds: d.bestIds }));
    expect(b.errors).toEqual([]);
    // 8 produits de cuisine dans la démo, triés par prix croissant : le moins cher (éplucheur, 2 000 F) en premier.
    const eplucheur = b.html.indexOf("/produit/eplucheur");
    const blender = b.html.indexOf("/produit/blender");
    expect(eplucheur).toBeGreaterThan(-1);
    expect(blender).toBeGreaterThan(eplucheur);
    expect(b.html).not.toContain("/produit/lampe");
  });
});
