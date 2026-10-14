// Rubriques facultatives de la fiche (0025), livraison offerte par produit (estimation du site = règle de place_order) et
// mot « sans photo » masqué dès qu'une photo existe (photo détourée : le mot se voyait à travers).
import { createElement, type ComponentType, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import frProduct from "@/messages/fr/product.json";
import enProduct from "@/messages/en/product.json";
import frCommon from "@/messages/fr/common.json";
import enCommon from "@/messages/en/common.json";
import {
  EMPTY_DETAILS,
  cleanDetail,
  detailLines,
  detailsFrom,
  hasAnyDetail,
  mergeDetails,
  specRows,
  type ProductDetails,
} from "@/lib/catalog/details";
import { DEFAULT_SHIPPING, cartShipsFree, shippingFee } from "@/lib/checkout/shipping";
import { freeShippingIds } from "@/lib/catalog/free-shipping";
import { usesMigration0025, validateProductForm } from "@/components/admin/products/logic";
import type { ProductFormValues } from "@/components/admin/products/types";
import { ProductDetailsSection, ProductInlineDetails, type DetailLabels } from "@/components/product/ProductDetailsSection";
import { ProductGallery } from "@/components/product/ProductGallery";
import { DeliveryNote } from "@/components/shop/DeliveryPromise";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: unknown } & Record<string, unknown>) =>
    createElement("a", { href, ...rest }, children as never),
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
  const messages = locale === "fr" ? { ...frCommon, ...frProduct } : { ...enCommon, ...enProduct };
  const errors: unknown[] = [];
  const html = renderToString(
    createElement(Provider, { locale, messages, onError: (e) => void (e.code !== "ENVIRONMENT_FALLBACK" && errors.push(e)) }, el),
  );
  return { html, errors };
}

const labels: DetailLabels = frProduct.ProductDetails as DetailLabels;
const d = (over: Partial<ProductDetails>): ProductDetails => ({ ...EMPTY_DETAILS, ...over });

describe("rubriques : saisie", () => {
  it("nettoie : fins de ligne Windows, espaces, lignes vides multiples", () => {
    expect(cleanDetail("  Bureau \r\n\r\n\r\n Sport  \r\n")).toBe("Bureau\nSport");
    expect(cleanDetail(undefined)).toBe("");
  });
  it("une ligne = un élément, puces saisies à la main retirées", () => {
    expect(detailLines("- Bureau\n• Sport\n* Voyage\n\n")).toEqual(["Bureau", "Sport", "Voyage"]);
  });
  it("caractéristiques : « Libellé : valeur », sinon valeur seule", () => {
    expect(specRows("Contenance : 750 ml\nSans BPA\nDimensions: 7 x 26 cm")).toEqual([
      { label: "Contenance", value: "750 ml" },
      { label: null, value: "Sans BPA" },
      { label: "Dimensions", value: "7 x 26 cm" },
    ]);
  });
  it("repli rubrique par rubrique sur le français ; colonnes absentes (avant 0025) = vide", () => {
    expect(mergeDetails(d({ color: "Black" }), d({ color: "Noir", care: "Laver à la main" }))).toEqual(d({ color: "Black", care: "Laver à la main" }));
    expect(detailsFrom({ locale: "fr" } as never)).toEqual(EMPTY_DETAILS);
  });
});

