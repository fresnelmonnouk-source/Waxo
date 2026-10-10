import { NextResponse } from "next/server";
import { getProducts, getSettings } from "@/lib/catalog";
import { getPacks } from "@/lib/catalog/packs";
import type { Locale } from "@/i18n/routing";

/**
 * GET /api/checkout/config?lang=fr&ids=a,b — données publiques dont le tiroir panier a besoin sans que les pages
 * (statiques) ne les embarquent : réglages de livraison/paiement, stock des articles du panier, 2 produits « à petit prix ».
 * Lecture seule, aucune donnée privée. Ne renvoie jamais d'erreur 5xx : repli sur les réglages par défaut.
 */

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lang: Locale = params.get("lang") === "en" ? "en" : "fr";
  const ids = new Set(
    (params.get("ids") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => SAFE_ID.test(s))
      .slice(0, 50),
  );

  try {
    const [settings, products, packs] = await Promise.all([
      getSettings(),
      getProducts(lang, { sort: "popular" }),
      getPacks(lang).catch(() => []),
    ]);
    const stock: Record<string, number> = {};
    for (const p of products) if (ids.has(p.id)) stock[p.id] = p.stock;
    // Packs du panier : stock = min des stocks des produits / quantité (calculé par getPacks).
    for (const k of packs) if (ids.has(k.id)) stock[k.id] = k.stock;

    // Ids du panier absents du catalogue ET qui ne sont pas des UUID (restes de la démo) : à retirer côté navigateur.
    // Jamais un UUID : si la base est lente et que le catalogue retombe sur la démo, un vrai panier ne doit pas être vidé.
    const known = new Set([...products.map((p) => p.id), ...packs.map((k) => k.id)]);
    const stale = [...ids].filter((id) => !known.has(id) && !UUID.test(id));

    const upsell = products
      .filter((p) => !ids.has(p.id) && p.price <= 3000 && p.stock > 0)
      .slice(0, 2)
      .map((p) => ({ id: p.id, slug: p.slug, name: p.name, price: p.price, bg: p.bg, imageUrl: p.imageUrl }));

    return NextResponse.json(
      { ok: true, shipping: settings.shipping, pay: settings.pay, stock, upsell, stale },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } },
    );
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
