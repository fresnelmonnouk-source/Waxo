import "server-only";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";
import type { Campaign } from "./logic";

// Lecture publique des campagnes (RLS : seules les campagnes actives sont visibles). Utilisée par le catalogue,
// le menu, la bannière et la page de campagne. Aucune campagne (ou base indisponible) = catalogue normal.

const TIMEOUT_MS = 3000;

type Row = {
  id: string;
  slug: string;
  name_fr: string;
  name_en: string;
  tagline_fr: string;
  tagline_en: string;
  starts_at: string;
  ends_at: string;
  active: boolean;
  show_menu: boolean;
  show_banner: boolean;
  show_countdown: boolean;
  campaign_items: { product_id: string; sale_price: number }[] | null;
};

export function campaignFromRow(r: Row): Campaign {
  return {
    id: r.id,
    slug: r.slug,
    nameFr: r.name_fr,
    nameEn: r.name_en,
    taglineFr: r.tagline_fr ?? "",
    taglineEn: r.tagline_en ?? "",
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    active: r.active,
    showMenu: r.show_menu,
    showBanner: r.show_banner,
    showCountdown: r.show_countdown,
    items: (r.campaign_items ?? []).map((i) => ({ productId: i.product_id, salePrice: i.sale_price })),
  };
}

export const CAMPAIGN_SELECT =
  "id,slug,name_fr,name_en,tagline_fr,tagline_en,starts_at,ends_at,active,show_menu,show_banner,show_countdown,campaign_items(product_id,sale_price)";

/** Campagnes actives pas encore terminées (en cours ou à venir). Jamais d'exception : [] en cas de souci. */
export async function getLiveCampaigns(): Promise<Campaign[]> {
  if (!supabasePublicEnv()) return [];
  try {
    const sb = createPublicClient();
    const work = sb.from("campaigns").select(CAMPAIGN_SELECT).eq("active", true).gt("ends_at", new Date().toISOString());
    const res = await Promise.race([
      Promise.resolve(work),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
    // Table absente (0015 pas encore appliquée), erreur ou délai dépassé : pas de campagne.
    if (!res || res.error || !res.data) return [];
    return (res.data as unknown as Row[]).map(campaignFromRow);
  } catch {
    return [];
  }
}
