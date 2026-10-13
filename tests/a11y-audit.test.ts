// Équipe A11y — correctifs de l'audit Mia du 2026-10-12 (focus, tunnel inerte, case CGU, favoris fantômes, nom du panier,
// messages éphémères, note sans avis, actions d'en-tête admin). Aucun navigateur : rendu serveur + logique pure.
import { createElement, type ComponentType, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { IntlMessageFormat } from "intl-messageformat";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import frA11y from "@/messages/fr/a11y.json";
import enA11y from "@/messages/en/a11y.json";
import frProduct from "@/messages/fr/product.json";
import enProduct from "@/messages/en/product.json";

const nav = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: unknown } & Record<string, unknown>) => {
    const { locale: _l, prefetch: _p, ...props } = rest;
    void _l;
    void _p;
    return createElement("a", { href, ...props }, children as never);
  },
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  usePathname: () => nav.pathname,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  useSearchParams: () => new URLSearchParams(""),
}));

const Provider = NextIntlClientProvider as unknown as ComponentType<{
  locale: string;
  messages: Record<string, unknown>;
  onError: (e: { code?: string }) => void;
  children?: ReactNode;
}>;

function html(el: ReactElement, locale: "fr" | "en" = "fr") {
  const messages = locale === "fr" ? { ...frProduct, ...frA11y } : { ...enProduct, ...enA11y };
  const errors: unknown[] = [];
  const out = renderToString(
    createElement(Provider, { locale, messages, onError: (e) => void (e.code !== "ENVIRONMENT_FALLBACK" && errors.push(e)) }, el),
  );
  expect(errors).toEqual([]);
  return out;
}

class FakeStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

describe("messages A11y (a11y.json)", () => {
  type Tree = { [k: string]: string | Tree };
  const flat = (tree: Tree, prefix = ""): Record<string, string> =>
    Object.entries(tree).reduce<Record<string, string>>((acc, [k, v]) => {
      const key = prefix ? `${prefix}.${k}` : k;
      return typeof v === "string" ? { ...acc, [key]: v } : { ...acc, ...flat(v, key) };
    }, {});
  const fr = flat(frA11y as Tree);
  const en = flat(enA11y as Tree);

  it("un seul namespace racine nouveau (« A11y ») : n'écrase aucun namespace existant à la fusion", () => {
    expect(Object.keys(frA11y)).toEqual(["A11y"]);
    expect(Object.keys(enA11y)).toEqual(["A11y"]);
  });
  it("FR et EN : mêmes clés, mêmes variables ICU, aucun tiret cadratin", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
    const vars = (msg: string, locale: string) =>
      new IntlMessageFormat(msg, locale)
        .getAst()
        .flatMap((n) => ("value" in n && typeof n.value === "string" && n.type !== 0 ? [n.value] : []))
        .sort();
    for (const k of Object.keys(fr)) {
      expect(vars(en[k], "en"), k).toEqual(vars(fr[k], "fr"));
      expect(fr[k], k).not.toContain("—");
      expect(en[k], k).not.toContain("—");
    }
  });
});

describe("favoris fantômes (audit 4.7)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("localStorage", new FakeStorage());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("staleFavoriteIds : demandés mais non renvoyés, sans doublon", async () => {
    const { staleFavoriteIds } = await import("@/lib/favorites/store");
    expect(staleFavoriteIds(["a", "b", "c", "b"], ["b"])).toEqual(["a", "c"]);
    expect(staleFavoriteIds(["a"], ["a"])).toEqual([]);
    expect(staleFavoriteIds([], [])).toEqual([]);
  });
  it("removeMany retire les ids disparus et garde les autres ; sans effet si aucun n'est présent", async () => {
    const { favorites, staleFavoriteIds } = await import("@/lib/favorites/store");
    favorites.toggle("p1");
    favorites.toggle("lampe");
    favorites.toggle("p2");
    favorites.removeMany(staleFavoriteIds(["p1", "lampe", "p2"], ["p1", "p2"]));
    expect(JSON.parse(localStorage.getItem("waxo:favorites:v1") ?? "[]")).toEqual(["p1", "p2"]);
    const before = localStorage.getItem("waxo:favorites:v1");
    favorites.removeMany(["absent"]);
    expect(localStorage.getItem("waxo:favorites:v1")).toBe(before);
  });
});

describe("case à cocher (audit 3.3)", () => {
  it("nom accessible = libellé visible (aria-labelledby → id du libellé), erreur reliée par aria-describedby", async () => {
    const { Checkbox } = await import("@/components/account/ui");
    const out = html(
      // eslint-disable-next-line react/no-children-prop -- `children` est une prop requise du type de Checkbox (fichier .ts, pas de JSX)
      createElement(Checkbox, { checked: false, onChange: () => {}, describedBy: "err-cgu", invalid: true, children: "J'accepte les CGU" }),
    );
    const labelledby = /aria-labelledby="([^"]+)"/.exec(out)?.[1];
    expect(labelledby).toBeTruthy();
    expect(out).toMatch(new RegExp(`id="${labelledby!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>J&#x27;accepte les CGU<`));
    expect(out).toContain('role="checkbox"');
    expect(out).toContain('aria-describedby="err-cgu"');
    expect(out).toContain('aria-invalid="true"');
  });
});

