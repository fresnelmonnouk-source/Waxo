"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertAdmin } from "@/lib/admin/guard";
import { adminDb, takenSlugs } from "@/lib/admin/data/products";
import {
  isStorageImageUrl,
  productFormSchema,
  slugify,
  uniqueSlug,
  validateProductForm,
  type ProductInput,
} from "@/components/admin/products/logic";
import { UNAVAILABLE_MESSAGE, type ActionResult, type ProductFormValues } from "@/components/admin/products/types";

// Server actions produits. Chaque action : assertAdmin() d'abord → base joignable ? → Zod → validation métier → écriture service_role.
// Retour { ok:true } | { ok:false, code, message, fields? } : jamais d'erreur SQL ni de stack côté client.

type Fail = Extract<ActionResult, { ok: false }>;
const fail = (code: Fail["code"], message: string, fields?: Record<string, string>): Fail => ({ ok: false, code, message, fields });

const GENERIC = "Une erreur est survenue. Réessayez dans un instant.";
const uuid = z.uuid();

function refresh() {
  revalidatePath("/admin/produits");
  revalidatePath("/admin/packs");
  revalidatePath("/[lang]", "layout"); // boutique : catalogue, fiches, accueil
}

type Prepared = { sb: SupabaseClient } | { error: Fail };
async function prepare(): Promise<Prepared> {
  const admin = await assertAdmin();
  if (!admin) return { error: fail("unauthorized", "Session expirée. Reconnectez-vous.") };
  const sb = adminDb();
  if (!sb) return { error: fail("unavailable", UNAVAILABLE_MESSAGE) };
  return { sb };
}

type DbErr = { code?: string; message?: string } | null;
const isUnique = (e: DbErr) => e?.code === "23505";
const isFk = (e: DbErr) => e?.code === "23503";
const logDb = (where: string, e: DbErr) => console.error(`[admin/produits] ${where}`, e?.code ?? "", (e?.message ?? "").slice(0, 120));

function parseForm(values: unknown): { input: ProductInput } | { error: Fail } {
  const shape = productFormSchema.safeParse(values);
  if (!shape.success) return { error: fail("invalid", "Formulaire invalide.") };
  const v = validateProductForm(shape.data as ProductFormValues);
  if (!v.ok) {
    const first = Object.values(v.errors)[0] ?? "Formulaire invalide.";
    return { error: fail("invalid", first, v.errors as Record<string, string>) };
  }
  return { input: v.value };
}

function imageOk(url: string | null, current: string | null): boolean {
  if (url === null || url === current) return true;
  return isStorageImageUrl(url, process.env.NEXT_PUBLIC_SUPABASE_URL);
}

/** Insère une traduction avec un slug libre ; réessaie si un autre admin prend le même slug entre-temps. */
async function insertTranslation(
  sb: SupabaseClient,
  productId: string,
  locale: "fr" | "en",
  name: string,
  description: string,
): Promise<DbErr> {
  const base = slugify(name);
  let last: DbErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = uniqueSlug(base, await takenSlugs(sb, "product_translations", locale, base));
    const { error } = await sb.from("product_translations").insert({ product_id: productId, locale, name, slug, description });
    if (!error) return null;
    last = error;
    if (!isUnique(error)) break;
  }
  return last;
}

export async function createProduct(values: ProductFormValues): Promise<ActionResult<{ id: string }>> {
  const p = await prepare();
  if ("error" in p) return p.error;
  const parsed = parseForm(values);
  if ("error" in parsed) return parsed.error;
  const { input } = parsed;
  if (!imageOk(input.imageUrl, null)) return fail("invalid", "Photo invalide : renvoyez-la depuis le formulaire.", { imageUrl: "Photo invalide." });

  const { sb } = p;
  try {
    const { data, error } = await sb
      .from("products")
      .insert({
        category_id: input.categoryId,
        price: input.price,
        compare_price: input.comparePrice,
        stock: input.stock,
        keyword: input.keyword,
        bg: input.bg,
        image_url: input.imageUrl,
        active: input.active,
      })
      .select("id")
      .single();
    if (error || !data) {
      logDb("create", error);
      if (isFk(error)) return fail("invalid", "Rayon inconnu.", { categoryId: "Rayon inconnu." });
      return fail("error", GENERIC);
    }
    const id = data.id as string;
    const rollback = async () => {
      await sb.from("products").delete().eq("id", id); // cascade : traductions + coût
    };

    const frErr = await insertTranslation(sb, id, "fr", input.name, input.description);
    if (frErr) {
      logDb("create fr", frErr);
      await rollback();
      return fail("error", GENERIC);
    }
    if (input.nameEn) {
      const enErr = await insertTranslation(sb, id, "en", input.nameEn, input.descriptionEn);
      if (enErr) {
        logDb("create en", enErr);
        await rollback();
        return fail("error", GENERIC);
      }
    }
    if (input.cost !== null) {
      const { error: cErr } = await sb.from("product_costs").insert({ product_id: id, cost: input.cost });
      if (cErr) {
        logDb("create cost", cErr);
        await rollback();
        return fail("error", GENERIC);
      }
    }
    refresh();
    return { ok: true, id };
  } catch (e) {
    logDb("create throw", e as DbErr);
    return fail("error", GENERIC);
  }
}

