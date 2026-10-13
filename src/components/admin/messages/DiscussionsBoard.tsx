"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addNoteAction,
  draftReplyAction,
  issueLinkAction,
  replyAction,
  setCategoryAction,
  setStatusAction,
  type ReplyOutcome,
} from "@/app/admin/(panel)/messages/actions";
import type { AdminThread, InboxData, InboxFilters, InboxRow } from "@/lib/conversations/admin-data";
import { CATEGORIES, CATEGORY_LABELS, SOURCE_LABELS, STATUS_LABELS, STATUSES, type Category, type Status } from "@/lib/conversations/types";
import { fmtDateShort } from "@/lib/settings/format";
import { btnDark, btnLine, DemoBanner, EmptyBox, FilterChip, fieldSmCls, useToast } from "../settings/ui";

const STATUS_STYLE: Record<Status, { bg: string; fg: string }> = {
  nouveau: { bg: "#FFF4D6", fg: "#8A5A00" },
  en_cours: { bg: "#E8EEF8", fg: "#1E3A6B" },
  resolu: { bg: "#E5EFE7", fg: "#1F6B4A" },
};

const OUTCOME_TEXT: Record<ReplyOutcome, string> = {
  sent: "Réponse envoyée. Le client est prévenu par e-mail avec son lien privé.",
  no_email: "Réponse enregistrée. Ce client n'a pas d'e-mail : copiez le lien privé et envoyez-le-lui sur WhatsApp.",
  no_site: "Réponse enregistrée. E-mail non envoyé : adresse publique du site inconnue (NEXT_PUBLIC_SITE_URL).",
  not_configured: "Réponse enregistrée. E-mail non envoyé : l'envoi d'e-mails n'est pas configuré (RESEND_API_KEY).",
};

function href(filters: InboxFilters, patch: Partial<InboxFilters> & { c?: string | null }): string {
  const f = { ...filters, ...patch };
  const q = new URLSearchParams();
  if (f.status !== "all") q.set("statut", f.status);
  if (f.category !== "all") q.set("categorie", f.category);
  if (patch.c) q.set("c", patch.c);
  const s = q.toString();
  return `/admin/messages${s ? `?${s}` : ""}`;
}

function StatusBadge({ status }: { status: Status }) {
  const st = STATUS_STYLE[status];
  return (
    <span className="rounded-full px-2.5 py-[3px] text-[12px] font-semibold whitespace-nowrap" style={{ background: st.bg, color: st.fg }}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function DiscussionsBoard({ inbox, filters, thread }: { inbox: InboxData; filters: InboxFilters; thread: AdminThread | null }) {
  const router = useRouter();
  const statusChips: { id: InboxFilters["status"]; label: string; count: number }[] = [
    { id: "all", label: "Toutes", count: inbox.counts.all },
    { id: "todo", label: "À traiter", count: inbox.counts.todo },
    ...STATUSES.map((s) => ({ id: s, label: STATUS_LABELS[s], count: inbox.counts[s] })),
  ];

  return (
    <div className="flex flex-col gap-5">
      <DemoBanner connected={inbox.connected} />
      <div className="flex flex-col gap-3">
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Filtrer par statut">
          {statusChips.map((c) => (
            <FilterChip key={c.id} active={filters.status === c.id} label={c.label} count={c.count} onClick={() => router.push(href(filters, { status: c.id }))} />
          ))}
        </div>
        <label className="flex items-center gap-2 text-[13px] text-text max-w-[320px]">
          Catégorie
          <select
            value={filters.category}
            onChange={(e) => router.push(href(filters, { category: e.target.value as InboxFilters["category"] }))}
            className={`${fieldSmCls} min-h-[44px]`}
          >
            <option value="all">Toutes</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,380px)_1fr] items-start">
        <nav aria-label="Discussions" className={`flex flex-col gap-2 ${thread ? "max-lg:hidden" : ""}`}>
          {inbox.rows.length === 0 ? <EmptyBox>Aucune discussion.</EmptyBox> : null}
          {inbox.rows.map((r) => (
            <InboxItem key={r.id} row={r} active={thread?.id === r.id} unread={r.unread && thread?.id !== r.id} to={href(filters, { c: r.id })} />
          ))}
          {inbox.truncated ? <p className="text-[13px] text-text m-0">Les 200 discussions les plus récentes sont affichées.</p> : null}
        </nav>
        {thread ? (
          <ThreadPanel key={thread.id} thread={thread} connected={inbox.connected} back={href(filters, { c: null })} />
        ) : (
          <div className="max-lg:hidden">
            <EmptyBox>Choisissez une discussion pour lire le fil et répondre.</EmptyBox>
          </div>
        )}
      </div>
    </div>
  );
}

