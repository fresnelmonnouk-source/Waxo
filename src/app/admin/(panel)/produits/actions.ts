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
  usesMigration0025,
  validateProductForm,
  type ProductInput,
} from "@/components/admin/products/logic";
import type { ProductDetails } from "@/lib/catalog/details";
import { isMissingColumn } from "@/lib/supabase/missing-column";
import { UNAVAILABLE_MESSAGE, type ActionResult, type ProductFormValues } from "@/components/admin/products/types";
import { isMissingImagesColumn } from "@/lib/media/product-images";
import { publishGate, publishGateFromRows, stripMarkers } from "@/lib/admin/ai/product-writer-gate";

// Server actions produits. Chaque action : assertAdmin() d'abord → base joignable ? → Zod → validation métier → écriture service_role.
// Retour { ok:true } | { ok:false, code, message, fields? } : jamais d'erreur SQL ni de stack côté client.

type Fail = Extract<ActionResult, { ok: false }>;
const fail = (code: Fail["code"], message: string, fields?: Record<string, string>, extra: Pick<Fail, "currentStock"> = {}): Fail => ({
  ok: false,
  code,
  message,
  fields,
  ...extra,
});

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
  // Un produit visible en boutique ne montre jamais de texte provisoire (« [à confirmer] », « [TBD] », « (à vérifier) »…)
  // laissé par le rédacteur IA ; masqué (brouillon), c'est permis.
  const gate = publishGate(v.value);
  if (gate) return { error: fail("invalid", gate.message, gate.fields) };
  return { input: v.value };
}

/** Chaque photo est une photo DÉJÀ enregistrée sur ce produit, ou une URL de NOTRE bucket `products` (jamais une URL arbitraire). */
function imagesOk(urls: readonly string[], current: readonly string[]): boolean {
  return urls.every((u) => current.includes(u) || isStorageImageUrl(u, process.env.NEXT_PUBLIC_SUPABASE_URL));
}

const BAD_PHOTO = "Photo invalide : renvoyez-la depuis le formulaire.";
const NEED_0024 = "Plusieurs photos : la migration 0024 n'est pas encore appliquée. Gardez une seule photo pour l'instant.";
const NEED_0025 =
  "Rubriques et livraison gratuite : la migration 0025 n'est pas encore appliquée. Videz ces champs (ou appliquez 0025) puis réessayez.";

/** La colonne manquante est-elle `products.free_shipping` (0025) ? Seule colonne de 0025 écrite dans `products`. */
const isMissing0025 = (e: DbErr) => isMissingColumn(e) && /\bfree_shipping\b/.test(e?.message ?? "");

type WriteOutcome<T> = { data: T | null; error: DbErr; legacy0025: boolean } | { fail: Fail };

/**
 * Écrit la ligne produit en retirant les colonnes des migrations pas encore appliquées : `images` (0024, une seule photo
 * alors) et `free_shipping` (0025, seulement si le formulaire ne s'en sert pas). Sinon : message clair, rien d'écrit.
 */
async function writeProductRow<T>(
  write: (cols: Record<string, unknown>) => PromiseLike<{ data: T | null; error: DbErr }>,
  row: Record<string, unknown>,
  input: ProductInput,
  legacyImages: boolean,
): Promise<WriteOutcome<T>> {
  let legacy0025 = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const cols = { ...row, ...photoColumns(input.images, legacyImages), ...(legacy0025 ? {} : { free_shipping: input.freeShipping }) };
    const { data, error } = await write(cols);
    if (!legacy0025 && isMissing0025(error)) {
      if (usesMigration0025(input)) return { fail: fail("invalid", NEED_0025) };
      console.warn("[admin/produits] migration 0025 absente : enregistrement sans livraison offerte ni rubriques");
      legacy0025 = true;
      continue;
    }
    if (!legacyImages && isMissingImagesColumn(error)) {
      if (input.images.length > 1) return { fail: fail("invalid", NEED_0024, { images: NEED_0024 }) };
      legacyImages = true;
      continue;
    }
    return { data, error, legacy0025 };
  }
  return { fail: fail("error", GENERIC) };
}

