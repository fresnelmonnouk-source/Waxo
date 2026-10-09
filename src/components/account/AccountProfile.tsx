"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { api, apiFieldErrors, errorCode, refreshMe, toast } from "@/lib/auth/client";
import type { MeUser } from "@/lib/auth/types";
import { fieldErrors, prettyPhone, profileSchema } from "@/lib/auth/validation";
import { BTN_DARK, Checkbox, inputClass, TextField } from "./ui";

/** Onglet « Mes informations » (maquette 863-878). Colonnes écrites : prénom, nom, téléphone, adresse, newsletter. L'e-mail est en lecture seule. */
export function AccountProfile({ user }: { user: MeUser }) {
  const t = useTranslations("Account");
  const tAuth = useTranslations("Auth");
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(prettyPhone(user.phone) || user.phone);
  const [address, setAddress] = useState(user.address);
  const [news, setNews] = useState(user.news);
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
    const input = { firstName, lastName, phone, address, news };
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setBusy(true);
    const res = await api("/api/me/profile", "PATCH", input);
    setBusy(false);
    if (res.data?.ok === true) {
      await refreshMe();
      toast.show(t("profile.saved"));
      return;
    }
    const fields = apiFieldErrors(res);
    if (Object.keys(fields).length) setErrors(fields);
    else setFormErr(errorCode(res));
  }

  return (
    <form onSubmit={save} noValidate className="flex max-w-[620px] flex-col gap-4 rounded-[24px] bg-white p-6">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <TextField label={t("profile.first")} value={firstName} onChange={edit(setFirstName, "firstName")} error={err(errors.firstName)} autoComplete="given-name" />
        <TextField label={t("profile.last")} value={lastName} onChange={edit(setLastName, "lastName")} error={err(errors.lastName)} autoComplete="family-name" />
      </div>
      <TextField label={t("profile.phone")} value={phone} onChange={edit(setPhone, "phone")} error={err(errors.phone)} inputMode="tel" autoComplete="tel" />
      <label className="flex flex-col gap-[6px] text-[14px] font-medium">
        {t("profile.email")}
        <input value={user.email} readOnly autoComplete="email" className={`${inputClass(false)} cursor-default text-muted`} />
        <span className="text-[13px] font-normal text-muted">
          {t.rich("profile.emailNote", { contact: (c) => <Link href="/contact">{c}</Link> })}
        </span>
      </label>
      <TextField
        label={t("profile.address")}
        value={address}
        onChange={edit(setAddress, "address")}
        error={err(errors.address)}
        autoComplete="street-address"
        placeholder={t("profile.addressPh")}
      />
      <Checkbox checked={news} onChange={setNews}>
        {t("profile.news")}
      </Checkbox>
      {formErr ? (
        <span role="alert" className="text-[14px] font-medium text-terracotta-deep">
          {err(formErr)}
        </span>
      ) : null}
      <button type="submit" disabled={busy} className={`${BTN_DARK} h-[50px] self-start px-6`}>
        {busy ? t("profile.saving") : t("profile.save")}
      </button>
    </form>
  );
}
