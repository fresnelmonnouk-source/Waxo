"use client";

import { useState, useTransition } from "react";
import { deleteSubscriberAction } from "@/app/admin/(panel)/newsletter/actions";
import type { Subscriber } from "@/lib/admin/data/newsletter";
import { fmtDateLong } from "@/lib/settings/format";
import { prettyPhone } from "@/lib/settings/phone";
import { btnDark, btnLink, DemoBanner, EmptyBox, useToast } from "../settings/ui";

export function NewsletterBoard({
  rows,
  counts,
  connected,
  truncated,
}: {
  rows: Subscriber[];
  counts: { email: number; whatsapp: number };
  connected: boolean;
  truncated: boolean;
}) {
  const { show, node } = useToast();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  function unsubscribe(s: Subscriber) {
    if (!window.confirm("Désinscrire ce contact ? Il ne recevra plus vos messages.")) return;
    setBusyId(s.id);
    startTransition(async () => {
      try {
        const res = await deleteSubscriberAction(s.id);
        if (res.ok) {
          setRemoved((r) => new Set(r).add(s.id));
          show("Contact désinscrit.");
        } else show(res.message);
      } catch {
        show("Une erreur est survenue. Réessayez.");
      } finally {
        setBusyId(null);
      }
    });
  }

  const visible = rows.filter((r) => !removed.has(r.id));
  const dec = (channel: "email" | "whatsapp") => rows.filter((r) => removed.has(r.id) && r.channel === channel).length;

  return (
    <div className="flex flex-col gap-5">
      <DemoBanner connected={connected} />
      <div className="flex justify-end">
        <a href="/admin/newsletter/export" download className={`${btnDark} px-5 min-h-[46px]`}>
          Exporter en CSV
        </a>
      </div>
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
        <div className="bg-white rounded-[20px] px-5 py-[18px] flex flex-col gap-1.5">
          <span className="text-[13px] text-text">Par e-mail</span>
          <strong className="font-display font-semibold text-[26px]">{Math.max(0, counts.email - dec("email")).toLocaleString("fr-FR")}</strong>
        </div>
        <div className="bg-white rounded-[20px] px-5 py-[18px] flex flex-col gap-1.5">
          <span className="text-[13px] text-text">Par WhatsApp</span>
          <strong className="font-display font-semibold text-[26px]">{Math.max(0, counts.whatsapp - dec("whatsapp")).toLocaleString("fr-FR")}</strong>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {visible.length === 0 ? <EmptyBox>Aucun abonné.</EmptyBox> : null}
        {visible.map((s) => (
          <div key={s.id} className="bg-white border border-[#E2DCCF] rounded-[14px] px-4 py-2.5 flex items-center gap-3.5 flex-wrap">
            <span
              className="rounded-full px-2.5 py-[3px] text-[12px] font-semibold min-w-[78px] text-center"
              style={{ background: s.channel === "email" ? "#DDEBF7" : "#E5EFE7", color: s.channel === "email" ? "#1D4F7A" : "#1F6B4A" }}
            >
              {s.channel === "email" ? "E-mail" : "WhatsApp"}
            </span>
            <span className="flex-[1_1_200px] text-[14px] min-w-0 [overflow-wrap:anywhere]">{s.channel === "email" ? s.value : "+229 " + prettyPhone(s.value)}</span>
            <span className="text-[13px] text-text">{fmtDateLong(s.createdAt)}</span>
            <button
              type="button"
              disabled={pending && busyId === s.id}
              onClick={() => unsubscribe(s)}
              className={`${btnLink} text-[13px] min-h-[44px] px-2`}
            >
              Désinscrire
            </button>
          </div>
        ))}
        {truncated ? <p className="text-[13px] text-text m-0">Les 200 inscriptions les plus récentes sont affichées ; l&apos;export CSV contient tous les abonnés.</p> : null}
      </div>
      {node}
    </div>
  );
}
