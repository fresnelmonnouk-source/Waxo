// Fonctions PURES de l'écran /admin/campagnes (testées dans tests/admin-campaigns.test.ts).
// Heure du Bénin = UTC+1 FIXE (Africa/Porto-Novo, pas de changement d'heure) : conversion sans dépendre du fuseau
// du navigateur ni de l'ICU de Node (affichage identique serveur / client, pas d'écart d'hydratation).
import {
  campaignStatus,
  discountPercent,
  priceFromPercent,
  type Campaign,
  type CampaignFormInput,
  type CampaignStats,
  type CampaignStatus,
} from "@/lib/campaigns/logic";

export const BENIN_OFFSET_MS = 60 * 60 * 1000;

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const pad = (n: number) => String(n).padStart(2, "0");

/** « 2026-11-28T00:00 » (heure du Bénin, valeur d'un <input type="datetime-local">) → ISO UTC. Invalide → null. */
export function beninLocalToIso(local: string): string | null {
  const m = LOCAL_RE.exec(local.trim());
  if (!m) return null;
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? "0"].map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  const check = new Date(asUtc);
  // 31 février & co : Date.UTC « déborde » sur le mois suivant → refusé.
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return new Date(asUtc - BENIN_OFFSET_MS).toISOString();
}

/** ISO (n'importe quel fuseau) → « 2026-11-28T00:00 » en heure du Bénin. Invalide → "". */
export function isoToBeninLocal(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t + BENIN_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** « 28 nov. 2026, 00:00 » en heure du Bénin. */
export function formatBeninDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "date invalide";
  const d = new Date(t + BENIN_OFFSET_MS);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export const formatCampaignRange = (startsAt: string, endsAt: string) => `${formatBeninDate(startsAt)} → ${formatBeninDate(endsAt)}`;

const STATUS_RANK: Record<CampaignStatus, number> = { running: 0, upcoming: 1, ended: 2, off: 3 };

/** Ordre de la liste : en cours (fin la plus proche d'abord), à venir (début le plus proche), terminées (plus récente), désactivées. */
export function sortCampaigns<C extends Pick<Campaign, "active" | "startsAt" | "endsAt">>(list: C[], now: number): C[] {
  const key = (c: C) => {
    const st = campaignStatus(c, now);
    const s = Date.parse(c.startsAt) || 0;
    const e = Date.parse(c.endsAt) || 0;
    const within = st === "running" ? e : st === "upcoming" ? s : -e;
    return { rank: STATUS_RANK[st], within };
  };
  return [...list].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return ka.rank - kb.rank || ka.within - kb.within;
  });
}

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  running: "En cours",
  upcoming: "À venir",
  ended: "Terminée",
  off: "Désactivée",
};

/** Les statistiques de ventes ont un sens si la campagne a commencé, ou si des ventes existent déjà. */
export const showsStats = (status: CampaignStatus, stats: CampaignStats) => status === "running" || status === "ended" || stats.orders > 0;

// ─────────────── Formulaire ───────────────

export type CampaignItemDraft = { productId: string; salePrice: string; percent: string };

export type CampaignDraft = {
  slug: string;
  slugTouched: boolean;
  nameFr: string;
  nameEn: string;
  taglineFr: string;
  taglineEn: string;
  startsLocal: string;
  endsLocal: string;
  active: boolean;
  showMenu: boolean;
  showBanner: boolean;
  showCountdown: boolean;
  items: CampaignItemDraft[];
};

export const emptyDraft = (): CampaignDraft => ({
  slug: "",
  slugTouched: false,
  nameFr: "",
  nameEn: "",
  taglineFr: "",
  taglineEn: "",
  startsLocal: "",
  endsLocal: "",
  active: true,
  showMenu: true,
  showBanner: true,
  showCountdown: true,
  items: [],
});

export function draftFromCampaign(c: Campaign, normalPrices: Map<string, number>): CampaignDraft {
  return {
    slug: c.slug,
    slugTouched: true,
    nameFr: c.nameFr,
    nameEn: c.nameEn,
    taglineFr: c.taglineFr,
    taglineEn: c.taglineEn,
    startsLocal: isoToBeninLocal(c.startsAt),
    endsLocal: isoToBeninLocal(c.endsAt),
    active: c.active,
    showMenu: c.showMenu,
    showBanner: c.showBanner,
    showCountdown: c.showCountdown,
    items: c.items.map((i) => {
      const normal = normalPrices.get(i.productId) ?? 0;
      const pct = discountPercent(normal, i.salePrice);
      return { productId: i.productId, salePrice: String(i.salePrice), percent: pct > 0 ? String(pct) : "" };
    }),
  };
}

