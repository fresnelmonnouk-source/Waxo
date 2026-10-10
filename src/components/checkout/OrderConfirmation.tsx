"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { fetchMe, type MeUser } from "@/lib/checkout/me";
import { parseLastOrder, readLastOrderRaw } from "@/lib/checkout/last-order";
import { prettyPhone } from "@/lib/checkout/phone";
import type { PayMethod } from "@/lib/checkout/shipping";
import { fmtXof } from "@/lib/money";
import { CheckoutShell } from "./CheckoutShell";
import { parseReturnParams, type ReturnPayState } from "./return-params";

const noopSubscribe = () => () => {};
// Chaîne brute du sessionStorage : instantané stable pour useSyncExternalStore ; null côté serveur.
const useStoredOrder = () => useSyncExternalStore(noopSubscribe, readLastOrderRaw, () => null);
// Query string de l'URL (la page reste statique) : vide côté serveur et au premier rendu.
const useSearch = () => useSyncExternalStore(noopSubscribe, () => window.location.search, () => "");

type StatusReply = { state: ReturnPayState; number?: string; total?: number; pay?: PayMethod };

const POLL_MS = 3000;
const POLL_MAX = 10;

const linkSun =
  "inline-flex min-h-[52px] items-center rounded-full bg-sun px-6 text-[16px] font-semibold no-underline hover:bg-sun-hover hover:text-ink";
const linkInk =
  "inline-flex min-h-[52px] items-center rounded-full bg-ink px-6 text-[16px] font-semibold text-cream no-underline hover:text-cream";

/**
 * Étape 3 de la commande : remerciement, numéro WX-…, prochaines étapes.
 * Gère aussi le RETOUR de paiement en ligne (`?n=WX-…&k=…&id=…`) : l'état est relu côté serveur (webhook ou vérification
 * directe chez le prestataire), jamais déduit de l'URL — payé / en attente de confirmation / échec.
 */
