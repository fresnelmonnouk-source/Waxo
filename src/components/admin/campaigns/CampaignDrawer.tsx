"use client";

import { useMemo, useState, useTransition } from "react";
import { saveCampaign } from "@/app/admin/(panel)/campagnes/actions";
import type { AdminCampaign, CampaignProductRef } from "@/lib/admin/data/campaigns";
import { discountPercent, MAX_DISCOUNT_PERCENT, slugifyCampaign, validateCampaign } from "@/lib/campaigns/logic";
import { fmtXof } from "@/lib/money";
import { Drawer, FIELD_ERR, FIELD_LABEL, inputClass } from "../products/ui";
import { Switch } from "../settings/ui";
import {
  applyPercentToAll,
  CAMPAIGN_TEMPLATES,
  draftFromCampaign,
  draftToInput,
  emptyDraft,
  itemWithPercent,
  itemWithPrice,
  normalizeSearch,
  parseWhole,
  type CampaignDraft,
  type CampaignItemDraft,
} from "./helpers";

const SEARCH_LIMIT = 8;

/** Tiroir création / modification d'une campagne : textes FR/EN, dates (heure du Bénin), affichage, produits et prix. */
export function CampaignDrawer({
  campaign,
  products,
  onClose,
  onSaved,
}: {
  campaign: AdminCampaign | null;
  products: CampaignProductRef[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isNew = !campaign;
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const normals = useMemo(() => new Map(products.map((p) => [p.id, p.price])), [products]);
  const [d, setD] = useState<CampaignDraft>(() => (campaign ? draftFromCampaign(campaign, normals) : emptyDraft()));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [query, setQuery] = useState("");
  const [bulk, setBulk] = useState("");
  const [pending, start] = useTransition();

  const clearErr = (...keys: string[]) => {
    setErrors((e) => {
      const next = { ...e };
      for (const k of keys) delete next[k];
      return next;
    });
    setFormError("");
  };

  const set = <K extends keyof CampaignDraft>(k: K, value: CampaignDraft[K], errKey: string = k) => {
    setD((s) => ({ ...s, [k]: value }));
    clearErr(errKey);
  };

  const setNameFr = (name: string) => {
    setD((s) => ({ ...s, nameFr: name, slug: s.slugTouched ? s.slug : slugifyCampaign(name) }));
    clearErr("nameFr", "slug");
  };

  const applyTemplate = (id: string) => {
    const t = CAMPAIGN_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setD((s) => ({
      ...s,
      nameFr: t.nameFr,
      nameEn: t.nameEn,
      taglineFr: t.taglineFr,
      taglineEn: t.taglineEn,
      slug: s.slugTouched ? s.slug : slugifyCampaign(t.nameFr),
    }));
    clearErr("nameFr", "nameEn", "slug", "tagline");
  };

  const used = new Set(d.items.map((i) => i.productId));
  const q = normalizeSearch(query);
  const matches = products.filter((p) => !used.has(p.id) && (!q || normalizeSearch(p.name).includes(q)));

  const setItems = (items: CampaignItemDraft[]) => set("items", items);
  const updateItem = (productId: string, fn: (it: CampaignItemDraft, normal: number) => CampaignItemDraft) =>
    setItems(d.items.map((it) => (it.productId === productId ? fn(it, normals.get(it.productId) ?? 0) : it)));

  const addProduct = (id: string) => {
    const base: CampaignItemDraft = { productId: id, salePrice: "", percent: "" };
    const pct = parseWhole(bulk);
    setItems([...d.items, pct ? itemWithPercent(base, normals.get(id) ?? 0, String(pct)) : base]);
  };

  const bulkPct = parseWhole(bulk);
  const bulkOk = bulkPct !== null && bulkPct > 0 && bulkPct <= MAX_DISCOUNT_PERCENT;

  const save = () => {
    const input = draftToInput(d);
    const check = validateCampaign(input, normals);
    if (!check.ok) {
      setErrors(check.errors);
      setFormError("Vérifiez les champs signalés.");
      return;
    }
    start(async () => {
      const res = await saveCampaign(campaign?.id ?? null, input);
      if (res.ok) onSaved(isNew ? "Campagne créée." : "Campagne enregistrée.");
      else {
        setErrors(res.fields ?? {});
        setFormError(res.message);
      }
    });
  };

  return (
    <Drawer title={isNew ? "Nouvelle campagne" : "Modifier la campagne"} onClose={onClose}>
      <div className="flex flex-col gap-3.5 p-5">
        {isNew && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Partir d&apos;un modèle</span>
            <div className="flex flex-wrap gap-2">
              {CAMPAIGN_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t.id)}
                  aria-pressed={d.nameFr === t.nameFr}
                  className="min-h-11 cursor-pointer rounded-full border px-3.5 text-[13px] font-medium"
                  style={
                    d.nameFr === t.nameFr
                      ? { borderColor: "#141210", background: "#141210", color: "#F4F1EA" }
                      : { borderColor: "#D6CFC0", background: "transparent", color: "#141210" }
                  }
                >
                  {t.nameFr}
                </button>
              ))}
            </div>
            <span className="text-xs text-[#4A443C]">Le modèle remplit les noms et l&apos;accroche ; choisissez ensuite les dates et les produits.</span>
          </div>
        )}

        <label className={FIELD_LABEL}>
          Nom de la campagne
          <input value={d.nameFr} onChange={(e) => setNameFr(e.target.value)} maxLength={60} className={inputClass(errors.nameFr)} />
          <span className={FIELD_ERR}>{errors.nameFr}</span>
        </label>

        <label className={FIELD_LABEL}>
          Nom en anglais
          <input value={d.nameEn} onChange={(e) => set("nameEn", e.target.value)} maxLength={60} lang="en" placeholder={d.nameFr} className={inputClass(errors.nameEn)} />
          <span className={FIELD_ERR}>{errors.nameEn}</span>
        </label>

        <label className={FIELD_LABEL}>
          Adresse de la page
          <span className="flex items-center gap-1.5">
            <span className="text-sm font-normal text-[#4A443C]">/campagne/</span>
            <input
              value={d.slug}
              onChange={(e) => {
                setD((s) => ({ ...s, slug: e.target.value.toLowerCase(), slugTouched: true }));
                clearErr("slug");
              }}
              maxLength={60}
              autoCapitalize="none"
              spellCheck={false}
              className={inputClass(errors.slug)}
            />
          </span>
          <span className="text-xs font-normal text-[#4A443C]">Remplie depuis le nom. Lettres minuscules, chiffres et tirets.</span>
          <span className={FIELD_ERR}>{errors.slug}</span>
        </label>

        <label className={FIELD_LABEL}>
          Accroche
          <textarea
            value={d.taglineFr}
            onChange={(e) => set("taglineFr", e.target.value, "tagline")}
            rows={2}
            maxLength={160}
            className={`${inputClass(errors.tagline)} resize-y leading-normal`}
          />
        </label>
        <label className={FIELD_LABEL}>
          Accroche en anglais
          <textarea
            value={d.taglineEn}
            onChange={(e) => set("taglineEn", e.target.value, "tagline")}
            rows={2}
            maxLength={160}
            lang="en"
            className={`${inputClass(errors.tagline)} resize-y leading-normal`}
          />
          <span className={FIELD_ERR}>{errors.tagline}</span>
        </label>

        <fieldset className="m-0 flex flex-col gap-3 rounded-[14px] border border-[#E2DCCF] bg-white p-3.5">
          <legend className="px-1 text-sm font-medium">Dates (heure du Bénin)</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={FIELD_LABEL}>
              Début
              <input type="datetime-local" value={d.startsLocal} onChange={(e) => set("startsLocal", e.target.value, "startsAt")} className={inputClass(errors.startsAt)} />
              <span className={FIELD_ERR}>{errors.startsAt}</span>
            </label>
            <label className={FIELD_LABEL}>
              Fin
              <input type="datetime-local" value={d.endsLocal} onChange={(e) => set("endsLocal", e.target.value, "endsAt")} className={inputClass(errors.endsAt)} />
              <span className={FIELD_ERR}>{errors.endsAt}</span>
            </label>
          </div>
          <span className="text-xs text-[#4A443C]">Les prix de campagne s&apos;appliquent dès le début et s&apos;arrêtent à la fin, automatiquement.</span>
        </fieldset>

        <div className="flex flex-col rounded-[14px] border border-[#E2DCCF] bg-white px-3.5 py-1">
          <Switch on={d.active} onToggle={() => set("active", !d.active)} label="Campagne active" hint="Désactivée, elle ne s'applique pas même pendant ses dates." />
          <Switch on={d.showMenu} onToggle={() => set("showMenu", !d.showMenu)} label="Lien dans le menu" hint="Pendant la campagne, un lien mène à sa page." />
          <Switch on={d.showBanner} onToggle={() => set("showBanner", !d.showBanner)} label="Bannière en haut du site" />
          <Switch on={d.showCountdown} onToggle={() => set("showCountdown", !d.showCountdown)} label="Compte à rebours" hint="Temps restant avant la fin de la campagne." />
        </div>

        <fieldset className="m-0 flex flex-col gap-3 rounded-[14px] border border-[#E2DCCF] bg-white p-3.5">
          <legend className="px-1 text-sm font-medium">Produits en promotion</legend>

          <div role="note" className="rounded-[12px] bg-[#FBEFC9] px-3 py-2.5 text-[13px] leading-[1.45] text-[#4A443C]">
            Le prix barré affiché est votre prix normal actuel. Ne l&apos;augmentez pas juste avant la campagne : une fausse remise est interdite
            et fait perdre la confiance des clients.
          </div>

          {d.items.length > 1 && (
            <div className="flex flex-wrap items-end gap-2">
              <label className={`${FIELD_LABEL} w-[120px]`}>
                Remise pour tous
                <span className="flex items-center gap-1">
                  <input value={bulk} onChange={(e) => setBulk(e.target.value)} inputMode="numeric" maxLength={2} aria-label="Pourcentage de remise pour tous" className={inputClass()} />
                  <span aria-hidden="true">%</span>
                </span>
              </label>
              <button
                type="button"
                disabled={!bulkOk}
                onClick={() => bulkOk && setItems(applyPercentToAll(d.items, normals, bulkPct))}
                className="min-h-11 cursor-pointer rounded-full border border-[#D6CFC0] bg-transparent px-4 text-[13px] hover:bg-[#F4F1EA] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Appliquer {bulkOk ? `${bulkPct} %` : "X %"} à tous
              </button>
            </div>
          )}

          {d.items.length === 0 && <span className="text-[13px] text-[#4A443C]">Aucun produit pour l&apos;instant : cherchez-en ci-dessous.</span>}
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {d.items.map((it) => {
              const p = byId.get(it.productId);
              const normal = p?.price ?? 0;
              const sale = parseWhole(it.salePrice);
              const pct = sale ? discountPercent(normal, sale) : 0;
              const bad = it.salePrice.trim() !== "" && (!sale || sale >= normal || pct > MAX_DISCOUNT_PERCENT);
              const name = p?.name ?? "(produit introuvable)";
              return (
                <li key={it.productId} className="flex flex-col gap-2 rounded-[12px] border border-[#E2DCCF] p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <strong className="truncate text-sm">{name}</strong>
                      <span className="flex flex-wrap items-center gap-1.5 text-[13px]">
                        <span className="text-[#4A443C] line-through">{fmtXof(normal)}</span>
                        <span aria-hidden="true">→</span>
                        <strong>{sale && !bad ? fmtXof(sale) : "-"}</strong>
                        {pct > 0 && !bad && (
                          <span className="rounded-full bg-[#C2410C] px-2 py-0.5 text-xs font-semibold text-white">-{pct} %</span>
                        )}
                      </span>
                      {p && !p.active && <span className="text-xs text-[#9A3412]">Produit masqué de la boutique.</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => setItems(d.items.filter((x) => x.productId !== it.productId))}
                      aria-label={`Retirer ${name}`}
                      className="h-11 w-11 flex-none cursor-pointer rounded-full border border-[#D6CFC0] bg-white text-lg"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="flex w-[100px] flex-col gap-1 text-xs font-medium">
                      Remise (%)
                      <input
                        value={it.percent}
                        onChange={(e) => updateItem(it.productId, (x, n) => itemWithPercent(x, n, e.target.value))}
                        inputMode="numeric"
                        maxLength={2}
                        aria-label={`Remise en pourcentage pour ${name}`}
                        className={inputClass(bad ? "x" : undefined)}
                      />
                    </label>
                    <span className="pb-3 text-xs text-[#4A443C]">ou</span>
                    <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs font-medium">
                      Prix de campagne (F)
                      <input
                        value={it.salePrice}
                        onChange={(e) => updateItem(it.productId, (x, n) => itemWithPrice(x, n, e.target.value))}
                        inputMode="numeric"
                        aria-label={`Prix de campagne pour ${name}`}
                        className={inputClass(bad ? "x" : undefined)}
                      />
                    </label>
                  </div>
                  {bad && (
                    <span className={FIELD_ERR}>
                      {sale && sale < normal ? `Remise de ${MAX_DISCOUNT_PERCENT} % maximum.` : "Le prix de campagne doit être inférieur au prix normal."}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {errors.items && <span className={FIELD_ERR}>{errors.items}</span>}

          <label className={FIELD_LABEL}>
            Ajouter un produit
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher par nom…"
              className={inputClass()}
            />
          </label>
          {matches.length === 0 ? (
            <span className="text-[13px] text-[#4A443C]">{q ? "Aucun produit ne correspond." : "Tous les produits sont déjà ajoutés."}</span>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {matches.slice(0, SEARCH_LIMIT).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => addProduct(p.id)}
                    className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-[12px] border border-[#E2DCCF] bg-[#FAF8F3] px-3 text-left text-sm hover:bg-[#F4F1EA]"
                  >
                    <span className="min-w-0 truncate">
                      {p.name}
                      {p.active ? "" : " (masqué)"}
                    </span>
                    <span className="flex flex-none items-center gap-2 text-[13px] text-[#4A443C]">
                      {fmtXof(p.price)}
                      <span className="font-semibold text-[#1F6B4A]">+ Ajouter</span>
                    </span>
                  </button>
                </li>
              ))}
              {matches.length > SEARCH_LIMIT && (
                <li className="text-xs text-[#4A443C]">+ {matches.length - SEARCH_LIMIT} autres : précisez la recherche.</li>
              )}
            </ul>
          )}
        </fieldset>

        {formError && (
          <span role="alert" className="text-sm font-medium text-[#C2410C]">
            {formError}
          </span>
        )}

        <div className="flex flex-wrap gap-2.5 pt-1.5">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="min-h-12 cursor-pointer rounded-full border-0 bg-[#141210] px-[22px] font-semibold text-[#F4F1EA] hover:bg-[#2C2823] disabled:opacity-60"
          >
            {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button type="button" onClick={onClose} className="min-h-12 cursor-pointer rounded-full border border-[#D6CFC0] bg-transparent px-[18px]">
            Annuler
          </button>
        </div>
      </div>
    </Drawer>
  );
}
