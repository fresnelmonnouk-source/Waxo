"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { authModal, useAuthRequest, type AuthRequest } from "@/lib/auth/client";
import { AuthForm } from "./AuthForm";
import { useMounted } from "./ui";

/** Fenêtre de connexion / inscription (maquette 1166-1231). Montée une seule fois par AccountMenu, ouverte via `authModal.open()`. */
export function AuthModal() {
  const req = useAuthRequest();
  const mounted = useMounted();
  if (!mounted || !req) return null;
  return createPortal(<Shell req={req} />, document.body);
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select, textarea, [tabindex]:not([tabindex="-1"])';

function Shell({ req }: { req: AuthRequest }) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLElement>("input")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return authModal.close();
      if (e.key !== "Tab" || !dialog.current) return;
      // Piège à focus : Tab reste dans la fenêtre.
      const items = Array.from(dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) authModal.close();
      }}
      className="fixed inset-0 z-[58] flex items-start justify-center overflow-y-auto bg-[rgba(20,18,16,.5)] px-4 py-8"
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={t("dialogAria")}
        className="relative flex w-[min(460px,100%)] flex-col gap-4 rounded-[28px] bg-cream p-[26px] [animation:wxup_.25s_ease_both]"
      >
        <button
          type="button"
          onClick={() => authModal.close()}
          aria-label={t("close")}
          className="absolute top-[14px] right-[14px] h-11 w-11 cursor-pointer rounded-full border-0 bg-white text-[20px]"
        >
          ×
        </button>
        <span className="font-display text-[22px] font-bold tracking-[-0.03em]">
          Wá x<span className="text-terracotta">ɔ</span>
        </span>
        <AuthForm
          initialMode={req.mode}
          message={req.message}
          variant="modal"
          onSuccess={() => {
            authModal.close();
            req.onSuccess?.();
            if (req.redirect) router.push(req.redirect);
          }}
        />
      </div>
    </div>
  );
}
