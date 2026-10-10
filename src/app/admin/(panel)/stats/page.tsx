import type { Metadata } from "next";
import { StatsView } from "@/components/admin/stats/StatsView";
import { SourceBanner } from "@/components/admin/ui/SourceBanner";
import { getStats } from "@/lib/admin/data/stats";
import { requireAdmin } from "@/lib/admin/guard";
import { isStatsRange, type StatsRange } from "@/lib/stats";

export const metadata: Metadata = { title: "Statistiques" };

// Statistiques (maquette lignes 263-306). Période pilotée par l'URL : ?periode=7|30|90 (30 par défaut).
export default async function StatsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const raw = Number(Array.isArray(sp.periode) ? sp.periode[0] : sp.periode);
  const range: StatsRange = isStatsRange(raw) ? raw : 30;
  const { source, stats } = await getStats(range);
  return (
    <>
      <SourceBanner source={source} />
      <StatsView stats={stats} />
    </>
  );
}
