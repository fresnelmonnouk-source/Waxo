"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
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
  cartShipsFree,
  parseShippingConfig,
  type PayConfig,
  type PayMethod,
  type ShippingConfig,
  type Zone,
} from "@/lib/checkout/shipping";
import { useApproxPrice } from "@/lib/currency/client";
import { fmtXof } from "@/lib/money";
import { cssImage, FALLBACK_BG } from "@/components/product/media";
import { CheckoutShell } from "./CheckoutShell";
import { checkoutEta, formatRange, type Eta } from "./eta";
import { cutoffParams, ExpressBadge, ExpressPicto } from "@/components/shop/ExpressBadge";
import { clearIdempotencyKey, idempotencyKeyFor, orderSignature } from "./idempotency";
import { saveCheckoutSnapshot, takeResume } from "./retry";
import { TurnstileWidget, type TurnstileHandle } from "./TurnstileWidget";

type Props = {
  shipping: ShippingConfig;
  pay: PayConfig;
  /** Clé de site Turnstile : donnée par le serveur seulement si la vérification est configurée (sinon aucun widget). */
  turnstileSiteKey?: string | null;
};
type Field = "name" | "phone" | "email" | "address" | "momo";
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

/** Instant courant arrondi à la minute (0 côté serveur) : l'estimation suit l'horloge sans re-rendu à chaque seconde. */
const subscribeMinute = (cb: () => void) => {
  const id = setInterval(cb, 30_000);
  return () => clearInterval(id);
};
function useMinute(): number {
  return useSyncExternalStore(subscribeMinute, () => Math.floor(Date.now() / 60_000) * 60_000, () => 0);
}

function RadioCard({
  checked,
  onSelect,
  children,
  zoneCard = false,
}: {
  checked: boolean;
  onSelect: () => void;
  children: ReactNode;
  /** Carte de zone (spec 6.1) : rayon 20 px, bordure 1 px, sélection 2 px encre (sans décalage de mise en page). */
  zoneCard?: boolean;
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
      className={
        zoneCard
          ? "flex cursor-pointer items-start gap-3.5 rounded-[20px] border bg-white px-5 py-[18px]"
          : "flex cursor-pointer items-center gap-3.5 rounded-2xl border-[1.5px] bg-card p-4"
      }
      style={
        zoneCard
          ? { borderColor: checked ? "#141210" : "#E2DCCF", boxShadow: checked ? "inset 0 0 0 1px #141210" : undefined }
          : { borderColor: checked ? "#141210" : "#E2DCCF" }
      }
    >
      <span
        className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 border-ink${zoneCard ? " mt-px" : ""}`}
      >
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: checked ? "#141210" : "transparent" }} />
      </span>
      {children}
    </div>
  );
}

const inputClass = "rounded-[14px] border bg-card p-3.5 text-[16px] font-normal";

/**
 * Articles du panier en « livraison offerte à Cotonou & Calavi » (0025), lus au chargement : la page est en cache, la liste
 * ne doit pas l'être. Vide en attendant = frais normaux affichés (jamais une gratuité promise à tort). Le serveur refuse la
 * commande si le total a augmenté (`shipping_changed` / `price_changed`) et renvoie la liste à jour (setter exposé).
 */
function useFreeShippingIds(lines: readonly { id: string }[], locale: string) {
  const [freeIds, setFreeIds] = useState<string[]>([]);
  const idsKey = lines
    .map((l) => l.id)
    .sort()
    .join(",");
  useEffect(() => {
    if (!idsKey) return;
    const ctrl = new AbortController();
    fetch(`/api/checkout/config?lang=${locale === "en" ? "en" : "fr"}&ids=${encodeURIComponent(idsKey)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j: { ok?: boolean; free?: unknown }) => {
        if (j.ok && Array.isArray(j.free)) setFreeIds(j.free.filter((x): x is string => typeof x === "string"));
      })
      .catch(() => {
        /* frais normaux affichés ; le serveur reste l'autorité */
      });
    return () => ctrl.abort();
  }, [idsKey, locale]);
  return [freeIds, setFreeIds] as const;
}

