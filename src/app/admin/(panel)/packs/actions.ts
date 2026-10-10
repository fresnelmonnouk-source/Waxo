"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertAdmin } from "@/lib/admin/guard";
import { adminDb, takenSlugs } from "@/lib/admin/data/products";
import {
  isStorageImageUrl,
  packFormSchema,
  slugify,
  uniqueSlug,
  validatePackForm,
  type PackInput,
} from "@/components/admin/products/logic";
import { UNAVAILABLE_MESSAGE, type ActionResult, type PackFormValues } from "@/components/admin/products/types";

// Server actions packs (packs + pack_translations + pack_items). Même discipline que les produits :
// assertAdmin() → base joignable → Zod → validation métier → écriture service_role → revalidatePath ciblé.

type Fail = Extract<ActionResult, { ok: false }>;
const fail = (code: Fail["code"], message: string, fields?: Record<string, string>): Fail => ({ ok: false, code, message, fields });
const GENERIC = "Une erreur est survenue. Réessayez dans un instant.";
const uuid = z.uuid();

function refresh() {
  revalidatePath("/admin/packs");
  revalidatePath("/[lang]", "layout");
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
const logDb = (where: string, e: DbErr) => console.error(`[admin/packs] ${where}`, e?.code ?? "", (e?.message ?? "").slice(0, 120));

function parseForm(values: unknown): { input: PackInput } | { error: Fail } {
  const shape = packFormSchema.safeParse(values);
  if (!shape.success) return { error: fail("invalid", "Formulaire invalide.") };
  const v = validatePackForm(shape.data as PackFormValues);
  if (!v.ok) {
    const first = Object.values(v.errors)[0] ?? "Formulaire invalide.";
    return { error: fail("invalid", first, v.errors as Record<string, string>) };
  }
  return { input: v.value };
}

const imageOk = (url: string | null, current: string | null) =>
  url === null || url === current || isStorageImageUrl(url, process.env.NEXT_PUBLIC_SUPABASE_URL);

async function insertTranslation(sb: SupabaseClient, packId: string, locale: "fr" | "en", name: string, description: string): Promise<DbErr> {
  const base = slugify(name);
  let last: DbErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = uniqueSlug(base, await takenSlugs(sb, "pack_translations", locale, base));
    const { error } = await sb.from("pack_translations").insert({ pack_id: packId, locale, name, slug, description });
    if (!error) return null;
    last = error;
    if (!isUnique(error)) break;
  }
  return last;
}

/** Les produits du contenu doivent exister (message clair plutôt qu'une erreur de clé étrangère). */
async function itemsExist(sb: SupabaseClient, ids: string[]): Promise<boolean> {
  const { data, error } = await sb.from("products").select("id").in("id", ids);
  return !error && (data?.length ?? 0) === new Set(ids).size;
}

