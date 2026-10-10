import { describe, expect, it } from "vitest";
import {
  isStorageImageUrl,
  marginOf,
  packSavings,
  packStock,
  parseAmount,
  slugify,
  stockTone,
  uniqueSlug,
  validatePackForm,
  validateProductForm,
} from "@/components/admin/products/logic";
import type { PackFormValues, ProductFormValues } from "@/components/admin/products/types";
import { clampPan, computeCropRect, outputSide } from "@/lib/media/crop";
import { detectImageType } from "@/lib/media/signature";

const base: ProductFormValues = {
  name: "Lampe LED rechargeable",
  nameEn: "",
  categoryId: "maison",
  price: "8 900",
  comparePrice: "",
  stock: "5",
  cost: "4600",
  description: "Jusqu'à 10 h d'autonomie, 3 intensités.",
  descriptionEn: "",
  keyword: "",
  bg: "#f3e3a6",
  active: true,
  imageUrl: null,
};

describe("slugs", () => {
  it("retire accents, ponctuation et espaces", () => {
    expect(slugify("Lampe LED rechargeable")).toBe("lampe-led-rechargeable");
    expect(slugify("Diffuseur d'huiles essentielles")).toBe("diffuseur-d-huiles-essentielles");
    expect(slugify("  Écouteurs sans-fil  œuf ")).toBe("ecouteurs-sans-fil-oeuf");
  });
  it("garde un repli non vide et borne la longueur", () => {
    expect(slugify("!!!")).toBe("produit");
    expect(slugify("a".repeat(200)).length).toBeLessThanOrEqual(60);
  });
  it("évite les collisions", () => {
    expect(uniqueSlug("lampe", new Set())).toBe("lampe");
    expect(uniqueSlug("lampe", new Set(["lampe"]))).toBe("lampe-2");
    expect(uniqueSlug("lampe", new Set(["lampe", "lampe-2", "lampe-3"]))).toBe("lampe-4");
  });
});

describe("parseAmount", () => {
  it("lit les montants saisis avec séparateurs", () => {
    expect(parseAmount("12 500 F")).toBe(12500);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("0")).toBe(0);
  });
});

describe("validateProductForm", () => {
  it("accepte un formulaire valide et normalise", () => {
    const r = validateProductForm(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.price).toBe(8900);
      expect(r.value.cost).toBe(4600);
      expect(r.value.comparePrice).toBeNull();
      expect(r.value.keyword).toBe("lampe");
      expect(r.value.bg).toBe("#F3E3A6");
      expect(r.value.nameEn).toBeNull();
    }
  });
  it("applique les messages de la maquette", () => {
    const r = validateProductForm({ ...base, name: "ab", price: "", stock: "", description: "court" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.name).toBe("Nom trop court.");
      expect(r.errors.price).toBe("Indiquez un prix.");
      expect(r.errors.stock).toBe("Indiquez le stock.");
      expect(r.errors.description).toBe("Description trop courte (10 caractères minimum).");
    }
  });
  it("exige un ancien prix supérieur au prix", () => {
    const r = validateProductForm({ ...base, comparePrice: "8900" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.comparePrice).toBe("Doit dépasser le prix.");
    expect(validateProductForm({ ...base, comparePrice: "10000" }).ok).toBe(true);
  });
  it("accepte le stock 0 et refuse une couleur invalide", () => {
    expect(validateProductForm({ ...base, stock: "0" }).ok).toBe(true);
    const r = validateProductForm({ ...base, bg: "red" });
    expect(r.ok).toBe(false);
  });
  it("EN : description sans nom anglais refusée", () => {
    const r = validateProductForm({ ...base, descriptionEn: "A lamp that lasts ten hours." });
    expect(r.ok).toBe(false);
    expect(validateProductForm({ ...base, nameEn: "Rechargeable LED lamp", descriptionEn: "" }).ok).toBe(true);
  });
});

describe("marge et stock", () => {
  it("calcule la marge", () => {
    expect(marginOf(8900, 4600)).toEqual({ amount: 4300, pct: 48 });
    expect(marginOf(8900, null)).toBeNull();
  });
  it("classe le stock", () => {
    expect(stockTone(0)).toBe("out");
    expect(stockTone(5)).toBe("low");
    expect(stockTone(6)).toBe("ok");
  });
});

