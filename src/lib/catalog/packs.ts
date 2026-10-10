import "server-only";
import { createHash } from "node:crypto";
import { cache } from "react";
import type { Locale } from "@/i18n/routing";
import { buildPack, type Pack, type PackItem } from "@/components/packs/logic";
import { createPublicClient } from "@/lib/supabase/public";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { getProducts, getSettings, type Product } from "./index";

export type { Pack, PackItem };

/**
 * Lecture des packs de la boutique (serveur, sans cookies → pages statiques/ISR possibles).
 * Source : Supabase (`packs` + `pack_translations` + `pack_items`) si configuré ET non vide ; sinon repli sur 3 packs de
 * démonstration calculés en code à partir du catalogue (mêmes packs et mêmes identifiants que `0006_packs_demo.sql`).
 * Prix, économie et stock sont toujours recalculés ici à partir du catalogue courant. Jamais d'exception vers les pages.
 */

const TIMEOUT_MS = 4000;
function withTimeout<T>(p: PromiseLike<T>): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("supabase_timeout")), TIMEOUT_MS)),
  ]);
}

// ───────────────────────── Démo (repli) ─────────────────────────
/** Même fonction que `scripts/gen-seed.mjs` : identifiants déterministes (md5 → uuid v4-like). */
export function demoUuid(ns: string, key: string): string {
  const h = createHash("md5").update(`${ns}:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

type DemoText = { name: string; slug: string; description: string };
export type DemoPackDef = {
  key: string;
  price: number;
  fr: DemoText;
  en: DemoText;
  /** `product` = identifiant du produit dans le jeu de démonstration (son slug FR). */
  items: { product: string; qty: number }[];
};

export const DEMO_PACKS: DemoPackDef[] = [
  {
    key: "bureau",
    price: 8900,
    fr: {
      name: "Pack Bureau confort",
      slug: "pack-bureau-confort",
      description:
        "Tout pour un bureau agréable : un support téléphone pliable, un tapis de souris ergonomique, un carnet A5 pointillé et un lot de 6 surligneurs pastel. Prêt à travailler, à prix réduit.",
    },
    en: {
      name: "Comfy Desk Pack",
      slug: "comfy-desk-pack",
      description:
        "Everything for a pleasant desk: a foldable phone stand, an ergonomic mouse pad, a dotted A5 notebook and a set of 6 pastel highlighters. Ready to work, at a reduced price.",
    },
    items: [
      { product: "support", qty: 1 },
      { product: "tapis", qty: 1 },
      { product: "carnet", qty: 1 },
      { product: "surligneurs", qty: 1 },
    ],
  },
  {
    key: "voyage",
    price: 17900,
    fr: {
      name: "Pack Voyage léger",
      slug: "pack-voyage-leger",
      description:
        "Le kit du voyageur organisé : une gourde isotherme 750 ml, une trousse de toilette pliable, un masque de sommeil 3D et des organiseurs de valise. Tout dans le même colis.",
    },
    en: {
      name: "Travel Light Pack",
      slug: "travel-light-pack",
      description:
        "The organised traveller's kit: a 750 ml insulated bottle, a foldable toiletry bag, a 3D sleep mask and suitcase organisers. Everything in the same parcel.",
    },
    items: [
      { product: "gourde", qty: 1 },
      { product: "trousse", qty: 1 },
      { product: "masque", qty: 1 },
      { product: "organiseurs", qty: 1 },
    ],
  },
  {
    key: "beaute",
    price: 11900,
    fr: {
      name: "Pack Beauté douceur",
      slug: "pack-beaute-douceur",
      description:
        "Un rituel simple pour prendre soin de soi : une brosse nettoyante visage, un miroir LED de poche et un set de 10 pinceaux de maquillage. Trois essentiels, un seul prix.",
    },
    en: {
      name: "Gentle Beauty Pack",
      slug: "gentle-beauty-pack",
      description:
        "A simple routine to look after yourself: a facial cleansing brush, a pocket LED mirror and a set of 10 makeup brushes. Three essentials, one price.",
    },
    items: [
      { product: "brosse", qty: 1 },
      { product: "miroir", qty: 1 },
      { product: "pinceaux", qty: 1 },
    ],
  },
];

/** Identifiant du pack de démonstration (identique à celui inséré par `0006_packs_demo.sql`). */
export const demoPackId = (key: string) => demoUuid("pack", key);

function toItem(product: Product, qty: number): PackItem {
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    qty,
    price: product.price,
    stock: product.stock,
    keyword: product.keyword,
    bg: product.bg,
    imageUrl: product.imageUrl,
  };
}

/** Packs de démonstration construits sur le catalogue : un produit est retrouvé par son id de démo ou par son uuid de seed. */
export function buildDemoPacks(locale: Locale, products: Product[]): Pack[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  return DEMO_PACKS.map((def) => {
    const tr = locale === "en" ? def.en : def.fr;
    const items = def.items.flatMap(({ product, qty }) => {
      const p = byId.get(product) ?? byId.get(demoUuid("product", product));
      return p ? [toItem(p, qty)] : [];
    });
    return buildPack(
      { id: demoPackId(def.key), slug: tr.slug, name: tr.name, description: tr.description, price: def.price, imageUrl: null },
      items,
      def.items.length,
    );
  });
}

// ───────────────────────── Base de données ─────────────────────────
type DbPackRow = {
  id: string;
  price: number;
  image_url: string | null;
  created_at: string;
  pack_translations: { locale: string; name: string; slug: string; description: string }[];
  pack_items: { product_id: string; qty: number }[];
};

async function fetchDbPacks(locale: Locale, products: Product[]): Promise<Pack[] | null> {
  if (!supabasePublicEnv()) return null;
  try {
    const { data, error } = await withTimeout(
      createPublicClient()
        .from("packs")
        .select("id,price,image_url,created_at,pack_translations(locale,name,slug,description),pack_items(product_id,qty)")
        .eq("active", true)
        .order("created_at", { ascending: true }),
    );
    if (error || !data?.length) return null;
    const byId = new Map(products.map((p) => [p.id, p]));
    const packs = (data as unknown as DbPackRow[]).flatMap((row) => {
      const tr = row.pack_translations.find((t) => t.locale === locale) ?? row.pack_translations.find((t) => t.locale === "fr");
      if (!tr || !tr.slug) return [];
      const items = row.pack_items.flatMap((it) => {
        const p = byId.get(it.product_id);
        return p ? [toItem(p, it.qty)] : [];
      });
      return [
        buildPack(
          { id: row.id, slug: tr.slug, name: tr.name, description: tr.description, price: row.price, imageUrl: row.image_url },
          items,
          row.pack_items.length,
        ),
      ];
    });
    return packs.length ? packs : null;
  } catch {
    return null;
  }
}

// ───────────────────────── API publique ─────────────────────────
/** Tous les packs actifs, localisés (base d'abord, démo si la base est absente ou vide). */
export const getPacks = cache(async (locale: Locale): Promise<Pack[]> => {
  try {
    const products = await getProducts(locale);
    return (await fetchDbPacks(locale, products)) ?? buildDemoPacks(locale, products);
  } catch {
    return [];
  }
});

/** Les packs sont-ils activés (bouton Admin → Packs) ? Vrai par défaut, y compris si la lecture échoue. */
export async function getPacksEnabled(): Promise<boolean> {
  return (await getSettings()).features?.packs !== false;
}

export async function getPackBySlug(locale: Locale, slug: string): Promise<Pack | null> {
  return (await getPacks(locale)).find((p) => p.slug === slug) ?? null;
}