function InboxItem({ row, active, unread, to }: { row: InboxRow; active: boolean; unread: boolean; to: string }) {
  return (
    <Link
      href={to}
      aria-current={active ? "true" : undefined}
      className="no-underline text-ink hover:text-ink rounded-2xl border px-4 py-3 flex flex-col gap-1.5 bg-white hover:bg-[#FAF8F3]"
      style={{ borderColor: active ? "#141210" : "#E2DCCF" }}
    >
      <span className="flex items-center gap-2 text-[12px] text-text">
        <span className="bg-cream rounded-full px-2 py-[2px] font-semibold text-ink">{CATEGORY_LABELS[row.category]}</span>
        {row.orderNumber ? <span>{row.orderNumber}</span> : null}
        <span className="ml-auto whitespace-nowrap">{fmtDateShort(row.lastMessageAt)}</span>
      </span>
      <span className={`text-[14px] ${unread ? "font-bold" : "font-normal"}`}>
        {unread ? <span className="sr-only">Non lu : </span> : null}
        {row.name}
      </span>
      <span className={`text-[13px] leading-snug line-clamp-2 break-words ${unread ? "font-semibold text-ink" : "text-text"}`}>{row.subject || "(sans objet)"}</span>
      <span className="flex items-center gap-2">
        <StatusBadge status={row.status} />
        {unread ? <span aria-hidden="true" className="w-2 h-2 rounded-full bg-terracotta" /> : null}
      </span>
    </Link>
  );
}

