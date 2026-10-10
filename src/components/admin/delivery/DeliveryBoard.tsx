"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { assignCourierAction, setOrderStatusAction } from "@/app/admin/(panel)/commandes/actions";
import type { DeliveryBoard as Board, DeliveryOrder, ZoneFilter } from "@/lib/orders/delivery";
import { ZONE_FILTERS } from "@/lib/orders/delivery";
import {
  DATE_SHORT,
  PAY_LABEL,
  ZONE_SHORT,
  codDue,
  fmtDate,
  fmtXof,
  plural,
  prettyPhone,
  telLink,
} from "@/lib/orders/format";
import { STATUS_META } from "@/lib/orders/status";
import type { Courier } from "@/lib/orders/types";
import type { ShippingSettings } from "@/lib/catalog";
import { EmptyBox, PayPill, StatusPill, btnDark, btnLeaf, btnLine, btnLinkText } from "../orders/ui";
import { useAdminAction } from "../orders/useAdminAction";
import { CourierManager } from "./CourierManager";

const chipCls = (on: boolean) =>
  `inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium no-underline ${
    on
      ? "border-[#141210] bg-[#141210] text-[#F4F1EA] hover:text-[#F4F1EA]"
      : "border-[#D6CFC0] bg-transparent text-[#141210] hover:text-[#141210]"
  }`;

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[20px] bg-white px-5 py-[18px]">
      <span className="text-[13px] text-[#4A443C]">{label}</span>
      <strong className="font-display text-[26px] font-semibold tracking-[-0.03em]">{value}</strong>
      <span className="text-[13px] text-[#4A443C]">{sub}</span>
    </div>
  );
}

function payLabel(o: DeliveryOrder): { due: boolean; text: string } {
  const due = codDue(o) > 0;
  return due ? { due, text: `À encaisser ${fmtXof(o.total)}` } : { due, text: `Payée · ${PAY_LABEL[o.pay]}` };
}

type RowProps = { o: DeliveryOrder; openHref: string };

function AddressLine({ o }: { o: DeliveryOrder }) {
  return (
    <span className="text-[13px] leading-[1.45] text-[#4A443C]">
      {ZONE_SHORT[o.zone]} · {o.address} ·{" "}
      <a href={telLink(o.phone)} className="text-[#141210]">
        {prettyPhone(o.phone)}
      </a>
    </span>
  );
}

function ToShipRow({
  o,
  openHref,
  couriers,
  connected,
}: RowProps & { couriers: Courier[]; connected: boolean }) {
  const { run, pending, toast } = useAdminAction();
  const p = payLabel(o);
  const disabled = pending || !connected;
  const options = couriers.filter((c) => c.active || c.id === o.courierId);
  return (
    <div className="flex flex-col gap-2 border-t border-[#F0EBE1] pt-3">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <Link href={openHref} scroll={false} className="text-sm font-bold text-[#141210] underline underline-offset-[3px]">
          {o.number}
        </Link>
        <span className="text-sm">{o.name}</span>
        <StatusPill status={o.status} />
        <span className="ml-auto">
          <PayPill due={p.due} label={p.text} />
        </span>
      </div>
      <AddressLine o={o} />
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={o.courierId ?? ""}
          disabled={disabled}
          onChange={(e) =>
            run(() => assignCourierAction({ orderId: o.id, courierId: e.target.value || null }), "Livreur mis à jour.")
          }
          aria-label={`Livreur de ${o.number}`}
          className="min-h-11 min-w-0 flex-[1_1_180px] cursor-pointer rounded-full border border-[#D6CFC0] bg-white px-3 text-[13px]"
        >
          <option value="">Choisir un livreur</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.zone === "autre" ? "autres villes" : "Cotonou"}
            </option>
          ))}
        </select>
        {o.status === "nouvelle" ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => run(() => setOrderStatusAction({ orderId: o.id, to: "preparation" }), `${o.number} : ${STATUS_META.preparation.label}`)}
            className={`${btnDark} min-h-11`}
          >
            Passer en préparation
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => run(() => setOrderStatusAction({ orderId: o.id, to: "livraison" }), `${o.number} remise au livreur.`)}
            className={`${btnDark} min-h-11`}
          >
            Remettre au livreur
          </button>
        )}
      </div>
      {toast}
    </div>
  );
}

function OnRoadRow({ o, openHref, connected }: RowProps & { connected: boolean }) {
  const { run, pending, toast } = useAdminAction();
  const p = payLabel(o);
  const disabled = pending || !connected;
  return (
    <div className="flex flex-col gap-2 border-t border-[#F0EBE1] pt-3">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <Link href={openHref} scroll={false} className="text-sm font-bold text-[#141210] underline underline-offset-[3px]">
          {o.number}
        </Link>
        <span className="text-sm">{o.name}</span>
        <span className="rounded-full bg-[#DDEBF7] px-[9px] py-[3px] text-[11px] font-semibold text-[#1D4F7A]">{o.courierName}</span>
        <span className="ml-auto">
          <PayPill due={p.due} label={p.text} />
        </span>
      </div>
      <AddressLine o={o} />
      <span className="text-xs text-[#4A443C]">En route</span>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => run(() => setOrderStatusAction({ orderId: o.id, to: "livree" }), `${o.number} : livrée.`)}
          className={`${btnLeaf} min-h-11`}
        >
          Marquer livrée
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => run(() => setOrderStatusAction({ orderId: o.id, to: "preparation" }), `${o.number} : livraison à reprogrammer.`)}
          className={`${btnLine} min-h-11`}
        >
          Échec, à reprogrammer
        </button>
        <a href={o.waHref} target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium text-[#141210]">
          Prévenir le client
        </a>
      </div>
      {toast}
    </div>
  );
}

