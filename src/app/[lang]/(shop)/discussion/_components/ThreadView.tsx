import { useLocale, useTranslations } from "next-intl";
import type { PublicThread, Status } from "@/lib/conversations/types";

/**
 * Fil d'une demande vu par le CLIENT (page par lien privé et « Mes demandes »). Reçoit un `PublicThread` : par
 * construction, aucune note interne ni coordonnée n'y figure. Utilisable côté serveur comme côté client.
 */

const TZ = "Africa/Porto-Novo";

export function fmtThreadDate(iso: string, locale: string, withTime = true): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    day: "numeric",
    month: "long",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : { year: "numeric" }),
    timeZone: TZ,
  }).format(d);
}

const STATUS_STYLE: Record<Status, string> = {
  nouveau: "bg-[#FFF4D6] text-[#8A5A00]",
  en_cours: "bg-[#E8EEF8] text-[#1E3A6B]",
  resolu: "bg-[#E3EFE8] text-leaf",
};

export function StatusPill({ status }: { status: Status }) {
  const t = useTranslations("Conversations");
  return <span className={`rounded-full px-3 py-1 text-[13px] font-semibold whitespace-nowrap ${STATUS_STYLE[status]}`}>{t(`statuses.${status}`)}</span>;
}

export function ThreadMeta({ thread }: { thread: PublicThread }) {
  const t = useTranslations("Conversations");
  const locale = useLocale();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] text-text">
      <StatusPill status={thread.status} />
      <span className="rounded-full bg-cream px-3 py-1 text-[13px] font-semibold text-ink">{t(`categories.${thread.category}`)}</span>
      {thread.orderNumber ? <span>{t("page.order", { number: thread.orderNumber })}</span> : null}
      <span>{t("page.opened", { date: fmtThreadDate(thread.createdAt, locale, false) })}</span>
    </div>
  );
}

export function ThreadMessages({ thread, shopName }: { thread: PublicThread; shopName: string }) {
  const t = useTranslations("Conversations");
  const locale = useLocale();
  return (
    <ol className="m-0 flex list-none flex-col gap-3 p-0">
      {thread.messages.map((m) => {
        const team = m.author === "equipe";
        return (
          <li
            key={m.id}
            className={`flex max-w-[86%] flex-col gap-1 rounded-[20px] px-4 py-3 ${team ? "self-start bg-white" : "self-end border border-border bg-[#FAF8F3]"}`}
          >
            <span className="text-[13px] font-semibold text-text">
              {team ? t("page.team", { shop: shopName }) : t("page.you")} · {fmtThreadDate(m.createdAt, locale)}
            </span>
            <p className="m-0 text-[15px] leading-[1.55] break-words whitespace-pre-line text-ink">{m.body}</p>
          </li>
        );
      })}
    </ol>
  );
}
