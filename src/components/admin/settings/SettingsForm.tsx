"use client";

import { useState, useTransition } from "react";
import { saveSettingsAction } from "@/app/admin/(panel)/reglages/actions";
import { LEGAL_FIELDS, PAY_IDS, PAY_LABELS, parseSettingsForm, type PayId, type SettingsErrors, type SettingsForm as Form } from "@/lib/settings/schema";
import { borderOf, btnDark, btnLine, cardCls, errCls, fieldCls, labelCls, Switch, useToast } from "./ui";

function Field({
  label,
  value,
  onChange,
  error,
  inputMode,
  autoComplete,
  maxLength,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  inputMode?: "tel" | "email" | "numeric" | "text";
  autoComplete?: string;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <label className={labelCls}>
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={inputMode}
        autoComplete={autoComplete}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className={`${fieldCls} ${borderOf(error)}`}
      />
      {error ? <span className={errCls}>{error}</span> : null}
    </label>
  );
}

export function SettingsForm({ initial, connected }: { initial: Form; connected: boolean }) {
  const { show, node } = useToast();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<Form>(initial);
  const [form, setForm] = useState<Form>(initial);
  const [errors, setErrors] = useState<SettingsErrors>({});
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors({});
  };
  const setLegal = (key: keyof Form["legal"], value: string) => {
    setForm((f) => ({ ...f, legal: { ...f.legal, [key]: value } }));
    setErrors({});
  };
  const togglePay = (id: PayId) => {
    setForm((f) => ({ ...f, pay: { ...f.pay, [id]: !f.pay[id] } }));
    setErrors({});
  };

  function save() {
    const check = parseSettingsForm(form);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    startTransition(async () => {
      try {
        const res = await saveSettingsAction(form);
        if (res.ok) {
          setSaved(form);
          setErrors({});
          show("Paramètres enregistrés. La boutique est à jour.");
        } else {
          if (res.fieldErrors) setErrors(res.fieldErrors as SettingsErrors);
          show(res.message);
        }
      } catch {
        show("Une erreur est survenue. Réessayez.");
      }
    });
  }

  const payError = errors.pay;
  return (
    <div className="flex flex-col gap-5">
      {!connected ? (
        <div role="note" className="bg-[#FFF4D6] text-[#8A5A00] rounded-2xl px-4 py-3 text-[13px]">
          Base non connectée (mode démo) : les valeurs affichées sont des exemples et les modifications ne seront pas enregistrées.
        </div>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="flex flex-col gap-5"
        noValidate
      >
        <div className="grid gap-5 items-start" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,440px),1fr))" }}>
          <section className={`${cardCls} gap-3.5`}>
            <h2 className="m-0 text-[17px]">Boutique</h2>
            <Field label="Nom de la boutique" value={form.shopName} onChange={(v) => set("shopName", v)} error={errors.shopName} maxLength={80} />
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
              <Field label="WhatsApp" value={form.whatsapp} onChange={(v) => set("whatsapp", v)} error={errors.whatsapp} inputMode="tel" autoComplete="off" maxLength={40} />
              <Field label="E-mail" value={form.email} onChange={(v) => set("email", v)} error={errors.email} inputMode="email" autoComplete="off" maxLength={200} />
            </div>
            <Field label="Horaires du service client" value={form.hours} onChange={(v) => set("hours", v)} error={errors.hours} maxLength={120} />
          </section>

          <section className={`${cardCls} gap-3.5`}>
            <h2 className="m-0 text-[17px]">Livraison</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cotonou & Calavi (F)" value={form.shipCotonou} onChange={(v) => set("shipCotonou", v)} error={errors.shipCotonou} inputMode="numeric" />
              <Field label="Autres villes (F)" value={form.shipOther} onChange={(v) => set("shipOther", v)} error={errors.shipOther} inputMode="numeric" />
              <Field label="Livraison offerte dès (F)" value={form.freeFrom} onChange={(v) => set("freeFrom", v)} error={errors.freeFrom} inputMode="numeric" />
              <Field label="Heure limite pour J+1" value={form.cutoff} onChange={(v) => set("cutoff", v)} error={errors.cutoff} inputMode="numeric" />
            </div>
            <span className="text-[13px] text-text leading-normal">Appliqué au panier, au paiement et aux réponses des assistants.</span>
          </section>

          <section className={`${cardCls} gap-1`}>
            <h2 className="m-0 mb-1.5 text-[17px]">Moyens de paiement</h2>
            {PAY_IDS.map((id) => (
              <div key={id} className="border-t border-[#F0EBE1] py-1.5 first:border-t-0">
                <Switch on={form.pay[id]} onToggle={() => togglePay(id)} label={PAY_LABELS[id]} />
              </div>
            ))}
            {payError ? (
              <span role="alert" className="text-[#C2410C] text-[13px]">
                {payError}
              </span>
            ) : null}
          </section>

          <section className={`${cardCls} gap-3`}>
            <h2 className="m-0 text-[17px]">Assistants IA</h2>
            <Switch
              on={form.autoDraft}
              onToggle={() => set("autoDraft", !form.autoDraft)}
              label="Préparer une réponse aux nouveaux messages"
              hint="Le brouillon apparaît dans Messages. Rien n'est envoyé sans vous."
            />
            <Field label="Signature des réponses" value={form.aiSign} onChange={(v) => set("aiSign", v)} error={errors.aiSign} maxLength={120} />
          </section>
        </div>

        <section className={`${cardCls} gap-3.5`}>
          <div className="flex flex-col gap-1 max-w-[640px]">
            <h2 className="m-0 text-[17px]">Mentions légales</h2>
            <span className="text-[13px] text-text leading-normal">
              Ces informations remplissent les pages légales de la boutique (mentions légales, CGV, confidentialité). Un champ laissé vide reste affiché comme « [à compléter] » :
              ne saisissez que des informations exactes.
            </span>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))" }}>
            {LEGAL_FIELDS.map((f) => (
              <Field
                key={f.key}
                label={f.label}
                value={form.legal[f.key]}
                onChange={(v) => setLegal(f.key, v)}
                error={errors[`legal.${f.key}`]}
                maxLength={f.max}
                inputMode={f.key === "phone" ? "tel" : f.key === "email" ? "email" : "text"}
                autoComplete="off"
              />
            ))}
          </div>
        </section>

        <div className="flex gap-2.5 flex-wrap items-center">
          <button type="submit" disabled={pending} className={`${btnDark} px-[22px] min-h-[48px]`}>
            {pending ? "Enregistrement…" : "Enregistrer les paramètres"}
          </button>
          {dirty ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setForm(saved);
                  setErrors({});
                }}
                className={`${btnLine} px-[18px] min-h-[48px]`}
              >
                Annuler les modifications
              </button>
              <span className="text-[13px] text-[#8A5A00]">Modifications non enregistrées</span>
            </>
          ) : null}
        </div>
      </form>
      {node}
    </div>
  );
}
