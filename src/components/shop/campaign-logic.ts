// Affichage public des campagnes (menu, bannière, page /campagne/<slug>) : règles PURES, testées dans
// tests/campaign-shop.test.ts. Les règles métier (statut, prix) restent dans src/lib/campaigns/logic.ts.
import {
  campaignName,
  campaignStatus,
  campaignTagline,
  featuredCampaign,
  type Campaign,
} from "@/lib/campaigns/logic";

/** Ce que l'en-tête reçoit (sérialisable, déjà traduit). */
export type HeaderCampaign = { slug: string; name: string; showMenu: boolean };

/** Ce que la bannière reçoit (sérialisable, déjà traduit). */
export type BannerCampaign = {
  slug: string;
  name: string;
  tagline: string;
  endsAt: string;
  showCountdown: boolean;
};

export type ShopCampaigns = {
  header: HeaderCampaign | null;
  banner: BannerCampaign | null;
};

/**
 * Campagne mise en avant dans la coque : lien du menu et bannière (chacun selon ses interrupteurs admin).
 * `now` par défaut = l'heure du rendu (le lire ici, hors du composant, respecte la règle de pureté de React).
 */
export function shopCampaigns(
  campaigns: Campaign[],
  locale: "fr" | "en",
  now: number = Date.now(),
): ShopCampaigns {
  const c = featuredCampaign(campaigns, now);
  if (!c) return { header: null, banner: null };
  const name = campaignName(c, locale);
  return {
    header: { slug: c.slug, name, showMenu: c.showMenu },
    banner: c.showBanner
      ? {
          slug: c.slug,
          name,
          tagline: campaignTagline(c, locale),
          endsAt: c.endsAt,
          showCountdown: c.showCountdown,
        }
      : null,
  };
}

/** Page de campagne : en cours, à venir, ou rien (inconnue, terminée, désactivée → 404). */
export function campaignPage(
  campaigns: Campaign[],
  slug: string,
  now: number = Date.now(),
): { state: "running" | "upcoming"; campaign: Campaign } | null {
  const c = campaigns.find((x) => x.slug === slug);
  if (!c) return null;
  const state = campaignStatus(c, now);
  return state === "running" || state === "upcoming"
    ? { state, campaign: c }
    : null;
}

/** Date de fin lisible, toujours dans le fuseau du Bénin (rendu identique serveur et navigateur). */
export function formatCampaignDate(iso: string, locale: "fr" | "en"): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Porto-Novo",
  }).format(d);
}

/** « 05 » : heures, minutes et secondes sur deux chiffres (évite que le compte à rebours « saute » en largeur). */
export const pad2 = (n: number) =>
  String(Math.max(0, Math.floor(n))).padStart(2, "0");
