"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type Field = "rating" | "body" | "city";
type ApiReply = {
  ok?: boolean;
  pending?: boolean;
  code?: string;
  message?: string;
  fields?: string[];
} | null;

const STAR_PATH = "M12 2.6l2.8 6 6.6.6-5 4.5 1.5 6.5L12 16.9l-5.9 3.3 1.5-6.5-5-4.5 6.6-.6z";
const FIELD =
  "rounded-[14px] border border-border bg-[#FAF8F3] px-3.5 py-3 text-[16px] leading-normal font-normal aria-[invalid=true]:border-terracotta-deep";

/**
 * Formulaire « Donner mon avis sur Wá xɔ » → POST /api/site-reviews. Le serveur vérifie la session, l'éligibilité
 * (commande livrée) et l'unicité ; ses messages (déjà traduits) sont affichés tels quels.
 */
export function SiteReviewForm() {
  const t = useTranslations("SiteReviews");
  const locale = useLocale();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState<Field[]>([]);
  const [needLogin, setNeedLogin] = useState(false);
  const openedAt = useRef(0);
  const honeypot = useRef<HTMLInputElement>(null);

  useEffect(() => {
    openedAt.current = Date.now();
  }, []);

  function clearError(field: Field) {
    setError("");
    setInvalid((f) => f.filter((x) => x !== field));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!rating) {
      setInvalid(["rating"]);
      return setError(t("errRating"));
    }
    if (body.trim().length < 10) {
      setInvalid(["body"]);
      return setError(t("errBody"));
    }
    setBusy(true);
    setError("");
    setInvalid([]);
    setNeedLogin(false);
    try {
      const res = await fetch("/api/site-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          rating,
          body: body.trim(),
          city: city.trim() || undefined,
          lang: locale === "en" ? "en" : "fr",
          website: honeypot.current?.value ?? "",
          t: openedAt.current,
        }),
      });
      const json = (await res.json().catch(() => null)) as ApiReply;
      if (res.ok && json?.ok) {
        setDone(true);
        return;
      }
      if (json?.code === "login_required" || res.status === 401) setNeedLogin(true);
      if (json?.code === "invalid_request" && Array.isArray(json.fields)) {
        setInvalid(json.fields.filter((f): f is Field => f === "rating" || f === "body" || f === "city"));
      }
      setError(json?.message || t("errNetwork"));
    } catch {
      setError(t("errNetwork"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="bg-leaf-bg text-leaf rounded-card p-5 text-[16px] leading-[1.55] font-semibold">
        <p className="m-0">{t("success")}</p>
        <Link href="/" className="text-leaf! hover:text-leaf! mt-3 inline-flex min-h-11 items-center underline">
          {t("backHome")}
        </Link>
      </div>
    );
  }

  const bad = (f: Field) => invalid.includes(f);

  return (
    <form onSubmit={submit} noValidate className="bg-card rounded-card flex flex-col gap-5 p-5 min-[560px]:p-7">
      <fieldset
        className="m-0 flex flex-col gap-2 border-0 p-0"
        aria-describedby={bad("rating") && error ? "site-review-error" : undefined}
      >
        <legend className="mb-2 p-0 text-[15px] font-semibold">{t("ratingLegend")}</legend>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((i) => (
              <label
                key={i}
                className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink"
              >
                <input
                  type="radio"
                  name="rating"
                  value={i}
                  checked={rating === i}
                  onChange={() => {
                    setRating(i);
                    clearError("rating");
                  }}
                  className="absolute inset-0 m-0 cursor-pointer opacity-0"
                />
                <span className="sr-only">{t("starOption", { count: i })}</span>
                <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
                  <path d={STAR_PATH} fill={i <= rating ? "#141210" : "#fff"} stroke="#141210" strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
              </label>
            ))}
          </div>
          <span className="text-[14px] font-medium" aria-hidden="true">
            {t(`label${rating}` as "label0")}
          </span>
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5 text-[15px] font-semibold">
        {t("body")}
        <textarea
          name="body"
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            clearError("body");
          }}
          rows={5}
          maxLength={600}
          required
          aria-invalid={bad("body") || undefined}
          aria-describedby="site-review-body-hint"
          placeholder={t("bodyPlaceholder")}
          className={`${FIELD} resize-y`}
        />
        <span id="site-review-body-hint" className="text-muted flex flex-wrap justify-between gap-2 text-[13px] font-normal">
          <span>{t("bodyHint")}</span>
          <span>{t("counter", { count: body.length })}</span>
        </span>
      </label>

      <label className="flex flex-col gap-1.5 text-[15px] font-semibold">
        {t("city")}
        <input
          type="text"
          name="city"
          value={city}
          onChange={(e) => {
            setCity(e.target.value);
            clearError("city");
          }}
          maxLength={40}
          autoComplete="address-level2"
          aria-invalid={bad("city") || undefined}
          placeholder={t("cityPlaceholder")}
          className={`${FIELD} min-h-12`}
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
        <div role="alert" id="site-review-error" className="text-terracotta-deep flex flex-col gap-3 text-[14px] leading-[1.5]">
          <span>{error}</span>
          {needLogin ? (
            <Link
              href="/connexion?next=/avis-boutique"
              className="bg-ink text-cream! hover:text-cream! inline-flex min-h-12 items-center self-start rounded-full px-[22px] font-semibold no-underline hover:bg-[#2C2823]"
            >
              {t("signIn")}
            </Link>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        aria-busy={busy}
        className="bg-ink text-cream min-h-12 cursor-pointer self-start rounded-full border-0 px-[26px] text-[16px] font-semibold hover:bg-[#2C2823] disabled:cursor-wait disabled:opacity-70"
      >
        {busy ? t("sending") : t("submit")}
      </button>
    </form>
  );
}
