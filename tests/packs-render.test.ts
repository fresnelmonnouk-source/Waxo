import { createElement, type ComponentType, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import frPacks from "@/messages/fr/packs.json";
import enPacks from "@/messages/en/packs.json";

// Rendu serveur des composants packs avec les VRAIS messages : une clé manquante ou un message ICU cassé fait échouer le test.
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

const Provider = NextIntlClientProvider as unknown as ComponentType<{
  locale: string;
  messages: Record<string, unknown>;
  onError: (e: { code?: string }) => void;
  children?: ReactNode;
}>;

function render(locale: "fr" | "en", el: ReactElement) {
  const errors: unknown[] = [];
  const html = renderToString(
    createElement(Provider, { locale, messages: locale === "fr" ? frPacks : enPacks, onError: (e) => {
            if (e.code !== "ENVIRONMENT_FALLBACK") errors.push(e);
          },
        }, el),
  );
  return { html, errors };
}

describe.each(["fr", "en"] as const)("rendu des composants packs (%s)", (locale) => {
  it("carte, visuel, contenu et achat d'un pack sans erreur de message", async () => {
    const { buildDemoPacks } = await import("@/lib/catalog/packs");
    const { getProducts } = await import("@/lib/catalog");
    const { PackCard } = await import("@/components/packs/PackCard");
    const { PackContents } = await import("@/components/packs/PackContents");
    const { PackBuy } = await import("@/components/packs/PackBuy");
    const [pack] = buildDemoPacks(locale, await getProducts(locale));

    const card = render(locale, createElement(PackCard, { pack }));
    expect(card.errors).toEqual([]);
    expect(card.html).toContain(`/packs/${pack.slug}`);
    expect(card.html).toContain(pack.name);

    const contents = render(locale, createElement(PackContents, { items: pack.items }));
    expect(contents.errors).toEqual([]);
    expect(contents.html).toContain(`/produit/${pack.items[0].slug}`);

    const buy = render(locale, createElement(PackBuy, { pack }));
    expect(buy.errors).toEqual([]);
  });

  it("pack épuisé : pas de bouton d'ajout sur la carte", async () => {
    const { buildDemoPacks } = await import("@/lib/catalog/packs");
    const { getProducts } = await import("@/lib/catalog");
    const { PackCard } = await import("@/components/packs/PackCard");
    const [pack] = buildDemoPacks(locale, await getProducts(locale));
    const { html, errors } = render(locale, createElement(PackCard, { pack: { ...pack, stock: 0 } }));
    expect(errors).toEqual([]);
    expect(html).not.toContain(locale === "fr" ? "Ajouter le pack au panier" : "Add the pack to cart");
  });
});
