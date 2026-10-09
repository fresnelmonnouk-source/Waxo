"use client";

import { useTranslations } from "next-intl";
import { STATUS_FLOW, STATUS_STYLE, type OrderStatus } from "@/lib/auth/status";

/** Pastille de statut (couleurs STATUS de waxo-data.js). */
export function StatusBadge({ status }: { status: OrderStatus }) {
  const t = useTranslations("Account.status");
  const s = STATUS_STYLE[status];
  return (
    <span className="rounded-full px-3 py-[5px] text-[13px] font-semibold" style={{ background: s.bg, color: s.fg }}>
      {t(status)}
    </span>
  );
}

/** Déroulé en 4 étapes (Reçue → En préparation → En livraison → Livrée). Absent pour une commande annulée. */
export function OrderSteps({ status }: { status: OrderStatus }) {
  const t = useTranslations("Account");
  if (status === "annulee") return null;
  const idx = STATUS_FLOW.indexOf(status);
  return (
    <ol aria-label={t("orders.stepsAria")} className="m-0 grid list-none grid-cols-4 p-0">
      {STATUS_FLOW.map((k, i) => (
        <li key={k} className="flex flex-col gap-2" aria-current={i === idx ? "step" : undefined}>
          <div className="flex items-center">
            <span className="h-[14px] w-[14px] flex-none rounded-full" style={{ background: idx >= i ? "#1F6B4A" : "#D6CFC0" }} />
            <span className="h-[3px] flex-1" style={{ background: i === 3 ? "transparent" : idx > i ? "#1F6B4A" : "#D6CFC0" }} />
          </div>
          <span className="pr-2 text-[13px] leading-[1.3]" style={{ color: idx >= i ? "#141210" : "#6B645A" }}>
            {t(`status.${k}`)}
          </span>
        </li>
      ))}
    </ol>
  );
}
