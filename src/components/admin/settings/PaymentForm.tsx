"use client";

import { useState, useTransition } from "react";
import { clearFedapayAction, saveFedapayAction, testFedapayAction } from "@/app/admin/(panel)/reglages/actions";
import type { PaymentAdminView } from "@/lib/admin/data/settings";
import type { FedapayStatus, SecretSource } from "@/lib/payment/credentials";
import { btnDark, btnLine, btnLink, borderOf, cardCls, DemoBanner, errCls, fieldCls, labelCls, useToast } from "./ui";

const SOURCE_TEXT: Record<SecretSource, string> = {
  admin: "Enregistrée ici",
  env: "Via le serveur (variable d'environnement)",
  none: "Non renseignée",
};

function Row({ label, source, masked }: { label: string; source: SecretSource; masked: string | null }) {
  const ok = source !== "none";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-[14px]">
      <span className="font-medium">{label}</span>
      <span className="flex items-center gap-2">
        {masked ? <code className="text-[13px]">{masked}</code> : null}
        <span className="rounded-full px-2.5 py-1 text-[12px]" style={{ background: ok ? "#E3EFE8" : "#F3E3DD", color: ok ? "#1F6B4A" : "#9A3412" }}>
          {SOURCE_TEXT[source]}
        </span>
      </span>
    </div>
  );
}

