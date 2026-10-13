import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { cartAdditions, packSlugFromPath, productItemFromJsonLd, toMeta } from "@/lib/tracking/events";
import { PIXEL_IDLE_TIMEOUT_MS, whenIdleAfterLoad } from "@/lib/tracking/providers";
import { productPageJsonLd, packPageJsonLd } from "@/lib/seo/jsonld";

const UUID = "3f2b8c1e-9d4a-4f6b-8e2a-1c5d7e9f0a12";
const labels = { home: "Accueil", catalogue: "Catalogue", packs: "Packs" };
const BASE = "https://www.waxo.boutique";

describe("contrat JSON-LD ↔ view_item", () => {
  const ld = productPageJsonLd({ id: UUID, slug: "savon-noir", name: "Savon noir", price: 2500, stock: 3 }, undefined, labels, "fr", BASE);
  // Aller-retour par la chaîne, comme dans la page (balise <script type="application/ld+json">).
  const fromPage = JSON.parse(JSON.stringify(ld)) as unknown;

  it("lit productID (UUID) et offers.price du JSON-LD réel de la fiche", () => {
    expect(productItemFromJsonLd(fromPage, { section: "produit", slug: "savon-noir" })).toEqual({ id: UUID, name: "Savon noir", price: 2500, quantity: 1 });
  });

  it("même identifiant et même prix que add_to_cart (ligne de panier du même produit)", () => {
    const view = productItemFromJsonLd(fromPage, { section: "produit", slug: "savon-noir" });
    const [added] = cartAdditions([], [{ kind: "product", id: UUID, qty: 1, name: "Savon noir", price: 2500 }]);
    expect(view?.id).toBe(added.id);
    expect(view?.price).toBe(added.price);
    expect(toMeta({ name: "view_item", items: [view!] }).params.content_ids).toEqual(toMeta({ name: "add_to_cart", items: [added] }).params.content_ids);
  });

  it("pack : identifiant préfixé `pack:` comme au panier", () => {
    const pld = JSON.parse(JSON.stringify(packPageJsonLd({ id: UUID, slug: "pack-cuisine", name: "Pack cuisine", price: 9000, stock: 1 }, labels, "fr", BASE))) as unknown;
    const view = productItemFromJsonLd(pld, { section: "packs", slug: "pack-cuisine" });
    const [added] = cartAdditions([], [{ kind: "pack", id: UUID, qty: 1, name: "Pack cuisine", price: 9000 }]);
    expect(view?.id).toBe(`pack:${UUID}`);
    expect(view?.id).toBe(added.id);
    expect(packSlugFromPath("/en/packs/pack-cuisine")).toBe("pack-cuisine");
  });

  it("aucun événement si le prix ou l'identifiant manque (plus de repli { id: slug } sans prix)", () => {
    const page = { section: "produit" as const, slug: "x" };
    expect(productItemFromJsonLd({ "@type": "Product", productID: UUID, url: `${BASE}/fr/produit/x` }, page)).toBeNull();
    expect(productItemFromJsonLd({ "@type": "Product", productID: UUID, offers: { price: "abc" } }, page)).toBeNull();
    expect(productItemFromJsonLd({ "@type": "Product", offers: { price: 100 } }, page)).toBeNull();
    expect(productItemFromJsonLd(null, page)).toBeNull();
    expect(productItemFromJsonLd([{ "@type": "BreadcrumbList" }], page)).toBeNull();
  });

  it("ignore le JSON-LD d'une autre fiche (navigation en cours)", () => {
    expect(productItemFromJsonLd(fromPage, { section: "produit", slug: "autre-produit" })).toBeNull();
    expect(productItemFromJsonLd(fromPage, { section: "packs", slug: "savon-noir" })).toBeNull();
  });

  it("slug accentué (encodé dans l'URL du JSON-LD) et repli sur sku", () => {
    const d = { "@type": "Product", sku: UUID, url: `${BASE}/fr/produit/${encodeURIComponent("pagne-wá")}`, offers: [{ price: "1500" }] };
    expect(productItemFromJsonLd(d, { section: "produit", slug: "pagne-wá" })).toEqual({ id: UUID, name: undefined, price: 1500, quantity: 1 });
  });
});

describe("Meta Pixel différé (M1)", () => {
  const fakeWindow = (readyState: string, withIdle = true) => {
    const loadCbs: (() => void)[] = [];
    const idle = vi.fn((cb: () => void, opts?: { timeout: number }) => {
      void opts;
      cb();
    });
    const timeout = vi.fn((cb: () => void) => cb());
    return {
      w: {
        document: { readyState },
        addEventListener: (_t: "load", cb: () => void) => loadCbs.push(cb),
        ...(withIdle ? { requestIdleCallback: idle } : {}),
        setTimeout: timeout,
      },
      fireLoad: () => loadCbs.forEach((cb) => cb()),
      idle,
      timeout,
    };
  };

  it("attend l'événement load puis un moment calme plafonné à 4 s", () => {
    const f = fakeWindow("interactive");
    const cb = vi.fn();
    whenIdleAfterLoad(f.w, cb);
    expect(cb).not.toHaveBeenCalled();
    f.fireLoad();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(f.idle.mock.calls[0][1]).toEqual({ timeout: PIXEL_IDLE_TIMEOUT_MS });
  });

  it("page déjà chargée : moment calme directement ; sans requestIdleCallback (Safari) : setTimeout", () => {
    const a = fakeWindow("complete");
    const cbA = vi.fn();
    whenIdleAfterLoad(a.w, cbA);
    expect(cbA).toHaveBeenCalledTimes(1);
    const b = fakeWindow("complete", false);
    const cbB = vi.fn();
    whenIdleAfterLoad(b.w, cbB);
    expect(b.timeout).toHaveBeenCalled();
    expect(cbB).toHaveBeenCalledTimes(1);
  });
});

describe("zod hors du bundle client (M3)", () => {
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  // Seuls les imports comptent (les commentaires peuvent citer zod).
  const imports = (p: string) => (read(p).match(/^import[^;]*;/gm) ?? []).join("\n");
  it("le formulaire newsletter n'importe que les règles pures, sans zod", () => {
    expect(imports("src/components/shop/Newsletter.tsx")).not.toMatch(/newsletter-schema|"zod"/);
    expect(imports("src/components/shop/newsletter-validate.ts")).not.toMatch(/newsletter-schema|"zod"/);
    expect(imports("src/components/shop/HeaderSearch.tsx")).not.toMatch(/newsletter-schema|"zod"|auth\/validation/);
  });
});