export async function updateProduct(id: string, values: ProductFormValues): Promise<ActionResult> {
  const p = await prepare();
  if ("error" in p) return p.error;
  if (!uuid.safeParse(id).success) return fail("invalid", "Produit inconnu.");
  const parsed = parseForm(values);
  if ("error" in parsed) return parsed.error;
  const { input } = parsed;
  const { sb } = p;

  try {
    const { data: cur, error: curErr } = await sb
      .from("products")
      .select("id,image_url,product_translations(locale)")
      .eq("id", id)
      .maybeSingle();
    if (curErr) {
      logDb("update read", curErr);
      return fail("error", GENERIC);
    }
    if (!cur) return fail("not_found", "Ce produit n'existe plus.");
    if (!imageOk(input.imageUrl, (cur.image_url as string | null) ?? null)) {
      return fail("invalid", "Photo invalide : renvoyez-la depuis le formulaire.", { imageUrl: "Photo invalide." });
    }
    const locales = new Set(((cur.product_translations as { locale: string }[] | null) ?? []).map((t) => t.locale));

    const { error } = await sb
      .from("products")
      .update({
        category_id: input.categoryId,
        price: input.price,
        compare_price: input.comparePrice,
        stock: input.stock,
        keyword: input.keyword,
        bg: input.bg,
        image_url: input.imageUrl,
        active: input.active,
      })
      .eq("id", id);
    if (error) {
      logDb("update", error);
      if (isFk(error)) return fail("invalid", "Rayon inconnu.", { categoryId: "Rayon inconnu." });
      return fail("error", GENERIC);
    }

    // FR (obligatoire) : le slug reste stable (les liens partagés ne cassent pas), seuls nom et description changent.
    if (locales.has("fr")) {
      const { error: e } = await sb.from("product_translations").update({ name: input.name, description: input.description }).eq("product_id", id).eq("locale", "fr");
      if (e) {
        logDb("update fr", e);
        return fail("error", GENERIC);
      }
    } else {
      const e = await insertTranslation(sb, id, "fr", input.name, input.description);
      if (e) {
        logDb("update fr insert", e);
        return fail("error", GENERIC);
      }
    }
    // EN (facultatif) : créée, mise à jour ou retirée selon le nom saisi.
    if (input.nameEn) {
      if (locales.has("en")) {
        const { error: e } = await sb.from("product_translations").update({ name: input.nameEn, description: input.descriptionEn }).eq("product_id", id).eq("locale", "en");
        if (e) {
          logDb("update en", e);
          return fail("error", GENERIC);
        }
      } else {
        const e = await insertTranslation(sb, id, "en", input.nameEn, input.descriptionEn);
        if (e) {
          logDb("update en insert", e);
          return fail("error", GENERIC);
        }
      }
    } else if (locales.has("en")) {
      await sb.from("product_translations").delete().eq("product_id", id).eq("locale", "en");
    }
    // Prix d'achat
    if (input.cost !== null) {
      const { error: e } = await sb.from("product_costs").upsert({ product_id: id, cost: input.cost });
      if (e) {
        logDb("update cost", e);
        return fail("error", GENERIC);
      }
    } else {
      await sb.from("product_costs").delete().eq("product_id", id);
    }
    refresh();
    return { ok: true };
  } catch (e) {
    logDb("update throw", e as DbErr);
    return fail("error", GENERIC);
  }
}

