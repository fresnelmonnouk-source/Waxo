"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { OPEN_COOKIES_EVENT, type ConsentChoice } from "@/lib/tracking/consent";
import { saveConsent, useConsent } from "@/lib/tracking/consent-client";

/**
 * Tant que le pied de page n'a pas son lien « Gérer mes cookies » (qui émet `waxo:cookies`), un petit bouton flottant
 * permet de rouvrir le choix. Passer à `false` une fois le lien du pied de page en place.
 */
const FLOATING_REOPEN = true;

const BTN =
  "inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-full px-5 text-[14px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
// Refuser pèse autant qu'accepter (même taille, même graisse) : pas de « dark pattern ».
const BTN_PRIMARY = `${BTN} bg-ink text-cream hover:bg-[#2C2823]`;
const BTN_SECONDARY = `${BTN} border-[1.5px] border-ink bg-white text-ink hover:bg-cream`;

function Toggle({ id, checked, onChange, label, text, disabled, stateLabel }: { id: string; checked: boolean; onChange?: (v: boolean) => void; label: string; text: string; disabled?: boolean; stateLabel: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[14px] border border-border bg-cream px-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[14px] font-semibold text-ink">
          {label}
        </label>
        <p id={`${id}-d`} className="m-0 mt-[2px] text-[13px] leading-normal text-muted">
          {text}
        </p>
      </div>
      {disabled ? (
        <span className="shrink-0 pt-[2px] text-[13px] font-semibold text-leaf">{stateLabel}</span>
      ) : (
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-describedby={`${id}-d`}
          onClick={() => onChange?.(!checked)}
          className={`relative h-[44px] w-[64px] shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink`}
        >
          <span aria-hidden="true" className={`absolute top-1/2 left-0 h-[28px] w-[52px] -translate-y-1/2 rounded-full transition-colors ${checked ? "bg-leaf" : "bg-border-strong"}`} />
          <span
            aria-hidden="true"
            className={`absolute top-1/2 h-[22px] w-[22px] -translate-y-1/2 rounded-full bg-white shadow transition-[left] ${checked ? "left-[27px]" : "left-[3px]"}`}
          />
          <span className="sr-only">{checked ? stateLabel : ""}</span>
        </button>
      )}
    </div>
  );
}