/** Réglages → Paiement : clés FedaPay saisies ici (chiffrées côté serveur ; seules des valeurs masquées reviennent à l'écran). */
export function PaymentForm({ view }: { view: PaymentAdminView }) {
  const { show, node } = useToast();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<FedapayStatus>(view.status);
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [confirmLive, setConfirmLive] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const disabled = !view.connected || !view.canEncrypt || pending;
  const typedLive = secretKey.trim().startsWith("sk_live_") || webhookSecret.trim().startsWith("wh_live_");

  function save() {
    setErrs({});
    startTransition(async () => {
      try {
        const res = await saveFedapayAction({ secretKey, webhookSecret, confirmLive });
        if (res.ok) {
          setStatus(res.status);
          setSecretKey("");
          setWebhookSecret("");
          setConfirmLive(false);
          show("Clés enregistrées. Testez la connexion pour vérifier.");
        } else {
          setErrs(res.fieldErrors ?? {});
          show(res.message);
        }
      } catch {
        show("Une erreur est survenue. Réessayez.");
      }
    });
  }

  function test() {
    startTransition(async () => {
      try {
        const res = await testFedapayAction();
        show(res.ok ? `Connexion réussie (mode ${res.mode === "live" ? "réel" : "essai"}).` : res.message);
      } catch {
        show("Une erreur est survenue. Réessayez.");
      }
    });
  }

  function clearSaved() {
    if (!window.confirm("Effacer les clés enregistrées ici ? Le site utilisera alors celles du serveur, ou n'acceptera plus de paiement en ligne.")) return;
    startTransition(async () => {
      try {
        const res = await clearFedapayAction("all");
        if (res.ok) {
          setStatus(res.status);
          show("Clés enregistrées effacées.");
        } else show(res.message);
      } catch {
        show("Une erreur est survenue. Réessayez.");
      }
    });
  }

  async function copyUrl() {
    if (!view.webhookUrl) return;
    try {
      await navigator.clipboard.writeText(view.webhookUrl);
      show("Adresse copiée.");
    } catch {
      show("Copie impossible : sélectionnez l'adresse à la main.");
    }
  }

  const savedHere = status.secretSource === "admin" || status.webhookSource === "admin";

  return (
    <section
      className={`${cardCls} gap-4`}
      aria-labelledby="pay-title"
    >
      <h2 id="pay-title" className="m-0 text-[17px]">
        Paiement en ligne (FedaPay)
      </h2>
      <DemoBanner connected={view.connected} />
      {!view.canEncrypt ? (
        <div role="note" className="rounded-2xl bg-[#FFF4D6] px-4 py-3 text-[13px] text-[#8A5A00]">
          Pour enregistrer des clés ici, le serveur a besoin d&apos;une clé de chiffrement : ajoutez la variable <code>SETTINGS_ENCRYPTION_KEY</code> (16 caractères minimum) dans les
          réglages de votre hébergement, puis redéployez.
        </div>
      ) : null}

      <div className="flex flex-col gap-2.5">
        <Row label="Clé secrète API" source={status.secretSource} masked={status.secretMasked} />
        <Row label="Secret du webhook" source={status.webhookSource} masked={status.webhookMasked} />
        <div className="flex flex-wrap items-center justify-between gap-2 text-[14px]">
          <span className="font-medium">Mode</span>
          <span className="rounded-full px-2.5 py-1 text-[12px]" style={{ background: status.mode === "live" ? "#F3E3DD" : "#E8EAF3", color: status.mode === "live" ? "#9A3412" : "#3F4A8A" }}>
            {status.mode === "live" ? "Réel : de vrais paiements sont encaissés" : status.mode === "sandbox" ? "Essai (sandbox) : aucun vrai argent" : "Aucun : paiement en ligne désactivé"}
          </span>
        </div>
      </div>

      <form
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}
        onSubmit={(ev) => {
          ev.preventDefault();
          save();
        }}
        noValidate
      >
        <label className={labelCls}>
          Clé secrète API (sk_…)
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={secretKey}
            disabled={disabled}
            placeholder={status.secretSource === "admin" ? "Laisser vide pour conserver la clé actuelle" : "sk_sandbox_…"}
            onChange={(e) => {
              setSecretKey(e.target.value);
              setErrs({});
            }}
            className={`${fieldCls} ${borderOf(errs.secretKey)}`}
          />
          {errs.secretKey ? <span className={errCls}>{errs.secretKey}</span> : null}
        </label>
        <label className={labelCls}>
          Secret du webhook (wh_…)
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={webhookSecret}
            disabled={disabled}
            placeholder={status.webhookSource === "admin" ? "Laisser vide pour conserver le secret actuel" : "wh_sandbox_…"}
            onChange={(e) => {
              setWebhookSecret(e.target.value);
              setErrs({});
            }}
            className={`${fieldCls} ${borderOf(errs.webhookSecret)}`}
          />
          {errs.webhookSecret ? <span className={errCls}>{errs.webhookSecret}</span> : null}
        </label>

        {typedLive ? (
          <label className="flex items-start gap-2 text-[14px]" style={{ gridColumn: "1 / -1" }}>
            <input type="checkbox" checked={confirmLive} onChange={(e) => setConfirmLive(e.target.checked)} className="mt-1" />
            <span>
              Je comprends qu&apos;une clé réelle encaisse de vrais paiements Mobile Money et carte.
              {errs.confirmLive ? <span className={`${errCls} block`}>{errs.confirmLive}</span> : null}
            </span>
          </label>
        ) : null}

        <div className="flex flex-wrap items-center gap-3" style={{ gridColumn: "1 / -1" }}>
          <button type="submit" disabled={disabled || (!secretKey.trim() && !webhookSecret.trim())} className={`${btnDark} min-h-[46px] px-5`}>
            Enregistrer
          </button>
          <button type="button" onClick={test} disabled={!view.connected || pending || status.secretSource === "none"} className={`${btnLine} min-h-[46px] px-5`}>
            Tester la connexion
          </button>
          {savedHere ? (
            <button type="button" onClick={clearSaved} disabled={pending} className={`${btnLink} text-[13px]`}>
              Effacer les clés enregistrées ici
            </button>
          ) : null}
        </div>
      </form>

      <div className="flex flex-col gap-2 rounded-2xl bg-[#FAF8F3] p-4 text-[13px]">
        <strong className="text-[14px]">Brancher FedaPay, pas à pas</strong>
        <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5">
          <li>
            Dans FedaPay, ouvrez votre espace de travail en mode <b>Essai (sandbox)</b> puis <b>API</b> : copiez la clé secrète (<code>sk_sandbox_…</code>) ci-dessus.
          </li>
          <li>
            Allez dans <b>Webhooks</b>, ajoutez cette adresse, cochez l&apos;événement <code>transaction.approved</code>, enregistrez :
            <span className="mt-1.5 flex flex-wrap items-center gap-2">
              <code className="break-all rounded-lg bg-white px-2 py-1">{view.webhookUrl ?? "Définissez NEXT_PUBLIC_SITE_URL pour afficher l'adresse"}</code>
              {view.webhookUrl ? (
                <button type="button" onClick={copyUrl} className={`${btnLine} min-h-9 px-3 text-[12px]`}>
                  Copier
                </button>
              ) : null}
            </span>
          </li>
          <li>
            Ouvrez ce webhook, révélez son <b>secret</b> (<code>wh_sandbox_…</code>) et collez-le dans « Secret du webhook ».
          </li>
          <li>
            Cliquez <b>Tester la connexion</b>, puis faites une commande d&apos;essai avec un numéro de test FedaPay. Passez en mode réel seulement après la recette.
          </li>
        </ol>
        <span className="text-text">Les clés sont chiffrées avant d&apos;être stockées et ne sont jamais réaffichées en entier.</span>
      </div>
      {node}
    </section>
  );
}
