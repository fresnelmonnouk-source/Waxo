"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { setOrderStatusAction } from "@/app/admin/(panel)/commandes/actions";
import type { StatusCounts } from "@/lib/admin/data/orders";
import { PERIODS, filtersToQuery, type OrderFilters } from "@/lib/orders/filters";
import { DATE_SHORT, PAY_LABEL, ZONE_LABEL, fmtDate, fmtXof, prettyPhone } from "@/lib/orders/format";
import { STATUS_LIST, STATUS_META, allowedTransitions } from "@/lib/orders/status";
import type { AdminOrder, OrderStatus } from "@/lib/orders/types";
import { EmptyBox } from "./ui";
import { useAdminAction } from "./useAdminAction";

const CHIPS: { id: OrderStatus | "all"; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "nouvelle", label: "Reçues" },
  { id: "preparation", label: "En préparation" },
  { id: "livraison", label: "En livraison" },
  { id: "livree", label: "Livrées" },
  { id: "annulee", label: "Annulées" },
];

const chipCls = (on: boolean) =>
  `inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium no-underline ${
    on
      ? "border-[#141210] bg-[#141210] text-[#F4F1EA] hover:text-[#F4F1EA]"
      : "border-[#D6CFC0] bg-transparent text-[#141210] hover:text-[#141210]"
  }`;

type Props = {
  rows: AdminOrder[];
  counts: StatusCounts;
  total: number;
  page: number;
  pageCount: number;
  filters: OrderFilters;
  connected: boolean;
  error: boolean;
};

/** Liste des commandes (maquette lignes 132-154) : filtres statut / période, recherche, changement de statut en ligne. */
export function OrdersBoard({ rows, counts, total, page, pageCount, filters, connected, error }: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? "/admin/commandes";
  const { run, pending, toast } = useAdminAction();
  const [q, setQ] = useState(filters.q);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);

  // Recherche « à la frappe », temporisée : l'URL porte le filtre (partageable, rechargeable).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (q.trim() === filters.q) return;
      router.replace(`${pathname}${filtersToQuery({ ...filters, q: q.trim(), page: 1 })}`, { scroll: false });
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seule la saisie doit relancer la temporisation
  }, [q]);

  const open = (n: string) => router.push(`${pathname}${filtersToQuery(filters, { commande: n })}`, { scroll: false });
  const exportHref = `/admin/commandes/export${filtersToQuery({ ...filters, page: 1 })}`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <nav aria-label="Filtrer par statut" className="flex flex-wrap gap-1.5">
          {CHIPS.map((c) => (
            <Link
              key={c.id}
              href={`${pathname}${filtersToQuery({ ...filters, status: c.id, page: 1 })}`}
              aria-current={filters.status === c.id ? "true" : undefined}
              className={chipCls(filters.status === c.id)}
            >
              {c.label}
              <span className="text-xs opacity-65">{counts[c.id].toLocaleString("fr-FR")}</span>
            </Link>
          ))}
        </nav>
        <form
          role="search"
          className="ml-auto flex min-w-0 flex-[0_1_260px]"
          onSubmit={(e) => {
            e.preventDefault();
            router.replace(`${pathname}${filtersToQuery({ ...filters, q: q.trim(), page: 1 })}`, { scroll: false });
          }}
        >
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={60}
            aria-label="Rechercher une commande"
            placeholder="N°, client ou téléphone"
            className="min-h-[42px] w-full min-w-0 rounded-full border border-[#D6CFC0] bg-white px-4 text-sm"
          />
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <nav aria-label="Filtrer par période" className="flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <Link
              key={p.id}
              href={`${pathname}${filtersToQuery({ ...filters, period: p.id, page: 1 })}`}
              aria-current={filters.period === p.id ? "true" : undefined}
              className={chipCls(filters.period === p.id)}
            >
              {p.label}
            </Link>
          ))}
        </nav>
        <a
          href={exportHref}
          download
          className="ml-auto inline-flex min-h-10 items-center rounded-full border border-[#D6CFC0] px-4 text-[13px] font-medium text-[#141210] no-underline hover:bg-white hover:text-[#141210]"
        >
          Exporter en CSV
        </a>
      </div>

      <div className="flex flex-col gap-2" aria-live="polite">
        {rows.length === 0 && !error ? <EmptyBox>Aucune commande ne correspond.</EmptyBox> : null}
        {rows.map((o) => (
          <div
            key={o.id}
            onClick={() => open(o.number)}
            className="flex cursor-pointer flex-wrap items-center gap-x-[18px] gap-y-2 rounded-2xl border border-[#E2DCCF] bg-white px-4 py-3 hover:border-[#141210]"
          >
            <Link
              href={`${pathname}${filtersToQuery(filters, { commande: o.number })}`}
              onClick={(e) => e.stopPropagation()}
              scroll={false}
              aria-label={`Ouvrir la commande ${o.number}`}
              className="min-w-[86px] text-sm font-bold text-[#141210] no-underline hover:text-[#141210]"
            >
              {o.number}
            </Link>
            <span className="min-w-[120px] text-[13px] text-[#4A443C]">{fmtDate(o.createdAt, DATE_SHORT)}</span>
            <span className="min-w-0 flex-[1_1_170px] text-sm">
              {o.name}
              <span className="block text-xs text-[#4A443C]">
                {prettyPhone(o.phone)} · {ZONE_LABEL[o.zone]}
              </span>
            </span>
            <span className="min-w-[120px] text-[13px] text-[#4A443C]">
              {PAY_LABEL[o.pay]}
              {o.paid ? "" : o.pay === "cod" ? "" : " · en attente"}
            </span>
            <strong className="min-w-[84px] text-right text-sm">{fmtXof(o.total)}</strong>
            <select
              value={o.status}
              disabled={pending || !connected || o.status === "livree" || o.status === "annulee"}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) =>
                run(
                  () => setOrderStatusAction({ orderId: o.id, to: e.target.value as OrderStatus }),
                  `${o.number} mise à jour.`,
                )
              }
              aria-label={`Statut de la commande ${o.number}`}
              className="min-h-11 cursor-pointer rounded-full border-0 px-2.5 text-[13px] font-semibold disabled:cursor-default"
              style={{ background: STATUS_META[o.status].bg, color: STATUS_META[o.status].color }}
            >
              {[o.status, ...allowedTransitions(o.status)]
                .sort((a, b) => STATUS_LIST.indexOf(a) - STATUS_LIST.indexOf(b))
                .map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
            </select>
          </div>
        ))}
      </div>

      {pageCount > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3 text-[13px] text-[#4A443C]">
          {page > 1 ? (
            <Link href={`${pathname}${filtersToQuery({ ...filters, page: page - 1 })}`} className="text-[#141210]">
              ← Plus récentes
            </Link>
          ) : (
            <span />
          )}
          <span>
            Page {page} sur {pageCount} · {total.toLocaleString("fr-FR")} commandes
          </span>
          {page < pageCount ? (
            <Link href={`${pathname}${filtersToQuery({ ...filters, page: page + 1 })}`} className="text-[#141210]">
              Plus anciennes →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
      {toast}
    </>
  );
}
