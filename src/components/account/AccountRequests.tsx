"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ReplyBox } from "@/app/[lang]/(shop)/discussion/_components/ReplyBox";
import { StatusPill, ThreadMessages, ThreadMeta, fmtThreadDate } from "@/app/[lang]/(shop)/discussion/_components/ThreadView";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/auth/client";
import type { MineRow, PublicThread } from "@/lib/conversations/types";
import { BTN_DARK } from "./ui";

type Load = { state: "loading" } | { state: "error" } | { state: "ready"; rows: MineRow[] };
type ThreadLoad = { state: "loading" } | { state: "error" } | { state: "ready"; thread: PublicThread };

/**
 * Onglet « Mes demandes » de « Mon compte » : liste des discussions du client connecté (GET /api/conversations/mine,
 * RLS + filtre propriétaire) ; une ligne se déplie sur le fil et le formulaire de réponse. Aucune note interne.
 */
export function AccountRequests({ shopName = "Wá xɔ", onCount }: { shopName?: string; onCount?: (n: number) => void }) {
  const t = useTranslations("Conversations");
  const locale = useLocale();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api("/api/conversations/mine", "GET").then((res) => {
      if (!alive) return;
      if (res.data?.ok === true && Array.isArray(res.data.conversations)) {
        const rows = res.data.conversations as MineRow[];
        setLoad({ state: "ready", rows });
        onCount?.(rows.length);
      } else setLoad({ state: "error" });
    });
    return () => {
      alive = false;
    };
  }, [attempt, onCount]);

  if (load.state === "loading") return <p className="m-0 text-[15px] text-muted">{t("account.loading")}</p>;
  if (load.state === "error") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-[20px] border border-dashed border-border-strong p-8">
        <strong className="text-[17px]">{t("account.loadError")}</strong>
        <button
          type="button"
          onClick={() => {
            setLoad({ state: "loading" });
            setAttempt((a) => a + 1);
          }}
          className={`${BTN_DARK} px-5 py-3`}
        >
          {t("account.retry")}
        </button>
      </div>
    );
  }
  if (!load.rows.length) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-[20px] border border-dashed border-border-strong p-8">
        <strong className="text-[17px]">{t("account.empty")}</strong>
        <Link href="/contact" className={`${BTN_DARK} px-5 py-3`}>
          {t("account.write")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-[14px] leading-[1.5] text-text">{t("account.intro")}</p>
      {load.rows.map((r) => {
        const open = openId === r.id;
        return (
          <div key={r.id} className="overflow-hidden rounded-[20px] border border-border bg-white">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : r.id)}
              aria-expanded={open}
              className="flex w-full cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 border-0 bg-transparent px-5 py-[18px] text-left"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <strong className={`text-[15px] break-words ${r.unread ? "font-bold" : "font-medium"}`}>{r.subject || t("page.untitled")}</strong>
                <span className="text-[13px] text-text">
                  {t(`categories.${r.category}`)}
                  {r.orderNumber ? ` · ${r.orderNumber}` : ""} · {t("account.updated", { date: fmtThreadDate(r.lastMessageAt, locale, false) })}
                </span>
              </span>
              {r.unread ? <span className="rounded-full bg-sun px-3 py-1 text-[13px] font-semibold text-ink">{t("account.unread")}</span> : null}
              <StatusPill status={r.status} />
            </button>
            {open ? (
              <div className="border-t border-border bg-cream px-4 py-5">
                <OwnThread id={r.id} shopName={shopName} onRead={() => setLoad((l) => (l.state === "ready" ? { ...l, rows: l.rows.map((x) => (x.id === r.id ? { ...x, unread: false } : x)) } : l))} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function OwnThread({ id, shopName, onRead }: { id: string; shopName: string; onRead: () => void }) {
  const t = useTranslations("Conversations");
  const [load, setLoad] = useState<ThreadLoad>({ state: "loading" });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  // Rappel du parent gardé dans une ref : il change à chaque rendu et ne doit pas relancer le chargement.
  const onReadRef = useRef(onRead);
  useEffect(() => {
    onReadRef.current = onRead;
  });

  useEffect(() => {
    let alive = true;
    api(`/api/conversations/mine/${encodeURIComponent(id)}`, "GET").then((res) => {
      if (!alive) return;
      const thread = res.data?.ok === true ? (res.data.thread as PublicThread | undefined) : undefined;
      if (thread && Array.isArray(thread.messages)) {
        setLoad({ state: "ready", thread });
        onReadRef.current();
      } else setLoad({ state: "error" });
    });
    return () => {
      alive = false;
    };
  }, [id, version]);

  if (load.state === "loading") return <p className="m-0 text-[14px] text-muted">{t("account.loading")}</p>;
  if (load.state === "error") return <p className="m-0 text-[14px] text-terracotta-deep">{t("account.loadError")}</p>;
  return (
    <div className="flex flex-col gap-4">
      <ThreadMeta thread={load.thread} />
      <ThreadMessages thread={load.thread} shopName={shopName} />
      <ReplyBox target={{ kind: "account", id }} resolved={load.thread.status === "resolu"} onSent={reload} />
    </div>
  );
}
