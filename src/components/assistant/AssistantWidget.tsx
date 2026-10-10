"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cssUrl } from "@/components/shop/logic";
import { shopToast } from "@/components/shop/toast";
import { Link, usePathname } from "@/i18n/navigation";
import type { AssistantAction, CardProduct } from "@/lib/assistant/types";
import { cart, useCartLines } from "@/lib/cart/store";
import { fmtXof } from "@/lib/money";
import { useCartDrawerOpen } from "@/lib/ui/cart-drawer";
import { assistant, useAssistant, type ChatMsg } from "./store";

const EVENT = "waxo:assistant";
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';
const CHIP_KEYS = ["c1", "c2", "c3", "c4"] as const;

/** Pastille « ɔ » de la marque (maquette : 38 px dans l'en-tête de la fenêtre). */
function Mark({ size, className = "" }: { size: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`font-display inline-flex flex-none items-center justify-center rounded-full font-bold ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.47) }}
    >
      ɔ
    </span>
  );
}

function ProductRow({ p }: { p: CardProduct }) {
  const t = useTranslations("Assistant.widget");
  const lines = useCartLines();
  const [added, setAdded] = useState(false);
  const inCart = lines.find((l) => l.kind === "product" && l.id === p.id)?.qty ?? 0;
  const soldOut = p.stock <= 0;

  function add() {
    if (soldOut) {
      shopToast.show({ kind: "soldOut" });
      return;
    }
    if (inCart >= p.stock) {
      shopToast.show({ kind: "maxStock", n: p.stock });
      return;
    }
    cart.add({ kind: "product", id: p.id, slug: p.slug, name: p.name, price: p.price, bg: p.bg, imageUrl: p.imageUrl });
    shopToast.show({ kind: "added", name: p.name });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }
  const leave = () => {
    if (window.innerWidth < 640) assistant.close();
  };

  return (
    <div className="border-border flex items-center gap-[10px] rounded-[14px] border bg-white p-2">
      <Link
        href={`/produit/${p.slug}`}
        onClick={leave}
        aria-label={t("openProduct", { name: p.name })}
        className="relative h-[52px] w-[52px] flex-none overflow-hidden rounded-[10px]"
        style={{ background: p.bg ?? "#E9E2D3" }}
      >
        {p.imageUrl ? <span aria-hidden="true" className="absolute inset-0 block" style={{ background: `${cssUrl(p.imageUrl)} center/cover no-repeat` }} /> : null}
      </Link>
      <Link href={`/produit/${p.slug}`} onClick={leave} className="text-ink! hover:text-ink! flex min-w-0 flex-1 flex-col gap-[2px] no-underline">
        <span className="text-[13.5px] leading-tight">{p.name}</span>
        <strong className="text-[13.5px]">{fmtXof(p.price)}</strong>
        {soldOut ? (
          <span className="text-muted text-[12px]">{t("outOfStock")}</span>
        ) : p.stock <= 5 ? (
          <span className="text-terracotta-deep text-[12px]">{t("lowStock", { count: p.stock })}</span>
        ) : null}
      </Link>
      <button
        type="button"
        onClick={add}
        disabled={soldOut}
        aria-label={t("addAria", { name: p.name })}
        className="bg-ink text-cream min-h-11 flex-none cursor-pointer rounded-full border-0 px-3 text-[12.5px] font-semibold hover:bg-[#C2410C] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {added ? "✓" : t("add")}
      </button>
    </div>
  );
}

function ActionLink({ a, onNavigate }: { a: AssistantAction; onNavigate: () => void }) {
  const base = "inline-flex min-h-11 items-center rounded-full px-4 text-[13px] font-semibold no-underline";
  if (a.kind === "whatsapp") {
    return (
      <a href={a.href} target="_blank" rel="noopener noreferrer" className={`${base} bg-sun text-ink! hover:bg-sun-hover hover:text-ink!`}>
        {a.label}
      </a>
    );
  }
  return (
    <Link href={a.href} onClick={onNavigate} className={`${base} border-border-strong text-ink! hover:text-ink! border bg-white hover:bg-[#FFF4D6]`}>
      {a.label}
    </Link>
  );
}

function Message({ m, onNavigate }: { m: ChatMsg; onNavigate: () => void }) {
  const t = useTranslations("Assistant");
  if (m.role === "u") {
    return (
      <div className="flex flex-col items-end gap-2">
        <div className="bg-ink text-cream max-w-[86%] rounded-[16px_16px_4px_16px] px-[14px] py-[11px] text-[14.5px] leading-[1.45] whitespace-pre-wrap">{m.text}</div>
      </div>
    );
  }
  if (m.role === "err") {
    return (
      <div className="flex flex-col items-start gap-2">
        <div className="max-w-[86%] rounded-[16px_16px_16px_4px] bg-white px-[14px] py-[11px] text-[14.5px] leading-[1.45]">
          {t(m.code === "rate" ? "errors.rate" : "errors.network")}
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionLink a={{ kind: "page", label: t("errors.contact"), href: "/contact" }} onNavigate={onNavigate} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="max-w-[86%] rounded-[16px_16px_16px_4px] bg-white px-[14px] py-[11px] text-[14.5px] leading-[1.45] whitespace-pre-wrap">{m.text}</div>
      {m.sources.length ? <span className="text-muted -mt-1 px-1 text-[11.5px]">{t("widget.source", { list: m.sources.join(" · ") })}</span> : null}
      {m.products.length ? (
        <div className="flex w-[92%] flex-col gap-2">
          {m.products.map((p) => (
            <ProductRow key={p.id} p={p} />
          ))}
        </div>
      ) : null}
      {m.actions.length ? (
        <div className="flex flex-wrap gap-2">
          {m.actions.map((a) => (
            <ActionLink key={a.href} a={a} onNavigate={onNavigate} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Assistant IA (maquette « Waxo Boutique » lignes 1240-1292) : bouton flottant « ɔ », bulle d'invitation facultative
 * et fenêtre de conversation. Écoute l'événement `waxo:assistant` ({ text? }) émis par les boutons « Demander à l'assistant »
 * des autres écrans et appelle `preventDefault()` pour signaler qu'il prend la main.
 */
export function AssistantWidget({ nudge = false }: { nudge?: boolean }) {
  const t = useTranslations("Assistant");
  const lang = useLocale() === "en" ? "en" : "fr";
  const pathname = usePathname();
  const st = useAssistant();
  const drawerOpen = useCartDrawerOpen();
  const [input, setInput] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  // Contexte envoyé au serveur : langue de la page et fiche produit consultée.
  const slug = /^\/produit\/([^/?#]+)/.exec(pathname)?.[1] ?? null;
  useEffect(() => {
    assistant.setContext({ lang, productSlug: slug });
  }, [lang, slug]);

  // Contrat d'intégration : les boutons des autres écrans émettent `waxo:assistant` (annulable).
  useEffect(() => {
    const onAsk = (e: Event) => {
      e.preventDefault();
      const text = (e as CustomEvent<{ text?: unknown }>).detail?.text;
      assistant.ask(typeof text === "string" ? text : undefined);
    };
    window.addEventListener(EVENT, onAsk);
    return () => window.removeEventListener(EVENT, onAsk);
  }, []);

  useEffect(() => (nudge ? assistant.scheduleNudge() : undefined), [nudge]);

  // Focus : champ de saisie à l'ouverture, retour à l'élément d'origine (ou au bouton flottant) à la fermeture.
  useEffect(() => {
    if (!st.open) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    const trigger = returnFocus.current;
    const launcher = launcherRef;
    return () => {
      requestAnimationFrame(() => (trigger?.isConnected ? trigger : launcher.current)?.focus());
    };
  }, [st.open]);

  // Défilement vers le dernier message.
  useEffect(() => {
    const el = listRef.current;
    if (el && st.open) el.scrollTop = el.scrollHeight;
  }, [st.msgs, st.busy, st.open]);

  // Plein écran mobile : la page derrière ne défile pas (maquette : fenêtre ouverte et largeur < 640 px).
  useEffect(() => {
    if (!st.open || window.innerWidth >= 640) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [st.open]);

  function submit() {
    const v = input.trim();
    if (!v || st.busy) return;
    setInput("");
    void assistant.send(v);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      assistant.close();
      return;
    }
    if (e.key !== "Tab") return;
    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((n) => n.offsetParent !== null);
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
  }

  const onCheckout = pathname.startsWith("/commande");
  const showLauncher = !st.open && !drawerOpen && !onCheckout;

  return (
    <>
      {showLauncher ? (
        <div className={`fixed right-5 z-30 flex flex-col items-end gap-[10px] ${st.stickyBuy ? "bottom-5 max-[979px]:bottom-24" : "bottom-5"}`}>
          {st.nudge ? (
            <div className="flex max-w-[260px] items-start gap-[10px] rounded-[18px_18px_4px_18px] bg-white px-4 py-[14px] text-[14px] leading-[1.4] shadow-[0_12px_30px_-12px_rgba(20,18,16,0.4)]" style={{ animation: "wxup .3s ease both" }}>
              <button type="button" onClick={() => assistant.open()} className="cursor-pointer border-0 bg-transparent p-0 text-left">
                {t("widget.nudge")}
              </button>
              <button type="button" onClick={() => assistant.dismissNudge()} aria-label={t("widget.nudgeDismiss")} className="text-text h-6 w-6 cursor-pointer border-0 bg-transparent p-0 text-[18px]">
                ×
              </button>
            </div>
          ) : null}
          <button
            ref={launcherRef}
            type="button"
            onClick={() => assistant.open()}
            aria-label={t("widget.launcher")}
            aria-haspopup="dialog"
            className="font-display bg-ink text-terracotta h-[60px] w-[60px] cursor-pointer rounded-full border-0 text-[28px] font-bold shadow-[0_12px_28px_-10px_rgba(20,18,16,0.5)] transition-transform duration-150 hover:scale-[1.06]"
          >
            ɔ
          </button>
        </div>
      ) : null}

      {st.open ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={t("widget.label")}
          data-screen-label="Assistant IA"
          onKeyDown={onKeyDown}
          className="bg-cream border-border fixed right-4 bottom-4 z-[60] flex h-[min(640px,calc(100dvh-32px))] w-[min(410px,calc(100vw-32px))] flex-col overflow-hidden rounded-[24px] border shadow-[0_24px_60px_-20px_rgba(20,18,16,0.55)]"
          style={{ animation: "wxup .25s ease both" }}
        >
          <div className="bg-ink text-cream flex items-center gap-3 px-4 py-[14px]">
            <Mark size={38} className="bg-cream text-terracotta" />
            <div className="flex flex-1 flex-col gap-[2px]">
              <strong className="text-[15px]">{t("widget.title")}</strong>
              <span className="text-[12px] text-[#B9B1A4]">{t("widget.subtitle")}</span>
            </div>
            <button
              type="button"
              onClick={() => assistant.close()}
              aria-label={t("widget.close")}
              className="text-cream h-11 w-11 cursor-pointer rounded-full border-0 bg-[#2C2823] text-[18px]"
            >
              ×
            </button>
          </div>

          <div ref={listRef} role="log" aria-live="polite" aria-label={t("widget.conversation")} className="flex flex-1 flex-col gap-3 overflow-y-auto p-[18px]">
            <div className="flex flex-col items-start gap-2">
              <div className="max-w-[86%] rounded-[16px_16px_16px_4px] bg-white px-[14px] py-[11px] text-[14.5px] leading-[1.45]">{t("widget.greeting")}</div>
            </div>
            {st.msgs.map((m) => (
              <Message key={m.id} m={m} onNavigate={() => window.innerWidth < 640 && assistant.close()} />
            ))}
            {st.busy ? (
              <div role="status" className="text-text self-start rounded-[16px_16px_16px_4px] bg-white px-4 py-3 text-[14px]" style={{ animation: "wxpulse 1.2s infinite" }}>
                {t("widget.thinking")}
              </div>
            ) : null}
            {st.msgs.length === 0 && !st.busy ? (
              <div role="group" aria-label={t("widget.suggestions")} className="mt-1 flex flex-wrap gap-2">
                {CHIP_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => void assistant.send(t(`chips.${k}`))}
                    className="border-border-strong min-h-11 cursor-pointer rounded-full border bg-white px-3 text-[13px] hover:bg-[#FFF4D6]"
                  >
                    {t(`chips.${k}`)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="border-border flex flex-col gap-[6px] border-t bg-white p-3">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={500}
                autoComplete="off"
                aria-label={t("widget.inputLabel")}
                placeholder={t("widget.placeholder")}
                className="border-border min-w-0 flex-1 rounded-full border bg-[#FAF8F3] px-4 py-3 text-[15px]"
              />
              <button
                type="submit"
                disabled={st.busy || !input.trim()}
                aria-label={t("widget.send")}
                className="bg-ink text-cream h-[46px] w-[46px] flex-none cursor-pointer rounded-full border-0 text-[18px] disabled:cursor-not-allowed disabled:opacity-50"
              >
                ↑
              </button>
            </form>
            <span className="text-muted text-center text-[11px]">{t("widget.disclaimer")}</span>
          </div>
        </div>
      ) : null}
    </>
  );
}