export async function createPack(values: PackFormValues): Promise<ActionResult<{ id: string }>> {
  const p = await prepare();
  if ("error" in p) return p.error;
  const parsed = parseForm(values);
  if ("error" in parsed) return parsed.error;
  const { input } = parsed;
  if (!imageOk(input.imageUrl, null)) return fail("invalid", "Photo invalide : renvoyez-la depuis le formulaire.", { imageUrl: "Photo invalide." });
  const { sb } = p;
  try {
    if (!(await itemsExist(sb, input.items.map((i) => i.productId)))) {
      return fail("invalid", "Un des produits du pack n'existe plus.", { items: "Un des produits n'existe plus." });
    }
    const { data, error } = await sb.from("packs").insert({ price: input.price, image_url: input.imageUrl, active: input.active }).select("id").single();
    if (error || !data) {
      logDb("create", error);
      return fail("error", GENERIC);
    }
    const id = data.id as string;
    const rollback = async () => {
      await sb.from("packs").delete().eq("id", id); // cascade : traductions + contenu
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
    const { error: iErr } = await sb.from("pack_items").insert(input.items.map((i) => ({ pack_id: id, product_id: i.productId, qty: i.qty })));
    if (iErr) {
      logDb("create items", iErr);
      await rollback();
      return fail("error", GENERIC);
    }
    refresh();
    return { ok: true, id };
  } catch {
    return fail("error", GENERIC);
  }
}

export async function updatePack(id: string, values: PackFormValues): Promise<ActionResult> {
  const p = await prepare();
  if ("error" in p) return p.error;
  if (!uuid.safeParse(id).success) return fail("invalid", "Pack inconnu.");
  const parsed = parseForm(values);
  if ("error" in parsed) return parsed.error;
  const { input } = parsed;
  const { sb } = p;
  try {
    const { data: cur, error: curErr } = await sb.from("packs").select("id,image_url,pack_translations(locale),pack_items(product_id)").eq("id", id).maybeSingle();
    if (curErr) {
      logDb("update read", curErr);
      return fail("error", GENERIC);
    }
    if (!cur) return fail("not_found", "Ce pack n'existe plus.");
    if (!imageOk(input.imageUrl, (cur.image_url as string | null) ?? null)) {
      return fail("invalid", "Photo invalide : renvoyez-la depuis le formulaire.", { imageUrl: "Photo invalide." });
    }
    if (!(await itemsExist(sb, input.items.map((i) => i.productId)))) {
      return fail("invalid", "Un des produits du pack n'existe plus.", { items: "Un des produits n'existe plus." });
    }
    const locales = new Set(((cur.pack_translations as { locale: string }[] | null) ?? []).map((t) => t.locale));
    const oldIds = ((cur.pack_items as { product_id: string }[] | null) ?? []).map((i) => i.product_id);

    const { error } = await sb.from("packs").update({ price: input.price, image_url: input.imageUrl, active: input.active }).eq("id", id);
    if (error) {
      logDb("update", error);
      return fail("error", GENERIC);
    }
    if (locales.has("fr")) {
      const { error: e } = await sb.from("pack_translations").update({ name: input.name, description: input.description }).eq("pack_id", id).eq("locale", "fr");
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
    if (input.nameEn) {
      if (locales.has("en")) {
        const { error: e } = await sb.from("pack_translations").update({ name: input.nameEn, description: input.descriptionEn }).eq("pack_id", id).eq("locale", "en");
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
      await sb.from("pack_translations").delete().eq("pack_id", id).eq("locale", "en");
    }
    // Contenu : upsert d'abord (jamais de fenêtre sans contenu), puis retrait de ce qui a disparu.
    const { error: uErr } = await sb.from("pack_items").upsert(input.items.map((i) => ({ pack_id: id, product_id: i.productId, qty: i.qty })), { onConflict: "pack_id,product_id" });
    if (uErr) {
      logDb("update items", uErr);
      return fail("error", GENERIC);
    }
    const keep = new Set(input.items.map((i) => i.productId));
    const removed = oldIds.filter((pid) => !keep.has(pid));
    if (removed.length) {
      const { error: dErr } = await sb.from("pack_items").delete().eq("pack_id", id).in("product_id", removed);
      if (dErr) {
        logDb("update items delete", dErr);
        return fail("error", GENERIC);
      }
    }
    refresh();
    return { ok: true };
  } catch {
    return fail("error", GENERIC);
  }
}

export async function setPackActive(id: string, active: boolean): Promise<ActionResult> {
  const p = await prepare();
  if ("error" in p) return p.error;
  if (!uuid.safeParse(id).success || typeof active !== "boolean") return fail("invalid", "Demande invalide.");
  try {
    const { data, error } = await p.sb.from("packs").update({ active }).eq("id", id).select("id");
    if (error) {
      logDb("active", error);
      return fail("error", GENERIC);
    }
    if (!data?.length) return fail("not_found", "Ce pack n'existe plus.");
    refresh();
    return { ok: true };
  } catch {
    return fail("error", GENERIC);
  }
}

/**
 * Active / désactive le menu Packs de la boutique (réglage public `settings.features.packs`).
 * Désactivé : lien retiré de l'en-tête et du menu mobile, pages /packs en 404, hors sitemap, packs retirés des paniers et
 * refusés à la commande. Les packs eux-mêmes sont conservés (rien n'est supprimé).
 */
export async function setPacksMenuEnabled(enabled: boolean): Promise<ActionResult> {
  const p = await prepare();
  if ("error" in p) return p.error;
  if (typeof enabled !== "boolean") return fail("invalid", "Demande invalide.");
  try {
    const { data, error: readError } = await p.sb.from("settings").select("value").eq("key", "features").maybeSingle();
    if (readError) {
      logDb("features read", readError);
      return fail("error", GENERIC);
    }
    const old = data?.value && typeof data.value === "object" && !Array.isArray(data.value) ? (data.value as Record<string, unknown>) : {};
    const { error } = await p.sb.from("settings").upsert({ key: "features", value: { ...old, packs: enabled }, is_public: true }, { onConflict: "key" });
    if (error) {
      logDb("features write", error);
      return fail("error", GENERIC);
    }
    refresh();
    return { ok: true };
  } catch {
    return fail("error", GENERIC);
  }
}

/** Suppression définitive, refusée si le pack figure dans une commande (historique) : le masquer à la place. */
export async function deletePack(id: string): Promise<ActionResult> {
  const p = await prepare();
  if ("error" in p) return p.error;
  if (!uuid.safeParse(id).success) return fail("invalid", "Pack inconnu.");
  const { sb } = p;
  try {
    const ordered = await sb.from("order_items").select("id", { count: "exact", head: true }).eq("pack_id", id);
    if (ordered.error) {
      logDb("delete check", ordered.error);
      return fail("error", GENERIC);
    }
    if ((ordered.count ?? 0) > 0) return fail("in_order", "Ce pack figure dans des commandes : masquez-le plutôt que de le supprimer.");
    const { error } = await sb.from("packs").delete().eq("id", id);
    if (error) {
      logDb("delete", error);
      if (isFk(error)) return fail("in_order", "Ce pack est encore référencé : masquez-le plutôt que de le supprimer.");
      return fail("error", GENERIC);
    }
    refresh();
    return { ok: true };
  } catch {
    return fail("error", GENERIC);
  }
}
