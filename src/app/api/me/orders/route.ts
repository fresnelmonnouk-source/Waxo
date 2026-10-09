import { fail, isLocale, json } from "@/lib/auth/http";
import { asStatus } from "@/lib/auth/status";
import { withTimeout } from "@/lib/auth/timeout";
import type { OrderView } from "@/lib/auth/types";
import { getSessionContext } from "@/lib/auth/user";

type Raw = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === "string" ? v : "");

function slugOf(item: Raw, lang: string): string | null {
  const product = item.products as Raw | Raw[] | null | undefined;
  const p = Array.isArray(product) ? product[0] : product;
  const tr = (p?.product_translations ?? []) as Raw[];
  const hit = tr.find((t) => t.locale === lang) ?? tr.find((t) => t.locale === "fr");
  return hit && typeof hit.slug === "string" ? hit.slug : null;
}

/** Mes commandes. Lecture sous RLS (orders_read) ET filtre explicite : un admin verrait sinon toutes les commandes. */
export async function GET(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return fail("unauthorized", 401);
  const langParam = new URL(req.url).searchParams.get("lang");
  const lang = isLocale(langParam) ? langParam : "fr";

  try {
    const base = "number,status,zone,pay,address,subtotal,shipping_fee,total,created_at";
    const query = (select: string) =>
      withTimeout(
        ctx.sb.from("orders").select(select).eq("user_id", ctx.userId).order("created_at", { ascending: false }).limit(50),
      ) as unknown as Promise<{ data: Raw[] | null; error: unknown }>;
    let res = await query(`${base},order_items(name,unit_price,qty,products(product_translations(locale,slug)))`);
    // Jointure produit indisponible : on affiche les commandes sans lien vers les fiches.
    if (res.error) res = await query(`${base},order_items(name,unit_price,qty)`);
    if (res.error) return fail("generic", 502);

    const orders: OrderView[] = (res.data ?? []).map((o) => ({
      number: str(o.number),
      status: asStatus(o.status),
      createdAt: str(o.created_at),
      zone: str(o.zone),
      pay: str(o.pay),
      address: str(o.address),
      subtotal: num(o.subtotal),
      shippingFee: num(o.shipping_fee),
      total: num(o.total),
      items: ((o.order_items ?? []) as Raw[]).map((i) => ({
        name: str(i.name),
        qty: num(i.qty),
        unitPrice: num(i.unit_price),
        slug: slugOf(i, lang),
      })),
    }));
    return json({ ok: true, orders });
  } catch {
    return fail("generic", 502);
  }
}
