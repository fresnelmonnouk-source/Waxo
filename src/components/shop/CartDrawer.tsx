"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { cart, useCartLines, useCartSubtotal, type CartLine } from "@/lib/cart/store";
import {
  DEFAULT_PAY,
  DEFAULT_SHIPPING,
  enabledPayMethods,
  freeShippingPercent,
  freeShippingRemaining,
  type PayConfig,
  type PayMethod,
  type ShippingConfig,
} from "@/lib/checkout/shipping";
import { fmtXof } from "@/lib/money";
import { cartDrawer, useCartDrawerOpen } from "@/lib/ui/cart-drawer";
import { askAssistant } from "@/components/product/assistant";
import { cssImage, FALLBACK_BG } from "@/components/product/media";

type Upsell = { id: string; slug: string; name: string; price: number; bg: string | null; imageUrl: string | null };
type Config = { shipping: ShippingConfig; pay: PayConfig; stock: Record<string, number>; upsell: Upsell[] };

const FALLBACK: Config = { shipping: DEFAULT_SHIPPING, pay: DEFAULT_PAY, stock: {}, upsell: [] };
const PAY_KEYS: Record<PayMethod, "payMomo" | "payMoov" | "payCeltiis" | "payCarte" | "payCod"> = {
  momo: "payMomo",
  moov: "payMoov",
  celtiis: "payCeltiis",
  carte: "payCarte",
  cod: "payCod",
};
const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

function Thumb({ bg, imageUrl, size, radius }: { bg: string | null; imageUrl: string | null; size: number; radius: number }) {
  const img = cssImage(imageUrl);
  return (
    <span
      aria-hidden="true"
      className="relative block flex-none overflow-hidden"
      style={{ width: size, height: size, borderRadius: radius, background: bg ?? FALLBACK_BG }}
    >
      {img ? <span className="absolute inset-0 block h-full w-full" style={{ background: img }} /> : null}
    </span>
  );
}

/** Tiroir panier (monté une fois dans la coque de la boutique). Ouvert/fermé via `cartDrawer`. */
export function CartDrawer() {
  const open = useCartDrawerOpen();
  if (!open) return null;
  return <DrawerContent />;
}