/** Entier positif depuis une saisie (« 12 500 », « 12500 F ») ; vide ou invalide → null. */
export function parseWhole(raw: string): number | null {
  const digits = raw.replace(/[\s\u00a0\u202f]/g, "").replace(/[Ff]$/, "");
  if (!/^\d+$/.test(digits)) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

/** Saisie du % : recalcule le prix de campagne. */
export function itemWithPercent(item: CampaignItemDraft, normal: number, percentRaw: string): CampaignItemDraft {
  const pct = parseWhole(percentRaw);
  const price = pct === null ? null : priceFromPercent(normal, pct);
  return { ...item, percent: percentRaw, salePrice: price === null ? item.salePrice : String(price) };
}

/** Saisie du prix : recalcule le %. */
export function itemWithPrice(item: CampaignItemDraft, normal: number, priceRaw: string): CampaignItemDraft {
  const price = parseWhole(priceRaw);
  const pct = price === null ? 0 : discountPercent(normal, price);
  return { ...item, salePrice: priceRaw, percent: pct > 0 ? String(pct) : "" };
}

/** « Appliquer X % à tous » : chaque produit reçoit son prix calculé (ceux qu'on ne peut pas calculer restent tels quels). */
export function applyPercentToAll(items: CampaignItemDraft[], normalPrices: Map<string, number>, percent: number): CampaignItemDraft[] {
  return items.map((it) => {
    const price = priceFromPercent(normalPrices.get(it.productId) ?? 0, percent);
    return price === null ? it : { ...it, salePrice: String(price), percent: String(percent) };
  });
}

/** Brouillon → valeurs envoyées à l'action serveur (dates converties en ISO UTC). */
export function draftToInput(d: CampaignDraft): CampaignFormInput {
  return {
    slug: d.slug.trim(),
    nameFr: d.nameFr,
    nameEn: d.nameEn,
    taglineFr: d.taglineFr,
    taglineEn: d.taglineEn,
    startsAt: beninLocalToIso(d.startsLocal) ?? "",
    endsAt: beninLocalToIso(d.endsLocal) ?? "",
    active: d.active,
    showMenu: d.showMenu,
    showBanner: d.showBanner,
    showCountdown: d.showCountdown,
    items: d.items.map((i) => ({ productId: i.productId, salePrice: parseWhole(i.salePrice) ?? 0 })),
  };
}

/** Recherche de produit insensible à la casse et aux accents. */
export const normalizeSearch = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export type CampaignTemplate = { id: string; nameFr: string; nameEn: string; taglineFr: string; taglineEn: string };

/** Modèles en un clic (les dates restent à saisir). */
export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "black-friday",
    nameFr: "Black Friday",
    nameEn: "Black Friday",
    taglineFr: "Des prix réduits sur une sélection de produits, pour quelques jours seulement.",
    taglineEn: "Reduced prices on a selection of products, for a few days only.",
  },
  {
    id: "noel",
    nameFr: "Noël",
    nameEn: "Christmas",
    taglineFr: "Des cadeaux qui font plaisir, à prix doux pour les fêtes.",
    taglineEn: "Gifts they'll love, at sweet prices for the holidays.",
  },
  {
    id: "tabaski",
    nameFr: "Tabaski",
    nameEn: "Tabaski",
    taglineFr: "Préparez la fête en famille avec nos offres spéciales Tabaski.",
    taglineEn: "Get ready to celebrate with our special Tabaski offers.",
  },
  {
    id: "fete-des-meres",
    nameFr: "Fête des mères",
    nameEn: "Mother's Day",
    taglineFr: "Faites plaisir à maman avec une sélection à prix réduit.",
    taglineEn: "Treat your mum with a selection at reduced prices.",
  },
  {
    id: "rentree",
    nameFr: "Rentrée",
    nameEn: "Back to school",
    taglineFr: "Tout pour bien démarrer l'année, à petits prix.",
    taglineEn: "Everything for a great start to the year, at small prices.",
  },
];
