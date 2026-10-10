"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { cart, useCartLines, useCartSubtotal } from "@/lib/cart/store";
import { fetchMe, type MeUser } from "@/lib/checkout/me";
import { normPhone, prettyPhone, validEmail, validPhone } from "@/lib/checkout/phone";
import { saveLastOrder } from "@/lib/checkout/last-order";
import {
  enabledPayMethods,
  isMobileMoney,
  shippingFee,
  type PayConfig,
  type PayMethod,
  type ShippingConfig,
  type Zone,
} from "@/lib/checkout/shipping";
import { fmtXof } from "@/lib/money";
import { cssImage, FALLBACK_BG } from "@/components/product/media";
import { CheckoutShell } from "./CheckoutShell";
import { clearIdempotencyKey, idempotencyKeyFor, orderSignature } from "./idempotency";

type Props = { shipping: ShippingConfig; pay: PayConfig };
type Errors = Partial<Record<"name" | "phone" | "email" | "address" | "momo", string>>;

const CHIP: Record<PayMethod, string> = {
  momo: "#FFCC00",
  moov: "#0066B3",
  celtiis: "#00A0DF",
  carte: "#141210",
  cod: "#1F6B4A",
};

const noopSubscribe = () => () => {};
/** Faux côté serveur et au premier rendu client, vrai ensuite : évite d'afficher « panier vide » avant la lecture du localStorage. */
function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

function RadioCard({
  checked,
  onSelect,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onSelect();
    }
  };
  return (
    <div
      role="radio"
      aria-checked={checked}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={onKey}
      className="flex cursor-pointer items-center gap-3.5 rounded-2xl border-[1.5px] bg-card p-4"
      style={{ borderColor: checked ? "#141210" : "#E2DCCF" }}
    >
      <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 border-ink">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: checked ? "#141210" : "transparent" }} />
      </span>
      {children}
    </div>
  );
}

const inputClass = "rounded-[14px] border bg-card p-3.5 text-[16px] font-normal";

