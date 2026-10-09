"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { fetchMe, type MeUser } from "@/lib/checkout/me";
import { parseLastOrder, readLastOrderRaw } from "@/lib/checkout/last-order";
import { prettyPhone } from "@/lib/checkout/phone";
import { fmtXof } from "@/lib/money";
import { CheckoutShell } from "./CheckoutShell";

const noopSubscribe = () => () => {};
// Chaîne brute du sessionStorage : instantané stable pour useSyncExternalStore ; null côté serveur.
const useStoredOrder = () => useSyncExternalStore(noopSubscribe, readLastOrderRaw, () => null);

/** Étape 3 de la commande : remerciement, numéro WX-…, prochaines étapes. */
export function OrderConfirmation({ cutoff }: { cutoff: number }) {
  const t = useTranslations("Thanks");
  const tp = useTranslations("Checkout");
  const router = useRouter();
  const raw = useStoredOrder();
  const order = useMemo(() => parseLastOrder(raw), [raw]);
  const [me, setMe] = useState<MeUser | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    void fetchMe(ctrl.signal).then(setMe);
    return () => ctrl.abort();
  }, []);

  const exit = () => router.push("/");

  if (!order) {
    return (
      <CheckoutShell step={3} onExit={exit}>
        <div className="mx-auto flex max-w-[620px] flex-col items-center gap-5 px-5 py-14 text-center">
          <h1 className="font-display m-0 text-[clamp(28px,4.4vw,44px)] leading-[1.08] font-semibold tracking-[-0.035em]">
            {t("unknownTitle")}
          </h1>
          <p className="m-0 text-[17px] leading-[1.55] text-text">{t("unknownText")}</p>
          <div className="flex flex-wrap justify-center gap-2.5">
            <Link
              href="/suivi"
              className="inline-flex min-h-[52px] items-center rounded-full bg-sun px-6 text-[16px] font-semibold no-underline hover:bg-sun-hover hover:text-ink"
            >
              {t("trackOrder")}
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-[52px] items-center rounded-full bg-ink px-6 text-[16px] font-semibold text-cream no-underline hover:text-cream"
            >
              {t("continueShopping")}
            </Link>
          </div>
        </div>
      </CheckoutShell>
    );
  }

  const first = order.name.trim().split(/\s+/)[0] ?? "";
  const hour = order.placedAt ? new Date(order.placedAt).getHours() : 0;
  const eta =
    order.zone === "cotonou" ? (hour < cutoff ? t("etaTomorrow") : t("eta48")) : t("etaOther");
  const total = fmtXof(order.total);
  const note = order.pay === "cod" ? t("codNote", { total }) : t("pendingNote");

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
          {first ? t("title", { first }) : t("titleAnonymous")}
        </h1>
        <p className="m-0 text-[17px] leading-[1.55] text-text">
          {t.rich("line", {
            b: (chunks) => <strong className="text-ink">{chunks}</strong>,
            number: order.number,
            total,
            pay: tp(`${order.pay}Name`),
            phone: prettyPhone(order.phone),
            eta,
          })}
        </p>
        <span role="status" className="rounded-[14px] bg-card px-4 py-3 text-[15px]">
          {note}
        </span>
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
          <Link
            href={me ? "/compte" : "/suivi"}
            className="inline-flex min-h-[52px] items-center rounded-full bg-sun px-6 text-[16px] font-semibold no-underline hover:bg-sun-hover hover:text-ink"
          >
            {t("trackOrder")}
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-[52px] items-center rounded-full bg-ink px-6 text-[16px] font-semibold text-cream no-underline hover:text-cream"
          >
            {t("continueShopping")}
          </Link>
        </div>
      </div>
    </CheckoutShell>
  );
}