/** Colonnes de traduction : nom, description et, si 0025 est appliquée, les rubriques. */
const trColumns = (name: string, description: string, details: ProductDetails | null) => ({ name, description, ...(details ?? {}) });

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
  details: ProductDetails | null,
): Promise<DbErr> {
  // Marqueurs provisoires retirés AVANT le slug : il est fixé à cette première sauvegarde (audit Victor W2).
  const base = slugify(stripMarkers(name));
  let last: DbErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = uniqueSlug(base, await takenSlugs(sb, "product_translations", locale, base));
    const { error } = await sb.from("product_translations").insert({ product_id: productId, locale, slug, ...trColumns(name, description, details) });
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
    const written = await writeProductRow<{ id: string }>((cols) => sb.from("products").insert(cols).select("id").single(), row, input, false);
    if ("fail" in written) return written.fail;
    const { data, error, legacy0025 } = written;
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

    const frErr = await insertTranslation(sb, id, "fr", input.name, input.description, legacy0025 ? null : input.details);
    if (frErr) {
      logDb("create fr", frErr);
      await rollback();
      return fail("error", GENERIC);
    }
    if (input.nameEn) {
      const enErr = await insertTranslation(sb, id, "en", input.nameEn, input.descriptionEn, legacy0025 ? null : input.detailsEn);
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
    // Stock : non modifié dans le formulaire → pas réécrit (une vente pendant l'édition reste décomptée) ; modifié → écrit
    // seulement s'il vaut encore la valeur affichée à l'ouverture, sinon conflit (audit Tariq 🟠4, 2026-10-14).
    const stockTouched = input.stockAtOpen === null || input.stock !== input.stockAtOpen;
    const { stock: _stock, ...rowNoStock } = row;
    void _stock;
    const written = await writeProductRow<{ id: string }[]>(
      (cols) => {
        const q = sb.from("products").update(cols).eq("id", id);
        return (stockTouched && input.stockAtOpen !== null ? q.eq("stock", input.stockAtOpen) : q).select("id");
      },
      stockTouched ? row : rowNoStock,
      input,
      legacy,
    );
    if ("fail" in written) return written.fail;
    const { data: updated, error, legacy0025 } = written;
    if (!error && !updated?.length) {
      if (stockTouched && input.stockAtOpen !== null) {
        // Stock actuel renvoyé : le tiroir reste ouvert, met à jour le champ et sa référence, rien d'autre n'est perdu
        // (audit Zoé Z5).
        const { data: now, error: nowErr } = await sb.from("products").select("stock").eq("id", id).maybeSingle();
        if (!now && !nowErr) return fail("not_found", "Ce produit n'existe plus.");
        const currentStock = typeof (now as { stock?: unknown } | null)?.stock === "number" ? (now as { stock: number }).stock : undefined;
        if (currentStock === undefined) {
          return fail("conflict", "Le stock a changé pendant votre modification (une vente ?). Rechargez la page puis corrigez le stock.", {
            stock: "Stock modifié entre-temps.",
          });
        }
        return fail(
          "conflict",
          `Le stock a changé pendant votre modification (une vente ?) : stock actuel ${currentStock}. Vérifiez le stock puis enregistrez à nouveau.`,
          { stock: `Stock actuel : ${currentStock}. Vérifiez puis enregistrez.` },
          { currentStock },
        );
      }
      return fail("not_found", "Ce produit n'existe plus.");
    }
    const frDetails = legacy0025 ? null : input.details;
    const enDetails = legacy0025 ? null : input.detailsEn;
    if (error) {
      logDb("update", error);
      if (isFk(error)) return fail("invalid", "Rayon inconnu.", { categoryId: "Rayon inconnu." });
      if (isPhotoCheck(error)) return fail("invalid", BAD_PHOTO, { images: "Photo invalide." });
      return fail("error", GENERIC);
    }

    // FR (obligatoire) : le slug reste stable (les liens partagés ne cassent pas), seuls nom et description changent.
    if (locales.has("fr")) {
      const { error: e } = await sb.from("product_translations").update(trColumns(input.name, input.description, frDetails)).eq("product_id", id).eq("locale", "fr");
      if (e) {
        logDb("update fr", e);
        return fail("error", GENERIC);
      }
    } else {
      const e = await insertTranslation(sb, id, "fr", input.name, input.description, frDetails);
      if (e) {
        logDb("update fr insert", e);
        return fail("error", GENERIC);
      }
    }
    // EN (facultatif) : créée, mise à jour ou retirée selon le nom saisi.
    if (input.nameEn) {
      if (locales.has("en")) {
        const { error: e } = await sb.from("product_translations").update(trColumns(input.nameEn, input.descriptionEn, enDetails)).eq("product_id", id).eq("locale", "en");
        if (e) {
          logDb("update en", e);
          return fail("error", GENERIC);
        }
      } else {
        const e = await insertTranslation(sb, id, "en", input.nameEn, input.descriptionEn, enDetails);
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
    if (active) {
      // Remise en ligne depuis la liste : mêmes règles que le formulaire, sur les textes enregistrés (« * » : rubriques
      // lues si la migration 0025 est appliquée, ignorées sinon).
      const { data: cur, error: readErr } = await p.sb.from("products").select("keyword,product_translations(*)").eq("id", id).maybeSingle();
      if (readErr) {
        logDb("active read", readErr);
        return fail("error", GENERIC);
      }
      if (!cur) return fail("not_found", "Ce produit n'existe plus.");
      const row = cur as { keyword?: unknown; product_translations?: Record<string, unknown>[] | null };
      const gate = publishGateFromRows(row.keyword, row.product_translations);
      if (gate) return fail("invalid", gate.message);
    }
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
