// Rendu serveur de la galerie de la fiche produit (photos multiples, 0024), de la carte produit (couverture en <img>) et du
// champ photos du back-office : alt, ordre, première image prioritaire, suivantes en lazy, repli sans photo.
import { createElement, type ComponentType, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import frProduct from "@/messages/fr/product.json";
import enProduct from "@/messages/en/product.json";
import frShop from "@/messages/fr/shop.json";
import frCommon from "@/messages/fr/common.json";
import { ProductGallery } from "@/components/product/ProductGallery";
import { PhotosField } from "@/components/admin/products/PhotosField";
import type { Product } from "@/lib/catalog/types";

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
  const messages = locale === "fr" ? { ...frCommon, ...frShop, ...frProduct } : { ...enProduct };
  const errors: unknown[] = [];
  const html = renderToString(
    createElement(Provider, { locale, messages, onError: (e) => void (e.code !== "ENVIRONMENT_FALLBACK" && errors.push(e)) }, el),
  );
  return { html, errors };
}

const BUCKET = "https://btarkkjimnkmiaxzonzq.supabase.co/storage/v1/object/public/products";
const [A, B, C, D] = ["a", "b", "c", "d"].map((n) => `${BUCKET}/2026/10/${n}.webp`);
const imgs = (html: string): string[] => [...(html.match(/<img\b[^>]*>/g) ?? [])];
const attr = (tag: string | undefined, name: string) => tag?.match(new RegExp(`\\s${name}="([^"]*)"`, "i"))?.[1];
const gallery = (images: string[]) =>
  createElement(ProductGallery, { images, name: "Lampe LED", bg: "#F3E3A6", keyword: "lampe", tag: { label: "Nouveau", bg: "#FFC93C", color: "#141210" } });

describe("galerie de la fiche produit", () => {
  it("4 photos : grandes images dans l'ordre, alt « nom, photo n sur 4 », première prioritaire, suivantes lazy", () => {
    const { html, errors } = render("fr", gallery([A, B, C, D]));
    expect(errors).toEqual([]);
    const all = imgs(html);
    const main = all.filter((t) => attr(t, "alt") !== "");
    expect(main.map((t) => attr(t, "src"))).toEqual([A, B, C, D]);
    expect(main.map((t) => attr(t, "alt"))).toEqual([1, 2, 3, 4].map((n) => `Lampe LED, photo ${n} sur 4`));
    expect(attr(main[0], "fetchpriority")).toBe("high");
    expect(attr(main[0], "loading")).toBeUndefined();
    for (const t of main.slice(1)) {
      expect(attr(t, "loading")).toBe("lazy");
      expect(attr(t, "fetchpriority")).toBeUndefined();
    }
    // Carré réservé : pas de décalage de mise en page.
    for (const t of main) expect([attr(t, "width"), attr(t, "height")]).toEqual(["1200", "1200"]);
  });

  it("4 photos : miniatures cliquables (boutons nommés), la première marquée courante, défilement accessible au clavier", () => {
    const { html } = render("fr", gallery([A, B, C, D]));
    const thumbs = html.match(/<button[^>]*aria-label="Afficher la photo \d sur 4"[^>]*>/g) ?? [];
    expect(thumbs).toHaveLength(4);
    expect(thumbs[0]).toContain('aria-current="true"');
    expect(thumbs.slice(1).some((t) => t.includes("aria-current"))).toBe(false);
    expect(html).toMatch(/role="region"[^>]*aria-label="Photos de Lampe LED"[^>]*tabindex="0"|role="region"[^>]*tabIndex="0"/i);
    expect(html).toContain("snap-x");
    // Miniatures : décoratives (alt vide), jamais prioritaires.
    const thumbImgs = imgs(html).filter((t) => attr(t, "alt") === "");
    expect(thumbImgs).toHaveLength(4);
    expect(thumbImgs.every((t) => attr(t, "loading") === "lazy")).toBe(true);
  });

  it("1 photo : une seule image, alt = nom du produit, prioritaire ; ni miniatures ni carrousel", () => {
    const { html } = render("fr", gallery([A]));
    const all = imgs(html);
    expect(all).toHaveLength(1);
    expect(attr(all[0], "alt")).toBe("Lampe LED");
    expect(attr(all[0], "fetchpriority")).toBe("high");
    expect(html).not.toContain('role="region"');
    expect(html).not.toContain("Afficher la photo");
  });

  it("sans photo : rendu d'origine (fond coloré + mot-clé décoratif, pastille), aucune image", () => {
    const { html } = render("fr", gallery([]));
    expect(imgs(html)).toHaveLength(0);
    expect(html).toContain("background:#F3E3A6");
    expect(html).toMatch(/<span aria-hidden="true"[^>]*>lampe<\/span>/);
    expect(html).toContain("Nouveau");
  });

  it("anglais : textes alternatifs et miniatures traduits", () => {
    const { html, errors } = render("en", gallery([A, B]));
    expect(errors).toEqual([]);
    expect(html).toContain('alt="Lampe LED, photo 2 of 2"');
    expect(html).toContain('aria-label="Show photo 1 of 2"');
  });
});

