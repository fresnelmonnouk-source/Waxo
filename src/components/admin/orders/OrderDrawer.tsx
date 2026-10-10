"use client";

import { useState } from "react";
import {
  assignCourierAction,
  markPaidAction,
  setCodVerifiedAction,
  setOrderStatusAction,
} from "@/app/admin/(panel)/commandes/actions";
import {
  DATE_LONG,
  DATE_SHORT,
  PAY_LABEL,
  ZONE_SHORT,
  fmtDate,
  fmtXof,
  orderStatusMessage,
  prettyPhone,
  telLink,
  waLink,
} from "@/lib/orders/format";
import { NEXT_STEP, STATUS_META, allowedTransitions } from "@/lib/orders/status";
import type { AdminOrder, Courier, OrderStatus } from "@/lib/orders/types";
import { StatusPill, btnDanger, btnDark, btnLine, selectLine } from "./ui";
import { useAdminAction } from "./useAdminAction";
import { useDrawer } from "./useDrawer";

const LABEL = "text-xs font-semibold uppercase tracking-[.06em] text-[#4A443C]";

type Props = { order: AdminOrder; couriers: Courier[]; paramKey?: string; connected: boolean };

/** Tiroir « Détail de la commande » (maquette lignes 586-615) + paiement, livreur et historique. */
export function OrderDrawer({ order, couriers, paramKey = "commande", connected }: Props) {
  const { run, pending, toast } = useAdminAction();
  const { close, closeRef, asideRef } = useDrawer(paramKey, "/admin/commandes");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const final = order.status === "livree" || order.status === "annulee";
  const next = NEXT_STEP[order.status];
  const options: OrderStatus[] = [order.status, ...allowedTransitions(order.status)];
  const activeCouriers = couriers.filter((c) => c.active || c.id === order.courierId);
  const courier = couriers.find((c) => c.id === order.courierId);
  const disabled = pending || !connected;

  const changeStatus = (to: OrderStatus) =>
    run(() => setOrderStatusAction({ orderId: order.id, to }), "Statut mis à jour.");

  const history: { label: string; at: string | null }[] = [
    { label: "Commande reçue", at: order.createdAt },
    { label: "Paiement reçu", at: order.paidAt },
    { label: "Livrée", at: order.deliveredAt },
  ];

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(20,18,16,.45)]" onClick={close}>
      <aside
        ref={asideRef}
        role="dialog"
        aria-modal="true"
        aria-label="Détail de la commande"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-[min(480px,100%)] animate-[wxup_.25s_ease_both] flex-col overflow-y-auto bg-[#F4F1EA]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#E2DCCF] px-5 py-[18px]">
          <div className="flex flex-col gap-1">
            <strong className="font-display text-xl font-semibold">{order.number}</strong>
            <span className="text-[13px] text-[#4A443C]">{fmtDate(order.createdAt, DATE_LONG)}</span>
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
          {/* Statut */}
          <div className="flex flex-wrap items-center gap-2.5 rounded-[18px] bg-white p-4">
            <select
              value={order.status}
              disabled={disabled || final}
              onChange={(e) => changeStatus(e.target.value as OrderStatus)}
              aria-label="Statut"
              className="min-h-11 cursor-pointer rounded-full border-0 px-3 text-sm font-semibold disabled:cursor-default"
              style={{ background: STATUS_META[order.status].bg, color: STATUS_META[order.status].color }}
            >
              {options.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
            {next ? (
              <button type="button" disabled={disabled} onClick={() => changeStatus(next.to)} className={`${btnDark} min-h-11`}>
                {next.label}
              </button>
            ) : null}
            {order.status === "livraison" ? (
              <button
                type="button"
                disabled={disabled}
                onClick={() => changeStatus("preparation")}
                className={`${btnLine} min-h-11`}
              >
                Échec, à reprogrammer
              </button>
            ) : null}
            {!connected ? <span className="w-full text-xs text-[#4A443C]">Base non connectée : lecture seule.</span> : null}
          </div>

          {/* Client */}
          <div className="flex flex-col gap-2 rounded-[18px] bg-white p-4 text-sm">
            <span className={LABEL}>Client · {order.userId ? "client inscrit" : "commande sans compte"}</span>
            <strong className="text-base">{order.name}</strong>
            <a href={telLink(order.phone)} className="text-[#141210]">
              +229 {prettyPhone(order.phone)}
            </a>
            {order.email ? (
              <a href={`mailto:${order.email}`} className="break-all text-[#141210]">
                {order.email}
              </a>
            ) : null}
            <span className="leading-[1.45]">
              {ZONE_SHORT[order.zone]} · {order.address}
            </span>
            {order.note ? (
              <span className="rounded-xl bg-[#FBEFC9] px-3 py-2 text-[13px] leading-[1.45]">Note du client : {order.note}</span>
            ) : null}
            <a
              href={waLink(order.phone, orderStatusMessage(order, STATUS_META[order.status].label))}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 flex min-h-11 items-center self-start rounded-full bg-[#1F6B4A] px-4 text-[13px] font-semibold text-white no-underline hover:bg-[#185A3E] hover:text-white"
            >
              Prévenir le client sur WhatsApp
            </a>
          </div>

          {/* Livreur */}
          {!final || order.courierId ? (
            <div className="flex flex-col gap-2 rounded-[18px] bg-white p-4 text-sm">
              <span className={LABEL}>Livreur</span>
              {final ? (
                <span>{courier ? `${courier.name} · ${prettyPhone(courier.phone)}` : "Non renseigné"}</span>
              ) : (
                <select
                  value={order.courierId ?? ""}
                  disabled={disabled}
                  aria-label="Livreur"
                  onChange={(e) =>
                    run(
                      () => assignCourierAction({ orderId: order.id, courierId: e.target.value || null }),
                      "Livreur mis à jour.",
                    )
                  }
                  className={`${selectLine} min-h-11`}
                >
                  <option value="">Choisir un livreur</option>
                  {activeCouriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.zone === "autre" ? "autres villes" : "Cotonou"}
                      {c.active ? "" : " (en pause)"}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : null}

          {/* Articles */}
          <div className="flex flex-col gap-1 rounded-[18px] bg-white p-4 text-sm">
            <span className={`${LABEL} mb-1.5`}>Articles à préparer</span>
            {order.items.map((i) => (
              <div key={i.id} className="flex gap-2.5 border-b border-[#F0EBE1] py-2">
                <strong className="min-w-7">{i.qty}×</strong>
                <span className="flex-1">
                  {i.name}
                  <span className="block text-xs text-[#4A443C]">{fmtXof(i.unitPrice)} l&apos;unité</span>
                </span>
                <span>{fmtXof(i.unitPrice * i.qty)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2">
              <span className="text-[#4A443C]">Sous-total</span>
              <span>{fmtXof(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#4A443C]">Livraison</span>
              <span>{order.shippingFee ? fmtXof(order.shippingFee) : "Offerte"}</span>
            </div>
            <div className="flex justify-between pt-1 text-base font-bold">
              <span>Total</span>
              <span>{fmtXof(order.total)}</span>
            </div>
          </div>

          {/* Paiement */}
          <div className="flex flex-col gap-2 rounded-[18px] bg-white p-4 text-sm">
            <span className={LABEL}>Paiement</span>
            <span className="text-[#4A443C]">{PAY_LABEL[order.pay]}</span>
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className="inline-flex items-center rounded-full px-2.5 py-[3px] text-xs font-semibold"
                style={{ background: order.paid ? "#E5EFE7" : "#FFF4D6", color: order.paid ? "#1F6B4A" : "#8A5A00" }}
              >
                {order.paid
                  ? `Payée${order.paidAt ? ` le ${fmtDate(order.paidAt, DATE_SHORT)}` : ""}`
                  : order.pay === "cod"
                    ? `À encaisser ${fmtXof(order.total)}`
                    : "En attente de paiement"}
              </span>
              {!order.paid && order.status !== "annulee" ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => run(() => markPaidAction({ orderId: order.id }), "Commande marquée payée.")}
                  className={btnLine}
                >
                  {order.pay === "cod" ? "Marquer encaissée" : "Marquer payée"}
                </button>
              ) : null}
            </div>
            {order.pay === "cod" && order.paid ? (
              <label className="flex min-h-11 cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={order.codVerified}
                  disabled={disabled}
                  onChange={(e) =>
                    run(
                      () => setCodVerifiedAction({ orderId: order.id, verified: e.target.checked }),
                      e.target.checked ? "Encaissement vérifié." : "Vérification retirée.",
                    )
                  }
                  className="size-5 cursor-pointer accent-[#1F6B4A]"
                />
                <span>Encaissement vérifié (argent remis par le livreur)</span>
              </label>
            ) : null}
          </div>

          {/* Historique */}
          <div className="flex flex-col gap-1.5 rounded-[18px] bg-white p-4 text-sm">
            <span className={`${LABEL} mb-1`}>Historique</span>
            {history
              .filter((h) => h.at)
              .map((h) => (
                <div key={h.label} className="flex justify-between gap-3">
                  <span>{h.label}</span>
                  <span className="text-[#4A443C]">{fmtDate(h.at, DATE_SHORT)}</span>
                </div>
              ))}
            <div className="flex items-center justify-between gap-3">
              <span>Statut actuel</span>
              <StatusPill status={order.status} />
            </div>
          </div>

          {/* Annulation */}
          {!final ? (
            confirmCancel ? (
              <div role="alert" className="flex flex-col gap-2 rounded-[18px] border border-[#9A3412] p-4 text-sm">
                <span>
                  Annuler {order.number} et remettre les articles en stock ? Cette action est définitive.
                  {order.paid ? " La commande est déjà payée : pensez à rembourser le client." : ""}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => run(() => setOrderStatusAction({ orderId: order.id, to: "annulee" }), "Commande annulée.", () => setConfirmCancel(false))}
                    className={btnDanger}
                  >
                    Oui, annuler la commande
                  </button>
                  <button type="button" onClick={() => setConfirmCancel(false)} className={btnLine}>
                    Non, la garder
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={disabled}
                onClick={() => setConfirmCancel(true)}
                className={`${btnDanger} self-start`}
              >
                Annuler la commande et remettre en stock
              </button>
            )
          ) : null}
        </div>
      </aside>
      {toast}
    </div>
  );
}
