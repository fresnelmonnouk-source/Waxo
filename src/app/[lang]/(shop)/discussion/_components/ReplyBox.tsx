"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Honeypot, inputClass } from "@/components/account/ui";
import { api, apiFieldErrors, errorCode } from "@/lib/auth/client";
import { BODY_MAX } from "@/lib/conversations/types";

type Target = { kind: "token"; token: string } | { kind: "account"; id: string };

/**
 * Réponse du client au fil. Par lien privé : POST /api/conversations/reply (jeton dans le CORPS). Connecté :
 * POST /api/conversations/mine/{id}. Honeypot + délai mini côté serveur. Après envoi : le fil est rechargé.
 */
export function ReplyBox({ target, resolved, onSent }: { target: Target; resolved: boolean; onSent?: () => void }) {
  const t = useTranslations("Conversations");
  const tAuth = useTranslations("Auth");
  const locale = useLocale() === "en" ? "en" : "fr";
  const router = useRouter();
  const [body, setBody] = useState("");
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = Date.now();
  }, []);

  const msg = (code: string) => (t.has(`errors.${code}`) ? t(`errors.${code}`) : tAuth.has(`errors.${code}`) ? tAuth(`errors.${code}`) : tAuth("errors.generic"));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const text = body.trim();
    if (text.length < 2) return setError(msg("textShort"));
    setBusy(true);
    setError("");
    setDone(false);
    const payload = { body: text, lang: locale, website: hp, t: shownAt.current };
    const res =
      target.kind === "token"
        ? await api("/api/conversations/reply", "POST", { ...payload, token: target.token })
        : await api(`/api/conversations/mine/${encodeURIComponent(target.id)}`, "POST", payload);
    setBusy(false);
    if (res.data?.ok === true) {
      setBody("");
      setDone(true);
      if (onSent) onSent();
      else router.refresh();
      return;
    }
    const fields = apiFieldErrors(res);
    setError(msg(fields.body ?? errorCode(res)));
  }

  return (
    <form onSubmit={submit} noValidate className="relative flex flex-col gap-3 rounded-[24px] bg-white p-5">
      <Honeypot value={hp} onChange={setHp} />
      <strong className="text-[17px]">{t("page.replyTitle")}</strong>
      {resolved ? <p className="m-0 text-[14px] leading-[1.5] text-text">{t("page.resolvedHint")}</p> : null}
      <label className="flex flex-col gap-[6px] text-[14px] font-medium">
        {t("page.replyLabel")}
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setError("");
            setDone(false);
          }}
          rows={4}
          maxLength={BODY_MAX}
          aria-invalid={error ? true : undefined}
          className={`${inputClass(!!error, "cream", "py-3")} resize-y leading-[1.5]`}
        />
      </label>
      <span aria-live="polite" className={`text-[13px] ${error ? "text-terracotta-deep" : "text-leaf"}`}>
        {error || (done ? t("page.sent") : "")}
      </span>
      <button
        type="submit"
        disabled={busy}
        className="h-[50px] cursor-pointer self-start rounded-full border-0 bg-ink px-6 text-[15px] font-semibold text-cream transition-colors hover:bg-[#2C2823] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? t("page.sending") : t("page.send")}
      </button>
    </form>
  );
}