describe("carte produit : couverture en <img>", () => {
  const product: Product = {
    id: "p1",
    slug: "lampe-led",
    name: "Lampe LED",
    description: "",
    categoryId: "maison",
    price: 8900,
    comparePrice: null,
    stock: 4,
    sold: 0,
    keyword: "lampe",
    bg: "#F3E3A6",
    imageUrl: A,
    images: [A],
    createdAt: "2026-10-01T00:00:00Z",
    rating: { average: 0, count: 0 },
  };
  it("image de couverture en lazy, alt vide (le lien porte le nom), fond et mot conservés", async () => {
    const { ProductCard } = await import("@/components/shop/ProductCard");
    const { html, errors } = render("fr", createElement(ProductCard, { product }));
    expect(errors).toEqual([]);
    const all = imgs(html);
    expect(all).toHaveLength(1);
    expect(attr(all[0], "src")).toBe(A);
    expect(attr(all[0], "alt")).toBe("");
    expect(attr(all[0], "loading")).toBe("lazy");
    expect(html).toContain('aria-label="Lampe LED"');
    expect(html).toContain(">lampe</span>");
  });
  it("sans photo : aucune image", async () => {
    const { ProductCard } = await import("@/components/shop/ProductCard");
    const { html } = render("fr", createElement(ProductCard, { product: { ...product, imageUrl: null, images: [] } }));
    expect(imgs(html)).toHaveLength(0);
  });
});

describe("champ photos du back-office", () => {
  const field = (images: string[], max?: number) =>
    renderToString(createElement(PhotosField, { images, bg: "#F3E3A6", word: "lampe", max, onChange: () => {} }));

  it("ordre conservé, première = photo principale, flèches nommées et bornées", () => {
    const html = field([A, B, C]);
    expect(imgs(html).map((t) => attr(t, "src"))).toEqual([A, B, C]);
    expect(html).toContain('alt="Photo 1 sur 3, photo principale"');
    expect(html).toMatch(/aria-label="Déplacer la photo 1 vers la gauche"[^>]*disabled=""/);
    expect(html).toMatch(/aria-label="Déplacer la photo 3 vers la droite"[^>]*disabled=""/);
    expect(html).not.toMatch(/aria-label="Déplacer la photo 2 vers la gauche"[^>]*disabled=""/);
    expect(html).toContain('aria-label="Retirer la photo 2"');
    expect((html.match(/Mettre en principale/g) ?? []).length).toBe(2);
    expect(html).toContain("3<!-- --> / <!-- -->8");
  });
  it("ajout multiple : champ fichier `multiple`, nommé et décrit ; désactivé à 8 photos", () => {
    const html = field([A]);
    expect(html).toMatch(/<input[^>]*type="file"[^>]*multiple=""/);
    expect(html).toMatch(/<input[^>]*aria-describedby="[^"]+"/);
    expect(html).toContain("Ajouter des photos");
    const full = field(Array.from({ length: 8 }, (_, i) => `${BUCKET}/x${i}.webp`));
    expect(full).toMatch(/<input[^>]*type="file"[^>]*disabled=""/);
    expect(full).toContain("8 photos au maximum");
  });
  it("migration 0024 absente : une seule photo, explication affichée", () => {
    const html = field([], 1);
    expect(html).not.toMatch(/multiple=""/);
    expect(html).toContain("Choisir une photo");
    expect(html).toContain("migration 0024");
  });
});
