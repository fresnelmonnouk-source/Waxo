"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { authModal, ensureMe, toast, useMe } from "@/lib/auth/client";
import { fmtDate, signOut } from "./actions";
import { AccountOrders } from "./AccountOrders";
import { AccountProfile } from "./AccountProfile";
import { AccountSecurity } from "./AccountSecurity";
import { BTN_DARK, BTN_OUTLINE, BTN_SUN } from "./ui";

const TABS = ["orders", "profile", "security"] as const;
type Tab = (typeof TABS)[number];

/** « Mon compte » (maquette 750-881). Connecté : onglets commandes / informations / sécurité. Sinon : invitation à se connecter. */
export function AccountPage() {
  const t = useTranslations("Account");
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const { status, user } = useMe();
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const onCount = useCallback((n: number) => setOrderCount(n), []);
  useEffect(() => {
    ensureMe();
  }, []);

  const rawTab = params.get("tab");
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "orders";
  const recovery = params.get("recovery") === "1";

  if (status === "loading") {
    return <p className="m-0 text-[15px] text-muted">{t("loading")}</p>;
  }

  if (!user) {
    return (
      <div className="flex max-w-[560px] flex-col gap-4 rounded-[28px] bg-white p-8">
        <h1 className="font-display m-0 text-[32px] font-semibold tracking-[-0.03em]">{t("page.title")}</h1>
        <p className="m-0 text-[16px] leading-[1.55] text-text">{t("page.intro")}</p>
        <div className="flex flex-wrap gap-[10px]">
          <button type="button" onClick={() => authModal.open("login")} className={`${BTN_DARK} h-[50px] px-[22px]`}>
            {t("page.login")}
          </button>
          <button
            type="button"
            onClick={() => authModal.open("signup")}
            className="inline-flex h-[50px] cursor-pointer items-center justify-center rounded-full border-[1.5px] border-ink bg-transparent px-[22px] font-semibold text-ink transition-colors hover:border-sun hover:bg-sun"
          >
            {t("page.signup")}
          </button>
        </div>
        <span className="text-[14px] leading-[1.5] text-text">
          {t.rich("page.guestNote", { track: (c) => <Link href="/suivi">{c}</Link> })}
        </span>
      </div>
    );
  }

  const goTab = (next: Tab) => router.replace({ pathname: "/compte", query: { tab: next } }, { scroll: false });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-[6px]">
          <h1 className="font-display m-0 text-[clamp(28px,3.6vw,40px)] font-semibold tracking-[-0.035em]">
            {t("page.hello", { first: user.firstName || user.email })}
          </h1>
          <span className="text-[14px] text-text">{t("page.since", { date: fmtDate(user.createdAt, locale) })}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.role === "admin" ? (
            <NextLink href="/admin" className={`${BTN_SUN} min-h-11 px-[18px] text-[14px]`}>
              {t("page.admin")}
            </NextLink>
          ) : null}
          <button
            type="button"
            onClick={async () => {
              await signOut();
              toast.show(t("toast.bye"));
              router.push("/");
            }}
            className={`${BTN_OUTLINE} min-h-11 px-[18px] text-[14px]`}
          >
            {t("page.logout")}
          </button>
        </div>
      </div>

      <div role="tablist" aria-label={t("page.tabsAria")} className="mb-6 flex flex-wrap gap-2">
        {TABS.map((id) => {
          const on = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => goTab(id)}
              className={`min-h-11 cursor-pointer rounded-full border px-[18px] text-[14px] font-medium ${
                on ? "border-ink bg-ink text-cream" : "border-border-strong bg-transparent text-ink"
              }`}
            >
              {t(`tabs.${id}`)}
              {id === "orders" && orderCount !== null ? ` (${orderCount})` : ""}
            </button>
          );
        })}
      </div>

      {tab === "orders" ? <AccountOrders openNumber={params.get("order")} onCount={onCount} /> : null}
      {tab === "profile" ? <AccountProfile user={user} /> : null}
      {tab === "security" ? <AccountSecurity recovery={recovery} onDone={() => recovery && goTab("security")} /> : null}
    </>
  );
}