describe("rubriques : fiche produit", () => {
  it("aucune rubrique remplie : rien du tout (ni bloc, ni titre)", () => {
    expect(render("fr", createElement(ProductDetailsSection, { details: EMPTY_DETAILS, labels })).html).toBe("");
    expect(render("fr", createElement(ProductInlineDetails, { details: EMPTY_DETAILS, labels })).html).toBe("");
  });
  it("seules les rubriques remplies et leur titre apparaissent", () => {
    const { html } = render("fr", createElement(ProductDetailsSection, { details: d({ highlights: "Garde au frais 24 h\nNe fuit pas" }), labels }));
    expect(html).toContain("Détails du produit");
    expect(html).toContain("Points forts");
    expect(html).toContain("<li>Garde au frais 24 h</li>");
    for (const absent of ["Caractéristiques techniques", "Utilisations possibles", "Conseils d"]) expect(html).not.toContain(absent);
  });
  it("couleur et matériaux sous la description, sans les autres rubriques", () => {
    const { html } = render("fr", createElement(ProductInlineDetails, { details: d({ color: "Noir mat", specs: "Poids : 300 g" }), labels }));
    expect(html).toContain("Couleur");
    expect(html).toContain("Noir mat");
    expect(html).not.toContain("Matériaux");
    expect(html).not.toContain("300 g");
  });
  it("texte saisi échappé (jamais interprété comme du HTML)", () => {
    const { html } = render("fr", createElement(ProductDetailsSection, { details: d({ uses: "<img src=x onerror=alert(1)>" }), labels }));
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});

describe("livraison offerte par produit (même règle que place_order)", () => {
  const cfg = DEFAULT_SHIPPING; // 1 000 Cotonou, 2 500 ailleurs, franco 15 000
  it("tout le panier coché : 0 à Cotonou & Calavi, tarif normal ailleurs", () => {
    expect(shippingFee(3000, "cotonou", cfg, true)).toBe(0);
    expect(shippingFee(3000, "autre", cfg, true)).toBe(2500);
  });
  it("panier mixte : tarif habituel, franco inchangé", () => {
    expect(shippingFee(3000, "cotonou", cfg, false)).toBe(1000);
    expect(shippingFee(16000, "cotonou", cfg, false)).toBe(0);
  });
  it("cartShipsFree : panier vide = non ; un article non coché = non", () => {
    expect(cartShipsFree([], ["a"])).toBe(false);
    expect(cartShipsFree([{ id: "a" }, { id: "b" }], ["a", "b"])).toBe(true);
    expect(cartShipsFree([{ id: "a" }, { id: "c" }], new Set(["a", "b"]))).toBe(false);
  });
  it("pack offert seulement si tous ses produits le sont", () => {
    const products = [
      { id: "a", freeShipping: true },
      { id: "b", freeShipping: true },
      { id: "c", freeShipping: false },
    ];
    const packs = [
      { id: "k1", items: [{ productId: "a" }, { productId: "b" }] },
      { id: "k2", items: [{ productId: "a" }, { productId: "c" }] },
      { id: "k3", items: [] },
    ] as never;
    expect(freeShippingIds(products, packs).sort()).toEqual(["a", "b", "k1"]);
  });
  it("note de livraison de la fiche : mention + condition en FR et EN", () => {
    const props = { cotonou: 1000, autre: 2500, freeFrom: 15000, cod: true, freeShipping: true };
    const fr = render("fr", createElement(DeliveryNote, props));
    expect(fr.errors).toEqual([]);
    expect(fr.html).toContain("livraison offerte pour ce produit");
    expect(fr.html).toContain("Offerte si tous les articles du panier le sont aussi.");
    const en = render("en", createElement(DeliveryNote, props));
    expect(en.errors).toEqual([]);
    expect(en.html).toContain("free delivery on this product");
    const plain = render("fr", createElement(DeliveryNote, { ...props, freeShipping: false }));
    expect(plain.html).not.toContain("pour ce produit");
  });
});

describe("formulaire produit : rubriques", () => {
  const base: ProductFormValues = {
    name: "Gourde isotherme",
    nameEn: "",
    categoryId: "cuisine",
    price: "5000",
    comparePrice: "",
    stock: "10",
    cost: "",
    description: "Garde au frais toute la journée.",
    descriptionEn: "",
    keyword: "",
    bg: "#F3E3A6",
    active: true,
    images: [],
    details: { ...EMPTY_DETAILS },
    detailsEn: { ...EMPTY_DETAILS },
    freeShipping: false,
  };
  it("tout est facultatif ; saisie nettoyée", () => {
    const v = validateProductForm({ ...base, details: d({ uses: " Bureau \r\n\r\nSport " }), freeShipping: true });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.value.details.uses).toBe("Bureau\nSport");
      expect(v.value.freeShipping).toBe(true);
      expect(usesMigration0025(v.value)).toBe(true);
    }
    const plain = validateProductForm(base);
    expect(plain.ok && usesMigration0025(plain.value)).toBe(false);
  });
  it("trop long : erreur sur la rubrique (FR et EN séparées)", () => {
    const v = validateProductForm({ ...base, nameEn: "Insulated bottle", details: d({ color: "x".repeat(201) }), detailsEn: d({ specs: "x".repeat(3001) }) });
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.errors.d_color).toMatch(/Couleur/);
      expect(v.errors.en_specs).toMatch(/Caractéristiques/);
    }
  });
  it("rubriques anglaises sans nom anglais : nom anglais demandé", () => {
    const v = validateProductForm({ ...base, detailsEn: d({ color: "Black" }) });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors.nameEn).toBeTruthy();
  });
  it("hasAnyDetail", () => {
    expect(hasAnyDetail(EMPTY_DETAILS)).toBe(false);
    expect(hasAnyDetail(d({ care: "x" }), ["care"])).toBe(true);
  });
});

describe("mot « sans photo »", () => {
  const BUCKET = "https://btarkkjimnkmiaxzonzq.supabase.co/storage/v1/object/public/products";
  const gallery = (images: string[]) => createElement(ProductGallery, { images, name: "Gourde", bg: "#F3E3A6", keyword: "gourdemot", tag: null });
  it("affiché sans photo, absent dès qu'il y a une photo (photo détourée : il se voyait à travers)", () => {
    expect(render("fr", gallery([])).html).toContain("gourdemot");
    expect(render("fr", gallery([`${BUCKET}/a.webp`])).html).not.toContain("gourdemot");
    expect(render("fr", gallery([`${BUCKET}/a.webp`, `${BUCKET}/b.webp`])).html).not.toContain("gourdemot");
  });
});