describe("packs", () => {
  const A = "6f1d3f6e-2c5a-4a53-8f0e-0a1b2c3d4e5f";
  const B = "7a1d3f6e-2c5a-4a53-8f0e-0a1b2c3d4e5f";
  const products = new Map([
    [A, { price: 8900, stock: 5 }],
    [B, { price: 6000, stock: 12 }],
  ]);
  const form: PackFormValues = {
    name: "Pack Maison",
    nameEn: "",
    description: "Les indispensables de la maison.",
    descriptionEn: "",
    price: "13500",
    active: true,
    imageUrl: null,
    items: [
      { productId: A, qty: 1 },
      { productId: B, qty: 1 },
    ],
  };
  it("calcule l'économie", () => {
    expect(packSavings(form.items, 13500, products)).toEqual({ total: 14900, saving: 1400, pct: 9, missing: 0 });
    expect(packSavings(form.items, 15000, products).saving).toBe(-100);
    expect(packSavings([{ productId: "x", qty: 1 }], 100, products).missing).toBe(1);
  });
  it("le stock du pack est le minimum par quantité", () => {
    expect(packStock(form.items, products)).toBe(5);
    expect(packStock([{ productId: A, qty: 2 }, { productId: B, qty: 1 }], products)).toBe(2);
    expect(packStock([], products)).toBe(0);
    expect(packStock([{ productId: "x", qty: 1 }], products)).toBe(0);
  });
  it("valide le formulaire", () => {
    expect(validatePackForm(form).ok).toBe(true);
    const empty = validatePackForm({ ...form, items: [] });
    expect(empty.ok).toBe(false);
    const dup = validatePackForm({ ...form, items: [{ productId: A, qty: 1 }, { productId: A, qty: 2 }] });
    expect(dup.ok).toBe(false);
    const qty = validatePackForm({ ...form, items: [{ productId: A, qty: 99 }] });
    expect(qty.ok).toBe(false);
    expect(validatePackForm({ ...form, price: "" }).ok).toBe(false);
  });
});

describe("URL de photo", () => {
  const sb = "https://abc.supabase.co";
  it("n'accepte que le bucket products", () => {
    expect(isStorageImageUrl(`${sb}/storage/v1/object/public/products/2026/10/x.webp`, sb)).toBe(true);
    expect(isStorageImageUrl("https://evil.example/x.png", sb)).toBe(false);
    expect(isStorageImageUrl(`${sb}/storage/v1/object/public/other/x.png`, sb)).toBe(false);
    expect(isStorageImageUrl(`${sb}/storage/v1/object/public/products/../x.png`, sb)).toBe(false);
    expect(isStorageImageUrl(`${sb}/storage/v1/object/public/products/x.png`, undefined)).toBe(false);
  });
});

describe("signature d'image", () => {
  it("reconnaît jpeg / png / webp par les octets", () => {
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe("image/jpeg");
    expect(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
    expect(detectImageType(webp)).toBe("image/webp");
  });
  it("refuse le reste (SVG, GIF, HTML, vide)", () => {
    expect(detectImageType(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(detectImageType(new TextEncoder().encode("GIF89a"))).toBeNull();
    expect(detectImageType(new TextEncoder().encode("<html>"))).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
    // RIFF mais pas WEBP (ex. WAV)
    expect(detectImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]))).toBeNull();
  });
});

describe("recadrage", () => {
  it("image paysage centrée : carré du petit côté", () => {
    const r = computeCropRect(2000, 1000, 280, { zoom: 1, panX: 0, panY: 0 });
    expect(r.side).toBeCloseTo(1000);
    expect(r.sx).toBeCloseTo(500);
    expect(r.sy).toBeCloseTo(0);
  });
  it("le zoom réduit la zone source", () => {
    const r = computeCropRect(1000, 1000, 280, { zoom: 2, panX: 0, panY: 0 });
    expect(r.side).toBeCloseTo(500);
    expect(r.sx).toBeCloseTo(250);
  });
  it("le décalage est borné : on ne sort jamais de l'image", () => {
    const c = clampPan(1000, 1000, 280, { zoom: 1, panX: 999, panY: 999 });
    expect(c.panX).toBe(0);
    const r = computeCropRect(1000, 1000, 280, { zoom: 2, panX: -99999, panY: 99999 });
    expect(r.sx).toBeGreaterThanOrEqual(0);
    expect(r.sx + r.side).toBeLessThanOrEqual(1000 + 1e-6);
    expect(r.sy).toBeGreaterThanOrEqual(0);
    expect(r.sy + r.side).toBeLessThanOrEqual(1000 + 1e-6);
  });
  it("sortie ≤ 1200 px, jamais agrandie", () => {
    expect(outputSide(3000)).toBe(1200);
    expect(outputSide(640)).toBe(640);
    expect(outputSide(0.4)).toBe(1);
  });
});
