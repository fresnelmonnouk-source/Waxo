"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { api, authModal, ensureMe, toast, useMe, useToastText } from "@/lib/auth/client";
import { isActiveStatus } from "@/lib/auth/status";
import type { MeUser, OrderView } from "@/lib/auth/types";
import { fmtXof } from "@/lib/money";
import { signOut } from "./actions";
import { AuthModal } from "./AuthModal";
import { useMounted } from "./ui";

/**
 * Bouton « Se connecter » / menu profil de l'en-tête (maquette lignes 68-95). L'état de session vient de `GET /api/me`
 * côté client : les pages restent statiques. Monte aussi la fenêtre de connexion et les toasts (portails).
 */
export function AccountMenu() {
  const { status, user } = useMe();
  useEffect(() => {
    ensureMe();
  }, []);

  return (
    <>
      {status === "loading" ? (
        // Réserve la place du bouton pendant le chargement de la session (aucun saut de mise en page, aucun faux « Se connecter »).
        <span aria-hidden="true" className="invisible inline-flex h-11 min-w-11" />
      ) : user ? (
        <ProfileMenu user={user} />
      ) : (
        <LoginButton />
      )}
      <AuthModal />
      <Toaster />
    </>
  );
}

function LoginButton() {
  const t = useTranslations("Account.menu");
  return (
    <button
      type="button"
      onClick={() => authModal.open("login")}
      aria-label={t("loginAria")}
      className="flex h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-border-strong bg-transparent px-[14px] text-[14px] font-medium hover:bg-white"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#141210" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      </svg>
      <span className="hidden min-[980px]:inline">{t("login")}</span>
    </button>
  );
}

const ITEM = "flex min-h-11 items-center justify-between gap-[10px] rounded-[12px] px-3 text-[14px] text-ink no-underline hover:bg-cream hover:text-ink";

function ProfileMenu({ user }: { user: MeUser }) {
  const t = useTranslations("Account");
  const tStatus = useTranslations("Account.status");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState<OrderView[] | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const initials = ((user.firstName.charAt(0) + user.lastName.charAt(0)) || user.email.charAt(0)).toUpperCase();
  const full = `${user.firstName} ${user.lastName}`.trim() || user.email;

  // Commandes (pour « Commande en cours » et les compteurs) : chargées à la première ouverture.
  useEffect(() => {
    if (!open || orders !== null) return;
    let alive = true;
    api(`/api/me/orders?lang=${locale}`, "GET").then((res) => {
      if (alive) setOrders(Array.isArray(res.data?.orders) ? (res.data.orders as OrderView[]) : []);
    });
    return () => {
      alive = false;
    };
  }, [open, orders, locale]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = orders?.find((o) => isActiveStatus(o.status));
  const items: { tab: string; label: string; meta: string }[] = [
    { tab: "orders", label: t("menu.orders"), meta: orders ? t("menu.ordersMeta", { count: orders.length }) : "" },
    { tab: "profile", label: t("menu.info"), meta: t("menu.infoMeta") },
    { tab: "security", label: t("menu.security"), meta: t("menu.securityMeta") },
  ];

  async function logout() {
    setOpen(false);
    await signOut();
    toast.show(t("toast.bye"));
    if (pathname.startsWith("/compte")) router.push("/");
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("menu.aria")}
        className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border-strong p-1 text-ink hover:bg-white ${open ? "bg-white" : "bg-transparent"}`}
      >
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-ink text-[13px] font-bold text-sun">{initials}</span>
        <span className="hidden text-[14px] font-medium min-[980px]:inline">{user.firstName || user.email}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#141210"
          strokeWidth="2.5"
          aria-hidden="true"
          className={`mr-2 hidden transition-transform duration-200 min-[980px]:block ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={t("menu.title")}
          className="absolute top-[calc(100%+8px)] right-0 z-[6] flex w-[min(300px,calc(100vw-32px))] flex-col gap-[2px] rounded-[22px] border border-border bg-white p-2 shadow-[0_18px_40px_-20px_rgba(20,18,16,.45)] [animation:wxup_.18s_ease_both]"
        >
          <div className="mb-1 flex items-center gap-3 border-b border-[#F0EBE1] px-[10px] pt-[10px] pb-[14px]">
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-ink text-[15px] font-bold text-sun">{initials}</span>
            <div className="flex min-w-0 flex-col gap-[2px]">
              <strong className="text-[15px]">{full}</strong>
              <span className="overflow-hidden text-[13px] text-ellipsis whitespace-nowrap text-muted">{user.email}</span>
            </div>
          </div>

          {active ? (
            <Link
              href={{ pathname: "/compte", query: { tab: "orders", order: active.number } }}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="mb-1 flex flex-col gap-[2px] rounded-[14px] bg-[#FFF4D6] px-3 py-[10px] text-[13px] text-ink no-underline hover:bg-[#FBEFC9] hover:text-ink"
            >
              <strong className="text-[14px]">
                {active.number} · {tStatus(active.status)}
              </strong>
              <span className="text-text">{t("menu.activeSub", { total: fmtXof(active.total) })}</span>
            </Link>
          ) : null}

          {items.map((it) => (
            <Link key={it.tab} href={{ pathname: "/compte", query: { tab: it.tab } }} role="menuitem" onClick={() => setOpen(false)} className={ITEM}>
              {it.label}
              <span className="text-[12px] text-muted">{it.meta}</span>
            </Link>
          ))}

          {user.role === "admin" ? (
            <NextLink href="/admin" role="menuitem" className="flex min-h-11 items-center rounded-[12px] px-3 text-[14px] font-semibold text-ink no-underline hover:bg-[#FFF4D6] hover:text-ink">
              {t("menu.admin")}
            </NextLink>
          ) : null}

          <button
            type="button"
            role="menuitem"
            onClick={logout}
            className="mt-1 min-h-[46px] cursor-pointer border-0 border-t border-[#F0EBE1] bg-transparent px-3 text-left text-[14px] text-[#9A3412] hover:bg-[#F6E1DA]"
          >
            {t("menu.logout")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Toaster() {
  const text = useToastText();
  const mounted = useMounted();
  if (!mounted || !text) return null;
  return createPortal(
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-[70] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-[14px] rounded-full bg-ink py-2 pr-5 pl-5 text-[14px] text-cream shadow-[0_12px_30px_-12px_rgba(20,18,16,.6)] [animation:wxup_.2s_ease_both]"
    >
      <span className="py-[6px]">{text}</span>
    </div>,
    document.body,
  );
}
