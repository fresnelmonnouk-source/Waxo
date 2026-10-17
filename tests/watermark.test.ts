// Filigrane des photos (src/lib/media/watermark.ts) : images de test générées avec sharp (blanche, sombre, PNG détourée).
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { WATERMARK_VERSION, applyWatermark } from "@/lib/media/watermark";
import { WATERMARK_VERSION as SHARED_VERSION } from "@/lib/media/watermark-version";

const solid = (w: number, h: number, color: string) =>
  sharp({ create: { width: w, height: h, channels: 3, background: color } })
    .png()
    .toBuffer();

/** Moyenne des écarts de pixels entre deux images RGB(A) de même taille (0 = identiques). */
async function meanDiff(a: Buffer, b: Buffer): Promise<number> {
  const [ra, rb] = await Promise.all([sharp(a).removeAlpha().raw().toBuffer(), sharp(b).removeAlpha().raw().toBuffer()]);
  expect(ra.length).toBe(rb.length);
  let sum = 0;
  for (let i = 0; i < ra.length; i += 1) sum += Math.abs(ra[i] - rb[i]);
  return sum / ra.length;
}

describe("applyWatermark", () => {
  it("expose la version du style", () => {
    expect(WATERMARK_VERSION).toBe("1");
    expect(WATERMARK_VERSION).toBe(SHARED_VERSION);
  });

  it("photo claire : sortie WebP, dimensions réduites à la largeur demandée, motif visible (pixels modifiés)", async () => {
    const src = await solid(900, 600, "#ffffff");
    const out = await applyWatermark(src, 480);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(480);
    expect(meta.height).toBe(320); // ratio conservé
    expect(meta.hasAlpha).toBe(false);
    const plain = await sharp(src).resize({ width: 480 }).webp({ quality: 80 }).toBuffer();
    expect(await meanDiff(out, plain)).toBeGreaterThan(1);
  });

  it("photo sombre : le motif reste visible (liseré clair sous l'encre)", async () => {
    const src = await solid(800, 800, "#101010");
    const out = await applyWatermark(src, 720);
    const plain = await sharp(src).resize({ width: 720 }).webp({ quality: 80 }).toBuffer();
    expect(await meanDiff(out, plain)).toBeGreaterThan(0.3);
    // au moins un pixel nettement plus clair que le fond : c'est le liseré
    const { data } = await sharp(out).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let brightest = 0;
    for (let i = 0; i < data.length; i += 1) brightest = Math.max(brightest, data[i]);
    expect(brightest).toBeGreaterThan(0x10 + 8);
  });

  it("n'agrandit jamais une petite image", async () => {
    const src = await solid(300, 200, "#e0d0b0");
    const meta = await sharp(await applyWatermark(src, 1080)).metadata();
    expect([meta.width, meta.height]).toEqual([300, 200]);
  });

  it("PNG détourée : alpha conservé (fond resté transparent), WebP en sortie", async () => {
    const circle = Buffer.from('<svg width="600" height="600"><circle cx="300" cy="300" r="200" fill="#c04020"/></svg>');
    const src = await sharp(circle).png().toBuffer();
    const out = await applyWatermark(src, 480);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.hasAlpha).toBe(true);
    expect([meta.width, meta.height]).toEqual([480, 480]);
    const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
    expect(info.channels).toBe(4);
    const alphaAt = (x: number, y: number) => data[(y * info.width + x) * 4 + 3];
    expect(alphaAt(240, 240)).toBe(255); // centre du disque : opaque
    // coins hors du disque : le plus souvent transparents (le motif n'y met qu'un voile très léger)
    let transparent = 0;
    let total = 0;
    for (let y = 0; y < 80; y += 1)
      for (let x = 0; x < 80; x += 1) {
        total += 1;
        if (alphaAt(x, y) < 128) transparent += 1;
      }
    expect(transparent / total).toBeGreaterThan(0.7);
  });

  it("reproductible : même entrée et même largeur = même sortie", async () => {
    const src = await solid(640, 640, "#7799aa");
    const [a, b] = await Promise.all([applyWatermark(src, 480), applyWatermark(src, 480)]);
    expect(a.equals(b)).toBe(true);
  });

  it("le motif est relatif à la largeur : même proportion en miniature qu'en grand", async () => {
    const big = await sharp(await applyWatermark(await solid(1200, 1200, "#ffffff"), 1080)).resize(320).raw().toBuffer();
    const small = await sharp(await applyWatermark(await solid(1200, 1200, "#ffffff"), 320)).raw().toBuffer();
    // moyennes de luminosité voisines (même densité de motif)
    const avg = (b: Buffer) => b.reduce((s, v) => s + v, 0) / b.length;
    expect(Math.abs(avg(big) - avg(small))).toBeLessThan(2);
  });

  it("refuse une entrée qui n'est pas une image, et une largeur hors limites", async () => {
    await expect(applyWatermark(Buffer.from("pas une image"), 480)).rejects.toThrow();
    const src = await solid(100, 100, "#ffffff");
    await expect(applyWatermark(src, 0)).rejects.toThrow();
    await expect(applyWatermark(src, 100000)).rejects.toThrow();
    await expect(applyWatermark(src, Number.NaN)).rejects.toThrow();
  });
});
