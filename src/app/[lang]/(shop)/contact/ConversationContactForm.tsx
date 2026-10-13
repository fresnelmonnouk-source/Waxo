"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAssistant } from "@/components/assistant/store";
import { TurnstileWidget, type TurnstileHandle } from "@/components/checkout/TurnstileWidget";
import { BTN_DARK, BTN_OUTLINE, Honeypot, inputClass, TextField } from "@/components/account/ui";
import { escalationCategory, escalationSummary, isEscalationKind } from "@/lib/assistant/escalation";
import { api, apiFieldErrors, errorCode } from "@/lib/auth/client";
import { fieldErrors } from "@/lib/auth/validation";
import { createSchema } from "@/lib/conversations/schema";
import { CATEGORIES, type Category } from "@/lib/conversations/types";

/**
 * Formulaire de contact → nouvelle discussion (POST /api/contact). Catégorie choisie par le client, numéro de commande
 * facultatif, honeypot + délai mini + Turnstile (inerte sans clés). Arrivée depuis l'assistant (?depuis=assistant) :
 * catégorie déduite du motif et message pré-rempli avec les derniers messages du visiteur, lus dans la mémoire de l'onglet
 * (jamais dans l'URL). Après envoi : lien privé du fil, à garder.
 */
export function ConversationContactForm({ turnstileSiteKey }: { turnstileSiteKey: string | null }) {
  const t = useTranslations("Conversations");
  const tc = useTranslations("Contact");
  const tAuth = useTranslations("Auth");
  const locale = useLocale() === "en" ? "en" : "fr";
  const chat = useAssistant();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [category, setCategory] = useState<Category>("question");
  const [orderNumber, setOrderNumber] = useState("");
  const [body, setBody] = useState("");
  const [source, setSource] = useState<"contact" | "assistant">("contact");
  const [hp, setHp] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentPath, setSentPath] = useState<string | null | undefined>(undefined);
  const shownAt = useRef(0);
  const turnstile = useRef<TurnstileHandle>(null);
  const prefilled = useRef(false);

  useEffect(() => {
    shownAt.current = Date.now();
  }, [sentPath]);

  // Passage depuis l'assistant : une seule fois, à l'arrivée sur la page.
  useEffect(() => {
    if (prefilled.current) return;
    prefilled.current = true;
    const q = new URLSearchParams(window.location.search);
    if (q.get("depuis") !== "assistant") return;
    const motif = q.get("motif");
    const texts = chat.msgs.filter((m) => m.role === "u").map((m) => (m as { text: string }).text);
    const summary = escalationSummary(texts);
    /* eslint-disable react-hooks/set-state-in-effect -- pré-remplissage unique depuis l'URL et la mémoire de l'onglet */
    setSource("assistant");
    if (isEscalationKind(motif)) setCategory(escalationCategory(motif, summary));
    if (summary) setBody(summary);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [chat.msgs]);

  const err = (code?: string) => {
    if (!code) return "";
    if (t.has(`errors.${code}`)) return t(`errors.${code}`);
    if (tc.has(`errors.${code}`)) return tc(`errors.${code}`);
    return tAuth.has(`errors.${code}`) ? tAuth(`errors.${code}`) : tAuth("errors.generic");
  };
  const edit = (setter: (v: string) => void, key: string) => (v: string) => {
    setter(v);
    setErrors((e) => ({ ...e, [key]: "" }));
    setFormErr("");
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const input = { name, contact, category, orderNumber, body, lang: locale, source };
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setBusy(true);
    const captcha = (await turnstile.current?.token()) ?? undefined;
    const res = await api("/api/contact", "POST", { ...input, website: hp, t: shownAt.current, captcha });
    turnstile.current?.reset();
    setBusy(false);
    if (res.data?.ok === true) {
      const path = typeof res.data.path === "string" && res.data.path.startsWith(`/${locale}/discussion/`) ? res.data.path : null;
      setSentPath(path);
      setName("");
      setContact("");
      setOrderNumber("");
      setBody("");
      setCategory("question");
      setSource("contact");
      return;
    }
    const fields = apiFieldErrors(res);
    if (Object.keys(fields).length) setErrors(fields);
    else setFormErr(errorCode(res));
  }

  if (sentPath !== undefined) {
    return (
      <div className="flex flex-col items-start gap-[14px] py-3 [animation:wxup_.3s_ease_both]">
        <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-leaf text-[26px] text-white">
          ✓
        </span>
        <strong role="status" className="text-[20px]">
          {t("contact.sentTitle")}
        </strong>
        <span className="leading-[1.5] text-text">{t("contact.sentText")}</span>
        {sentPath ? (
          <>
            {/* Lien privé : navigation pleine page (pas de préchargement), jamais transmis à un autre site. */}
            <a href={sentPath} rel="noreferrer" className={`${BTN_DARK} min-h-11 px-[18px]`}>
              {t("contact.follow")}
            </a>
            <span className="text-[13px] leading-[1.5] text-muted">{t("contact.keepLink")}</span>
          </>
        ) : null}
        <button type="button" onClick={() => setSentPath(undefined)} className={`${BTN_OUTLINE} min-h-11 px-[18px]`}>
          {tc("another")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="relative flex flex-col gap-4">
      <Honeypot value={hp} onChange={setHp} />
      <strong className="text-[18px]">{tc("formTitle")}</strong>
      {source === "assistant" ? (
        <p role="note" className="m-0 rounded-[14px] bg-[#FFF4D6] px-4 py-3 text-[14px] leading-[1.5] text-ink">
          {t("contact.fromAssistant")}
        </p>
      ) : null}
      <TextField label={tc("name")} value={name} onChange={edit(setName, "name")} error={err(errors.name)} autoComplete="name" maxLength={120} />
      <TextField label={tc("contact")} value={contact} onChange={edit(setContact, "contact")} error={err(errors.contact)} placeholder={tc("contactPh")} maxLength={200} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <label className="flex min-w-0 flex-col gap-[6px] text-[14px] font-medium">
          {t("contact.category")}
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as Category);
              setErrors((x) => ({ ...x, category: "" }));
            }}
            aria-invalid={errors.category ? true : undefined}
            className="min-h-12 rounded-[14px] border border-border bg-[#FAF8F3] px-3 text-[15px] font-normal"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </select>
          {errors.category ? <span className="text-[13px] font-normal text-terracotta-deep">{err(errors.category)}</span> : null}
        </label>
        <TextField
          label={tc("orderNumber")}
          value={orderNumber}
          onChange={edit(setOrderNumber, "orderNumber")}
          error={err(errors.orderNumber)}
          placeholder={tc("orderNumberPh")}
          maxLength={40}
        />
      </div>
      <label className="flex flex-col gap-[6px] text-[14px] font-medium">
        {tc("message")}
        <textarea
          value={body}
          onChange={(e) => edit(setBody, "body")(e.target.value)}
          rows={5}
          maxLength={3000}
          aria-invalid={errors.body ? true : undefined}
          className={`${inputClass(!!errors.body, "cream", "py-3")} resize-y leading-[1.5]`}
        />
        <span aria-live="polite" className="text-[13px] font-normal text-terracotta-deep">
          {err(errors.body)}
        </span>
      </label>
      <TurnstileWidget ref={turnstile} siteKey={turnstileSiteKey} lang={locale} />
      {formErr ? (
        <span role="alert" className="text-[14px] font-medium text-terracotta-deep">
          {err(formErr)}
        </span>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="h-[52px] cursor-pointer rounded-full border-0 bg-ink text-[16px] font-semibold text-cream transition-colors hover:bg-[#2C2823] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? tc("sending") : tc("send")}
      </button>
      <span className="text-[12px] leading-[1.5] text-muted">{t.rich("contact.privacy", { privacy: (c) => <Link href="/confidentialite">{c}</Link> })}</span>
    </form>
  );
}
