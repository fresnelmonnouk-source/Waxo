// Photos multiples (0024) : logique pure (ordre, limite, repli), validation du formulaire produit, JSON-LD multi-images.
import { describe, expect, it } from "vitest";
import {
  MAX_PRODUCT_IMAGES,
  appendImages,
  imageSources,
  isMissingImagesColumn,
  makeCover,
  moveImage,
  productImages,
  remainingSlots,
  removeImageAt,
  storageImageAt,
} from "@/lib/media/product-images";
import { validateProductForm } from "@/components/admin/products/logic";
import type { ProductFormValues } from "@/components/admin/products/types";
import { productJsonLd, productPageJsonLd } from "@/lib/seo/jsonld";

const BUCKET = "https://btarkkjimnkmiaxzonzq.supabase.co/storage/v1/object/public/products";
const url = (n: number) => `${BUCKET}/2026/10/photo-${n}.webp`;
const [A, B, C, D] = [1, 2, 3, 4].map(url);

describe("productImages : liste affichée", () => {
  it("prend `images` (0024) dans l'ordre, couverture en premier", () => {
    expect(productImages([B, A, C], A)).toEqual([B, A, C]);
  });
  it("colonne absente ou vide → repli sur la photo unique image_url", () => {
    expect(productImages(undefined, A)).toEqual([A]);
    expect(productImages(null, A)).toEqual([A]);
    expect(productImages([], A)).toEqual([A]);
  });
  it("sans photo → liste vide", () => {
    expect(productImages(undefined, null)).toEqual([]);
    expect(productImages([], "")).toEqual([]);
  });
  it("retire doublons, vides et valeurs non textuelles ; 8 au plus", () => {
    expect(productImages([A, A, "", null, 3, " ", B], null)).toEqual([A, B]);
    const ten = Array.from({ length: 10 }, (_, i) => url(i));
    expect(productImages(ten, null)).toHaveLength(MAX_PRODUCT_IMAGES);
  });
});

describe("réordonnancement et limite", () => {
  it("moveImage déplace et borne la cible", () => {
    expect(moveImage([A, B, C], 0, 2)).toEqual([B, C, A]);
    expect(moveImage([A, B, C], 2, 0)).toEqual([C, A, B]);
    expect(moveImage([A, B, C], 1, 99)).toEqual([A, C, B]);
    expect(moveImage([A, B, C], 1, -5)).toEqual([B, A, C]);
  });
  it("moveImage hors limites → copie inchangée (jamais la même référence)", () => {
    const list = [A, B];
    const out = moveImage(list, 5, 0);
    expect(out).toEqual(list);
    expect(out).not.toBe(list);
  });
  it("makeCover met la photo en tête sans changer l'ordre des autres", () => {
    expect(makeCover([A, B, C, D], 2)).toEqual([C, A, B, D]);
  });
  it("removeImageAt retire la photo ; retirer la couverture fait de la suivante la couverture", () => {
    expect(removeImageAt([A, B, C], 0)).toEqual([B, C]);
    expect(removeImageAt([A, B, C], 1)).toEqual([A, C]);
  });
  it("appendImages : sans doublon, refuse au-delà de 8 et compte les refus", () => {
    const seven = Array.from({ length: 7 }, (_, i) => url(i));
    const res = appendImages(seven, [url(100), url(0), url(101), url(102)]);
    expect(res.list).toHaveLength(8);
    expect(res.list[7]).toBe(url(100));
    expect(res.dropped).toBe(2);
    expect(remainingSlots(res.list)).toBe(0);
    expect(remainingSlots([A], 1)).toBe(0);
    expect(remainingSlots([A])).toBe(7);
  });
});