export function CheckoutFlow({ shipping: shippingProp, pay, turnstileSiteKey = null }: Props) {
  const t = useTranslations("Checkout");
  const ts = useTranslations("Security.checkout");
  const tc = useTranslations("Shell.currency");
  const approx = useApproxPrice();
  const locale = useLocale();
  const router = useRouter();
  const hydrated = useHydrated();
  const minute = useMinute();
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
  const turnstile = useRef<TurnstileHandle>(null);
  const submitErrorRef = useRef<HTMLSpanElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const momoRef = useRef<HTMLInputElement>(null);
  const errId = useId();
  /** Ancienne commande dont le paiement a échoué (reprise depuis l'écran d'échec) : le serveur libère son stock. */
  const replaces = useRef<{ n: string; k: string } | null>(null);
  const [resumed, setResumed] = useState(false);

  const methods = enabledPayMethods(pay);
  // Réglages de livraison : ceux de la page (cache ISR) tant que le serveur n'en a pas renvoyé de plus récents (409, Z1).
  const [liveShipping, setLiveShipping] = useState<ShippingConfig | null>(null);
  const shipping = liveShipping ?? shippingProp;
  const [freeIds, setFreeIds] = useFreeShippingIds(lines, locale);
  const allFree = cartShipsFree(lines, freeIds);
  const fee = shippingFee(subtotal, zone, shipping, allFree);
  const total = subtotal + fee;
  const mm = isMobileMoney(method);

  // Erreur d'envoi : annoncée (role=alert) ET focalisée, pour qu'elle soit visible sur mobile (audit Mia 4.9).
  useEffect(() => {
    if (submitError) submitErrorRef.current?.focus();
  }, [submitError]);

  /** Focus sur le premier champ en erreur, dans l'ordre du formulaire. */
  function focusFirstError(e: Errors) {
    const refs = { name: nameRef, phone: phoneRef, email: emailRef, address: addressRef, momo: momoRef };
    const first = (["name", "phone", "email", "address", "momo"] as const).find((k) => e[k]);
    if (first) requestAnimationFrame(() => refs[first].current?.focus());
  }
  const describedBy = (key: Field) => (errors[key] ? `${errId}-${key}` : undefined);

  useEffect(() => {
    shownAt.current = Date.now();
    // Reprise après un paiement en ligne échoué : coordonnées, zone et moyen de paiement préremplis (audit Mia 9).
    const resume = takeResume();
    if (resume) {
      replaces.current = resume.replaces;
      // Lecture unique du sessionStorage à l'ouverture (navigateur seulement) : pas de source externe à suivre.
      /* eslint-disable react-hooks/set-state-in-effect */
      setForm((f) => ({ ...f, ...resume.form, momo: resume.form.phone }));
      setZone(resume.zone);
      if (methods.includes(resume.pay)) setMethod(resume.pay);
      setResumed(true);
      if (resume.form.name.trim().length >= 3 && validPhone(resume.form.phone) && resume.form.address.trim().length >= 5) setStep(2);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lecture unique à l'ouverture du tunnel
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
    if (Object.keys(e).length) {
      setErrors(e);
      focusFirstError(e);
      return;
    }
    setErrors({});
    setForm((f) => ({ ...f, momo: f.momo || f.phone }));
    setMethod((m) => (methods.includes(m) ? m : (methods[0] ?? "cod")));
    goStep(2);
  }

  async function placeOrder(attempt = 0) {
    if ((paying && attempt === 0) || lines.length === 0) return;
    if (mm && !validPhone(form.momo)) {
      setErrors({ momo: t("errMomo") });
      focusFirstError({ momo: "x" });
      return;
    }
    setPaying(true);
    setSubmitError("");
    setErrors({});
    const items = lines.map((l) => ({ kind: l.kind, id: l.id, qty: l.qty }));
    // Même clé tant que la commande est identique : un nouvel essai après coupure ne crée pas de doublon côté serveur.
    const idem = idempotencyKeyFor(
      orderSignature({ items, zone, pay: method, phone: normPhone(form.phone), name: form.name.trim(), address: form.address.trim() }),
    );
    // Jeton anti-robot (Turnstile, inerte sans clés) : attendu avant l'envoi, à usage unique.
    const captcha = (await turnstile.current?.token()) ?? undefined;
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
          // Sous-total et frais affichés : le serveur refuse seulement si le TOTAL réel dépasse le total affiché (prix en
          // hausse, livraison plus offerte, réglages modifiés), sans rien garder ; un total égal ou plus bas passe.
          expectedSubtotal: subtotal,
          expectedShipping: shippingFee(subtotal, zone, shipping, cartShipsFree(lines, freeIds)),
          captcha,
          replaces: replaces.current ?? undefined,
        }),
      });
      turnstile.current?.reset(); // jeton consommé : le prochain envoi en demandera un neuf
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        code?: string;
        message?: string;
        fields?: string[];
        order?: { number: string; total: number };
        payment?: { kind: "cod" | "pending" | "redirect"; url?: string };
        prices?: Record<string, number>;
        free?: unknown[];
        shipping?: unknown;
      } | null;

      // Total en hausse depuis l'affichage (fin de campagne, livraison plus offerte, réglages modifiés) : le serveur renvoie
      // les prix, les réglages de livraison et la liste « offerte » à jour. Appliqués ici, le total affiché devient celui
      // qui sera facturé et le prochain envoi passe (Z1).
      if (json?.code === "shipping_changed" || json?.code === "price_changed") {
        if (json.prices) cart.syncPrices(json.prices);
        if (Array.isArray(json.free)) setFreeIds(json.free.filter((x): x is string => typeof x === "string"));
        const cfg = parseShippingConfig(json.shipping);
        if (cfg) setLiveShipping(cfg);
        setSubmitError(json.message || t("errGeneric"));
        setPaying(false);
        return;
      }

      // Commande créée (y compris paiement en ligne non lancé : la commande existe, on l'indique à l'écran de confirmation).
      const created = json?.order && (json.ok || json.code === "payment_unavailable") ? json.order : null;
      if (created) {
        clearIdempotencyKey();
        replaces.current = null;
        if (method !== "cod") {
          // Paiement en ligne : instantané du panier, restauré par l'écran d'échec (« Réessayer », « Payer à la livraison »).
          saveCheckoutSnapshot({
            number: created.number,
            lines,
            zone,
            pay: method,
            form: { name: form.name.trim(), phone: form.phone, email: form.email.trim(), address: form.address.trim() },
          });
        }
        saveLastOrder({
          number: created.number,
          total: created.total,
          pay: method,
          zone,
          name: form.name.trim(),
          phone: normPhone(form.phone),
          pending: method !== "cod",
          placedAt: Date.now(),
          items: lines.map((l) => ({ id: l.kind === "pack" ? `pack:${l.id}` : l.id, price: l.price, quantity: l.qty })),
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
        focusFirstError(e);
      } else if (fields.includes("payerPhone")) {
        setErrors({ momo: t("errMomo") });
        focusFirstError({ momo: "x" });
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
  const eta: Eta = checkoutEta(minute, zone, shipping.cutoff);
  const etaText =
    eta.kind === "range"
      ? t("etaRange", formatRange(eta.from, eta.to, locale))
      : eta.kind === "tomorrowSunday"
        ? t("etaTomorrowSunday")
        : eta.kind === "tomorrow"
          ? t("etaTomorrow")
          : t("etaToday");

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
                aria-describedby={describedBy("name")}
                ref={nameRef}
                className={inputClass}
                style={{ borderColor: errBorder(errors.name) }}
              />
              <span id={`${errId}-name`} className="text-[13px] font-normal text-terracotta-deep">{errors.name}</span>
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
                  aria-describedby={describedBy("phone")}
                  ref={phoneRef}
                  className="min-w-0 flex-1 border-0 p-3.5 text-[16px] font-normal focus:outline-none"
                />
              </div>
              <span id={`${errId}-phone`} className="text-[13px] font-normal text-terracotta-deep">{errors.phone}</span>
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
                aria-describedby={describedBy("email")}
                ref={emailRef}
                className={inputClass}
                style={{ borderColor: errBorder(errors.email) }}
              />
              <span className="text-[13px] font-normal text-text">{t("emailHelp")}</span>
              <span id={`${errId}-email`} className="text-[13px] font-normal text-terracotta-deep">{errors.email}</span>
            </label>
            <div role="radiogroup" aria-label={t("zoneGroup")} className="@container flex flex-col gap-2.5">
              <span className="text-[14px] font-medium">{t("zoneLabel")}</span>
              <div className="grid gap-2.5 @2xl:grid-cols-2">
                {(["cotonou", "autre"] as const).map((z) => {
                  const zoneFee = shippingFee(subtotal, z, shipping, allFree);
                  return (
                    <RadioCard key={z} zoneCard checked={zone === z} onSelect={() => setZone(z)}>
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                          <strong className="text-[16px] leading-[1.25] font-semibold text-ink">
                            {z === "cotonou" ? t("zoneCotonou") : t("zoneAutre")}
                          </strong>
                          {z === "cotonou" ? <ExpressBadge label={t("express")} size="S" variant="onLight" /> : null}
                        </div>
                        <span className="text-[14px] leading-[1.45] text-text">
                          {z === "cotonou"
                            ? t("zoneCotonouSub", cutoffParams(shipping.cutoff, locale))
                            : t("zoneAutreSub")}
                        </span>
                      </div>
                      <strong
                        className="text-[15px] font-semibold whitespace-nowrap"
                        style={{ color: zoneFee ? "#141210" : "#1F6B4A" }}
                      >
                        {zoneFee ? fmtXof(zoneFee) : t("shippingFree")}
                      </strong>
                    </RadioCard>
                  );
                })}
              </div>
              <p aria-live="polite" className="m-0 flex items-start gap-2 text-[14px] leading-[1.4] font-medium text-ink">
                <span className="mt-px">
                  <ExpressPicto size={16} color="#C2410C" />
                </span>
                {etaText}
              </p>
            </div>
            <label className="flex flex-col gap-1.5 text-[14px] font-medium">
              {t("address")}
              <input
                value={form.address}
                onChange={set("address")}
                autoComplete="street-address"
                placeholder={t("addressPlaceholder")}
                aria-invalid={!!errors.address}
                aria-describedby={describedBy("address")}
                ref={addressRef}
                className={inputClass}
                style={{ borderColor: errBorder(errors.address) }}
              />
              <span id={`${errId}-address`} className="text-[13px] font-normal text-terracotta-deep">{errors.address}</span>
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
                  aria-describedby={describedBy("momo")}
                  ref={momoRef}
                  className={inputClass}
                  style={{ borderColor: errBorder(errors.momo) }}
                />
                <span className="text-[13px] font-normal text-text">{t("momoHelp")}</span>
                <span id={`${errId}-momo`} role="alert" className="text-[13px] font-normal text-terracotta-deep">
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
              <span className="rounded-xl bg-leaf-bg px-3.5 py-3 text-[14px] leading-normal text-ink">{t("codNote")}</span>
            ) : null}
            {resumed ? (
              <span role="status" className="rounded-[14px] bg-card px-3.5 py-3 text-[14px] leading-normal text-ink">
                {ts("resumed")}
              </span>
            ) : null}
            <TurnstileWidget ref={turnstile} siteKey={turnstileSiteKey} lang={locale === "en" ? "en" : "fr"} />
            {submitError ? (
              <span
                ref={submitErrorRef}
                tabIndex={-1}
                role="alert"
                className="rounded-[14px] bg-card px-3.5 py-3 text-[14px] leading-normal text-terracotta-deep focus:outline-none"
              >
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
          {approx(total) ? (
            <span className="text-muted text-right text-[13px]">{tc("payNote", { approx: approx(total) as string })}</span>
          ) : null}
        </div>
        <span className="rounded-xl bg-leaf-bg px-3 py-2.5 text-[13px] text-leaf">
          {t("returns", { days: shipping.returnDays })}
        </span>
      </div>
    </div>,
  );
}
