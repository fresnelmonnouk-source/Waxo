import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { getTeam } from "@/lib/admin/data/team";
import { TeamView } from "@/components/admin/team/TeamView";

export const metadata: Metadata = { title: "Équipe" };

export default async function TeamPage() {
  const me = await requireAdmin();
  const data = await getTeam(me.id);
  return <TeamView data={data} />;
}