export function CheckoutFlow({ shipping, pay }: Props) {
  const t = useTranslations("Checkout");
  const locale = useLocale();
  const router = useRouter();
  const hydrated = useHydrated();
  const lines = useCartLines();
  const subtotal = useCartSubtotal();

  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", momo: "" });
  const [zone, setZone] = useState<Zone>("cotonou");
  const [method, setMethod] = useState<PayMethod>(enabledPayMethods(pay)[0] ?? "cod");
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState("");
  const [paying, setPaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [me, setMe] = useState<MeUser | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const shownAt = useRef(0);
  const honeypot = useRef<HTMLInputElement>(null);

  const methods = enabledPayMethods(pay);
  const fee = shippingFee(subtotal, zone, shipping);
  const total = subtotal + fee;
  const mm = isMobileMoney(method);

  useEffect(() => {
    shownAt.current = Date.now();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const ctrl = new AbortController();
    // Compte connecté : préremplit les champs encore vides (jamais d'écrasement d'une saisie).
    void fetchMe(ctrl.signal).then((u) => {
      if (!u) return;
      setMe(u);
      setForm((f) => ({
        ...f,
        name: f.name || u.name,
        phone: f.phone || (u.phone ? prettyPhone(u.phone) : ""),
        address: f.address || u.address,
      }));
    });
    return () => {
      ctrl.abort();
      document.body.style.overflow = overflow;
    };
  }, []);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: "" }));
  };

  function goStep(next: 1 | 2) {
    setStep(next);
    scroller.current?.scrollTo({ top: 0 });
  }

  function toPay() {
    const e: Errors = {};
    if (form.name.trim().length < 3) e.name = t("errName");
    if (!validPhone(form.phone)) e.phone = t("errPhone");
    if (form.email.trim() && !validEmail(form.email)) e.email = t("errEmail");
    if (form.address.trim().length < 5) e.address = t("errAddress");
    if (Object.keys(e).length) return setErrors(e);
    setErrors({});
    setForm((f) => ({ ...f, momo: f.momo || f.phone }));
    setMethod((m) => (methods.includes(m) ? m : (methods[0] ?? "cod")));
    goStep(2);
  }

  async function placeOrder(attempt = 0) {
    if ((paying && attempt === 0) || lines.length === 0) return;
    if (mm && !validPhone(form.momo)) return setErrors({ momo: t("errMomo") });
    setPaying(true);
    setSubmitError("");
    setErrors({});
    const items = lines.map((l) => ({ kind: l.kind, id: l.id, qty: l.qty }));
    // Même clé tant que la commande est identique : un nouvel essai après coupure ne crée pas de doublon côté serveur.
    const idem = idempotencyKeyFor(
      orderSignature({ items, zone, pay: method, phone: normPhone(form.phone), name: form.name.trim(), address: form.address.trim() }),
    );
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 30_000);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          items,
          idem,
          customer: {
            name: form.name.trim(),
            phone: normPhone(form.phone),
            address: form.address.trim(),
            ...(form.email.trim() ? { email: form.email.trim() } : {}),
          },
          zone,
          pay: method,
          payerPhone: mm ? normPhone(form.momo) : undefined,
          lang: locale === "en" ? "en" : "fr",
          website: honeypot.current?.value ?? "",
          t: shownAt.current,
          // Durée écoulée mesurée sur la seule horloge du téléphone : insensible à un décalage d'heure.
          elapsed: Date.now() - shownAt.current,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        code?: string;
        message?: string;
        fields?: string[];
        order?: { number: string; total: number };
        payment?: { kind: "cod" | "pending" | "redirect"; url?: string };
      } | null;

      // Commande créée (y compris paiement en ligne non lancé : la commande existe, on l'indique à l'écran de confirmation).
      const created = json?.order && (json.ok || json.code === "payment_unavailable") ? json.order : null;
      if (created) {
        clearIdempotencyKey();
        saveLastOrder({
          number: created.number,
          total: created.total,
          pay: method,
          zone,
          name: form.name.trim(),
          phone: normPhone(form.phone),
          pending: method !== "cod",
          placedAt: Date.now(),
        });
        cart.clear();
        setFinished(true);
        if (json?.payment?.kind === "redirect" && json.payment.url) {
          window.location.assign(json.payment.url);
        } else if (json?.code === "payment_unavailable") {
          // Commande enregistrée mais paiement non lancé : la page de confirmation l'indique clairement.
          router.replace("/commande/merci?p=unavailable");
        } else {
          router.replace("/commande/merci");
        }
        return;
      }

      if (json?.code === "too_fast" && attempt < 2) {
        // Envoi jugé trop rapide : on patiente puis on réessaie automatiquement (le bouton reste en « chargement »).
        clearTimeout(timeout);
        await new Promise((r) => setTimeout(r, 3000));
        return placeOrder(attempt + 1);
      }

      const fields = json?.fields ?? [];
      if (fields.some((f) => f === "name" || f === "phone" || f === "email" || f === "address")) {
        const e: Errors = {};
        if (fields.includes("name")) e.name = t("errName");
        if (fields.includes("phone")) e.phone = t("errPhone");
        if (fields.includes("email")) e.email = t("errEmail");
        if (fields.includes("address")) e.address = t("errAddress");
        setErrors(e);
        goStep(1);
      } else if (fields.includes("payerPhone")) {
        setErrors({ momo: t("errMomo") });
      } else {
        setSubmitError(json?.message || t("errGeneric"));
      }
      setPaying(false);
    } catch (e) {
      setSubmitError(e instanceof DOMException && e.name === "AbortError" ? t("errTimeout") : t("errNetwork"));
      setPaying(false);
    } finally {
      clearTimeout(timeout);
    }
  }

  function exit() {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  const shell = (children: ReactNode) => (
    <CheckoutShell step={step} onExit={exit} scrollRef={scroller}>
      {children}
    </CheckoutShell>
  );

  if (finished) return shell(null);
  if (!hydrated) return shell(null);

  if (lines.length === 0) {
    return shell(
      <div className="mx-auto flex max-w-[620px] flex-col items-center gap-4 px-5 py-16 text-center">
        <h1 className="font-display m-0 text-[32px] font-semibold tracking-[-0.03em]">{t("emptyTitle")}</h1>
        <span className="text-text">{t("emptyText")}</span>
        <Link
          href="/catalogue"
          className="rounded-full bg-ink px-[22px] py-3.5 font-semibold text-cream no-underline hover:text-cream"
        >
          {t("emptyCta")}
        </Link>
      </div>,
    );
  }

  const errBorder = (msg?: string) => (msg ? "#C2410C" : "#E2DCCF");

  return shell(
    <div className="mx-auto grid max-w-[1100px] grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-start gap-8 px-5 pt-8 pb-16">
      <div className="flex min-w-0 flex-col gap-5">
        {/* Honeypot : invisible pour les humains, rempli par les robots. */}
        <input
          ref={honeypot}
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
        />
        {step === 1 ? (
          <>
            <h1 className="font-display m-0 text-[32px] font-semibold tracking-[-0.03em]">{t("whereTitle")}</h1>
            {me ? (
              <span className="-mt-2 text-[15px] text-leaf">{t("loggedAs", { name: me.name })}</span>
            ) : (
              <span className="-mt-2 text-[15px] text-text">
                {t("guestHint")}{" "}
                <Link href="/connexion" className="font-semibold">
                  {t("signIn")}
                </Link>
              </span>
            )}
            <label className="flex flex-col gap-1.5 text-[14px] font-medium">
              {t("name")}
              <input
                value={form.name}
                onChange={set("name")}
                autoComplete="name"
                placeholder={t("namePlaceholder")}
                aria-invalid={!!errors.name}
                className={inputClass}
                style={{ borderColor: errBorder(errors.name) }}
              />
              <span className="text-[13px] font-normal text-terracotta-deep">{errors.name}</span>
            </label>
            <label className="flex flex-col gap-1.5 text-[14px] font-medium">
              {t("phone")}
              <div
                className="flex overflow-hidden rounded-[14px] border bg-card focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-ink"
                style={{ borderColor: errBorder(errors.phone) }}
              >
                <span className="border-r border-border bg-[#FAF8F3] p-3.5 font-normal">+229</span>
                <input
                  value={form.phone}
                  onChange={set("phone")}
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder={t("phonePlaceholder")}
                  aria-invalid={!!errors.phone}
                  className="min-w-0 flex-1 border-0 p-3.5 text-[16px] font-normal focus:outline-none"
                />
              </div>
              <span className="text-[13px] font-normal text-terracotta-deep">{errors.phone}</span>
            </label>
            <label className="flex flex-col gap-1.5 text-[14px] font-medium">
              {t("email")}
              <input
                value={form.email}
                onChange={set("email")}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={t("emailPlaceholder")}
                aria-invalid={!!errors.email}
                className={inputClass}
                style={{ borderColor: errBorder(errors.email) }}
              />
              <span className="text-[13px] font-normal text-text">{t("emailHelp")}</span>
              <span className="text-[13px] font-normal text-terracotta-deep">{errors.email}</span>
            </label>
            <div role="radiogroup" aria-label={t("zoneGroup")} className="flex flex-col gap-2.5">
              <span className="text-[14px] font-medium">{t("zoneLabel")}</span>
              {(["cotonou", "autre"] as const).map((z) => (
                <RadioCard key={z} checked={zone === z} onSelect={() => setZone(z)}>
                  <div className="flex flex-1 flex-col gap-0.5">
                    <strong className="text-[15px]">{z === "cotonou" ? t("zoneCotonou") : t("zoneAutre")}</strong>
                    <span className="text-[13px] text-text">
                      {z === "cotonou" ? t("zoneCotonouSub", { cutoff: shipping.cutoff }) : t("zoneAutreSub")}
                    </span>
                  </div>
                  <strong className="text-[15px]">{fmtXof(shippingFee(subtotal, z, shipping))}</strong>
                </RadioCard>
              ))}
            </div>
            <label className="flex flex-col gap-1.5 text-[14px] font-medium">
              {t("address")}
              <input
                value={form.address}
                onChange={set("address")}
                autoComplete="street-address"
                placeholder={t("addressPlaceholder")}
                aria-invalid={!!errors.address}
                className={inputClass}
                style={{ borderColor: errBorder(errors.address) }}
              />
              <span className="text-[13px] font-normal text-terracotta-deep">{errors.address}</span>
            </label>
            <button
              type="button"
              onClick={toPay}
              className="h-14 cursor-pointer rounded-full border-0 bg-ink text-[16px] font-semibold text-cream hover:bg-[#2C2823]"
            >
              {t("toPay")}
            </button>
          </>
        ) : (
          <>
            <h1 className="font-display m-0 text-[32px] font-semibold tracking-[-0.03em]">{t("payTitle")}</h1>
            <span className="-mt-2 text-[15px] text-text">
              {t("deliverTo", { address: form.address, phone: form.phone })}
            </span>
            <div role="radiogroup" aria-label={t("payGroup")} className="flex flex-col gap-2.5">
              {methods.map((m) => (
                <RadioCard
                  key={m}
                  checked={method === m}
                  onSelect={() => {
                    setMethod(m);
                    setErrors({});
                  }}
                >
                  <div className="flex flex-1 flex-col gap-0.5">
                    <strong className="text-[15px]">{t(`${m}Name`)}</strong>
                    <span className="text-[13px] text-text">{t(`${m}Sub`)}</span>
                  </div>
                  <span aria-hidden="true" className="h-6 w-9 rounded-md" style={{ background: CHIP[m] }} />
                </RadioCard>
              ))}
            </div>
            {mm ? (
              <label className="flex flex-col gap-1.5 text-[14px] font-medium">
                {t("momoNumber", { operator: t(`${method}Name`) })}
                <input
                  value={form.momo}
                  onChange={set("momo")}
                  inputMode="tel"
                  placeholder={t("phonePlaceholder")}
                  aria-invalid={!!errors.momo}
                  className={inputClass}
                  style={{ borderColor: errBorder(errors.momo) }}
                />
                <span className="text-[13px] font-normal text-text">{t("momoHelp")}</span>
                <span role="alert" className="text-[13px] font-normal text-terracotta-deep">
                  {errors.momo}
                </span>
              </label>
            ) : null}
            {method === "carte" ? (
              <span className="rounded-[14px] bg-card px-3.5 py-3 text-[14px] leading-normal text-text">
                {t("cardNote")}
              </span>
            ) : null}
            {method === "cod" ? (
              <span className="rounded-[14px] bg-card px-3.5 py-3 text-[14px] leading-normal text-text">
                {t("codNote")}
              </span>
            ) : null}
            {submitError ? (
              <span role="alert" className="rounded-[14px] bg-card px-3.5 py-3 text-[14px] leading-normal text-terracotta-deep">
                {submitError}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => void placeOrder()}
              disabled={paying}
              aria-busy={paying}
              className="min-h-14 cursor-pointer rounded-full border-0 px-5 text-[16px] font-semibold text-cream hover:bg-[#2C2823] disabled:cursor-wait disabled:hover:bg-[#4A443C]"
              style={{ background: paying ? "#4A443C" : "#141210" }}
            >
              {paying
                ? mm
                  ? t("payingMomo")
                  : t("payingCard")
                : method === "cod"
                  ? t("confirmCod", { total: fmtXof(total) })
                  : t("pay", { total: fmtXof(total) })}
            </button>
            <span className="-mt-1.5 text-[12px] leading-normal text-muted">
              {t.rich("terms", {
                terms: (chunks) => (
                  <Link href="/cgv" target="_blank">
                    {chunks}
                  </Link>
                ),
              })}
            </span>
            <button
              type="button"
              onClick={() => goStep(1)}
              className="min-h-10 cursor-pointer self-start border-0 bg-transparent text-[14px] underline underline-offset-[3px]"
            >
              {t("editShipping")}
            </button>
          </>
        )}
      </div>

      <div className="sticky top-[90px] flex flex-col gap-3.5 rounded-3xl bg-card p-[22px]">
        <strong className="text-[17px]">{t("summary")}</strong>
        {lines.map((l) => {
          const img = cssImage(l.imageUrl);
          return (
            <div key={`${l.kind}:${l.id}`} className="flex items-center gap-3">
              <div
                className="relative h-12 w-12 flex-none rounded-xl"
                style={{ background: l.bg ?? FALLBACK_BG }}
                aria-hidden="true"
              >
                {img ? <div className="absolute inset-0 h-full w-full rounded-xl" style={{ background: img }} /> : null}
                <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink text-[11px] text-white">
                  {l.qty}
                </span>
              </div>
              <span className="flex-1 text-[14px] leading-[1.25]">{l.name}</span>
              <span className="text-[14px] whitespace-nowrap">{fmtXof(l.price * l.qty)}</span>
            </div>
          );
        })}
        <div className="flex flex-col gap-2 border-t border-border pt-3.5 text-[15px]">
          <div className="flex justify-between">
            <span>{t("subtotal")}</span>
            <span>{fmtXof(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>{t("shipping")}</span>
            <span>{fee ? fmtXof(fee) : t("shippingFree")}</span>
          </div>
          <div className="flex justify-between pt-1.5 text-[20px] font-semibold">
            <span>{t("total")}</span>
            <span>{fmtXof(total)}</span>
          </div>
        </div>
        <span className="rounded-xl bg-leaf-bg px-3 py-2.5 text-[13px] text-leaf">
          {t("returns", { days: shipping.returnDays })}
        </span>
      </div>
    </div>,
  );
}
