"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteReviewAction, setReviewHiddenAction } from "@/app/admin/(panel)/avis/actions";
import type { AdminReview, ReviewView } from "@/lib/admin/data/reviews";
import { fmtDateLong } from "@/lib/settings/format";
import { btnLine, btnLink, DemoBanner, EmptyBox, useToast } from "../settings/ui";

const CHIPS: { id: ReviewView; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "published", label: "Publiés" },
  { id: "hidden", label: "Masqués" },
];

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-px" role="img" aria-label={`${rating} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2.6l2.8 6 6.6.6-5 4.5 1.5 6.5L12 16.9l-5.9 3.3 1.5-6.5-5-4.5 6.6-.6z" fill={i <= Math.round(rating) ? "#141210" : "#D6CFC0"} />
        </svg>
      ))}
    </span>
  );
}

export function ReviewsBoard({
  rows,
  counts,
  view,
  truncated,
  connected,
}: {
  rows: AdminReview[];
  counts: { all: number; published: number; hidden: number };
  view: ReviewView;
  truncated: boolean;
  connected: boolean;
}) {
  const { show, node } = useToast();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function run(id: string, work: () => Promise<{ ok: boolean; message?: string }>, success: string) {
    setBusyId(id);
    startTransition(async () => {
      try {
        const res = await work();
        show(res.ok ? success : (res.message ?? "Une erreur est survenue."));
      } catch {
        show("Une erreur est survenue. Réessayez.");
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <DemoBanner connected={connected} />
      <nav aria-label="Filtrer les avis" className="flex gap-1.5 flex-wrap">
        {CHIPS.map((c) => {
          const active = view === c.id;
          return (
            <Link
              key={c.id}
              href={c.id === "all" ? "/admin/avis" : `/admin/avis?vue=${c.id}`}
              aria-current={active ? "page" : undefined}
              className="rounded-full px-3.5 min-h-[44px] text-[13px] font-medium flex gap-1.5 items-center border no-underline hover:text-inherit"
              style={{ borderColor: active ? "#141210" : "#D6CFC0", background: active ? "#141210" : "transparent", color: active ? "#F4F1EA" : "#141210" }}
            >
              {c.label}
              <span className="opacity-65 text-[12px]">{counts[c.id].toLocaleString("fr-FR")}</span>
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-col gap-2">
        {rows.length === 0 ? <EmptyBox>Aucun avis dans cette vue.</EmptyBox> : null}
        {rows.map((r) => {
          const busy = pending && busyId === r.id;
          return (
            <article key={r.id} className="bg-white border border-[#E2DCCF] rounded-2xl px-4 py-3.5 flex flex-col gap-2" aria-busy={busy}>
              <div className="flex items-center gap-x-3 gap-y-2 flex-wrap text-[13px]">
                <Stars rating={r.rating} />
                <strong className="text-[14px]">{r.author}</strong>
                <span className="text-text">sur {r.productName}</span>
                {r.verified ? <span className="bg-[#E5EFE7] text-[#1F6B4A] rounded-full px-2 py-0.5 text-[11px] font-semibold">Achat vérifié</span> : null}
                {!r.seed ? <span className="bg-[#FBEFC9] rounded-full px-2 py-0.5 text-[11px] font-semibold">Publié depuis le site</span> : null}
                <span className="text-text">{fmtDateLong(r.createdAt)}</span>
                <span
                  className="ml-auto rounded-full px-2.5 py-[3px] text-[12px] font-semibold"
                  style={{ background: r.hidden ? "#F6E1DA" : "#E5EFE7", color: r.hidden ? "#9A3412" : "#1F6B4A" }}
                >
                  {r.hidden ? "Masqué" : "Publié"}
                </span>
              </div>
              <p className="m-0 text-[14px] leading-normal whitespace-pre-line break-words">{r.body}</p>
              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(r.id, () => setReviewHiddenAction(r.id, !r.hidden), r.hidden ? "Avis publié." : "Avis masqué.")}
                  className={`${btnLine} px-3.5 min-h-[44px] text-[13px]`}
                >
                  {r.hidden ? "Publier" : "Masquer"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Supprimer définitivement l'avis de ${r.author} ?`)) run(r.id, () => deleteReviewAction(r.id), "Avis supprimé.");
                  }}
                  className={`${btnLink} text-[13px] min-h-[44px] px-2`}
                >
                  Supprimer
                </button>
              </div>
            </article>
          );
        })}
        {truncated ? <p className="text-[13px] text-text m-0">Les 200 avis les plus récents sont affichés.</p> : null}
      </div>
      {node}
    </div>
  );
}