describe("validateProductForm : photos", () => {
  const base: ProductFormValues = {
    name: "Lampe LED rechargeable",
    nameEn: "",
    categoryId: "maison",
    price: "8900",
    comparePrice: "",
    stock: "5",
    cost: "",
    description: "Jusqu'à 10 h d'autonomie, 3 intensités.",
    descriptionEn: "",
    keyword: "",
    bg: "#F3E3A6",
    active: true,
    images: [],
  };
  it("garde l'ordre, retire doublons et vides", () => {
    const v = validateProductForm({ ...base, images: [B, A, B, " ", C] });
    expect(v.ok && v.value.images).toEqual([B, A, C]);
  });
  it("plus de 8 photos → erreur sur le champ photos", () => {
    const v = validateProductForm({ ...base, images: Array.from({ length: 9 }, (_, i) => url(i)) });
    expect(v.ok).toBe(false);
    expect(!v.ok && v.errors.images).toBe("8 photos au maximum.");
  });
  it("aucune photo reste permis (rendu fond coloré + mot)", () => {
    const v = validateProductForm(base);
    expect(v.ok && v.value.images).toEqual([]);
  });
});

describe("erreur « colonne images absente » (avant 0024)", () => {
  it("reconnaît la lecture (42703) et l'écriture (PGRST204)", () => {
    expect(isMissingImagesColumn({ code: "42703", message: "column products.images does not exist" })).toBe(true);
    expect(isMissingImagesColumn({ code: "PGRST204", message: "Could not find the 'images' column of 'products' in the schema cache" })).toBe(true);
  });
  it("n'avale pas les autres erreurs", () => {
    expect(isMissingImagesColumn(null)).toBe(false);
    expect(isMissingImagesColumn({ code: "500", message: "images" })).toBe(false);
    expect(isMissingImagesColumn({ code: "42703", message: "column products.updated_at does not exist" })).toBe(false);
  });
});

describe("tailles servies", () => {
  it("sans transformation (défaut) : image d'origine, pas de srcset", () => {
    expect(imageSources(A, false)).toEqual({ src: A });
  });
  it("avec transformation : URL /render/image/ et srcset", () => {
    expect(storageImageAt(A, 480)).toBe(`https://btarkkjimnkmiaxzonzq.supabase.co/storage/v1/render/image/public/products/2026/10/photo-1.webp?width=480&quality=75`);
    const s = imageSources(A, true, [320, 720]);
    expect(s.src).toContain("/render/image/public/products/2026/10/photo-1.webp?width=720");
    expect(s.srcSet).toMatch(/width=320&quality=75 320w, .*width=720&quality=75 720w$/);
  });
  it("URL hors Storage (démo, chemin local) : jamais transformée", () => {
    expect(imageSources("/demo/lampe.webp", true)).toEqual({ src: "/demo/lampe.webp" });
  });
});

describe("JSON-LD Product : toutes les photos", () => {
  const p = { id: "5b4e688a-1bb0-4e16-aeb8-a933014cd3ac", slug: "lampe", name: "Lampe", price: 8900, stock: 3 };
  it("image = tableau de toutes les photos, couverture en premier", () => {
    const ld = productJsonLd({ ...p, imageUrl: B, images: [B, A, C] }, "fr", { base: "https://waxo.bj" });
    expect(ld.image).toEqual([B, A, C]);
  });
  it("repli sur imageUrl seule, et pas de clé image sans photo", () => {
    expect(productJsonLd({ ...p, imageUrl: A }, "fr", { base: "https://waxo.bj" }).image).toEqual([A]);
    expect(productJsonLd({ ...p, imageUrl: null, images: [] }, "fr", { base: "https://waxo.bj" })).not.toHaveProperty("image");
  });
  it("fiche produit : la page passe toutes les photos au JSON-LD", () => {
    const [prod] = productPageJsonLd({ ...p, imageUrl: A, images: [A, B, D] }, undefined, { home: "Accueil", catalogue: "Catalogue", packs: "" }, "fr", "https://waxo.bj");
    expect(prod.image).toEqual([A, B, D]);
  });
});
