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
import { isMissingImagesColumn } from "@/lib/media/product-images";

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
  revalidatePath("/sitemap.xml");
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
/** Contrainte CHECK refusée : pour les photos, `products_images_valid` (0024 : 8 au plus, bucket `products`). */
const isPhotoCheck = (e: DbErr) => e?.code === "23514" && /images/.test(e?.message ?? "");
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

/** Chaque photo est une photo DÉJÀ enregistrée sur ce produit, ou une URL de NOTRE bucket `products` (jamais une URL arbitraire). */
function imagesOk(urls: readonly string[], current: readonly string[]): boolean {
  return urls.every((u) => current.includes(u) || isStorageImageUrl(u, process.env.NEXT_PUBLIC_SUPABASE_URL));
}

const BAD_PHOTO = "Photo invalide : renvoyez-la depuis le formulaire.";
const NEED_0024 = "Plusieurs photos : la migration 0024 n'est pas encore appliquée. Gardez une seule photo pour l'instant.";

/**
 * Colonnes photo à écrire : `images` (0024) + `image_url` = photo principale (compatibilité, aussi tenue par le trigger).
 * `legacy` = sans `images`, quand la colonne n'existe pas encore (une seule photo possible).
 */
const photoColumns = (images: readonly string[], legacy = false) =>
  legacy ? { image_url: images[0] ?? null } : { images: [...images], image_url: images[0] ?? null };

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
  if (!imagesOk(input.images, [])) return fail("invalid", BAD_PHOTO, { images: "Photo invalide." });

  const { sb } = p;
  try {
    const row = {
      category_id: input.categoryId,
      price: input.price,
      compare_price: input.comparePrice,
      stock: input.stock,
      keyword: input.keyword,
      bg: input.bg,
      active: input.active,
    };
    const insert = (legacy: boolean) => sb.from("products").insert({ ...row, ...photoColumns(input.images, legacy) }).select("id").single();
    let { data, error } = await insert(false);
    if (isMissingImagesColumn(error)) {
      if (input.images.length > 1) return fail("invalid", NEED_0024, { images: NEED_0024 });
      ({ data, error } = await insert(true));
    }
    if (error || !data) {
      logDb("create", error);
      if (isFk(error)) return fail("invalid", "Rayon inconnu.", { categoryId: "Rayon inconnu." });
      if (isPhotoCheck(error)) return fail("invalid", BAD_PHOTO, { images: "Photo invalide." });
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
    const readCurrent = (columns: string) => sb.from("products").select(columns).eq("id", id).maybeSingle();
    let legacy = false;
    let { data: curData, error: curErr } = await readCurrent("id,image_url,images,product_translations(locale)");
    if (isMissingImagesColumn(curErr)) {
      legacy = true;
      ({ data: curData, error: curErr } = await readCurrent("id,image_url,product_translations(locale)"));
    }
    if (curErr) {
      logDb("update read", curErr);
      return fail("error", GENERIC);
    }
    const cur = curData as { image_url?: string | null; images?: string[] | null; product_translations?: { locale: string }[] | null } | null;
    if (!cur) return fail("not_found", "Ce produit n'existe plus.");
    const currentImages = [...(cur.images ?? []), ...(cur.image_url ? [cur.image_url] : [])];
    if (!imagesOk(input.images, currentImages)) return fail("invalid", BAD_PHOTO, { images: "Photo invalide." });
    if (legacy && input.images.length > 1) return fail("invalid", NEED_0024, { images: NEED_0024 });
    const locales = new Set((cur.product_translations ?? []).map((t) => t.locale));

    const row = {
      category_id: input.categoryId,
      price: input.price,
      compare_price: input.comparePrice,
      stock: input.stock,
      keyword: input.keyword,
      bg: input.bg,
      active: input.active,
    };
    const update = (asLegacy: boolean) => sb.from("products").update({ ...row, ...photoColumns(input.images, asLegacy) }).eq("id", id);
    let { error } = await update(legacy);
    if (!legacy && isMissingImagesColumn(error)) {
      if (input.images.length > 1) return fail("invalid", NEED_0024, { images: NEED_0024 });
      ({ error } = await update(true));
    }
    if (error) {
      logDb("update", error);
      if (isFk(error)) return fail("invalid", "Rayon inconnu.", { categoryId: "Rayon inconnu." });
      if (isPhotoCheck(error)) return fail("invalid", BAD_PHOTO, { images: "Photo invalide." });
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
