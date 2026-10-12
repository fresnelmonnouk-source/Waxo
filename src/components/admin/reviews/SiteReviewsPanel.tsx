"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addSiteReviewAction, deleteSiteReviewAction, setSiteReviewStatusAction } from "@/app/admin/(panel)/avis/site-actions";
import type { AdminSiteReviewsData } from "@/lib/admin/data/site-reviews";
import { borderOf, btnDark, btnLine, btnLink, cardCls, errCls, fieldCls, labelCls, useToast } from "../settings/ui";

const ORIGINS = ["WhatsApp", "Facebook", "Instagram", "E-mail", "Téléphone", "En personne"] as const;
const STATUS_LABEL = { pending: "À valider", published: "Publié", hidden: "Masqué" } as const;
const STATUS_STYLE = {
  pending: { background: "#FBEFC9", color: "#7A5A00" },
  published: { background: "#E5EFE7", color: "#1F6B4A" },
  hidden: { background: "#EEE9DE", color: "#4A443C" },
} as const;

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Porto-Novo" });

/** Avis sur la boutique : validation des avis clients + saisie d'un avis reçu ailleurs (avec l'accord du client). */
export function SiteReviewsPanel({ data }: { data: AdminSiteReviewsData }) {
  const router = useRouter();
  const { show, node } = useToast();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ author: "", city: "", rating: 5, body: "", origin: "WhatsApp" as (typeof ORIGINS)[number], consent: false, publish: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const toValidate = data.rows.filter((r) => r.status === "pending").length;
  const published = data.rows.filter((r) => r.status === "published").length;

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, done: string) =>
    start(async () => {
      const res = await fn();
      show(res.ok ? done : (res.message ?? "Une erreur est survenue."));
      if (res.ok) router.refresh();
    });

  const submit = () => {
    if (!form.consent) return setErrors({ consent: "Sans l'accord du client, l'avis ne peut pas être publié." });
    setErrors({});
    start(async () => {
      const res = await addSiteReviewAction(form);
      if (res.ok) {
        show(form.publish ? "Avis publié sur l'accueil." : "Avis ajouté, à valider.");
        setForm({ author: "", city: "", rating: 5, body: "", origin: "WhatsApp", consent: false, publish: true });
        setOpen(false);
        router.refresh();
      } else {
        setErrors({ ...(res as { fieldErrors?: Record<string, string> }).fieldErrors, form: (res as { message?: string }).message ?? "" });
      }
    });
  };

  return (
    <section className={`${cardCls} gap-3`} aria-labelledby="site-reviews-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="site-reviews-title" className="m-0 text-[17px] font-bold">
            Avis sur la boutique
          </h2>
          <p className="m-0 mt-1 text-[13px] text-text">
            Affichés sur l&apos;accueil, juste avant la newsletter, à partir de 3 avis publiés. {published} publié{published > 1 ? "s" : ""}
            {toValidate ? ` · ${toValidate} à valider` : ""}.
          </p>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} className={`${btnDark} min-h-[44px] px-4 text-[14px]`} disabled={!data.connected || data.missing}>
          {open ? "Fermer" : "+ Ajouter un avis reçu"}
        </button>
      </div>

      {data.missing ? (
        <p role="alert" className="m-0 rounded-xl bg-[#FDF0E6] p-3 text-[13px]">
          Appliquez la migration 0018_site_reviews.sql dans Supabase pour activer les avis sur la boutique.
        </p>
      ) : null}

      {open ? (
        <form
          className="flex flex-col gap-3 rounded-2xl border border-[#E2DCCF] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <p className="m-0 rounded-xl bg-[#FBEFC9] px-3 py-2 text-[13px]">
            Saisissez uniquement un avis réellement envoyé par un client (WhatsApp, Facebook…), avec son accord pour le publier. Inventer un avis est interdit.
          </p>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
            <label className={labelCls}>
              Nom affiché
              <input value={form.author} maxLength={60} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="Ex. Afi H." className={`${fieldCls} ${borderOf(errors.author)}`} />
              {errors.author ? <span className={errCls}>{errors.author}</span> : null}
            </label>
            <label className={labelCls}>
              Ville (facultatif)
              <input value={form.city} maxLength={40} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Ex. Cotonou" className={`${fieldCls} ${borderOf()}`} />
            </label>
            <label className={labelCls}>
              Note
              <select value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })} className={`${fieldCls} ${borderOf()}`}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} sur 5
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              Reçu par
              <select value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value as (typeof ORIGINS)[number] })} className={`${fieldCls} ${borderOf()}`}>
                {ORIGINS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
          </div>
          <label className={labelCls}>
            Avis du client (tel qu&apos;il l&apos;a écrit)
            <textarea value={form.body} maxLength={600} rows={3} onChange={(e) => setForm({ ...form, body: e.target.value })} className={`${fieldCls} ${borderOf(errors.body)}`} />
            {errors.body ? <span className={errCls}>{errors.body}</span> : null}
          </label>
          <label className="flex min-h-[44px] cursor-pointer items-start gap-2 text-[14px]">
            <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} className="mt-1 h-5 w-5" />
            <span>Le client m&apos;a donné son accord pour publier cet avis sur le site.</span>
          </label>
          {errors.consent ? <span className={errCls}>{errors.consent}</span> : null}
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-[14px]">
            <input type="checkbox" checked={form.publish} onChange={(e) => setForm({ ...form, publish: e.target.checked })} className="h-5 w-5" />
            <span>Publier tout de suite</span>
          </label>
          {errors.form ? <span className={errCls}>{errors.form}</span> : null}
          <div>
            <button type="submit" disabled={pending} className={`${btnDark} min-h-[46px] px-5`}>
              {pending ? "Patientez…" : "Enregistrer l'avis"}
            </button>
          </div>
        </form>
      ) : null}

      {data.rows.length === 0 && !data.missing ? (
        <p className="m-0 text-[14px] text-text">Aucun avis sur la boutique pour l&apos;instant.</p>
      ) : null}

      <ul className="m-0 flex list-none flex-col p-0">
        {data.rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 border-t border-[#EEE9DE] py-3 first:border-t-0">
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold" style={STATUS_STYLE[r.status]}>
                {STATUS_LABEL[r.status]}
              </span>
              <strong className="text-[14px]">{r.author}</strong>
              {r.city ? <span className="text-text">· {r.city}</span> : null}
              <span aria-label={`${r.rating} sur 5`}>{"★".repeat(r.rating) + "☆".repeat(5 - r.rating)}</span>
              <span className="text-text">
                · {r.source === "client" ? (r.verified ? "Client vérifié (commande livrée)" : "Client") : `Saisi par l'admin (${r.origin ?? "reçu ailleurs"})`} · {fmt(r.createdAt)}
              </span>
            </div>
            <p className="m-0 text-[14px] leading-normal">{r.body}</p>
            <div className="flex flex-wrap gap-2">
              {r.status !== "published" ? (
                <button type="button" disabled={pending} onClick={() => run(() => setSiteReviewStatusAction(r.id, "published"), "Avis publié.")} className={`${btnDark} min-h-[40px] px-4 text-[13px]`}>
                  Publier
                </button>
              ) : null}
              {r.status !== "hidden" ? (
                <button type="button" disabled={pending} onClick={() => run(() => setSiteReviewStatusAction(r.id, "hidden"), "Avis masqué.")} className={`${btnLine} min-h-[40px] px-4 text-[13px]`}>
                  Masquer
                </button>
              ) : null}
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (window.confirm(`Supprimer définitivement l'avis de ${r.author} ?`)) run(() => deleteSiteReviewAction(r.id), "Avis supprimé.");
                }}
                className={`${btnLink} min-h-[40px] px-2 text-[13px]`}
              >
                Supprimer
              </button>
            </div>
          </li>
        ))}
      </ul>
      {node}
    </section>
  );
}
