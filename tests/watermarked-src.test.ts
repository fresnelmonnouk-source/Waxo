// Photos servies avec filigrane : watermarkedSrc / imageSources / parseBucketPhotoUrl (module pur), cssUrl / cssImage,
// Open Graph et JSON-LD. Les originaux (démo, externes, vides) et l'ADMIN restent inchangés.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cssImage } from "@/components/product/media";
import { cssUrl } from "@/components/shop/logic";
import { productJsonLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import {
  WATERMARK_WIDTHS,
  imageSources,
  parseBucketPhotoUrl,
  snapWatermarkWidth,
  watermarkEnabled,
  watermarkedSrc,
} from "@/lib/media/product-images";
import { WATERMARK_VERSION } from "@/lib/media/watermark-version";

const HOST = "btarkkjimnkmiaxzonzq.supabase.co";
const SUPABASE = `https://${HOST}`;
const A = `${SUPABASE}/storage/v1/object/public/products/2026/10/photo-1.webp`;
const enc = (u: string) => encodeURIComponent(u);
const via = (u: string, w: number) => `/api/img?u=${enc(u)}&w=${w}&v=${WATERMARK_VERSION}`;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE);
  vi.stubEnv("NEXT_PUBLIC_IMAGE_WATERMARK", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("parseBucketPhotoUrl", () => {
  it("accepte une photo du bucket products et renvoie l'URL canonique", () => {
    expect(parseBucketPhotoUrl(A)).toBe(A);
  });
  it.each([
    ["autre hôte", `https://evil.test/storage/v1/object/public/products/a.webp`],
    ["sous-domaine piégé", `https://${HOST}.evil.test/storage/v1/object/public/products/a.webp`],
    ["identifiants dans l'URL", `https://user:pw@${HOST}/storage/v1/object/public/products/a.webp`],
    ["port", `https://${HOST}:8443/storage/v1/object/public/products/a.webp`],
    ["http", `http://${HOST}/storage/v1/object/public/products/a.webp`],
    ["autre bucket", `${SUPABASE}/storage/v1/object/public/avatars/a.webp`],
    ["préfixe de bucket proche", `${SUPABASE}/storage/v1/object/public/products-private/a.webp`],
    ["URL signée / privée", `${SUPABASE}/storage/v1/object/sign/products/a.webp`],
    ["..", `${SUPABASE}/storage/v1/object/public/products/../avatars/a.webp`],
    ["%2e%2e", `${SUPABASE}/storage/v1/object/public/products/%2e%2e/avatars/a.webp`],
    ["%2E%2E", `${SUPABASE}/storage/v1/object/public/products/%2E%2E/a.webp`],
    ["slash encodé", `${SUPABASE}/storage/v1/object/public/products/a%2f..%2fb.webp`],
    ["antislash encodé", `${SUPABASE}/storage/v1/object/public/products/a%5cb.webp`],
    ["octet nul", `${SUPABASE}/storage/v1/object/public/products/a%00.webp`],
    ["pourcentage invalide", `${SUPABASE}/storage/v1/object/public/products/a%zz.webp`],
    ["segment vide", `${SUPABASE}/storage/v1/object/public/products/2026//a.webp`],
    ["requête", `${A}?download=1`],
    ["ancre", `${A}#x`],
    ["antislash", `${SUPABASE}/storage/v1/object/public/products/a\\b.webp`],
    ["espace", `${A} `],
    ["objet vide", `${SUPABASE}/storage/v1/object/public/products/`],
    ["trop long", `${SUPABASE}/storage/v1/object/public/products/${"a".repeat(500)}.webp`],
  ])("refuse : %s", (_n, url) => {
    expect(parseBucketPhotoUrl(url)).toBeNull();
  });
  it("refuse les valeurs qui ne sont pas des chaînes, et tout si NEXT_PUBLIC_SUPABASE_URL manque ou n'est pas https", () => {
    expect(parseBucketPhotoUrl(null)).toBeNull();
    expect(parseBucketPhotoUrl(42)).toBeNull();
    expect(parseBucketPhotoUrl(A, "")).toBeNull();
    expect(parseBucketPhotoUrl(A, `http://${HOST}`)).toBeNull();
    expect(parseBucketPhotoUrl(A, "pas une url")).toBeNull();
  });
});

describe("watermarkedSrc", () => {
  it("photo du bucket : /api/img avec u encodé, largeur arrondie à la liste blanche et version", () => {
    expect(watermarkedSrc(A, 720)).toBe(via(A, 720));
    expect(watermarkedSrc(A, 160)).toBe(via(A, 320)); // vignette de panier → 320
    expect(watermarkedSrc(A, 500)).toBe(via(A, 720));
    expect(watermarkedSrc(A, 5000)).toBe(via(A, 1200));
  });
  it("snapWatermarkWidth ne sort jamais de la liste blanche", () => {
    for (const w of [0, 1, 319, 321, 481, 1080, 1081, 1200, 9999, NaN]) expect(WATERMARK_WIDTHS).toContain(snapWatermarkWidth(w));
  });
  it("démo, externe, local, vide, null : inchangés", () => {
    expect(watermarkedSrc("/demo/lampe.webp", 720)).toBe("/demo/lampe.webp");
    expect(watermarkedSrc("https://cdn.exemple.com/a.webp", 720)).toBe("https://cdn.exemple.com/a.webp");
    expect(watermarkedSrc(`${A}?v=2`, 720)).toBe(`${A}?v=2`);
    expect(watermarkedSrc("", 720)).toBeNull();
    expect(watermarkedSrc(null, 720)).toBeNull();
    expect(watermarkedSrc(undefined, 720)).toBeNull();
  });
  it("NEXT_PUBLIC_IMAGE_WATERMARK=0 : URL d'origine", () => {
    vi.stubEnv("NEXT_PUBLIC_IMAGE_WATERMARK", "0");
    expect(watermarkEnabled()).toBe(false);
    expect(watermarkedSrc(A, 720)).toBe(A);
    expect(imageSources(A)).toEqual({ src: A });
  });
  it("activé par défaut (variable absente ou autre que 0)", () => {
    vi.stubEnv("NEXT_PUBLIC_IMAGE_WATERMARK", "");
    expect(watermarkEnabled()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_IMAGE_WATERMARK", "1");
    expect(watermarkEnabled()).toBe(true);
  });
  it("sans NEXT_PUBLIC_SUPABASE_URL : inchangé (jamais une URL que la route refuserait)", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(watermarkedSrc(A, 720)).toBe(A);
  });
});

describe("imageSources avec filigrane", () => {
  it("photo du bucket : src 720 + srcset 320/480/720/1080 via /api/img (même sans transformation Supabase)", () => {
    const s = imageSources(A);
    expect(s.src).toBe(via(A, 720));
    expect(s.srcSet).toBe([320, 480, 720, 1080].map((w) => `${via(A, w)} ${w}w`).join(", "));
    expect(imageSources(A, true)).toEqual(s); // le filigrane prime sur la transformation Supabase
  });
  it("hors bucket : ancien comportement (démo inchangée, transformation seulement si activée)", () => {
    expect(imageSources("/demo/lampe.webp")).toEqual({ src: "/demo/lampe.webp" });
    expect(imageSources("/demo/lampe.webp", true)).toEqual({ src: "/demo/lampe.webp" });
    expect(imageSources("https://cdn.exemple.com/a.webp")).toEqual({ src: "https://cdn.exemple.com/a.webp" });
  });
  it("filigrane coupé : transformation Supabase (si activée) ou origine", () => {
    expect(imageSources(A, false, undefined, false)).toEqual({ src: A });
    expect(imageSources(A, true, [320, 720], false).src).toContain("/render/image/public/products/2026/10/photo-1.webp?width=720");
  });
});

describe("arrière-plans CSS (cssUrl / cssImage)", () => {
  it("photo du bucket : /api/img à la largeur demandée", () => {
    expect(cssUrl(A, 720)).toBe(`url("${via(A, 720)}")`);
    expect(cssUrl(A)).toBe(`url("${via(A, 480)}")`);
    expect(cssImage(A)).toBe(`url(${JSON.stringify(via(A, 320))}) center/cover no-repeat`);
    expect(cssImage(A, 1080)).toBe(`url(${JSON.stringify(via(A, 1080))}) center/cover no-repeat`);
  });
  it("hors bucket / absente : comme avant", () => {
    expect(cssUrl("/demo/a.webp")).toBe('url("/demo/a.webp")');
    expect(cssImage("/demo/a.webp")).toBe('url("/demo/a.webp") center/cover no-repeat');
    expect(cssImage(null)).toBeNull();
  });
});

describe("Open Graph, Twitter et JSON-LD", () => {
  it("image de partage : version filigranée absolue (1 200 px)", () => {
    const m = pageMetadata({ lang: "fr", path: "/produit/lampe", title: "Lampe", image: A });
    const og = (m.openGraph?.images as { url: string }[])[0].url;
    expect(og.startsWith("http")).toBe(true);
    expect(og).toContain(`/api/img?u=${enc(A)}&w=1200&v=${WATERMARK_VERSION}`);
    expect((m.twitter?.images as string[])[0]).toBe(og);
  });
  it("image de partage hors bucket : inchangée", () => {
    const m = pageMetadata({ lang: "fr", path: "/p", title: "P", image: "https://cdn.exemple.com/a.webp" });
    expect((m.openGraph?.images as { url: string }[])[0].url).toBe("https://cdn.exemple.com/a.webp");
  });
  it("JSON-LD Product : toutes les photos filigranées en URL absolues", () => {
    const B = `${SUPABASE}/storage/v1/object/public/products/2026/10/photo-2.webp`;
    const ld = productJsonLd({ id: "x", slug: "lampe", name: "Lampe", price: 8900, stock: 3, images: [A, B, "https://cdn.exemple.com/c.webp"] }, "fr", { base: "https://waxo.bj" });
    expect(ld.image).toEqual([`https://waxo.bj${via(A, 1200)}`, `https://waxo.bj${via(B, 1200)}`, "https://cdn.exemple.com/c.webp"]);
  });
  it("JSON-LD Product : filigrane coupé = URLs d'origine", () => {
    vi.stubEnv("NEXT_PUBLIC_IMAGE_WATERMARK", "0");
    const ld = productJsonLd({ id: "x", slug: "lampe", name: "Lampe", price: 8900, stock: 3, imageUrl: A }, "fr", { base: "https://waxo.bj" });
    expect(ld.image).toEqual([A]);
  });
});

describe("l'admin garde les photos d'origine (propres)", () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
    });
  const adminFiles = [...walk("src/components/admin"), ...walk("src/lib/admin"), ...walk("src/app/admin"), ...walk("src/app/api/admin")];
  it("aucun fichier de l'admin n'utilise le filigrane ni les aides d'image publiques", () => {
    expect(adminFiles.length).toBeGreaterThan(20);
    for (const f of adminFiles) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/watermarkedSrc|imageSources|cssUrl|cssImage|\/api\/img/);
    }
  });
});
