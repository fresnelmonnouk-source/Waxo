// États vides (boutique sans produit), FAQ entièrement dans le HTML, messages des pages 404/erreur : rendu serveur avec
// les VRAIS messages FR et EN (une clé manquante ou un message ICU cassé fait échouer le test).
import { createElement, type ComponentType, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import frShop from "@/messages/fr/shop.json";
import enShop from "@/messages/en/shop.json";
import frCommon from "@/messages/fr/common.json";
import enCommon from "@/messages/en/common.json";
import frAssistant from "@/messages/fr/assistant.json";
import enAssistant from "@/messages/en/assistant.json";
import frStates from "@/messages/fr/states.json";
import enStates from "@/messages/en/states.json";

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
let search = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }));

const Provider = NextIntlClientProvider as unknown as ComponentType<{
  locale: string;
  messages: Record<string, unknown>;
  onError: (e: { code?: string }) => void;
  children?: ReactNode;
}>;

function render(locale: "fr" | "en", el: ReactElement) {
  const messages = locale === "fr" ? { ...frCommon, ...frShop, ...frAssistant, ...frStates } : { ...enCommon, ...enShop, ...enAssistant, ...enStates };
  const errors: unknown[] = [];
  const html = renderToString(
    createElement(Provider, { locale, messages, onError: (e) => void (e.code !== "ENVIRONMENT_FALLBACK" && errors.push(e)) }, el),
  );
  return { html, errors };
}

/** Texte tel que React l'écrit dans le HTML (apostrophe échappée). */
const esc = (t: string) => t.replace(/'/g, "&#x27;");

const cats = [{ id: "cuisine", label: "Cuisine", bg: "#fff", sort: 1, count: 0 }];

describe.each(["fr", "en"] as const)("boutique vide (%s)", (locale) => {
  const s = locale === "fr" ? frStates : enStates;
  it("accueil : sections vides masquées, bloc « Arrivage en cours », jamais « 0 produit »", async () => {
    const { ArrivalNotice, BestSellers, CategoryTiles, HomeCatalog } = await import("@/components/shop/HomeSections");
    const { Selection } = await import("@/components/shop/Selection");
    for (const el of [
      createElement(CategoryTiles, { categories: cats }),
      createElement(HomeCatalog, { products: [], total: 0 }),
      createElement(Selection, { products: [], newIds: [], bestIds: [] }),
      createElement(BestSellers, { products: [], bestIds: [] }),
    ]) {
      const { html, errors } = render(locale, el);
      expect(errors).toEqual([]);
      expect(html).toBe("");
    }
    const { html, errors } = render(locale, createElement(ArrivalNotice));
    expect(errors).toEqual([]);
    expect(html).toContain(esc(s.EmptyStates.arrivalTitle));
    expect(html).toContain('href="/contact"');
  });
  it("catalogue (serveur et navigateur) : état « Arrivage en cours », sans compteur ni message de recherche", async () => {
    const { CatalogStatic } = await import("@/components/shop/CatalogStatic");
    const { CatalogView } = await import("@/components/shop/CatalogView");
    const shop = locale === "fr" ? frShop : enShop;
    for (const el of [
      createElement(CatalogStatic, { products: [], newIds: [], bestIds: [] }),
      createElement(CatalogView, { products: [], categories: cats, newIds: [], bestIds: [] }),
    ]) {
      const { html, errors } = render(locale, el);
      expect(errors).toEqual([]);
      expect(html).toContain(esc(s.EmptyStates.arrivalTitle));
      expect(html).toContain("<h1");
      expect(html).not.toContain(esc(shop.Catalog.emptyTitle));
      expect(html).not.toMatch(/\b0 (produit|product)/);
    }
  });
  it("catalogue garni, filtres sans résultat : message propre aux filtres, « Effacer » seulement si un filtre est actif", async () => {
    const { CatalogView } = await import("@/components/shop/CatalogView");
    const product = {
      id: "p1", slug: "a", name: "Gourde", description: "", categoryId: "cuisine", price: 2500, comparePrice: null, stock: 3, sold: 0,
      keyword: "", bg: null, imageUrl: null, createdAt: "2026-10-01T00:00:00Z", rating: { average: 0, count: 0 },
    };
    search = "budget=gt7";
    const { html, errors } = render(locale, createElement(CatalogView, { products: [product], categories: [{ ...cats[0], count: 1 }], newIds: [], bestIds: [] }));
    search = "";
    expect(errors).toEqual([]);
    expect(html).toContain(esc(s.EmptyStates.filtersText));
    expect(html).not.toContain(esc(s.EmptyStates.arrivalTitle));
  });
});

describe("FAQ : toutes les réponses dans le HTML", () => {
  it("réponses fermées présentes mais masquées (`hidden`), la première ouverte", async () => {
    const { FaqList } = await import("@/components/account/FaqList");
    const items = [1, 2, 3].map((n) => ({ id: `q${n}`, question: `Question ${n}`, answer: `Réponse ${n}` }));
    const { html } = render("fr", createElement(FaqList, { items }));
    for (const n of [1, 2, 3]) expect(html).toContain(`Réponse ${n}`);
    expect(html.match(/<p[^>]*hidden=""/g)?.length).toBe(2);
    expect(html.match(/aria-expanded="true"/g)?.length).toBe(1);
  });
});

describe("messages des pages d'état", () => {
  it("mêmes clés en FR et en EN, sans tiret cadratin", () => {
    const keys = (o: Record<string, unknown>, p = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`]));
    expect(keys(enStates).sort()).toEqual(keys(frStates).sort());
    expect(JSON.stringify(frStates) + JSON.stringify(enStates)).not.toContain("—");
  });
});
