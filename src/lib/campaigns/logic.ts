// Campagnes promotionnelles (Black Friday, Noël, Tabaski…) : règles PURES, testées dans tests/campaigns.test.ts.
// Le prix FACTURÉ est décidé par la base (place_order + campaign_for, migration 0015) ; ces fonctions servent à
// l'affichage, à l'admin et aux statistiques, et suivent exactement les mêmes règles.

export type CampaignItem = { productId: string; salePrice: number };

export type Campaign = {
  id: string;
  slug: string;
  nameFr: string;
  nameEn: string;
  taglineFr: string;
  taglineEn: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
  active: boolean;
  showMenu: boolean;
  showBanner: boolean;
  showCountdown: boolean;
  items: CampaignItem[];
};

export type CampaignStatus = "running" | "upcoming" | "ended" | "off";

/** Même règle que la base : active ET starts_at ≤ maintenant < ends_at. */
export function campaignStatus(c: Pick<Campaign, "active" | "startsAt" | "endsAt">, now: number): CampaignStatus {
  if (!c.active) return "off";
  const s = Date.parse(c.startsAt);
  const e = Date.parse(c.endsAt);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return "off";
  if (now < s) return "upcoming";
  if (now >= e) return "ended";
  return "running";
}

export const isRunning = (c: Campaign, now: number) => campaignStatus(c, now) === "running";

/** Prix de campagne en cours pour un produit : le plus bas des campagnes en cours, seulement s'il est sous le prix normal. */
export function campaignPriceFor(
  productId: string,
  normalPrice: number,
  campaigns: Campaign[],
  now: number,
): { price: number; campaign: Campaign } | null {
  let best: { price: number; campaign: Campaign } | null = null;
  for (const c of campaigns) {
    if (!isRunning(c, now)) continue;
    const it = c.items.find((i) => i.productId === productId);
    if (!it || !(it.salePrice > 0) || it.salePrice >= normalPrice) continue;
    if (!best || it.salePrice < best.price || (it.salePrice === best.price && Date.parse(c.startsAt) < Date.parse(best.campaign.startsAt))) {
      best = { price: it.salePrice, campaign: c };
    }
  }
  return best;
}

export type CampaignTag = { slug: string; name: string; endsAt: string };

/**
 * Applique les campagnes en cours à une liste de produits : prix = prix de campagne, prix barré = prix NORMAL du
 * produit (jamais un prix inventé). Les produits hors campagne sont rendus tels quels.
 */
export function applyCampaigns<P extends { id: string; price: number; comparePrice: number | null }>(
  products: P[],
  campaigns: Campaign[],
  now: number,
  locale: "fr" | "en",
): (P & { campaign?: CampaignTag })[] {
  if (!campaigns.some((c) => isRunning(c, now))) return products;
  return products.map((p) => {
    const hit = campaignPriceFor(p.id, p.price, campaigns, now);
    if (!hit) return p;
    return {
      ...p,
      price: hit.price,
      comparePrice: p.price,
      campaign: { slug: hit.campaign.slug, name: campaignName(hit.campaign, locale), endsAt: hit.campaign.endsAt },
    };
  });
}

export const campaignName = (c: Pick<Campaign, "nameFr" | "nameEn">, locale: "fr" | "en") => (locale === "en" ? c.nameEn : c.nameFr);
export const campaignTagline = (c: Pick<Campaign, "taglineFr" | "taglineEn">, locale: "fr" | "en") =>
  locale === "en" ? c.taglineEn : c.taglineFr;

/** Campagne à mettre en avant (menu, bannière) : la première en cours, par date de fin la plus proche. */
export function featuredCampaign(campaigns: Campaign[], now: number): Campaign | null {
  return campaigns.filter((c) => isRunning(c, now) && c.items.length > 0).sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt))[0] ?? null;
}

/** Remise en % arrondie (affichage). */
export function discountPercent(normal: number, sale: number): number {
  if (!(normal > 0) || !(sale > 0) || sale >= normal) return 0;
  return Math.round((1 - sale / normal) * 100);
}

/** Prix de campagne à partir d'un % de remise, arrondi à la centaine de francs inférieure (jamais 0, jamais ≥ prix). */
export function priceFromPercent(normal: number, percent: number): number | null {
  if (!(normal > 0) || !(percent > 0) || percent >= 100) return null;
  const raw = Math.floor((normal * (100 - percent)) / 100 / 100) * 100;
  const price = raw > 0 ? raw : Math.floor((normal * (100 - percent)) / 100);
  return price > 0 && price < normal ? price : null;
}