function ThreadPanel({ thread, connected, back }: { thread: AdminThread; connected: boolean; back: string }) {
  const router = useRouter();
  const { show, node } = useToast();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [text, setText] = useState("");
  const [draftInfo, setDraftInfo] = useState<{ mode: string; sources: { title: string }[] } | null>(null);
  const [link, setLink] = useState<string | null>(null);

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      try {
        await fn();
      } catch {
        show("Une erreur est survenue. Réessayez.");
      }
    });

  const changeStatus = (s: Status) =>
    run(async () => {
      const res = await setStatusAction(thread.id, s);
      if (res.ok) {
        show(`Statut : ${STATUS_LABELS[s]}.`);
        router.refresh();
      } else show(res.message);
    });
  const changeCategory = (c: Category) =>
    run(async () => {
      const res = await setCategoryAction(thread.id, c);
      if (res.ok) {
        show(`Catégorie : ${CATEGORY_LABELS[c]}.`);
        router.refresh();
      } else show(res.message);
    });
  const draft = () =>
    run(async () => {
      const res = await draftReplyAction(thread.id);
      if (res.ok) {
        setMode("reply");
        setText(res.draft.text);
        setDraftInfo({ mode: res.draft.mode, sources: res.draft.sources });
      } else show(res.message);
    });
  const submit = () =>
    run(async () => {
      if (!text.trim()) return show("Le message est vide.");
      if (mode === "reply") {
        const res = await replyAction(thread.id, text);
        if (!res.ok) return show(res.message);
        show(OUTCOME_TEXT[res.outcome]);
      } else {
        const res = await addNoteAction(thread.id, text);
        if (!res.ok) return show(res.message);
        show("Note interne ajoutée (jamais visible du client).");
      }
      setText("");
      setDraftInfo(null);
      router.refresh();
    });
  const copyLink = () =>
    run(async () => {
      const res = await issueLinkAction(thread.id);
      if (!res.ok) return show(res.message);
      setLink(res.url);
      try {
        await navigator.clipboard.writeText(res.url);
        show("Lien privé copié. Envoyez-le seulement à ce client.");
      } catch {
        show("Lien privé créé : copiez-le ci-dessous.");
      }
    });

  return (
    <section aria-label="Fil de la discussion" className="bg-white rounded-[22px] p-5 flex flex-col gap-4 min-w-0" aria-busy={pending}>
      <Link href={back} className="lg:hidden text-[13px] text-text">
        ← Toutes les discussions
      </Link>
      <header className="flex flex-col gap-2">
        <div className="flex items-start gap-3 flex-wrap">
          <h2 className="m-0 text-[18px] font-semibold leading-snug break-words flex-1 min-w-[200px]">{thread.subject || "(sans objet)"}</h2>
          <StatusBadge status={thread.status} />
        </div>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
          <dt className="text-text">Client</dt>
          <dd className="m-0 break-words">
            <strong>{thread.name}</strong> · <span className="break-all">{thread.contact}</span>
            {thread.userId ? <span className="text-text"> · compte client</span> : null}
          </dd>
          <dt className="text-text">Source</dt>
          <dd className="m-0">
            {SOURCE_LABELS[thread.source]} · {fmtDateShort(thread.createdAt)} · {thread.locale === "en" ? "anglais" : "français"}
          </dd>
          {thread.orderNumber ? (
            <>
              <dt className="text-text">Commande</dt>
              <dd className="m-0">
                {thread.order ? (
                  <Link href={`/admin/commandes?commande=${encodeURIComponent(thread.order.number)}`}>
                    {thread.order.number}
                    {thread.order.statusLabel ? ` · ${thread.order.statusLabel}` : ""}
                  </Link>
                ) : (
                  <span>
                    {thread.orderNumber} <span className="text-text">(introuvable)</span>
                  </span>
                )}
              </dd>
            </>
          ) : null}
        </dl>
        <div className="flex gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-[13px] text-text">
            Statut
            <select value={thread.status} disabled={pending || !connected} onChange={(e) => changeStatus(e.target.value as Status)} className={`${fieldSmCls} min-h-[44px] w-auto`}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-[13px] text-text">
            Catégorie
            <select value={thread.category} disabled={pending || !connected} onChange={(e) => changeCategory(e.target.value as Category)} className={`${fieldSmCls} min-h-[44px] w-auto`}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <ol className="list-none m-0 p-0 flex flex-col gap-2.5" aria-label="Messages">
        {thread.messages.map((m) => {
          const note = m.author === "note_interne";
          const team = m.author === "equipe";
          return (
            <li
              key={m.id}
              className={`rounded-2xl px-3.5 py-2.5 max-w-[88%] flex flex-col gap-1 ${team ? "self-end bg-ink text-cream" : note ? "self-end bg-[#FFF4D6] border border-dashed border-[#D9B44A]" : "self-start bg-[#FAF8F3] border border-[#E2DCCF]"}`}
            >
              <span className={`text-[12px] font-semibold ${team ? "text-cream/80" : note ? "text-[#8A5A00]" : "text-text"}`}>
                {team ? "Équipe" : note ? "Note interne · jamais visible du client" : "Client"} · {fmtDateShort(m.createdAt)}
              </span>
              <p className="m-0 text-[14px] leading-normal whitespace-pre-line break-words">{m.body}</p>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-2 border-t border-[#E2DCCF] pt-4">
        <div role="tablist" aria-label="Type de message" className="flex gap-2">
          {(["reply", "note"] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className="rounded-full px-3.5 min-h-[44px] text-[13px] font-medium cursor-pointer border"
              style={{ borderColor: mode === id ? "#141210" : "#D6CFC0", background: mode === id ? "#141210" : "transparent", color: mode === id ? "#F4F1EA" : "#141210" }}
            >
              {id === "reply" ? "Répondre au client" : "Note interne"}
            </button>
          ))}
        </div>
        {mode === "note" ? <p className="m-0 text-[12px] text-[#8A5A00]">Visible de l&apos;équipe seulement : le client ne la voit jamais et l&apos;IA ne la reçoit pas.</p> : null}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 3000))}
          rows={6}
          aria-label={mode === "reply" ? "Réponse au client" : "Note interne"}
          placeholder={mode === "reply" ? "Votre réponse au client…" : "Note pour l'équipe…"}
          className={`${fieldSmCls} leading-normal resize-y`}
        />
        {draftInfo ? (
          <p className="m-0 text-[12px] text-text">
            {draftInfo.mode} · à relire avant envoi
            {draftInfo.sources.length ? ` · sources : ${draftInfo.sources.map((s) => s.title).join(", ")}` : ""}
          </p>
        ) : null}
        <div className="flex gap-2 flex-wrap">
          {mode === "reply" ? (
            <button
              type="button"
              disabled={pending}
              onClick={draft}
              className="border-0 bg-sun text-ink rounded-full px-3.5 min-h-[44px] cursor-pointer text-[13px] font-semibold hover:bg-sun-hover disabled:opacity-60"
            >
              {pending ? "Patientez…" : "Brouillon IA"}
            </button>
          ) : null}
          <button type="button" disabled={pending || !connected} onClick={submit} className={`${btnDark} px-4 min-h-[44px] text-[13px]`}>
            {mode === "reply" ? "Envoyer la réponse" : "Ajouter la note"}
          </button>
          <button type="button" disabled={pending || !connected} onClick={copyLink} className={`${btnLine} px-3.5 min-h-[44px] text-[13px]`}>
            Copier le lien privé
          </button>
        </div>
        {link ? (
          <input readOnly value={link} aria-label="Lien privé du client" onFocus={(e) => e.currentTarget.select()} className={`${fieldSmCls} text-[12px]`} />
        ) : null}
        <p className="m-0 text-[12px] text-text">Le brouillon IA ne reçoit ni le nom, ni le téléphone, ni l&apos;e-mail du client, ni les notes internes.</p>
      </div>
      {node}
    </section>
  );
}
