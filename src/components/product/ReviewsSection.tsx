"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { fetchMe, type MeUser } from "@/lib/checkout/me";
import { Stars } from "./Stars";

export type ReviewView = {
  id: string;
  author: string;
  rating: number;
  body: string;
  dateTxt: string;
  verified: boolean;
};

type Props = {
  productId: string;
  productName: string;
  average: number;
  avgTxt: string;
  countTxt: string;
  reviews: ReviewView[];
};

const STAR_PATH = "M12 2.6l2.8 6 6.6.6-5 4.5 1.5 6.5L12 16.9l-5.9 3.3 1.5-6.5-5-4.5 6.6-.6z";
const reviewedKey = (id: string) => `waxo:reviewed:${id}`;

function wasReviewed(id: string): boolean {
  try {
    return localStorage.getItem(reviewedKey(id)) === "1";
  } catch {
    return false;
  }
}
function markReviewed(id: string) {
  try {
    localStorage.setItem(reviewedKey(id), "1");
  } catch {
    /* stockage bloqué : le serveur refuse de toute façon un second avis */
  }
}

/** Avis clients : synthèse, liste, formulaire (réservé aux clients inscrits, comme dans la maquette). */
export function ReviewsSection({ productId, productName, average, avgTxt, countTxt, reviews }: Props) {
  const t = useTranslations("Reviews");
  const locale = useLocale();
  const [me, setMe] = useState<MeUser | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [panel, setPanel] = useState<"none" | "form" | "login">("none");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [thanks, setThanks] = useState(false);
  const [mine, setMine] = useState<ReviewView[]>([]);
  const openedAt = useRef(0);
  const honeypot = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    void fetchMe(ctrl.signal).then(setMe);
    // Lecture du drapeau « déjà noté » après hydratation (localStorage n'existe pas côté serveur).
    queueMicrotask(() => setReviewed(wasReviewed(productId)));
    return () => ctrl.abort();
  }, [productId]);

  function start() {
    if (!me) {
      setPanel("login");
      return;
    }
    openedAt.current = Date.now();
    setRating(0);
    setHover(0);
    setText("");
    setError("");
    setThanks(false);
    setPanel("form");
  }

  async function submit() {
    if (busy) return;
    if (!rating) return setError(t("errRating"));
    if (text.trim().length < 15) return setError(t("errShort"));
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          rating,
          body: text.trim(),
          author: me?.name ?? "",
          lang: locale === "en" ? "en" : "fr",
          website: honeypot.current?.value ?? "",
          t: openedAt.current,
        }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; code?: string; message?: string } | null;
      if (res.ok && json?.ok) {
        markReviewed(productId);
        setReviewed(true);
        setMine((m) => [
          {
            id: `mine-${Date.now()}`,
            author: me?.name || (locale === "en" ? "Customer" : "Client"),
            rating,
            body: text.trim(),
            dateTxt: new Date().toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
            verified: false,
          },
          ...m,
        ]);
        setPanel("none");
        setThanks(true);
      } else {
        if (json?.code === "already_reviewed") {
          markReviewed(productId);
          setReviewed(true);
        }
        setError(json?.message || t("errNetwork"));
      }
    } catch {
      setError(t("errNetwork"));
    } finally {
      setBusy(false);
    }
  }

  const shown = hover || rating;
  const all = [...mine.map((r) => ({ ...r, isMine: true })), ...reviews.map((r) => ({ ...r, isMine: false }))];

  return (
    <section
      id="avis"
      aria-label={t("title")}
      className="mt-14 grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-start gap-9 border-t border-border pt-10"
    >
      <div className="flex flex-col gap-3.5">
        <h2 className="font-display m-0 text-[26px] font-semibold tracking-[-0.03em]">{t("title")}</h2>
        <div className="flex items-center gap-3.5">
          <strong className="font-display text-[52px] leading-none font-semibold tracking-[-0.04em]">{avgTxt}</strong>
          <div className="flex flex-col gap-1">
            <Stars value={average} size={20} gap={2} />
            <span className="text-[14px] text-text">{countTxt}</span>
          </div>
        </div>
        <span className="text-[14px] leading-normal text-text">{t("policy")}</span>
        {reviewed ? (
          <span className="self-start rounded-full bg-leaf-bg px-[18px] py-3 text-[14px] font-semibold text-leaf">
            {t("ctaDone")}
          </span>
        ) : (
          <button
            type="button"
            onClick={start}
            className="h-[50px] cursor-pointer self-start rounded-full border-0 bg-ink px-[22px] text-[15px] font-semibold text-cream hover:bg-[#2C2823]"
          >
            {t("ctaGive")}
          </button>
        )}
        {thanks ? (
          <span role="status" className="text-[14px] font-semibold text-leaf">
            {t("thanks")}
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col">
        {panel === "login" ? (
          <div className="mb-3 flex animate-[wxup_.25s_ease_both] flex-col gap-3.5 rounded-card border-[1.5px] border-ink bg-card p-5">
            <div className="flex flex-col gap-1">
              <strong className="text-[16px]">{t("loginTitle")}</strong>
              <span className="text-[13px] text-text">{t("loginText")}</span>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Link
                href="/connexion"
                className="inline-flex h-12 items-center rounded-full bg-ink px-[22px] font-semibold text-cream no-underline hover:bg-[#2C2823] hover:text-cream"
              >
                {t("signIn")}
              </Link>
              <button
                type="button"
                onClick={() => setPanel("none")}
                className="h-12 cursor-pointer rounded-full border border-border-strong bg-transparent px-5"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        ) : null}

        {panel === "form" ? (
          <div className="mb-3 flex animate-[wxup_.25s_ease_both] flex-col gap-3.5 rounded-card border-[1.5px] border-ink bg-card p-5">
            <div className="flex flex-col gap-1">
              <strong className="text-[16px]">{t("formTitle", { name: productName })}</strong>
              <span className="text-[13px] text-text">
                {me?.name ? t("publishedAs", { name: me.name }) : t("publishedAsProfile")}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <div role="group" aria-label={t("ratingGroup")} onMouseLeave={() => setHover(0)} className="flex">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={t("starLabel", { count: i })}
                    aria-pressed={rating === i}
                    onClick={() => {
                      setRating(i);
                      setError("");
                    }}
                    onMouseEnter={() => setHover(i)}
                    className="flex h-11 w-11 cursor-pointer items-center justify-center border-0 bg-transparent p-1.5"
                  >
                    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
                      <path
                        d={STAR_PATH}
                        fill={i <= shown ? "#141210" : "#fff"}
                        stroke="#141210"
                        strokeWidth="1.3"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                ))}
              </div>
              <span className="text-[14px] font-medium">{t(`label${shown}` as "label0")}</span>
            </div>
            <label className="flex flex-col gap-1.5 text-[14px] font-medium">
              {t("comment")}
              <textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setError("");
                }}
                rows={4}
                maxLength={1500}
                placeholder={t("commentPlaceholder")}
                className="resize-y rounded-[14px] border border-border bg-[#FAF8F3] px-3.5 py-3 text-[15px] leading-normal font-normal"
              />
            </label>
            {/* Honeypot : champ invisible que seuls les robots remplissent. */}
            <input
              ref={honeypot}
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute -left-[9999px] h-0 w-0 opacity-0"
            />
            {error ? (
              <span role="alert" className="text-[13px] text-terracotta-deep">
                {error}
              </span>
            ) : null}
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                aria-busy={busy}
                className="h-12 cursor-pointer rounded-full border-0 bg-ink px-[22px] font-semibold text-cream hover:bg-[#2C2823] disabled:cursor-wait disabled:opacity-70"
              >
                {busy ? t("publishing") : t("publish")}
              </button>
              <button
                type="button"
                onClick={() => setPanel("none")}
                className="h-12 cursor-pointer rounded-full border border-border-strong bg-transparent px-5"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        ) : null}

        {all.map((r) => (
          <div key={r.id} className="flex flex-col gap-2 border-b border-border py-[18px]">
            <div className="flex flex-wrap items-center gap-2.5">
              <Stars value={r.rating} size={15} />
              <strong className="text-[14px]">{r.author}</strong>
              {r.verified ? (
                <span className="rounded-full bg-leaf-bg px-[9px] py-[3px] text-[12px] font-semibold text-leaf">
                  {t("verified")}
                </span>
              ) : null}
              {r.isMine ? (
                <span className="rounded-full bg-[#FBEFC9] px-[9px] py-[3px] text-[12px] font-semibold">{t("mine")}</span>
              ) : null}
              <span className="ml-auto text-[13px] text-muted">{r.dateTxt}</span>
            </div>
            <p className="m-0 text-[15px] leading-[1.55] text-pretty">{r.body}</p>
          </div>
        ))}
        {all.length === 0 ? <span className="py-[18px] text-text">{t("empty")}</span> : null}
      </div>
    </section>
  );
}
