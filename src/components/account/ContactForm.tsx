"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { api, apiFieldErrors, errorCode } from "@/lib/auth/client";
import { CONTACT_SUBJECTS, contactSchema, fieldErrors } from "@/lib/auth/validation";
import { BTN_OUTLINE, Honeypot, inputClass, TextField } from "./ui";

/** Formulaire de contact (maquette 564-600) → POST /api/contact (table `messages`). */
export function ContactForm() {
  const t = useTranslations("Contact");
  const tAuth = useTranslations("Auth");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [subject, setSubject] = useState<(typeof CONTACT_SUBJECTS)[number]>("order");
  const [orderNumber, setOrderNumber] = useState("");
  const [body, setBody] = useState("");
  const [hp, setHp] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = Date.now();
  }, [sent]);

  const err = (code?: string) => {
    if (!code) return "";
    if (t.has(`errors.${code}`)) return t(`errors.${code}`);
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
    const input = { name, contact, subject, orderNumber, body };
    const parsed = contactSchema.safeParse(input);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setBusy(true);
    const res = await api("/api/contact", "POST", { ...input, website: hp, t: shownAt.current });
    setBusy(false);
    if (res.data?.ok === true) {
      setSent(true);
      setName("");
      setContact("");
      setOrderNumber("");
      setBody("");
      setSubject("order");
      return;
    }
    const fields = apiFieldErrors(res);
    if (Object.keys(fields).length) setErrors(fields);
    else setFormErr(errorCode(res));
  }

  if (sent) {
    return (
      <div className="flex flex-col items-start gap-[14px] py-3 [animation:wxup_.3s_ease_both]">
        <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-leaf text-[26px] text-white">
          ✓
        </span>
        <strong role="status" className="text-[20px]">
          {t("sentTitle")}
        </strong>
        <span className="leading-[1.5] text-text">{t("sentText")}</span>
        <button type="button" onClick={() => setSent(false)} className={`${BTN_OUTLINE} min-h-11 px-[18px]`}>
          {t("another")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="relative flex flex-col gap-4">
      <Honeypot value={hp} onChange={setHp} />
      <strong className="text-[18px]">{t("formTitle")}</strong>
      <TextField label={t("name")} value={name} onChange={edit(setName, "name")} error={err(errors.name)} autoComplete="name" maxLength={120} />
      <TextField label={t("contact")} value={contact} onChange={edit(setContact, "contact")} error={err(errors.contact)} placeholder={t("contactPh")} maxLength={200} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <label className="flex min-w-0 flex-col gap-[6px] text-[14px] font-medium">
          {t("subject")}
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value as (typeof CONTACT_SUBJECTS)[number])}
            className="min-h-12 rounded-[14px] border border-border bg-[#FAF8F3] px-3 text-[15px] font-normal"
          >
            {CONTACT_SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {t(`subjects.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <TextField
          label={t("orderNumber")}
          value={orderNumber}
          onChange={edit(setOrderNumber, "orderNumber")}
          error={err(errors.orderNumber)}
          placeholder={t("orderNumberPh")}
          maxLength={40}
        />
      </div>
      <label className="flex flex-col gap-[6px] text-[14px] font-medium">
        {t("message")}
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
        {busy ? t("sending") : t("send")}
      </button>
      <span className="text-[12px] leading-[1.5] text-muted">{t.rich("privacy", { privacy: (c) => <Link href="/confidentialite">{c}</Link> })}</span>
    </form>
  );
}
