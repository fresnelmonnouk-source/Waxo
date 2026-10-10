import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { getAdminPacks } from "@/lib/admin/data/packs";
import { PacksView } from "@/components/admin/packs/PacksView";

export const metadata: Metadata = { title: "Packs" };

export default async function PacksPage() {
  await requireAdmin();
  const data = await getAdminPacks();
  return <PacksView data={data} />;
}
