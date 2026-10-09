import { getProductsByIds } from "@/lib/catalog";
import { isLocale } from "@/lib/auth/http";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_IDS = 60;

/**
 * GET /api/products?ids=a,b,c&lang=fr — produits (localisés) par identifiants, pour la page Favoris
 * (les favoris vivent dans le navigateur, la page reste statique). Données publiques uniquement.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const lang = params.get("lang");
  const ids = (params.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => ID_RE.test(s))
    .slice(0, MAX_IDS);

  if (!ids.length) return Response.json({ products: [] }, { headers: { "Cache-Control": "no-store" } });
  try {
    const products = await getProductsByIds(isLocale(lang) ? lang : "fr", ids);
    return Response.json({ products }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch {
    return Response.json({ products: [], error: true }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
