"use client";

import { useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { validEmail, validPhone } from "./newsletter-schema";

type Channel = "email" | "whatsapp";
type Status = "idle" | "sending" | "ok";

/** Bandeau newsletter jaune (maquette lignes 883-911). Anti-robot : champ piège `website` + délai minimal côté serveur. */
export function Newsletter() {
  const t = useTranslations("Newsletter");
  const [channel, setChannel] = useState<Channel>("email");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [shownAt] = useState(() => Date.now());
  const honeypot = useRef<HTMLInputElement>(null);
  const isEmail = channel === "email";

  function pick(next: Channel) {
    setChannel(next);
    setError("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    const v = value.trim();
    if (isEmail ? !validEmail(v) : !validPhone(v)) {
      setError(isEmail ? t("errEmail") : t("errWhatsapp"));
      return;
    }
    setError("");
    setStatus("sending");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, value: v, website: honeypot.current?.value ?? "", t: shownAt }),
      });
      const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setValue("");
        setStatus("ok");
        return;
      }
      setStatus("idle");
      setError(
        data.error === "unavailable" ? t("errUnavailable") : data.error === "too_fast" || data.error === "rate" ? t("errTooFast") : data.error === "invalid" ? (isEmail ? t("errEmail") : t("errWhatsapp")) : t("errGeneric"),
      );
    } catch {
      setStatus("idle");
      setError(t("errGeneric"));
    }
  }

  const tab = (on: boolean) => ({
    background: on ? "#141210" : "transparent",
    color: on ? "#FFC93C" : "#141210",
  });

  return (
    <section className="bg-sun">
      <div className="mx-auto grid max-w-[1280px] grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] items-center gap-7 px-5 py-12">
        <div className="flex flex-col gap-[10px]">
          <h2 className="font-display m-0 text-[clamp(24px,3vw,34px)] leading-[1.1] font-semibold tracking-[-0.03em]">{t("title")}</h2>
          <p className="m-0 text-[16px] leading-normal text-[#2C2823]">{t("text")}</p>
        </div>
        <div className="flex flex-col gap-3">
          {status === "ok" ? (
            <div role="status" className="flex items-center gap-[14px] rounded-[20px] bg-white p-5" style={{ animation: "wxup .3s ease both" }}>
              <span className="bg-leaf flex h-11 w-11 flex-none items-center justify-center rounded-full text-[20px] text-white" aria-hidden="true">
                ✓
              </span>
              <span className="text-[15px] leading-[1.45]">
                <strong>{t("okTitle")}</strong> {t("okText")}
              </span>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="flex flex-col gap-3">
              <div role="group" aria-label={t("channelLabel")} className="flex gap-1 self-start rounded-full bg-white/55 p-1">
                <button
                  type="button"
                  aria-pressed={isEmail}
                  onClick={() => pick("email")}
                  className="min-h-11 cursor-pointer rounded-full border-0 px-4 text-[14px] font-semibold"
                  style={tab(isEmail)}
                >
                  {t("email")}
                </button>
                <button
                  type="button"
                  aria-pressed={!isEmail}
                  onClick={() => pick("whatsapp")}
                  className="min-h-11 cursor-pointer rounded-full border-0 px-4 text-[14px] font-semibold"
                  style={tab(!isEmail)}
                >
                  {t("whatsapp")}
                </button>
              </div>
              {/* Champ piège : invisible pour les humains, rempli par les robots. */}
              <input
                ref={honeypot}
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="pointer-events-none absolute -left-[9999px] h-0 w-0 opacity-0"
              />
              <div className="flex flex-wrap gap-2">
                <input
                  type={isEmail ? "email" : "tel"}
                  inputMode={isEmail ? "email" : "tel"}
                  autoComplete={isEmail ? "email" : "tel"}
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    setError("");
                  }}
                  maxLength={200}
                  aria-label={isEmail ? t("labelEmail") : t("labelWhatsapp")}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "nl-error" : undefined}
                  placeholder={isEmail ? t("placeholderEmail") : t("placeholderWhatsapp")}
                  className="border-ink h-[52px] min-w-0 flex-[1_1_220px] rounded-full border-[1.5px] bg-white px-[18px] text-[16px]"
                />
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="bg-ink text-cream h-[52px] cursor-pointer rounded-full border-0 px-6 text-[15px] font-semibold hover:bg-[#2C2823] disabled:opacity-70"
                >
                  {status === "sending" ? t("sending") : t("submit")}
                </button>
              </div>
              {error ? (
                <span id="nl-error" role="alert" className="text-[14px] font-semibold text-[#7A1F0A]">
                  {error}
                </span>
              ) : null}
              <span className="text-[13px] text-[#2C2823]">
                {t.rich("privacy", {
                  a: (chunks) => (
                    <Link href="/confidentialite" className="underline">
                      {chunks}
                    </Link>
                  ),
                })}
              </span>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
