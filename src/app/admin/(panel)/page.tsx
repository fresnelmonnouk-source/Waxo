import type { Metadata } from "next";
import Link from "next/link";
import { LowStock, type LowRow } from "@/components/admin/dashboard/LowStock";
import { TodoOrders, type TodoRow } from "@/components/admin/dashboard/TodoOrders";
import { Card, KpiCard } from "@/components/admin/ui/Card";
import { SourceBanner } from "@/components/admin/ui/SourceBanner";
import { Stars } from "@/components/admin/ui/Stars";
import { getDashboard } from "@/lib/admin/data/dashboard";
import { requireAdmin } from "@/lib/admin/guard";
import { LOW_STOCK, NEXT_STATUS, ZONE_LABEL } from "@/lib/admin/ui/constants";
import { fmtXof } from "@/lib/money";
import { plural } from "@/lib/stats/format";
import { fmtDate } from "@/lib/stats/time";

export const metadata: Metadata = { title: "Tableau de bord" };

const linkBtn = "text-sm text-[#141210] underline underline-offset-[3px] hover:text-[#141210]";

// Tableau de bord (maquette lignes 83-131). Données : commandes, produits, avis (repli démo sans base).
export default async function AdminHome() {
  await requireAdmin();
  const { source, data, reviews } = await getDashboard();

  const todo: TodoRow[] = data.todo.map((o) => {
    const next = NEXT_STATUS[o.status];
    return {
      id: o.id,
      number: o.number,
      name: o.name,
      dateTxt: fmtDate(o.date, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
      zoneTxt: ZONE_LABEL[o.zone] ?? "",
      status: o.status,
      totalFmt: fmtXof(o.total),
      nextStatus: next ? next[0] : null,
      nextLabel: next ? next[1] : "",
    };
  });
  const low: LowRow[] = data.low.map((p) => ({ id: p.id, name: p.name, bg: p.bg, imageUrl: p.imageUrl, stock: p.stock }));

  return (
    <>
      <SourceBanner source={source} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
        <KpiCard label="Chiffre d'affaires · 30 jours" value={fmtXof(data.rev30)} sub={`${plural(data.count30, "commande", "commandes")}, hors annulations`} />
        <KpiCard
          label="Commandes à traiter"
          value={String(data.todo.length)}
          sub={`${plural(data.newCount, "nouvelle", "nouvelles")} à confirmer`}
          subColor={data.newCount ? "#8A5A00" : "#4A443C"}
        />
        <KpiCard label="Panier moyen · 30 jours" value={fmtXof(data.avg30)} sub="Livraison comprise" />
        <KpiCard
          label="Produits en stock faible"
          value={String(data.low.length)}
          sub={`${LOW_STOCK} unités ou moins`}
          subColor={data.low.length ? "#C2410C" : "#4A443C"}
        />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-5">
        <Card className="gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="m-0 text-[17px] font-bold">Commandes à traiter</h2>
            <Link href="/admin/commandes" className={linkBtn}>
              Toutes les commandes
            </Link>
          </div>
          <TodoOrders rows={todo} readOnly={source !== "db"} />
        </Card>
        <Card className="gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="m-0 text-[17px] font-bold">Stock faible</h2>
            <Link href="/admin/produits" className={linkBtn}>
              Tous les produits
            </Link>
          </div>
          <LowStock rows={low} readOnly={source !== "db"} />
        </Card>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-5">
        <Card className="gap-1">
          <h2 className="m-0 mb-2 text-[17px] font-bold">Meilleures ventes</h2>
          <ol className="m-0 flex list-none flex-col p-0">
            {data.topSold.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 border-t border-[#F0EBE1] py-2.5 text-sm">
                <span className="w-6 font-display font-bold">{i + 1}</span>
                <span className="min-w-0 flex-1">{p.name}</span>
                <span className="text-[#4A443C]">{plural(p.sold, "vendu", "vendus")}</span>
                <span className="min-w-[84px] text-right" style={{ color: p.stock <= LOW_STOCK ? "#C2410C" : "#4A443C" }}>
                  {plural(p.stock, "en stock", "en stock")}
                </span>
              </li>
            ))}
          </ol>
        </Card>
        <Card className="gap-1">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="m-0 text-[17px] font-bold">Derniers avis</h2>
            <Link href="/admin/avis" className={linkBtn}>
              Modérer
            </Link>
          </div>
          {reviews.length === 0 && <span className="text-sm text-[#4A443C]">Aucun avis pour le moment.</span>}
          {reviews.map((r) => (
            <div key={r.id} className="flex flex-col gap-1.5 border-t border-[#F0EBE1] py-3">
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <Stars rating={r.rating} />
                <strong>{r.author}</strong>
                <span className="text-[#4A443C]">sur {r.productName}</span>
                <span
                  className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: r.hidden ? "#F6E1DA" : "#E5EFE7", color: r.hidden ? "#9A3412" : "#1F6B4A" }}
                >
                  {r.hidden ? "Masqué" : "Publié"}
                </span>
              </div>
              <span className="text-sm leading-[1.45] text-[#2C2823]">{r.body}</span>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
