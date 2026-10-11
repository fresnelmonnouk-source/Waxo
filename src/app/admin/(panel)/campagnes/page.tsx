import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { getAdminCampaigns } from "@/lib/admin/data/campaigns";
import { CampaignsView } from "@/components/admin/campaigns/CampaignsView";

export const metadata: Metadata = { title: "Campagnes" };

export default async function CampaignsPage() {
  await requireAdmin();
  const data = await getAdminCampaigns();
  return <CampaignsView data={data} />;
}