function DrawerContent() {
  const t = useTranslations("Cart");
  const locale = useLocale();
  const router = useRouter();
  const lines = useCartLines();
  const subtotal = useCartSubtotal();
  const [config, setConfig] = useState<Config>(FALLBACK);
  const [maxFor, setMaxFor] = useState<string | null>(null);
  const asideRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const count = lines.reduce((n, l) => n + l.qty, 0);
  const idsKey = lines
    .map((l) => l.id)
    .sort()
    .join(",");

  // Réglages publics, stock des articles du panier et suggestions : récupérés à l'ouverture et quand le panier change.
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/checkout/config?lang=${locale === "en" ? "en" : "fr"}&ids=${encodeURIComponent(idsKey)}`, {
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((j: Partial<Config> & { ok?: boolean }) => {
        if (j.ok && j.shipping && j.pay) {
          setConfig({ shipping: j.shipping, pay: j.pay, stock: j.stock ?? {}, upsell: j.upsell ?? [] });
        }
      })
      .catch(() => {
        /* repli sur les réglages par défaut */
      });
    return () => ctrl.abort();
  }, [idsKey, locale]);

  // Échap pour fermer, focus piégé dans le tiroir, défilement de la page bloqué, focus rendu à la fermeture.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cartDrawer.close();
        return;
      }
      if (e.key !== "Tab" || !asideRef.current) return;
      const items = Array.from(asideRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
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

  const { shipping, pay, stock } = config;
  const remaining = freeShippingRemaining(subtotal, shipping);
  const payLine = enabledPayMethods(pay)
    .map((m) => t(PAY_KEYS[m]))
    .join(" · ");
  const upsell = config.upsell.filter((u) => !lines.some((l) => l.id === u.id)).slice(0, 2);

  function inc(line: CartLine) {
    const max = stock[line.id];
    if (max !== undefined && line.qty >= max) {
      setMaxFor(line.id);
      return;
    }
    setMaxFor(null);
    cart.setQty(line.kind, line.id, line.qty + 1);
  }

  return (
    <div
      onClick={() => cartDrawer.close()}
      className="fixed inset-0 z-[45] flex justify-end bg-[rgba(20,18,16,.45)]"
    >
      <aside
        ref={asideRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("dialogLabel")}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-[min(440px,100%)] animate-[wxup_.25s_ease_both] flex-col bg-cream"
      >
        <div className="flex items-center justify-between border-b border-border px-[22px] py-[18px]">
          <strong className="font-display text-[20px] font-semibold tracking-[-0.02em]">
            {t("title", { count })}
          </strong>
          <button
            ref={closeRef}
            type="button"
            aria-label={t("close")}
            onClick={() => cartDrawer.close()}
            className="h-11 w-11 cursor-pointer rounded-full border-0 bg-card text-[20px]"
          >
            ×
          </button>
        </div>

        {count > 0 ? (
          <>
            <div className="flex flex-col gap-2 border-b border-border px-[22px] py-3.5">
              <span className="text-[14px]">
                {remaining > 0 ? t("shipRemaining", { amount: fmtXof(remaining) }) : t("shipFree")}
              </span>
              <div className="h-1.5 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-leaf transition-[width] duration-[400ms]"
                  style={{ width: `${freeShippingPercent(subtotal, shipping)}%` }}
                />
              </div>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto px-[22px] py-1.5">
              {lines.map((l) => (
                <div key={`${l.kind}:${l.id}`} className="flex items-center gap-3.5 border-b border-border py-3.5">
                  <Link href={`/produit/${l.slug}`} onClick={() => cartDrawer.close()} aria-hidden="true" tabIndex={-1}>
                    <Thumb bg={l.bg} imageUrl={l.imageUrl} size={68} radius={14} />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Link
                      href={`/produit/${l.slug}`}
                      onClick={() => cartDrawer.close()}
                      className="text-[15px] leading-[1.25] no-underline hover:text-ink"
                    >
                      {l.name}
                    </Link>
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center rounded-full border border-border-strong bg-card">
                        <button
                          type="button"
                          aria-label={t("decrease")}
                          onClick={() => {
                            setMaxFor(null);
                            cart.setQty(l.kind, l.id, l.qty - 1);
                          }}
                          className="h-10 w-10 cursor-pointer border-0 bg-transparent text-[16px]"
                        >
                          −
                        </button>
                        <span className="min-w-[18px] text-center text-[14px]">{l.qty}</span>
                        <button
                          type="button"
                          aria-label={t("increase")}
                          onClick={() => inc(l)}
                          className="h-10 w-10 cursor-pointer border-0 bg-transparent text-[16px]"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => cart.remove(l.kind, l.id)}
                        className="min-h-10 cursor-pointer border-0 bg-transparent text-[13px] text-text underline underline-offset-[3px]"
                      >
                        {t("remove")}
                      </button>
                    </div>
                    {maxFor === l.id ? (
                      <span role="status" className="text-[12px] text-terracotta-deep">
                        {t("maxStock", { count: stock[l.id] ?? l.qty })}
                      </span>
                    ) : null}
                  </div>
                  <strong className="text-[15px] whitespace-nowrap">{fmtXof(l.price * l.qty)}</strong>
                </div>
              ))}

              {upsell.length > 0 ? (
                <div className="flex flex-col gap-2.5 pt-[18px] pb-2">
                  <span className="text-[13px] tracking-[.06em] text-text uppercase">{t("upsellTitle")}</span>
                  {upsell.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 rounded-[14px] bg-card p-2.5">
                      <Thumb bg={u.bg} imageUrl={u.imageUrl} size={44} radius={10} />
                      <span className="flex-1 text-[14px] leading-[1.25]">{u.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          cart.add({
                            kind: "product",
                            id: u.id,
                            slug: u.slug,
                            name: u.name,
                            price: u.price,
                            bg: u.bg,
                            imageUrl: u.imageUrl,
                          })
                        }
                        className="min-h-10 cursor-pointer rounded-full border border-border-strong bg-transparent px-3 text-[13px] whitespace-nowrap hover:border-sun hover:bg-sun"
                      >
                        + {fmtXof(u.price)}
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-border bg-card px-[22px] pt-[18px] pb-[22px]">
              <div className="flex justify-between text-[16px]">
                <span>{t("subtotal")}</span>
                <strong>{fmtXof(subtotal)}</strong>
              </div>
              <button
                type="button"
                onClick={() => {
                  cartDrawer.close();
                  router.push("/commande");
                }}
                className="h-[54px] cursor-pointer rounded-full border-0 bg-ink text-[16px] font-semibold text-cream hover:bg-[#2C2823]"
              >
                {t("checkout")}
              </button>
              <span className="text-center text-[12px] text-text">{payLine}</span>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3.5 p-6 text-center">
            <strong className="text-[18px]">{t("emptyTitle")}</strong>
            <span className="text-text">{t("emptyText")}</span>
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                href="/catalogue"
                onClick={() => cartDrawer.close()}
                className="rounded-full bg-ink px-5 py-[13px] font-semibold text-cream no-underline hover:text-cream"
              >
                {t("seeProducts")}
              </Link>
              <button
                type="button"
                onClick={() => {
                  cartDrawer.close();
                  if (!askAssistant("")) router.push("/contact");
                }}
                className="min-h-[46px] cursor-pointer rounded-full border-0 bg-sun px-5 font-semibold"
              >
                {t("askAssistant")}
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
