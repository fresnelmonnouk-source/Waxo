"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertAdmin } from "@/lib/admin/guard";
import { adminDb } from "@/lib/admin/data/products";
import { isMissingSchema, MISSING_TABLE_MESSAGE } from "@/lib/admin/data/campaigns";
import { validateCampaign, type CampaignFormInput } from "@/lib/campaigns/logic";
import { UNAVAILABLE_MESSAGE, type ActionResult } from "@/components/admin/products/types";

// Server actions campagnes (campaigns + campaign_items). Même discipline que les packs :
// assertAdmin() → base joignable → Zod (forme) → validateCampaign avec les prix normaux LUS EN BASE → écriture service_role.

type Fail = Extract<ActionResult, { ok: false }>;
const fail = (code: Fail["code"], message: string, fields?: Record<string, string>): Fail => ({ ok: false, code, message, fields });
const GENERIC = "Une erreur est survenue. Réessayez dans un instant.";
const uuid = z.uuid();
const MAX_ITEMS = 200;

function refresh() {
  revalidatePath("/admin/campagnes");
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
const logDb = (where: string, e: DbErr) => console.error(`[admin/campaigns] ${where}`, e?.code ?? "", (e?.message ?? "").slice(0, 120));
/** Erreur base → message : table absente (0015 non appliquée) expliquée, le reste générique. */
const dbFail = (where: string, e: DbErr): Fail => {
  logDb(where, e);
  return isMissingSchema(e) ? fail("error", MISSING_TABLE_MESSAGE) : fail("error", GENERIC);
};

const formSchema = z.object({
  slug: z.string().max(120),
  nameFr: z.string().max(200),
  nameEn: z.string().max(200),
  taglineFr: z.string().max(400),
  taglineEn: z.string().max(400),
  startsAt: z.string().max(40),
  endsAt: z.string().max(40),
  active: z.boolean(),
  showMenu: z.boolean(),
  showBanner: z.boolean(),
  showCountdown: z.boolean(),
  items: z.array(z.object({ productId: uuid, salePrice: z.number().finite() })).max(MAX_ITEMS),
});

export async function saveCampaign(id: string | null, input: CampaignFormInput): Promise<ActionResult<{ id: string }>> {
  const p = await prepare();
  if ("error" in p) return p.error;
  if (id !== null && !uuid.safeParse(id).success) return fail("invalid", "Campagne inconnue.");
  const shape = formSchema.safeParse(input);
  if (!shape.success) return fail("invalid", "Formulaire invalide.");
  const { sb } = p;
  try {
    // Prix normaux relus en base : jamais ceux envoyés par le navigateur (sinon « fausse remise » possible).
    const productIds = [...new Set(shape.data.items.map((i) => i.productId))];
    const normalPrices = new Map<string, number>();
    if (productIds.length) {
      const { data, error } = await sb.from("products").select("id,price").in("id", productIds);
      if (error) return dbFail("save prices", error);
      for (const r of data ?? []) normalPrices.set(r.id as string, r.price as number);
    }
    const v = validateCampaign(shape.data, normalPrices);
    if (!v.ok) return fail("invalid", Object.values(v.errors)[0] ?? "Formulaire invalide.", v.errors);
    const c = v.value;
    const row = {
      slug: c.slug,
      name_fr: c.nameFr,
      name_en: c.nameEn,
      tagline_fr: c.taglineFr,
      tagline_en: c.taglineEn,
      starts_at: new Date(c.startsAt).toISOString(),
      ends_at: new Date(c.endsAt).toISOString(),
      active: c.active,
      show_menu: c.showMenu,
      show_banner: c.showBanner,
      show_countdown: c.showCountdown,
      updated_at: new Date().toISOString(),
    };
    const slugTaken = () => fail("invalid", "Cette adresse est déjà utilisée.", { slug: "Cette adresse est déjà utilisée." });

    // Champs + produits en UNE transaction (RPC save_campaign, migration 0015).
    const { data: saved, error } = await sb.rpc("save_campaign", {
      p_id: id,
      p_row: row,
      p_items: c.items.map((i) => ({ product_id: i.productId, sale_price: i.salePrice })),
    });
    if (error || typeof saved !== "string") {
      if (isUnique(error)) return slugTaken();
      if (error?.message?.includes("campaign_not_found")) return fail("not_found", "Cette campagne n'existe plus.");
      return dbFail("save", error);
    }
    const campaignId = saved;
    refresh();
    return { ok: true, id: campaignId };
  } catch {
    return fail("error", GENERIC);
  }
}

export async function setCampaignActive(id: string, active: boolean): Promise<ActionResult> {
  const p = await prepare();
  if ("error" in p) return p.error;
  if (!uuid.safeParse(id).success || typeof active !== "boolean") return fail("invalid", "Demande invalide.");
  try {
    const { data, error } = await p.sb.from("campaigns").update({ active, updated_at: new Date().toISOString() }).eq("id", id).select("id");
    if (error) return dbFail("active", error);
    if (!data?.length) return fail("not_found", "Cette campagne n'existe plus.");
    refresh();
    return { ok: true };
  } catch {
    return fail("error", GENERIC);
  }
}

/** Suppression définitive, refusée si des commandes y sont rattachées (historique des ventes) : la désactiver à la place. */
export async function deleteCampaign(id: string): Promise<ActionResult> {
  const p = await prepare();
  if ("error" in p) return p.error;
  if (!uuid.safeParse(id).success) return fail("invalid", "Campagne inconnue.");
  const { sb } = p;
  try {
    const sold = await sb.from("order_items").select("id", { count: "exact", head: true }).eq("campaign_id", id);
    if (sold.error) return dbFail("delete check", sold.error);
    if ((sold.count ?? 0) > 0) {
      return fail("in_order", "Des commandes sont rattachées à cette campagne : désactivez-la plutôt que de la supprimer.");
    }
    const { data, error } = await sb.from("campaigns").delete().eq("id", id).select("id");
    if (error) return dbFail("delete", error);
    if (!data?.length) return fail("not_found", "Cette campagne n'existe plus.");
    refresh();
    return { ok: true };
  } catch {
    return fail("error", GENERIC);
  }
}