/** Bandeau de consentement strict (opt-in). Aucun script de suivi n'est chargé avant « Tout accepter » / « Enregistrer ». */
export function ConsentBanner() {
  const t = useTranslations("Consent");
  const consent = useConsent();
  const [reopened, setReopened] = useState(false);
  const [details, setDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const [announce, setAnnounce] = useState("");

  const open = consent === null || reopened;

  const openFromEvent = useCallback(() => {
    setAnalytics(consent?.analytics ?? false);
    setMarketing(consent?.marketing ?? false);
    setDetails(true);
    setReopened(true);
  }, [consent]);

  useEffect(() => {
    window.addEventListener(OPEN_COOKIES_EVENT, openFromEvent);
    return () => window.removeEventListener(OPEN_COOKIES_EVENT, openFromEvent);
  }, [openFromEvent]);

  // Rouvert à la demande : le focus passe sur la boîte (premier affichage : on ne vole pas le focus).
  useEffect(() => {
    if (reopened) boxRef.current?.focus();
  }, [reopened, details]);

  useEffect(() => {
    if (!open || consent === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReopened(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, consent]);

  if (consent === undefined) return null; // serveur / hydratation : rien (pas de décalage)

  const commit = (choice: ConsentChoice) => {
    saveConsent(choice);
    setReopened(false);
    setDetails(false);
    setAnnounce(t("saved"));
  };

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        {announce}
      </div>
      {open ? (
        <div
          ref={boxRef}
          role="dialog"
          aria-modal="false"
          aria-labelledby="waxo-consent-title"
          aria-describedby="waxo-consent-text"
          tabIndex={-1}
          className="fixed right-3 bottom-3 left-3 z-[90] mx-auto max-w-[560px] rounded-card border border-border bg-white p-5 text-text shadow-[0_18px_50px_rgba(20,18,16,0.22)] outline-none sm:right-auto sm:bottom-4 sm:left-4 sm:mx-0"
        >
          <h2 id="waxo-consent-title" className="font-display m-0 text-[17px] font-semibold tracking-[-0.02em] text-ink">
            {t("title")}
          </h2>
          <p id="waxo-consent-text" className="m-0 mt-2 text-[14px] leading-normal">
            {t("text")}{" "}
            <Link href="/confidentialite" className="text-ink underline">
              {t("privacyLink")}
            </Link>
          </p>

          {details ? (
            <div className="mt-4 flex flex-col gap-2">
              <h3 className="m-0 text-[13px] font-bold tracking-[0.08em] text-muted uppercase">{t("detailsTitle")}</h3>
              <Toggle id="waxo-c-ess" checked disabled label={t("essentialTitle")} text={t("essentialText")} stateLabel={t("essentialState")} />
              <Toggle id="waxo-c-ana" checked={analytics} onChange={setAnalytics} label={t("analyticsTitle")} text={t("analyticsText")} stateLabel={t("on")} />
              <Toggle id="waxo-c-mkt" checked={marketing} onChange={setMarketing} label={t("marketingTitle")} text={t("marketingText")} stateLabel={t("on")} />
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {details ? (
              <>
                <button type="button" className={BTN_PRIMARY} onClick={() => commit({ analytics, marketing })}>
                  {t("save")}
                </button>
                <button type="button" className={BTN_SECONDARY} onClick={() => commit({ analytics: true, marketing: true })}>
                  {t("acceptAll")}
                </button>
                <button type="button" className={BTN_SECONDARY} onClick={() => commit({ analytics: false, marketing: false })}>
                  {t("refuseAll")}
                </button>
              </>
            ) : (
              <>
                <button type="button" className={BTN_PRIMARY} onClick={() => commit({ analytics: true, marketing: true })}>
                  {t("acceptAll")}
                </button>
                <button type="button" className={BTN_PRIMARY} onClick={() => commit({ analytics: false, marketing: false })}>
                  {t("refuseAll")}
                </button>
                <button
                  type="button"
                  className={BTN_SECONDARY}
                  onClick={() => {
                    setAnalytics(false);
                    setMarketing(false);
                    setDetails(true);
                  }}
                >
                  {t("customize")}
                </button>
              </>
            )}
            {consent ? (
              <button type="button" className={`${BTN} text-ink underline`} onClick={() => setReopened(false)}>
                {t("close")}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {FLOATING_REOPEN && consent && !open ? (
        <button
          type="button"
          onClick={openFromEvent}
          aria-label={t("reopenLabel")}
          title={t("reopenLabel")}
          className="fixed bottom-[88px] left-3 z-40 inline-flex h-[44px] w-[44px] cursor-pointer items-center justify-center rounded-full border border-border-strong bg-white text-ink shadow-md hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink md:bottom-4"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3a9 9 0 1 0 9 9 4 4 0 0 1-4-4 4 4 0 0 1-5-5Z" />
            <circle cx="9" cy="12" r="1" fill="currentColor" />
            <circle cx="14" cy="15" r="1" fill="currentColor" />
            <circle cx="10" cy="16.5" r=".6" fill="currentColor" />
          </svg>
        </button>
      ) : null}
    </>
  );
}

/** Lien texte « Gérer mes cookies » prêt à poser dans le pied de page (émet `waxo:cookies`). */
export function CookieSettingsLink({ className, children }: { className?: string; children?: React.ReactNode }) {
  const t = useTranslations("Consent");
  return (
    <button
      type="button"
      className={className ?? "cursor-pointer border-0 bg-transparent p-0 text-[14px] text-cream underline hover:text-sun"}
      onClick={() => window.dispatchEvent(new Event(OPEN_COOKIES_EVENT))}
    >
      {children ?? t("reopenLabel")}
    </button>
  );
}
