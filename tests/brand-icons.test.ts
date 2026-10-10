import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

const root = process.cwd();
const png = (p: string) => readFileSync(join(root, p));
// Lecture de la taille dans l'en-tête PNG (octets 16-23 : largeur puis hauteur).
const size = (p: string) => {
  const b = png(p);
  return { sig: b.subarray(0, 8).toString("hex"), w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};

describe("icônes de la marque (favicon « ɔ »)", () => {
  it("favicon.ico contient 16, 32 et 48 px", () => {
    const b = png("src/app/favicon.ico");
    expect(b.readUInt16LE(0)).toBe(0); // réservé
    expect(b.readUInt16LE(2)).toBe(1); // type ICO
    const n = b.readUInt16LE(4);
    const sizes = Array.from({ length: n }, (_, i) => b[6 + i * 16] || 256).sort((a, c) => a - c);
    expect(sizes).toEqual([16, 32, 48]);
  });
  it("icon.svg : pastille encre + « ɔ » terre cuite de la charte", () => {
    const svg = readFileSync(join(root, "src/app/icon.svg"), "utf8");
    expect(svg).toContain("#141210");
    expect(svg).toContain("#E2552B");
    expect(svg).toMatch(/viewBox="0 0 512 512"/);
    expect(svg).not.toMatch(/<script|onload|href=/i);
  });
  it("PNG aux bonnes dimensions (apple 180, Android 192/512, maskable 512)", () => {
    const expected: [string, number][] = [
      ["src/app/apple-icon.png", 180],
      ["public/icon-192.png", 192],
      ["public/icon-512.png", 512],
      ["public/icon-maskable-512.png", 512],
    ];
    for (const [p, px] of expected) expect(size(p), p).toEqual({ sig: "89504e470d0a1a0a", w: px, h: px });
  });
  it("le manifeste ne référence que des fichiers qui existent", () => {
    const icons = manifest().icons ?? [];
    expect(icons.length).toBeGreaterThanOrEqual(3);
    for (const i of icons) expect(existsSync(join(root, "public", i.src.replace(/^\//, ""))) || existsSync(join(root, "src/app", i.src.replace(/^\//, ""))), i.src).toBe(true);
    expect(icons.some((i) => i.purpose === "maskable")).toBe(true);
  });
});