/** Temps restant découpé pour le compte à rebours. */
export function countdownParts(endsAt: string, now: number): { days: number; hours: number; minutes: number; seconds: number } | null {
  const left = Date.parse(endsAt) - now;
  if (!Number.isFinite(left) || left <= 0) return null;
  const s = Math.floor(left / 1000);
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

// ─────────────── Admin : validation du formulaire ───────────────

export const MAX_DISCOUNT_PERCENT = 90;
export const MAX_CAMPAIGN_DAYS = 62;

export type CampaignFormInput = {
  slug: string;
  nameFr: string;
  nameEn: string;
  taglineFr: string;
  taglineEn: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
  showMenu: boolean;
  showBanner: boolean;
  showCountdown: boolean;
  items: CampaignItem[];
};

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function slugifyCampaign(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** Valide une campagne. `normalPrices` = prix normal actuel de chaque produit (pour refuser un « faux » prix barré). */
export function validateCampaign(
  v: CampaignFormInput,
  normalPrices: Map<string, number>,
): { ok: true; value: CampaignFormInput } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const nameFr = v.nameFr.trim();
  const nameEn = v.nameEn.trim() || nameFr;
  if (nameFr.length < 2 || nameFr.length > 60) errors.nameFr = "Nom de 2 à 60 caractères.";
  if (nameEn.length < 2 || nameEn.length > 60) errors.nameEn = "Nom anglais de 2 à 60 caractères.";
  const slug = (v.slug.trim() || slugifyCampaign(nameFr)).slice(0, 60);
  if (!SLUG_RE.test(slug) || slug.length < 2) errors.slug = "Adresse : lettres minuscules, chiffres et tirets.";
  if (v.taglineFr.length > 160 || v.taglineEn.length > 160) errors.tagline = "Accroche de 160 caractères maximum.";
  const s = Date.parse(v.startsAt);
  const e = Date.parse(v.endsAt);
  if (!Number.isFinite(s)) errors.startsAt = "Date de début invalide.";
  if (!Number.isFinite(e)) errors.endsAt = "Date de fin invalide.";
  if (Number.isFinite(s) && Number.isFinite(e)) {
    if (e <= s) errors.endsAt = "La fin doit être après le début.";
    else if (e - s > MAX_CAMPAIGN_DAYS * 86_400_000) errors.endsAt = `Une campagne dure ${MAX_CAMPAIGN_DAYS} jours au maximum.`;
  }
  const seen = new Set<string>();
  const items: CampaignItem[] = [];
  for (const it of v.items) {
    if (seen.has(it.productId)) continue;
    seen.add(it.productId);
    const normal = normalPrices.get(it.productId);
    if (normal === undefined) {
      errors.items = "Un produit de la liste n'existe plus.";
      continue;
    }
    const sale = Math.round(it.salePrice);
    if (!(sale > 0) || sale >= normal) {
      errors.items = "Chaque prix de campagne doit être inférieur au prix normal du produit.";
      continue;
    }
    if (discountPercent(normal, sale) > MAX_DISCOUNT_PERCENT) {
      errors.items = `Remise de ${MAX_DISCOUNT_PERCENT} % maximum.`;
      continue;
    }
    items.push({ productId: it.productId, salePrice: sale });
  }
  if (items.length === 0 && !errors.items) errors.items = "Ajoutez au moins un produit.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: { ...v, slug, nameFr, nameEn, taglineFr: v.taglineFr.trim(), taglineEn: v.taglineEn.trim(), items },
  };
}

// ─────────────── Statistiques ───────────────

export type CampaignSaleLine = { productId: string | null; name: string; unitPrice: number; qty: number; orderId: string };

export type CampaignStats = { orders: number; units: number; revenue: number; top: { name: string; units: number; revenue: number }[] };

/** Agrège les lignes vendues au prix de campagne (order_items.campaign_id, commandes non annulées). */
export function campaignStats(lines: CampaignSaleLine[]): CampaignStats {
  const orders = new Set<string>();
  const byProduct = new Map<string, { name: string; units: number; revenue: number }>();
  let units = 0;
  let revenue = 0;
  for (const l of lines) {
    orders.add(l.orderId);
    units += l.qty;
    revenue += l.unitPrice * l.qty;
    const k = l.productId ?? l.name;
    const cur = byProduct.get(k) ?? { name: l.name, units: 0, revenue: 0 };
    cur.units += l.qty;
    cur.revenue += l.unitPrice * l.qty;
    byProduct.set(k, cur);
  }
  const top = [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  return { orders: orders.size, units, revenue, top };
}
