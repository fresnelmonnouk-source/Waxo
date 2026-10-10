"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ClientRow } from "@/lib/orders/clients";
import { DATE_DAY, DATE_SHORT, fmtDate, fmtXof, plural, prettyPhone, telLink, waBase } from "@/lib/orders/format";
import type { AdminOrder } from "@/lib/orders/types";
import { EmptyBox, StatusPill } from "../orders/ui";
import { useDrawer } from "../orders/useDrawer";

type Filters = { q: string; news: boolean };

const qs = (f: Filters, extra: Record<string, string> = {}) => {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.news) p.set("news", "1");
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
};

function ClientDrawer({ client, orders }: { client: ClientRow; orders: AdminOrder[] }) {
  const { close, closeRef, asideRef } = useDrawer("client", "/admin/clients");
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(20,18,16,.45)]" onClick={close}>
      <aside
        ref={asideRef}
        role="dialog"
        aria-modal="true"
        aria-label="Détail du client"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-[min(480px,100%)] animate-[wxup_.25s_ease_both] flex-col overflow-y-auto bg-[#F4F1EA]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#E2DCCF] px-5 py-[18px]">
          <div className="flex items-center gap-3">
            <span className="flex size-[38px] flex-none items-center justify-center rounded-full bg-[#141210] text-[13px] font-bold text-[#FFC93C]">
              {client.initials}
            </span>
            <div className="flex flex-col gap-0.5">
              <strong className="font-display text-lg font-semibold">{client.name}</strong>
              <span className="text-[13px] text-[#4A443C]">Inscrit le {fmtDate(client.createdAt, DATE_DAY)}</span>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Fermer"
            className="size-11 flex-none cursor-pointer rounded-full border-0 bg-white text-xl"
          >
            ×
          </button>
        </div>
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-2 rounded-[18px] bg-white p-4 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[.06em] text-[#4A443C]">Coordonnées</span>
            {client.phone ? (
              <a href={telLink(client.phone)} className="text-[#141210]">
                +229 {prettyPhone(client.phone)}
              </a>
            ) : null}
            {client.email ? (
              <a href={`mailto:${client.email}`} className="break-all text-[#141210]">
                {client.email}
              </a>
            ) : null}
            {client.address ? <span className="leading-[1.45]">{client.address}</span> : <span className="text-[#4A443C]">Adresse non renseignée</span>}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span
                className="rounded-full px-2.5 py-[3px] text-xs font-semibold"
                style={{ background: client.news ? "#DDEBF7" : "#E2DCCF", color: client.news ? "#1D4F7A" : "#4A443C" }}
              >
                {client.news ? "Abonné à la newsletter" : "Non abonné à la newsletter"}
              </span>
              {client.phone ? (
                <a
                  href={waBase(client.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center rounded-full bg-[#1F6B4A] px-4 text-[13px] font-semibold text-white no-underline hover:bg-[#185A3E] hover:text-white"
                >
                  WhatsApp
                </a>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 rounded-[18px] bg-white p-4">
              <span className="text-[13px] text-[#4A443C]">Commandes</span>
              <strong className="font-display text-[22px] font-semibold tracking-[-0.03em]">{client.orders}</strong>
            </div>
            <div className="flex flex-col gap-1 rounded-[18px] bg-white p-4">
              <span className="text-[13px] text-[#4A443C]">Total dépensé</span>
              <strong className="font-display text-[22px] font-semibold tracking-[-0.03em]">{fmtXof(client.spent)}</strong>
            </div>
          </div>
          <div className="flex flex-col gap-1 rounded-[18px] bg-white p-4 text-sm">
            <span className="mb-1.5 text-xs font-semibold uppercase tracking-[.06em] text-[#4A443C]">Commandes récentes</span>
            {orders.length === 0 ? <span className="text-[#4A443C]">Aucune commande pour le moment.</span> : null}
            {orders.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#F0EBE1] py-2">
                <Link href={`/admin/commandes?commande=${encodeURIComponent(o.number)}`} className="min-w-[78px] font-bold text-[#141210]">
                  {o.number}
                </Link>
                <span className="flex-1 text-[13px] text-[#4A443C]">{fmtDate(o.createdAt, DATE_SHORT)}</span>
                <StatusPill status={o.status} />
                <strong className="min-w-[72px] text-right">{fmtXof(o.total)}</strong>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

type Props = {
  rows: ClientRow[];
  filters: Filters;
  totalAll: number;
  newsCount: number;
  truncated: boolean;
  detail: { client: ClientRow; orders: AdminOrder[] } | null;
};

/** Liste des clients (maquette lignes 514-527) : recherche, filtre newsletter, fiche détail en tiroir. */
export function ClientsBoard({ rows, filters, totalAll, newsCount, truncated, detail }: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? "/admin/clients";
  const [q, setQ] = useState(filters.q);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const v = q.trim();
      if (v !== filters.q) router.replace(`${pathname}${qs({ ...filters, q: v })}`, { scroll: false });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seule la saisie relance la temporisation
  }, [q]);

  const chip = (on: boolean) =>
    `inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium no-underline ${
      on ? "border-[#141210] bg-[#141210] text-[#F4F1EA] hover:text-[#F4F1EA]" : "border-[#D6CFC0] text-[#141210] hover:text-[#141210]"
    }`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <nav aria-label="Filtrer les clients" className="flex gap-1.5">
          <Link href={`${pathname}${qs({ ...filters, news: false })}`} aria-current={!filters.news ? "true" : undefined} className={chip(!filters.news)}>
            Tous <span className="text-xs opacity-65">{totalAll}</span>
          </Link>
          <Link href={`${pathname}${qs({ ...filters, news: true })}`} aria-current={filters.news ? "true" : undefined} className={chip(filters.news)}>
            Newsletter <span className="text-xs opacity-65">{newsCount}</span>
          </Link>
        </nav>
        <form
          role="search"
          className="ml-auto flex min-w-0 flex-[0_1_300px]"
          onSubmit={(e) => {
            e.preventDefault();
            router.replace(`${pathname}${qs({ ...filters, q: q.trim() })}`, { scroll: false });
          }}
        >
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={60}
            aria-label="Rechercher un client"
            placeholder="Nom, e-mail ou téléphone"
            className="min-h-[42px] w-full min-w-0 rounded-full border border-[#D6CFC0] bg-white px-4 text-sm"
          />
        </form>
      </div>

      <div className="flex flex-col gap-2">
        {rows.length === 0 ? <EmptyBox>Aucun client ne correspond.</EmptyBox> : null}
        {rows.map((c) => (
          <div
            key={c.id}
            onClick={() => router.push(`${pathname}${qs(filters, { client: c.id })}`, { scroll: false })}
            className="flex cursor-pointer flex-wrap items-center gap-x-[18px] gap-y-2 rounded-2xl border border-[#E2DCCF] bg-white px-4 py-3 hover:border-[#141210]"
          >
            <span className="flex size-[38px] flex-none items-center justify-center rounded-full bg-[#141210] text-[13px] font-bold text-[#FFC93C]">
              {c.initials}
            </span>
            <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
              <Link
                href={`${pathname}${qs(filters, { client: c.id })}`}
                onClick={(e) => e.stopPropagation()}
                scroll={false}
                aria-label={`Ouvrir la fiche de ${c.name}`}
                className="text-sm font-bold text-[#141210] no-underline hover:text-[#141210]"
              >
                {c.name}
              </Link>
              <span className="break-words text-xs text-[#4A443C]">
                {[c.email, c.phone ? `+229 ${prettyPhone(c.phone)}` : ""].filter(Boolean).join(" · ")}
              </span>
            </div>
            <span className="min-w-[150px] text-[13px] text-[#4A443C]">Inscrit le {fmtDate(c.createdAt, DATE_DAY)}</span>
            <span className="min-w-[100px] text-[13px]">{plural(c.orders, "commande", "commandes")}</span>
            <strong className="min-w-[90px] text-right text-sm">{fmtXof(c.spent)}</strong>
            {c.news ? (
              <span className="rounded-full bg-[#DDEBF7] px-2.5 py-[3px] text-xs font-semibold text-[#1D4F7A]">Newsletter</span>
            ) : null}
            {c.phone ? (
              <a
                href={waBase(c.phone)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex min-h-11 items-center text-[13px] font-medium text-[#141210]"
              >
                WhatsApp
              </a>
            ) : null}
          </div>
        ))}
      </div>
      {truncated ? (
        <p className="m-0 text-[13px] text-[#4A443C]">Seuls les 200 clients les plus récents sont chargés.</p>
      ) : null}
      {detail ? <ClientDrawer key={detail.client.id} client={detail.client} orders={detail.orders} /> : null}
    </>
  );
}