export async function setProductActive(id: string, active: boolean): Promise<ActionResult> {
  const p = await prepare();
  if ("error" in p) return p.error;
  if (!uuid.safeParse(id).success || typeof active !== "boolean") return fail("invalid", "Demande invalide.");
  try {
    const { data, error } = await p.sb.from("products").update({ active }).eq("id", id).select("id");
    if (error) {
      logDb("active", error);
      return fail("error", GENERIC);
    }
    if (!data?.length) return fail("not_found", "Ce produit n'existe plus.");
    refresh();
    return { ok: true };
  } catch {
    return fail("error", GENERIC);
  }
}

/** Ajuste le stock de +/- delta sans écraser une vente concurrente (écriture conditionnelle sur l'ancienne valeur, 4 essais). */
export async function adjustStock(id: string, delta: number): Promise<ActionResult<{ stock: number }>> {
  const p = await prepare();
  if ("error" in p) return p.error;
  if (!uuid.safeParse(id).success || !Number.isInteger(delta) || Math.abs(delta) > 1000) return fail("invalid", "Demande invalide.");
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const { data: cur, error } = await p.sb.from("products").select("stock").eq("id", id).maybeSingle();
      if (error) {
        logDb("stock read", error);
        return fail("error", GENERIC);
      }
      if (!cur) return fail("not_found", "Ce produit n'existe plus.");
      const next = Math.min(100_000, Math.max(0, (cur.stock as number) + delta));
      const { data: upd, error: uErr } = await p.sb.from("products").update({ stock: next }).eq("id", id).eq("stock", cur.stock).select("stock");
      if (uErr) {
        logDb("stock write", uErr);
        return fail("error", GENERIC);
      }
      if (upd?.length) {
        refresh();
        return { ok: true, stock: next };
      }
    }
    return fail("conflict", "Le stock vient de changer (une vente ?). Réessayez.");
  } catch {
    return fail("error", GENERIC);
  }
}

/** Fixe le stock à une valeur saisie (inventaire). */
export async function setProductStock(id: string, stock: number): Promise<ActionResult<{ stock: number }>> {
  const p = await prepare();
  if ("error" in p) return p.error;
  if (!uuid.safeParse(id).success || !Number.isInteger(stock) || stock < 0 || stock > 100_000) return fail("invalid", "Stock invalide.");
  try {
    const { data, error } = await p.sb.from("products").update({ stock }).eq("id", id).select("stock");
    if (error) {
      logDb("stock set", error);
      return fail("error", GENERIC);
    }
    if (!data?.length) return fail("not_found", "Ce produit n'existe plus.");
    refresh();
    return { ok: true, stock };
  } catch {
    return fail("error", GENERIC);
  }
}

/** Suppression définitive. Refusée si le produit figure dans une commande (historique) ou dans un pack : le masquer à la place. */
export async function deleteProduct(id: string): Promise<ActionResult> {
  const p = await prepare();
  if ("error" in p) return p.error;
  if (!uuid.safeParse(id).success) return fail("invalid", "Produit inconnu.");
  const { sb } = p;
  try {
    const ordered = await sb.from("order_items").select("id", { count: "exact", head: true }).eq("product_id", id);
    if (ordered.error) {
      logDb("delete check orders", ordered.error);
      return fail("error", GENERIC);
    }
    if ((ordered.count ?? 0) > 0) {
      return fail("in_order", "Ce produit figure dans des commandes : masquez-le plutôt que de le supprimer.");
    }
    const packed = await sb.from("pack_items").select("pack_id", { count: "exact", head: true }).eq("product_id", id);
    if (packed.error) {
      logDb("delete check packs", packed.error);
      return fail("error", GENERIC);
    }
    if ((packed.count ?? 0) > 0) {
      return fail("in_pack", "Ce produit fait partie d'un pack : retirez-le du pack d'abord, ou masquez-le.");
    }
    const { error } = await sb.from("products").delete().eq("id", id);
    if (error) {
      logDb("delete", error);
      if (isFk(error)) return fail("in_pack", "Ce produit est encore référencé : masquez-le plutôt que de le supprimer.");
      return fail("error", GENERIC);
    }
    refresh();
    return { ok: true };
  } catch {
    return fail("error", GENERIC);
  }
}