export function OrderConfirmation({ cutoff }: { cutoff: number }) {
  const t = useTranslations("Thanks");
  const tp = useTranslations("Checkout");
  const router = useRouter();
  const raw = useStoredOrder();
  const search = useSearch();
  const ret = useMemo(() => parseReturnParams(search), [search]);
  const stored = useMemo(() => parseLastOrder(raw), [raw]);
  const order = stored && (!ret.number || stored.number === ret.number) ? stored : null;
  const [me, setMe] = useState<MeUser | null>(null);
  const [status, setStatus] = useState<StatusReply | null>(null);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    void fetchMe(ctrl.signal).then(setMe);
    return () => ctrl.abort();
  }, []);

  // Relance périodique tant que le paiement n'est pas confirmé (le webhook peut arriver quelques secondes après le retour).
  useEffect(() => {
    if (!ret.number || !ret.token) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ctrl = new AbortController();
    const qs = new URLSearchParams({ n: ret.number, k: ret.token });
    if (ret.transactionId) qs.set("id", ret.transactionId);

    async function poll(attempt: number) {
      let next: StatusReply | null = null;
      try {
        const res = await fetch(`/api/checkout/status?${qs.toString()}`, { cache: "no-store", signal: ctrl.signal });
        const json = (await res.json().catch(() => null)) as (StatusReply & { ok?: boolean }) | null;
        if (json?.ok && json.state) next = json;
      } catch {
        /* réseau : on retentera */
      }
      if (cancelled) return;
      if (next) setStatus(next);
      const state = next?.state ?? "pending";
      if (state === "pending" || (!next && attempt < POLL_MAX)) {
        if (attempt + 1 >= POLL_MAX) setExhausted(true);
        else timer = setTimeout(() => void poll(attempt + 1), POLL_MS);
      }
    }
    void poll(0);
    return () => {
      cancelled = true;
      ctrl.abort();
      if (timer) clearTimeout(timer);
    };
  }, [ret.number, ret.token, ret.transactionId]);

  const exit = () => router.push("/");

  const payState: ReturnPayState = ret.unavailable
    ? "unavailable"
    : ret.number && ret.token
      ? (status?.state ?? "pending")
      : "none";

  const number = order?.number ?? status?.number ?? ret.number ?? null;
  const total = order?.total ?? status?.total ?? null;
  const method: PayMethod | null = order?.pay ?? status?.pay ?? null;

  if (!number || payState === "unknown") {
    return (
      <CheckoutShell step={3} onExit={exit}>
        <div className="mx-auto flex max-w-[620px] flex-col items-center gap-5 px-5 py-14 text-center">
          <h1 className="font-display m-0 text-[clamp(28px,4.4vw,44px)] leading-[1.08] font-semibold tracking-[-0.035em]">
            {t("unknownTitle")}
          </h1>
          <p className="m-0 text-[17px] leading-[1.55] text-text">{t("unknownText")}</p>
          <div className="flex flex-wrap justify-center gap-2.5">
            <Link href="/suivi" className={linkSun}>
              {t("trackOrder")}
            </Link>
            <Link href="/" className={linkInk}>
              {t("continueShopping")}
            </Link>
          </div>
        </div>
      </CheckoutShell>
    );
  }

  if (payState === "failed" || payState === "unavailable") {
    const failed = payState === "failed";
    return (
      <CheckoutShell step={3} onExit={exit}>
        <div className="mx-auto flex max-w-[620px] animate-[wxup_.35s_ease_both] flex-col items-center gap-5 px-5 py-14 text-center">
          <span
            aria-hidden="true"
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-terracotta-deep text-[34px] text-white"
          >
            !
          </span>
          <h1 className="font-display m-0 text-[clamp(28px,4.4vw,44px)] leading-[1.08] font-semibold tracking-[-0.035em]">
            {failed ? t("failedTitle") : t("unavailableTitle")}
          </h1>
          <p className="m-0 text-[17px] leading-[1.55] text-text">
            {t.rich(failed ? "failedText" : "unavailableText", {
              b: (chunks) => <strong className="text-ink">{chunks}</strong>,
              number,
            })}
          </p>
          <div className="flex flex-wrap justify-center gap-2.5">
            <Link href="/contact" className={linkSun}>
              {t("contactUs")}
            </Link>
            <Link href="/catalogue" className={linkInk}>
              {t("continueShopping")}
            </Link>
          </div>
        </div>
      </CheckoutShell>
    );
  }

  const first = order?.name.trim().split(/\s+/)[0] ?? "";
  const paid = payState === "paid";
  const pendingOnline = payState === "pending" || (payState === "none" && !!order?.pending);
  const hour = order?.placedAt ? new Date(order.placedAt).getHours() : 0;
  const eta = !order
    ? ""
    : order.zone === "cotonou"
      ? hour < cutoff
        ? t("etaTomorrow")
        : t("eta48")
      : t("etaOther");
  const totalText = total === null ? "" : fmtXof(total);
  const note = paid
    ? t("paidNote")
    : method === "cod"
      ? t("codNote", { total: totalText })
      : exhausted
        ? t("pendingLateNote")
        : t("pendingNote");

  return (
    <CheckoutShell step={3} onExit={exit}>
      <div className="mx-auto flex max-w-[620px] animate-[wxup_.35s_ease_both] flex-col items-center gap-5 px-5 py-14 text-center">
        <span
          aria-hidden="true"
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-leaf text-[34px] text-white"
        >
          ✓
        </span>
        <h1 className="font-display m-0 text-[clamp(28px,4.4vw,44px)] leading-[1.08] font-semibold tracking-[-0.035em]">
          {paid ? (first ? t("paidTitle", { first }) : t("paidTitleAnonymous")) : first ? t("title", { first }) : t("titleAnonymous")}
        </h1>
        <p className="m-0 text-[17px] leading-[1.55] text-text">
          {order
            ? t.rich("line", {
                b: (chunks) => <strong className="text-ink">{chunks}</strong>,
                number: order.number,
                total: totalText,
                pay: tp(`${order.pay}Name`),
                phone: prettyPhone(order.phone),
                eta,
              })
            : t.rich("lineShort", {
                b: (chunks) => <strong className="text-ink">{chunks}</strong>,
                number,
                total: totalText,
                pay: method ? tp(`${method}Name`) : "",
              })}
        </p>
        <span role="status" className="rounded-[14px] bg-card px-4 py-3 text-[15px]">
          {note}
        </span>
        {pendingOnline && !exhausted && ret.number ? (
          <span className="text-[14px] text-muted">{t("checking")}</span>
        ) : null}
        {me ? null : (
          <div className="flex w-full flex-col items-center gap-3 rounded-[22px] bg-card p-5">
            <strong className="text-[16px]">{t("guestTitle")}</strong>
            <span className="text-[14px] text-text">{t("guestText")}</span>
            <Link
              href="/inscription"
              className="inline-flex min-h-12 items-center rounded-full bg-sun px-[22px] font-semibold no-underline hover:bg-sun-hover hover:text-ink"
            >
              {t("createAccount")}
            </Link>
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-2.5">
          <Link href={me ? "/compte" : "/suivi"} className={linkSun}>
            {t("trackOrder")}
          </Link>
          <Link href="/" className={linkInk}>
            {t("continueShopping")}
          </Link>
        </div>
      </div>
    </CheckoutShell>
  );
}
