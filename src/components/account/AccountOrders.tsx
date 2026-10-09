"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/auth/client";
import type { OrderView } from "@/lib/auth/types";
import { fmtXof } from "@/lib/money";
import { fmtDate } from "./actions";
import { OrderSteps, StatusBadge } from "./OrderParts";
import { BTN_DARK } from "./ui";

type Load = { state: "loading" } | { state: "error" } | { state: "ready"; orders: OrderView[] };

/** Onglet « Mes commandes » : liste dépliable (maquette 778-830). Données : GET /api/me/orders (RLS + filtre propriétaire). */
export function AccountOrders({ openNumber, onCount }: { openNumber: string | null; onCount: (n: number) => void }) {
  const t = useTranslations("Account");
  const locale = useLocale();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [openId, setOpenId] = useState<string | null>(openNumber);

  useEffect(() => {
    let alive = true;
    api(`/api/me/orders?lang=${locale}`, "GET").then((res) => {
      if (!alive) return;
      if (res.data?.ok === true && Array.isArray(res.data.orders)) {
        const orders = res.data.orders as OrderView[];
        setLoad({ state: "ready", orders });
        onCount(orders.length);
      } else setLoad({ state: "error" });
    });
    return () => {
      alive = false;
    };
  }, [locale, attempt, onCount]);

  if (load.state === "loading") return <p className="m-0 text-[15px] text-muted">{t("loading")}</p>;
  if (load.state === "error") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-[20px] border border-dashed border-border-strong p-8">
        <strong className="text-[17px]">{t("orders.loadError")}</strong>
        <button
          type="button"
          onClick={() => {
            setLoad({ state: "loading" });
            setAttempt((a) => a + 1);
          }}
          className={`${BTN_DARK} px-5 py-3`}
        >
          {t("orders.retry")}
        </button>
      </div>
    );
  }
  if (!load.orders.length) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-[20px] border border-dashed border-border-strong p-8">
        <strong className="text-[17px]">{t("orders.empty")}</strong>
        <Link href="/catalogue" className={`${BTN_DARK} px-5 py-3`}>
          {t("orders.seeCatalog")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {load.orders.map((o) => {
        const open = openId === o.number;
        const count = o.items.reduce((a, i) => a + i.qty, 0);
        return (
          <div key={o.number} className="overflow-hidden rounded-[20px] border border-border bg-white">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : o.number)}
              aria-expanded={open}
              className="flex w-full cursor-pointer flex-wrap items-center gap-x-5 gap-y-2 border-0 bg-transparent px-5 py-[18px] text-left"
            >
              <strong className="text-[15px]">{o.number}</strong>
              <span className="text-[14px] text-text">{fmtDate(o.createdAt, locale)}</span>
              <span className="text-[14px] text-text">{t("orders.items", { count })}</span>
              <span className="ml-auto flex items-center gap-[14px]">
                <StatusBadge status={o.status} />
                <strong className="text-[15px]">{fmtXof(o.total)}</strong>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#141210"
                  strokeWidth="2.5"
                  aria-hidden="true"
                  className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>

            {open ? (
              <div className="flex flex-col gap-[18px] border-t border-border p-5">
                <OrderSteps status={o.status} />
                {o.status === "annulee" ? <span className="text-[14px] leading-[1.5] text-[#9A3412]">{t("orders.cancelled")}</span> : null}

                <div className="flex flex-col">
                  {o.items.map((it, i) => (
                    <div key={`${it.name}-${i}`} className="flex flex-wrap items-center gap-x-[14px] gap-y-[10px] border-b border-[#F0EBE1] py-[10px]">
                      {it.slug ? (
                        <Link href={`/produit/${it.slug}`} className="min-w-[180px] flex-[1_1_180px] text-[15px] text-ink">
                          {it.name}
                        </Link>
                      ) : (
                        <span className="min-w-[180px] flex-[1_1_180px] text-[15px]">{it.name}</span>
                      )}
                      <span className="text-[14px] text-text">× {it.qty}</span>
                      <span className="min-w-20 text-right text-[14px] font-semibold">{fmtXof(it.unitPrice * it.qty)}</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4 text-[14px]">
                  <div className="flex flex-col gap-1">
                    <span className="text-muted">{t("orders.delivery")}</span>
                    <span className="leading-[1.45]">
                      {t(`zone.${o.zone === "autre" ? "autre" : "cotonou"}`)} · {o.address}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted">{t("orders.payment")}</span>
                    <span>{t.has(`pay.${o.pay}`) ? t(`pay.${o.pay}`) : o.pay}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="flex justify-between">
                      <span className="text-muted">{t("orders.subtotal")}</span>
                      {fmtXof(o.subtotal)}
                    </span>
                    <span className="flex justify-between">
                      <span className="text-muted">{t("orders.shipping")}</span>
                      {o.shippingFee ? fmtXof(o.shippingFee) : t("orders.free")}
                    </span>
                    <strong className="flex justify-between text-[15px]">
                      <span>{t("orders.total")}</span>
                      {fmtXof(o.total)}
                    </strong>
                  </div>
                </div>

                <span className="text-[13px] text-text">
                  {t.rich("orders.question", {
                    number: o.number,
                    contact: (c) => <Link href="/contact">{c}</Link>,
                  })}
                </span>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
