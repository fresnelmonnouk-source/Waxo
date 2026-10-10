"use client";

import { useTranslations } from "next-intl";
import { cartDrawer } from "@/lib/ui/cart-drawer";
import { shopToast, useToast } from "./toast";

/** Message éphémère de la boutique (monté une fois dans la coque). Fidèle à la maquette (ligne 1233). */
export function ShopToast() {
  const t = useTranslations("Shell.toast");
  const toast = useToast();
  if (!toast) return null;

  const text =
    toast.kind === "added"
      ? t("added", { name: toast.name })
      : toast.kind === "soldOut"
        ? t("soldOut")
        : toast.kind === "staleRemoved"
          ? t("staleRemoved")
          : t("maxStock", { n: toast.n });

  return (
    <div
      key={toast.id}
      role="status"
      className="bg-ink text-cream fixed bottom-6 left-1/2 z-[70] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-[14px] rounded-full py-2 pr-2 pl-5 text-[14px] shadow-[0_12px_30px_-12px_rgba(20,18,16,0.6)]"
      style={{ animation: "wxup .2s ease both" }}
    >
      <span className="py-[6px]">{text}</span>
      {toast.kind === "added" ? (
        <button
          type="button"
          onClick={() => {
            shopToast.hide();
            cartDrawer.open();
          }}
          className="bg-sun text-ink min-h-9 cursor-pointer rounded-full border-0 px-[14px] font-semibold whitespace-nowrap"
        >
          {t("viewCart")}
        </button>
      ) : null}
    </div>
  );
}
