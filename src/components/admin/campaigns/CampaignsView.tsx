"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCampaign, setCampaignActive } from "@/app/admin/(panel)/campagnes/actions";
import type { AdminCampaign, CampaignsData } from "@/lib/admin/data/campaigns";
import { campaignStatus, type CampaignStatus } from "@/lib/campaigns/logic";
import { fmtXof } from "@/lib/money";
import { SourceNotice, useToast } from "../products/ui";
import { formatCampaignRange, showsStats, STATUS_LABEL } from "./helpers";
import { CampaignDrawer } from "./CampaignDrawer";

const PILL: Record<CampaignStatus, { background: string; color: string }> = {
  running: { background: "#E5EFE7", color: "#1F6B4A" },
  upcoming: { background: "#FFC93C", color: "#141210" },
  ended: { background: "#E2DCCF", color: "#4A443C" },
  off: { background: "#E2DCCF", color: "#4A443C" },
};

function StatusPill({ status }: { status: CampaignStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status === "off" ? "line-through" : ""}`} style={PILL[status]}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Liste des campagnes (en cours, à venir, terminées) avec leurs ventes, et tiroir de création / modification. */
export function CampaignsView({ data }: { data: CampaignsData }) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ campaign: AdminCampaign | null } | null>(null);
  const [activeOver, setActiveOver] = useState<Record<string, boolean>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [delError, setDelError] = useState("");
  const [pending, start] = useTransition();
  const [toast, show] = useToast();
  const [now] = useState(() => Date.now());

  const toggle = (c: AdminCampaign) => {
    const on = activeOver[c.id] ?? c.active;
    setActiveOver((s) => ({ ...s, [c.id]: !on }));
    start(async () => {
      const res = await setCampaignActive(c.id, !on);
      if (res.ok) {
        show(on ? "Campagne désactivée : prix normaux rétablis." : "Campagne réactivée.");
        router.refresh();
      } else {
        setActiveOver((s) => {
          const next = { ...s };
          delete next[c.id];
          return next;
        });
        show(res.message);
      }
    });
  };

  const remove = (c: AdminCampaign) => {
    setDelError("");
    start(async () => {
      const res = await deleteCampaign(c.id);
      if (res.ok) {
        setConfirmId(null);
        show("Campagne supprimée.");
        router.refresh();
      } else setDelError(res.message);
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {data.source === "error" && data.message ? (
        <div role="alert" className="rounded-[14px] bg-[#F6E1DA] px-3.5 py-2.5 text-[13px] leading-[1.45] text-[#9A3412]">
          {data.message}
        </div>
      ) : (
        <SourceNotice source={data.source} truncated={data.truncated} noun="campagnes" />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="max-w-[560px] text-sm text-[#4A443C]">
          Pendant ses dates, une campagne active vend ses produits au prix de campagne ; le prix normal s&apos;affiche barré. À la fin, les
          prix normaux reviennent tout seuls.
        </span>
        <button
          type="button"
          onClick={() => setEditing({ campaign: null })}
          disabled={data.source === "error"}
          className="min-h-[46px] cursor-pointer rounded-full border-0 bg-[#141210] px-5 font-semibold text-[#F4F1EA] hover:bg-[#2C2823] disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Créer une campagne
        </button>
      </div>

      <div className="flex flex-col gap-3" role="list">
        {data.campaigns.length === 0 && data.source !== "error" && (
          <p className="m-0 rounded-2xl border border-dashed border-[#D6CFC0] bg-white p-5 text-sm text-[#4A443C]">
            Aucune campagne pour l&apos;instant. Créez votre première campagne (Black Friday, Noël, Tabaski…) : les prix changent tout seuls aux
            dates choisies.
          </p>
        )}
        {data.campaigns.map((c) => {
          const active = activeOver[c.id] ?? c.active;
          const status = campaignStatus({ ...c, active }, now);
          const stats = showsStats(status, c.stats);
          return (
            <article key={c.id} role="listitem" className="flex flex-col gap-3 rounded-[22px] border border-[#E2DCCF] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="m-0 text-[17px] font-bold">{c.nameFr}</h2>
                    <StatusPill status={status} />
                  </div>
                  <span className="text-[13px] text-[#4A443C]">{formatCampaignRange(c.startsAt, c.endsAt)} (heure du Bénin)</span>
                  <span className="text-[13px] text-[#4A443C]">
                    {c.items.length} produit{c.items.length > 1 ? "s" : ""} en promotion · /campagne/{c.slug}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={active}
                    aria-label={`Campagne active : ${c.nameFr}`}
                    onClick={() => toggle(c)}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-0 bg-transparent px-1 text-[13px] font-semibold"
                  >
                    <span aria-hidden="true" className="relative h-[26px] w-11 flex-none rounded-full transition-colors duration-200" style={{ background: active ? "#1F6B4A" : "#C9C1B2" }}>
                      <span className="absolute top-[3px] h-5 w-5 rounded-full bg-white transition-[left] duration-200" style={{ left: active ? 21 : 3 }} />
                    </span>
                    {active ? "Active" : "Inactive"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing({ campaign: c })}
                    className="min-h-11 cursor-pointer rounded-full border border-[#D6CFC0] bg-transparent px-3.5 text-[13px] hover:bg-[#F4F1EA]"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmId(c.id);
                      setDelError("");
                    }}
                    className="min-h-11 cursor-pointer rounded-full border-0 bg-transparent px-2 text-[13px] text-[#9A3412] underline underline-offset-[3px]"
                  >
                    Supprimer
                  </button>
                </div>
              </div>

              {stats && (
                <div className="flex flex-col gap-2.5 rounded-2xl bg-[#F4F1EA] p-3.5">
                  <dl className="m-0 grid grid-cols-3 gap-2 text-sm">
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-xs text-[#4A443C]">Commandes</dt>
                      <dd className="m-0 font-bold">{c.stats.orders.toLocaleString("fr-FR")}</dd>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-xs text-[#4A443C]">Articles vendus</dt>
                      <dd className="m-0 font-bold">{c.stats.units.toLocaleString("fr-FR")}</dd>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-xs text-[#4A443C]">Chiffre d&apos;affaires</dt>
                      <dd className="m-0 font-bold">{fmtXof(c.stats.revenue)}</dd>
                    </div>
                  </dl>
                  {c.stats.top.length > 0 ? (
                    <div className="flex flex-col gap-1 text-[13px]">
                      <span className="text-xs font-semibold text-[#4A443C]">Meilleures ventes</span>
                      <ol className="m-0 flex list-none flex-col gap-1 p-0">
                        {c.stats.top.slice(0, 3).map((t, i) => (
                          <li key={`${t.name}-${i}`} className="flex justify-between gap-3">
                            <span className="min-w-0 truncate">
                              {i + 1}. {t.name}
                            </span>
                            <span className="flex-none text-[#4A443C]">
                              {t.units} vendu{t.units > 1 ? "s" : ""} · {fmtXof(t.revenue)}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : (
                    <span className="text-[13px] text-[#4A443C]">Aucune vente au prix de campagne pour l&apos;instant.</span>
                  )}
                </div>
              )}

              {confirmId === c.id && (
                <div className="flex flex-col gap-2.5 rounded-2xl bg-[#F6E1DA] p-3.5">
                  <span className="text-sm leading-[1.45] text-[#141210]">
                    Supprimer définitivement « {c.nameFr} » ? Les produits ne sont pas touchés. Pour l&apos;arrêter sans la perdre, désactivez-la
                    plutôt.
                  </span>
                  {delError && (
                    <span role="alert" className="text-sm font-medium text-[#9A3412]">
                      {delError}
                    </span>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => remove(c)}
                      disabled={pending}
                      className="min-h-11 cursor-pointer rounded-full border-0 bg-[#9A3412] px-4 font-semibold text-white disabled:opacity-60"
                    >
                      {pending ? "Suppression…" : "Supprimer"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmId(null);
                        setDelError("");
                      }}
                      className="min-h-11 cursor-pointer rounded-full border border-[#D6CFC0] bg-white px-4"
                    >
                      Garder
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {editing && (
        <CampaignDrawer
          key={editing.campaign?.id ?? "new"}
          campaign={editing.campaign}
          products={data.products}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            setActiveOver({});
            show(message);
            router.refresh();
          }}
        />
      )}
      {toast}
    </div>
  );
}
