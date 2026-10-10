import "server-only";
import demo from "@/lib/demo/admin.json";
import { getProducts } from "@/lib/catalog";
import { fmtXof } from "@/lib/money";
import { formFromSettings, type SettingsForm } from "@/lib/settings/schema";
import type { KbDoc, KbEntry } from "@/lib/settings/kb-search";
import { tryAdminClient, withTimeout } from "@/lib/settings/db";

/** Réglages (lecture back-office) : base si configurée, sinon repli sur src/lib/demo/admin.json. */

const SETTINGS_KEYS = ["brand", "shipping", "pay", "legal", "flags"] as const;

function demoValues() {
  const s = demo.settings;
  return {
    brand: { shopName: s.shopName, whatsapp: s.whatsapp, email: s.email, hours: s.hours, aiSign: s.aiSign },
    shipping: { cotonou: s.shipCotonou, autre: s.shipOther, freeFrom: s.freeShip, cutoff: s.cutoff },
    pay: s.pay,
    flags: { autoDraft: s.autoDraft },
  };
}

export async function getSettingsForm(): Promise<{ form: SettingsForm; connected: boolean }> {
  const sb = tryAdminClient();
  if (sb) {
    try {
      const { data, error } = await withTimeout(sb.from("settings").select("key,value").in("key", [...SETTINGS_KEYS]));
      if (!error && data) {
        const byKey = Object.fromEntries(data.map((r) => [r.key as string, r.value as unknown]));
        return { form: formFromSettings(byKey), connected: true };
      }
    } catch {
      /* repli démo */
    }
  }
  return { form: formFromSettings(demoValues()), connected: false };
}

/** Fiches rédigées de la base de connaissances (table `kb`). */
export async function getKbEntries(): Promise<{ entries: KbEntry[]; connected: boolean }> {
  const sb = tryAdminClient();
  if (sb) {
    try {
      const { data, error } = await withTimeout(sb.from("kb").select("id,tag,title,text,keywords,active").order("title").limit(200));
      if (!error && data) {
        return {
          entries: data
            .filter((r) => r.active !== false)
            .map((r) => ({ id: String(r.id), tag: String(r.tag), title: String(r.title), text: String(r.text), keywords: String(r.keywords ?? "") })),
          connected: true,
        };
      }
    } catch {
      /* repli démo */
    }
  }
  return {
    entries: demo.kb.map((k) => ({ id: k.id, tag: k.tag, title: k.title, text: k.text, keywords: k.keywords ?? "" })),
    connected: false,
  };
}

/** Fiches produits indexées automatiquement (nom, description, prix, stock), en français. */
export async function getProductKbDocs(): Promise<KbDoc[]> {
  try {
    const products = await getProducts("fr");
    return products.map((p) => ({
      id: `p:${p.id}`,
      kind: "produit" as const,
      tag: "Produit",
      title: p.name,
      keywords: p.keyword,
      text: `${p.description} Prix : ${fmtXof(p.price)}${p.comparePrice ? ` au lieu de ${fmtXof(p.comparePrice)}` : ""}. ${
        p.stock > 0 ? `En stock : ${p.stock}.` : "Épuisé pour le moment."
      }`,
    }));
  } catch {
    return [];
  }
}

/** Toutes les sources de recherche (fiches rédigées + fiches produits). */
export async function getAllKbDocs(): Promise<{ docs: KbDoc[]; entries: KbEntry[]; productCount: number; connected: boolean }> {
  const [{ entries, connected }, products] = await Promise.all([getKbEntries(), getProductKbDocs()]);
  return { docs: [...entries.map((e) => ({ ...e, kind: "kb" as const })), ...products], entries, productCount: products.length, connected };
}