describe("bouton panier (audit 4.12)", () => {
  it("le nombre d'articles est dans le nom accessible", async () => {
    const { cartButtonLabel } = await import("@/components/shop/Header");
    expect(cartButtonLabel("Ouvrir le panier", 3)).toBe("Ouvrir le panier (3)");
    expect(cartButtonLabel("Open cart", 0)).toBe("Open cart (0)");
  });
});

describe("tunnel de commande : coque inerte (audit 3.2)", () => {
  it("isCheckoutPath : /commande et /commande/merci seulement", async () => {
    const { isCheckoutPath } = await import("@/components/shop/CheckoutInert");
    expect(isCheckoutPath("/commande")).toBe(true);
    expect(isCheckoutPath("/commande/merci")).toBe(true);
    expect(isCheckoutPath("/")).toBe(false);
    expect(isCheckoutPath("/commandes")).toBe(false);
    expect(isCheckoutPath("/compte/commandes")).toBe(false);
  });
  it("inert + aria-hidden sur /commande, rien ailleurs (l'enveloppe ne crée aucune boîte)", async () => {
    const { CheckoutInert } = await import("@/components/shop/CheckoutInert");
    nav.pathname = "/commande";
    const on = html(createElement(CheckoutInert, null, createElement("a", { href: "/cgv" }, "CGV")));
    expect(on).toMatch(/<div class="contents" inert=""[^>]*aria-hidden="true"/);
    nav.pathname = "/catalogue";
    const off = html(createElement(CheckoutInert, null, createElement("a", { href: "/cgv" }, "CGV")));
    expect(off).not.toContain("inert");
    expect(off).not.toContain("aria-hidden");
    nav.pathname = "/";
  });
});

describe("messages éphémères (audit 4.11)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("5 s par défaut (au lieu de 3 s)", async () => {
    const { shopToast } = await import("@/components/shop/toast");
    const hide = vi.spyOn(shopToast, "hide");
    shopToast.show({ kind: "soldOut" });
    vi.advanceTimersByTime(4900);
    expect(hide).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(hide).toHaveBeenCalledTimes(1);
  });
  it("en pause au survol/focus, reprise avec au moins 2 s", async () => {
    const { shopToast } = await import("@/components/shop/toast");
    const hide = vi.spyOn(shopToast, "hide");
    shopToast.show({ kind: "added", name: "Gourde" });
    vi.advanceTimersByTime(4900);
    shopToast.pause();
    vi.advanceTimersByTime(60_000);
    expect(hide).not.toHaveBeenCalled();
    shopToast.resume();
    vi.advanceTimersByTime(1900);
    expect(hide).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(hide).toHaveBeenCalledTimes(1);
  });
});

describe("note sans avis (audit 4.8)", () => {
  const base = { productId: "p1", productName: "Gourde", avgTxt: "0,0", countTxt: "0 avis", reviews: [] };
  it("aucun avis : « Pas encore d'avis » + invitation, jamais « 0,0 »", async () => {
    const { ReviewsSection } = await import("@/components/product/ReviewsSection");
    const out = html(createElement(ReviewsSection, { ...base, average: 0, count: 0 }));
    expect(out).toContain((frProduct as { Product: { noRating: string } }).Product.noRating.replace("'", "&#x27;"));
    expect(out).toContain(frA11y.A11y.reviews.invite);
    expect(out).not.toContain("0,0");
    // Cible du lien « note » sous le titre : le focus y est déplacé.
    expect(out).toMatch(/id="avis-titre" tabindex="-1"/i);
  });
  it("avec des avis : la moyenne reste affichée", async () => {
    const { ReviewsSection } = await import("@/components/product/ReviewsSection");
    const out = html(createElement(ReviewsSection, { ...base, average: 4.5, avgTxt: "4,5", countTxt: "2 avis", count: 2 }), "fr");
    expect(out).toContain("4,5");
    expect(out).not.toContain(frA11y.A11y.reviews.invite);
  });
});

describe("admin : actions dans l'en-tête de page (audit 4.1)", () => {
  const pages = [
    { href: "/admin/produits", title: "Produits", sub: "3 produits" },
    { href: "/admin/newsletter", title: "Newsletter", sub: "2 abonnés" },
  ];
  it("Produits : lien « + Ajouter un produit » vers ?nouveau=1", async () => {
    const { PageHeading, NEW_PRODUCT_HREF } = await import("@/components/admin/shell/PageHeading");
    nav.pathname = "/admin/produits";
    const out = renderToString(createElement(PageHeading, { pages }));
    expect(NEW_PRODUCT_HREF).toBe("/admin/produits?nouveau=1");
    expect(out).toContain('href="/admin/produits?nouveau=1"');
    expect(out).toContain("+ Ajouter un produit");
    nav.pathname = "/";
  });
  it("Newsletter : « Exporter en CSV » dans l'en-tête", async () => {
    const { PageHeading } = await import("@/components/admin/shell/PageHeading");
    nav.pathname = "/admin/newsletter";
    const out = renderToString(createElement(PageHeading, { pages }));
    expect(out).toContain('href="/admin/newsletter/export"');
    expect(out).toContain("Exporter en CSV");
    expect(out).not.toContain("Ajouter un produit");
    nav.pathname = "/";
  });
});
