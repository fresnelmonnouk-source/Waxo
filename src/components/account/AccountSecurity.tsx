"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { api, apiFieldErrors, errorCode, toast } from "@/lib/auth/client";
import { fieldErrors, passwordSchema } from "@/lib/auth/validation";
import { BTN_DARK, PasswordField } from "./ui";

/** Onglet « Sécurité » : changement de mot de passe (maquette 850-861). `recovery` : arrivée par un lien de réinitialisation (pas d'ancien mot de passe). */
export function AccountSecurity({ recovery, onDone }: { recovery: boolean; onDone: () => void }) {
  const t = useTranslations("Account");
  const tAuth = useTranslations("Auth");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState("");
  const [busy, setBusy] = useState(false);

  const err = (code?: string) => (code ? (tAuth.has(`errors.${code}`) ? tAuth(`errors.${code}`) : tAuth("errors.generic")) : "");
  const edit = (setter: (v: string) => void, key: string) => (v: string) => {
    setter(v);
    setErrors((e) => ({ ...e, [key]: "" }));
    setFormErr("");
  };

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const found: Record<string, string> = {};
    if (!recovery && !current) found.current = "passRequired";
    const parsed = passwordSchema.safeParse({ current: recovery ? undefined : current, next });
    if (!parsed.success) Object.assign(found, fieldErrors(parsed.error));
    if (confirm !== next && !found.confirm) found.confirm = "pwMismatch";
    if (Object.keys(found).length) return setErrors(found);

    setBusy(true);
    const res = await api("/api/me/password", "POST", recovery ? { next, recovery: true } : { current, next });
    setBusy(false);
    if (res.data?.ok === true) {
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.show(t("security.saved"));
      onDone();
      return;
    }
    const fields = apiFieldErrors(res);
    if (Object.keys(fields).length) setErrors(fields);
    else setFormErr(errorCode(res));
  }

  const toggle = { show, onToggle: () => setShow((s) => !s), showLabel: tAuth("show"), hideLabel: tAuth("hide") };
  return (
    <form onSubmit={save} noValidate className="flex max-w-[620px] flex-col gap-4 rounded-[24px] bg-white p-6">
      <strong className="text-[17px]">{t("security.title")}</strong>
      {recovery ? <p className="m-0 rounded-[14px] bg-[#FBEFC9] px-[14px] py-3 text-[14px] leading-[1.5]">{t("page.recoveryNote")}</p> : null}
      {!recovery ? (
        <PasswordField label={t("security.current")} value={current} onChange={edit(setCurrent, "current")} error={err(errors.current)} autoComplete="current-password" {...toggle} />
      ) : null}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <PasswordField
          label={t("security.next")}
          value={next}
          onChange={edit(setNext, "next")}
          error={err(errors.next)}
          autoComplete="new-password"
          placeholder={t("security.nextPh")}
          {...toggle}
        />
        <PasswordField label={t("security.confirm")} value={confirm} onChange={edit(setConfirm, "confirm")} error={err(errors.confirm)} autoComplete="new-password" {...toggle} />
      </div>
      {formErr ? (
        <span role="alert" className="text-[14px] font-medium text-terracotta-deep">
          {err(formErr)}
        </span>
      ) : null}
      <button type="submit" disabled={busy} className={`${BTN_DARK} h-[50px] self-start px-6`}>
        {busy ? t("security.saving") : t("security.save")}
      </button>
      <span className="border-t border-[#F0EBE1] pt-[14px] text-[13px] leading-[1.5] text-text">
        {t.rich("security.footer", { contact: (c) => <Link href="/contact">{c}</Link> })}
      </span>
    </form>
  );
}
