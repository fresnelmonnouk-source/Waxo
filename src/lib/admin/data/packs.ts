import "server-only";
import demo from "@/lib/demo/catalog.json";
import type { AdminPack, PackProductRef, PacksData } from "@/components/admin/products/types";
import { ADMIN_LIST_LIMIT, adminDb, withTimeout } from "./products";

// Lecture admin des packs (packs + traductions + contenu). Repli démo sans Supabase : 3 packs calculés depuis le catalogue de démo.

type TrRow = { locale: string; name: string; slug: string; description: string };
type PackRow = {
  id: string;
  price: number;
  image_url: string | null;
  active: boolean;
  created_at: string;
  pack_translations: TrRow[] | null;
  pack_items: { product_id: string; qty: number }[] | null;
};

function demoProductRefs(): PackProductRef[] {
  return demo.products.map((p) => ({ id: p.id, name: p.fr.name, price: p.price, stock: p.stock, bg: p.bg, imageUrl: p.imageUrl, active: true }));
}

/** 3 packs de démonstration : les 3 premiers produits des rayons maison, cuisine et tech, à -10 % arrondi à la centaine. */
function demoPacks(): AdminPack[] {
  const picks: { cat: string; name: string; slug: string }[] = [
    { cat: "maison", name: "Pack Maison", slug: "pack-maison" },
    { cat: "cuisine", name: "Pack Cuisine", slug: "pack-cuisine" },
    { cat: "tech", name: "Pack Tech", slug: "pack-tech" },
  ];
  return picks.map((pk) => {
    const prods = demo.products.filter((p) => p.categoryId === pk.cat).slice(0, 3);
    const total = prods.reduce((a, p) => a + p.price, 0);
    return {
      id: `demo-${pk.slug}`,
      price: Math.round((total * 0.9) / 100) * 100,
      imageUrl: null,
      active: true,
      createdAt: "2026-09-01",
      fr: { name: pk.name, slug: pk.slug, description: `Les indispensables du rayon ${pk.cat}, réunis à prix réduit.` },
      en: null,
      items: prods.map((p) => ({ productId: p.id, qty: 1 })),
    };
  });
}

export async function getAdminPacks(): Promise<PacksData> {
  const sb = adminDb();
  if (!sb) return { source: "demo", packs: demoPacks(), products: demoProductRefs(), truncated: false };
  try {
    const [packs, prods] = await Promise.all([
      withTimeout(
        sb
          .from("packs")
          .select("id,price,image_url,active,created_at,pack_translations(locale,name,slug,description),pack_items(product_id,qty)")
          .order("created_at", { ascending: false })
          .range(0, ADMIN_LIST_LIMIT - 1),
      ),
      withTimeout(
        sb
          .from("products")
          .select("id,price,stock,bg,image_url,active,product_translations(locale,name)")
          .order("created_at", { ascending: false })
          .range(0, ADMIN_LIST_LIMIT - 1),
      ),
    ]);
    if (packs.error) throw packs.error;
    if (prods.error) throw prods.error;
    const rows = (packs.data ?? []) as unknown as PackRow[];
    const products: PackProductRef[] = (prods.data ?? []).map((p) => {
      const tr = (p.product_translations as { locale: string; name: string }[] | null) ?? [];
      return {
        id: p.id as string,
        name: tr.find((t) => t.locale === "fr")?.name ?? "(sans nom)",
        price: p.price as number,
        stock: p.stock as number,
        bg: (p.bg as string | null) ?? null,
        imageUrl: (p.image_url as string | null) ?? null,
        active: p.active as boolean,
      };
    });
    return {
      source: "db",
      packs: rows.map((r) => {
        const tr = r.pack_translations ?? [];
        const fr = tr.find((t) => t.locale === "fr");
        const en = tr.find((t) => t.locale === "en");
        return {
          id: r.id,
          price: r.price,
          imageUrl: r.image_url,
          active: r.active,
          createdAt: r.created_at,
          fr: fr ? { name: fr.name, slug: fr.slug, description: fr.description } : { name: "(sans nom)", slug: "", description: "" },
          en: en ? { name: en.name, slug: en.slug, description: en.description } : null,
          items: (r.pack_items ?? []).map((i) => ({ productId: i.product_id, qty: i.qty })),
        };
      }),
      products,
      truncated: rows.length >= ADMIN_LIST_LIMIT || products.length >= ADMIN_LIST_LIMIT,
    };
  } catch {
    return { source: "error", packs: [], products: [], truncated: false };
  }
}
