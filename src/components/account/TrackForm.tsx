"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { api, apiFieldErrors, errorCode } from "@/lib/auth/client";
import type { TrackView } from "@/lib/auth/types";
import { fieldErrors, trackSchema } from "@/lib/auth/validation";
import { fmtXof } from "@/lib/money";
import { fmtDate } from "./actions";
import { OrderSteps, StatusBadge } from "./OrderParts";
import { BTN_DARK, BTN_OUTLINE, Honeypot, TextField } from "./ui";

/** Suivi invité (/suivi) : numéro WX-… + e-mail ou téléphone de la commande. Pas de maquette : même langage visuel que « Mon compte ». */
export function TrackForm() {
  const t = useTranslations("Track");
  const tAuth = useTranslations("Auth");
  const locale = useLocale();
  const [number, setNumber] = useState("");
  const [contact, setContact] = useState("");
  const [hp, setHp] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<TrackView | null>(null);
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = Date.now();
  }, []);

  const err = (code?: string) => {
    if (!code) return "";
    if (code === "notFound") return t("notFound");
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
    const parsed = trackSchema.safeParse({ number, contact });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setBusy(true);
    const res = await api("/api/orders/track", "POST", { number: parsed.data.number, contact: parsed.data.contact, website: hp, t: shownAt.current });
    setBusy(false);
    const found = res.data?.order as TrackView | undefined;
    if (res.data?.ok === true && found) return setOrder(found);
    const fields = apiFieldErrors(res);
    if (Object.keys(fields).length) setErrors(fields);
    else setFormErr(errorCode(res));
  }

  if (order) {
    return (
      <div className="flex max-w-[620px] flex-col gap-[18px] rounded-[24px] bg-white p-6 [animation:wxup_.3s_ease_both]">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <strong className="text-[17px]">{order.number}</strong>
          <StatusBadge status={order.status} />
        </div>
        <span className="text-[14px] text-text">{t("placedOn", { date: fmtDate(order.createdAt, locale) })}</span>
        <OrderSteps status={order.status} />
        <div className="flex flex-col">
          <strong className="pb-2 text-[14px] text-muted">{t("items")}</strong>
          {order.items.map((it, i) => (
            <div key={`${it.name}-${i}`} className="flex flex-wrap items-center gap-x-[14px] gap-y-[10px] border-b border-[#F0EBE1] py-[10px]">
              <span className="min-w-[180px] flex-[1_1_180px] text-[15px]">{it.name}</span>
              <span className="text-[14px] text-text">× {it.qty}</span>
              <span className="min-w-20 text-right text-[14px] font-semibold">{fmtXof(it.unitPrice * it.qty)}</span>
            </div>
          ))}
          <strong className="flex justify-between pt-3 text-[15px]">
            <span>{t("total")}</span>
            {fmtXof(order.total)}
          </strong>
        </div>
        <span className="text-[13px] text-text">
          {t.rich("help", { number: order.number, contact: (c) => <Link href="/contact">{c}</Link> })}
        </span>
        <button type="button" onClick={() => setOrder(null)} className={`${BTN_OUTLINE} min-h-11 self-start px-[18px] text-[14px]`}>
          {t("again")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex max-w-[560px] flex-col gap-4">
      <form onSubmit={submit} noValidate className="relative flex flex-col gap-4 rounded-[24px] bg-white p-6">
        <Honeypot value={hp} onChange={setHp} />
        <TextField
          label={t("number")}
          value={number}
          onChange={edit(setNumber, "number")}
          error={err(errors.number)}
          placeholder={t("numberPh")}
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={40}
        />
        <TextField
          label={t("contact")}
          value={contact}
          onChange={edit(setContact, "contact")}
          error={err(errors.contact)}
          placeholder={t("contactPh")}
          autoComplete="email"
          maxLength={200}
        />
        {formErr ? (
          <span role="alert" className="text-[14px] font-medium text-terracotta-deep">
            {err(formErr)}
          </span>
        ) : null}
        <button type="submit" disabled={busy} className={`${BTN_DARK} h-[52px] text-[16px]`}>
          {busy ? t("searching") : t("submit")}
        </button>
      </form>
      <span className="px-1 text-[14px] leading-[1.5] text-text">{t.rich("account", { account: (c) => <Link href="/compte">{c}</Link> })}</span>
    </div>
  );
}