type Props = {
  board: Board;
  fees: ShippingSettings;
  zone: ZoneFilter;
  connected: boolean;
  todayLabel: string;
};

/** Onglet Livraisons (maquette lignes 181-261). */
export function DeliveryBoard({ board, fees, zone, connected, todayLabel }: Props) {
  const pathname = usePathname() ?? "/admin/livraisons";
  const k = board.kpis;
  const zq = (z: ZoneFilter) => (z === "all" ? "" : `zone=${z}`);
  const open = (n: string) => {
    const q = [zq(zone), `commande=${encodeURIComponent(n)}`].filter(Boolean).join("&");
    return `${pathname}?${q}`;
  };
  const couriers: Courier[] = board.couriers;

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
        <Kpi
          label="À expédier"
          value={String(k.toShip)}
          sub={plural(k.toShipNew, "nouvelle à confirmer", "nouvelles à confirmer")}
        />
        <Kpi label="En route" value={String(k.onRoad)} sub={plural(k.couriersOut, "livreur sorti", "livreurs sortis")} />
        <Kpi
          label="Livrées aujourd'hui"
          value={String(k.deliveredToday)}
          sub={todayLabel}
        />
        <Kpi label="À encaisser par les livreurs" value={fmtXof(k.codDue)} sub="Paiement à la livraison en cours" />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <nav aria-label="Zone de livraison" className="flex flex-wrap gap-1.5">
          {ZONE_FILTERS.map((z) => (
            <Link
              key={z.id}
              href={z.id === "all" ? pathname : `${pathname}?zone=${z.id}`}
              aria-current={zone === z.id ? "true" : undefined}
              className={chipCls(zone === z.id)}
            >
              {z.label}
              <span className="text-xs opacity-65">{board.zoneCounts[z.id]}</span>
            </Link>
          ))}
        </nav>
        <span className="ml-auto flex flex-wrap items-center gap-2 text-[13px] text-[#4A443C]">
          Tarifs : Cotonou &amp; Calavi {fmtXof(fees.cotonou)} · autres villes {fmtXof(fees.autre)} · offerte dès{" "}
          {fmtXof(fees.freeFrom)}
          <Link href="/admin/reglages" className={btnLinkText}>
            Modifier
          </Link>
          <a href="/admin/livraisons/export" download className={btnLinkText}>
            Exporter en CSV
          </a>
        </span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] items-start gap-5">
        <section className="flex flex-col gap-3 rounded-[22px] bg-white p-5" aria-label="À expédier">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="m-0 text-[17px]">À expédier</h2>
            <span className="text-[13px] text-[#4A443C]">{plural(board.toShip.length, "commande", "commandes")}</span>
          </div>
          {board.toShip.length === 0 ? <span className="text-sm text-[#4A443C]">Rien à expédier dans cette zone.</span> : null}
          {board.toShip.map((o) => (
            <ToShipRow key={o.id} o={o} openHref={open(o.number)} couriers={couriers} connected={connected} />
          ))}
        </section>
        <section className="flex flex-col gap-3 rounded-[22px] bg-white p-5" aria-label="En cours de livraison">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="m-0 text-[17px]">En cours de livraison</h2>
            <span className="text-[13px] text-[#4A443C]">{plural(board.onRoad.length, "commande", "commandes")}</span>
          </div>
          {board.onRoad.length === 0 ? <span className="text-sm text-[#4A443C]">Aucune commande en route.</span> : null}
          {board.onRoad.map((o) => (
            <OnRoadRow key={o.id} o={o} openHref={open(o.number)} connected={connected} />
          ))}
        </section>
      </div>

      <CourierManager couriers={board.couriers} connected={connected} />

      <section className="flex flex-col gap-1 rounded-[22px] bg-white p-5" aria-label="Livrées récemment">
        <h2 className="m-0 mb-2 text-[17px]">Livrées récemment</h2>
        {board.delivered.length === 0 ? <EmptyBox>Aucune livraison récente.</EmptyBox> : null}
        {board.delivered.map((o) => (
          <div key={o.id} className="flex flex-wrap items-center gap-x-3.5 gap-y-1 border-t border-[#F0EBE1] py-2.5 text-sm">
            <Link href={open(o.number)} scroll={false} className="min-w-[86px] font-bold text-[#141210] no-underline hover:underline">
              {o.number}
            </Link>
            <span className="min-w-0 flex-[1_1_160px]">{o.name}</span>
            <span className="text-[13px] text-[#4A443C]">{o.courierName}</span>
            <span className="min-w-[120px] text-right text-[13px] text-[#4A443C]">
              {fmtDate(o.deliveredAt ?? o.createdAt, DATE_SHORT)}
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
