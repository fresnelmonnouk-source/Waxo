"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { api, apiFieldErrors, errorCode, refreshMe, toast, type AuthMode } from "@/lib/auth/client";
import { fieldErrors, forgotSchema, loginSchema, signupSchema } from "@/lib/auth/validation";
import { Checkbox, Honeypot, PasswordField, TextField } from "./ui";

type Props = {
  initialMode: AuthMode;
  message?: string;
  /** « modal » : fond crème, champs blancs ; « page » : carte blanche, champs crème. */
  variant: "modal" | "page";
  /** Connexion réussie (ou inscription avec session ouverte). */
  onSuccess: () => void;
};

const TAB_ON = "bg-ink text-cream";
const TAB_OFF = "bg-transparent text-ink";
const SUBMIT = "h-[52px] cursor-pointer rounded-full border-0 bg-ink text-[16px] font-semibold text-cream transition-colors hover:bg-[#2C2823] disabled:cursor-not-allowed disabled:opacity-60";
const LINK_BTN = "cursor-pointer border-0 bg-transparent text-[14px] underline underline-offset-[3px]";

/** Connexion / création de compte / mot de passe oublié. Même formulaire dans la fenêtre modale et sur les pages /connexion et /inscription. */
export function AuthForm({ initialMode, message, variant, onSuccess }: Props) {
  const t = useTranslations("Auth");
  const tToast = useTranslations("Account.toast");
  const locale = useLocale();
  const bg = variant === "modal" ? "white" : "cream";

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [cgu, setCgu] = useState(false);
  const [news, setNews] = useState(true);
  const [show, setShow] = useState(false);
  const [hp, setHp] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [signupDone, setSignupDone] = useState(false);
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = Date.now();
  }, []);

  const err = (code?: string) => (code ? (t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.generic")) : "");
  const switchMode = (next: AuthMode) => {
    setMode(next);
    setErrors({});
    setFormErr("");
    setForgotSent(false);
    setSignupDone(false);
  };
  const setField = (setter: (v: string) => void, key: string) => (v: string) => {
    setter(v);
    setErrors((e) => ({ ...e, [key]: "" }));
    setFormErr("");
  };

  async function loggedIn() {
    const user = await refreshMe();
    toast.show(tToast("welcome", { first: user?.firstName ?? "" }));
    onSuccess();
  }
  function fail(res: Parameters<typeof errorCode>[0]) {
    const fields = apiFieldErrors(res);
    if (Object.keys(fields).length) setErrors(fields);
    else setFormErr(errorCode(res));
  }

  async function submitLogin(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const parsed = loginSchema.safeParse({ id, password });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setBusy(true);
    const res = await api("/api/auth/login", "POST", { id: parsed.data.id, password, website: hp, t: shownAt.current });
    setBusy(false);
    if (res.data?.ok === true) return loggedIn();
    fail(res);
  }

  async function submitSignup(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const input = { firstName, lastName, phone, email, password, cgu, news };
    const parsed = signupSchema.safeParse(input);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setBusy(true);
    const res = await api("/api/auth/signup", "POST", { ...input, lang: locale, website: hp, t: shownAt.current });
    setBusy(false);
    if (res.data?.ok === true) {
      if (res.data.status === "signedIn") return loggedIn();
      setSignupDone(true);
      return;
    }
    fail(res);
  }

  async function submitForgot(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const parsed = forgotSchema.safeParse({ id });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setBusy(true);
    const res = await api("/api/auth/forgot", "POST", { id: parsed.data.id, lang: locale, website: hp, t: shownAt.current });
    setBusy(false);
    if (res.data?.ok === true) return setForgotSent(true);
    fail(res);
  }

  const passwordField = (autoComplete: string, placeholder?: string) => (
    <PasswordField
      label={t("password")}
      value={password}
      onChange={setField(setPassword, "password")}
      error={err(errors.password)}
      show={show}
      onToggle={() => setShow((s) => !s)}
      showLabel={t("show")}
      hideLabel={t("hide")}
      autoComplete={autoComplete}
      placeholder={placeholder}
      bg={bg}
    />
  );
  const formError = formErr ? (
    <span role="alert" className="text-[14px] font-medium text-terracotta-deep">
      {err(formErr)}
    </span>
  ) : null;

  return (
    <div className="flex flex-col gap-4">
      {message ? <div className="rounded-[14px] bg-[#FBEFC9] px-[14px] py-3 text-[14px] leading-[1.5]">{message}</div> : null}

      {mode !== "forgot" ? (
        <div role="tablist" className="flex gap-1 rounded-full bg-white p-1">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => switchMode(m)}
              className={`min-h-[42px] flex-1 cursor-pointer rounded-full border-0 text-[14px] font-semibold ${mode === m ? TAB_ON : TAB_OFF}`}
            >
              {m === "login" ? t("tabLogin") : t("tabSignup")}
            </button>
          ))}
        </div>
      ) : null}

      {mode === "login" ? (
        <form onSubmit={submitLogin} noValidate className="relative flex flex-col gap-4">
          <Honeypot value={hp} onChange={setHp} />
          <TextField label={t("id")} value={id} onChange={setField(setId, "id")} error={err(errors.id)} autoComplete="username" bg={bg} />
          {passwordField("current-password")}
          {formError}
          <button type="submit" disabled={busy} className={SUBMIT}>
            {busy ? t("submitting") : t("submitLogin")}
          </button>
          <button type="button" onClick={() => switchMode("forgot")} className={`${LINK_BTN} min-h-11 self-center`}>
            {t("forgotLink")}
          </button>
        </form>
      ) : null}

      {mode === "signup" ? (
        signupDone ? (
          <p role="status" className="m-0 rounded-[14px] bg-leaf-bg p-[14px] text-[14px] leading-[1.5] text-leaf">
            {t("signupDone")}
          </p>
        ) : (
          <form onSubmit={submitSignup} noValidate className="relative flex flex-col gap-4">
            <Honeypot value={hp} onChange={setHp} />
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
              <TextField label={t("first")} value={firstName} onChange={setField(setFirstName, "firstName")} error={err(errors.firstName)} autoComplete="given-name" bg={bg} />
              <TextField label={t("last")} value={lastName} onChange={setField(setLastName, "lastName")} error={err(errors.lastName)} autoComplete="family-name" bg={bg} />
            </div>
            <TextField label={t("phone")} value={phone} onChange={setField(setPhone, "phone")} error={err(errors.phone)} inputMode="tel" autoComplete="tel-national" placeholder={t("phonePh")} bg={bg} />
            <TextField label={t("email")} value={email} onChange={setField(setEmail, "email")} error={err(errors.email)} inputMode="email" autoComplete="email" bg={bg} />
            {passwordField("new-password", t("passwordPh"))}
            <Checkbox
              checked={cgu}
              onChange={(v) => {
                setCgu(v);
                setErrors((x) => ({ ...x, cgu: "" }));
              }}
              align="start"
              small
            >
              {t.rich("cgu", {
                cgu: (c) => (
                  <Link href="/cgu" target="_blank">
                    {c}
                  </Link>
                ),
                privacy: (c) => (
                  <Link href="/confidentialite" target="_blank">
                    {c}
                  </Link>
                ),
              })}
            </Checkbox>
            <span aria-live="polite" className="-mt-2 text-[13px] text-terracotta-deep">
              {err(errors.cgu)}
            </span>
            <Checkbox checked={news} onChange={setNews} small>
              {t("news")}
            </Checkbox>
            {formError}
            <button type="submit" disabled={busy} className={SUBMIT}>
              {busy ? t("submitting") : t("submitSignup")}
            </button>
          </form>
        )
      ) : null}

      {mode === "forgot" ? (
        <div className="flex flex-col gap-4">
          <strong className="text-[18px]">{t("forgotTitle")}</strong>
          {forgotSent ? (
            <p role="status" className="m-0 rounded-[14px] bg-leaf-bg p-[14px] text-[14px] leading-[1.5] text-leaf">
              {t("forgotSent")}
            </p>
          ) : (
            <form onSubmit={submitForgot} noValidate className="relative flex flex-col gap-4">
              <Honeypot value={hp} onChange={setHp} />
              <span className="text-[14px] leading-[1.5] text-text">{t("forgotIntro")}</span>
              <TextField label={t("id")} value={id} onChange={setField(setId, "id")} error={err(errors.id)} autoComplete="username" bg={bg} />
              {formError}
              <button type="submit" disabled={busy} className={SUBMIT}>
                {busy ? t("submitting") : t("forgotSend")}
              </button>
            </form>
          )}
          <button type="button" onClick={() => switchMode("login")} className={`${LINK_BTN} min-h-11 self-start`}>
            {t("back")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
