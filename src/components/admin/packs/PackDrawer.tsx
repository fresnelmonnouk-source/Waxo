"use client";

import { useMemo, useState, useTransition } from "react";
import { createPack, deletePack, updatePack } from "@/app/admin/(panel)/packs/actions";
import { fmtXof } from "@/lib/money";
import { FIELD_ERR, FIELD_LABEL, Drawer, Switch, inputClass } from "../products/ui";
import { PhotoField } from "../products/PhotoField";
import { MAX_PACK_ITEMS, packSavings, packStock, parseAmount, validatePackForm } from "../products/logic";
import type { AdminPack, PackFormValues, PackProductRef } from "../products/types";

function initialValues(p: AdminPack | null): PackFormValues {
  if (!p) return { name: "", nameEn: "", description: "", descriptionEn: "", price: "", active: true, imageUrl: null, items: [] };
  return {
    name: p.fr.name,
    nameEn: p.en?.name ?? "",
    description: p.fr.description,
    descriptionEn: p.en?.description ?? "",
    price: String(p.price),
    active: p.active,
    imageUrl: p.imageUrl,
    items: p.items.map((i) => ({ productId: i.productId, qty: i.qty })),
  };
}

/** Tiroir création / édition d'un pack : contenu (produit + quantité), prix et économie calculée en direct. */
export function PackDrawer({
  pack,
  products,
  onClose,
  onSaved,
}: {
  pack: AdminPack | null;
  products: PackProductRef[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isNew = !pack;
  const [v, setV] = useState<PackFormValues>(() => initialValues(pack));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [delError, setDelError] = useState("");
  const [pending, start] = useTransition();

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const set = <K extends keyof PackFormValues>(k: K, value: PackFormValues[K]) => {
    setV((s) => ({ ...s, [k]: value }));
    setErrors((e) => ({ ...e, [k]: "" }));
    setFormError("");
  };

  const used = new Set(v.items.map((i) => i.productId));
  const free = products.filter((p) => !used.has(p.id));
  const price = parseAmount(v.price) ?? 0;
  const sav = packSavings(v.items, price, byId);
  const stock = packStock(v.items, byId);
  const hidden = v.items.filter((i) => byId.get(i.productId)?.active === false);

  const setItem = (idx: number, patch: Partial<{ productId: string; qty: number }>) =>
    set(
      "items",
      v.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    );

  const save = () => {
    const check = validatePackForm(v);
    if (!check.ok) {
      setErrors(check.errors as Record<string, string>);
      return;
    }
    start(async () => {
      const res = isNew ? await createPack(v) : await updatePack(pack.id, v);
      if (res.ok) onSaved(isNew ? "Pack créé." : "Pack enregistré.");
      else {
        setErrors(res.fields ?? {});
        setFormError(res.message);
      }
    });
  };

  const remove = () => {
    if (!pack) return;
    setDelError("");
    start(async () => {
      const res = await deletePack(pack.id);
      if (res.ok) onSaved("Pack supprimé.");
      else setDelError(res.message);
    });
  };

  const word = v.name.trim().split(/\s+/)[0]?.toLowerCase() ?? "";

  return (
    <Drawer title={isNew ? "Nouveau pack" : "Modifier le pack"} onClose={onClose}>
      <div className="flex flex-col gap-3.5 p-5">
        <PhotoField imageUrl={v.imageUrl} bg="#F3E3A6" word={word} onChange={(url) => set("imageUrl", url)} />
        {errors.imageUrl && <span className={FIELD_ERR}>{errors.imageUrl}</span>}

        <label className={FIELD_LABEL}>
          Nom du pack
          <input value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={120} className={inputClass(errors.name)} />
          <span className={FIELD_ERR}>{errors.name}</span>
        </label>

        <label className={FIELD_LABEL}>
          Description
          <textarea
            value={v.description}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
            maxLength={2000}
            className={`${inputClass(errors.description)} resize-y leading-normal`}
          />
          <span className={FIELD_ERR}>{errors.description}</span>
        </label>

        <details className="rounded-[14px] border border-[#E2DCCF] bg-white px-3.5 py-1" open={Boolean(v.nameEn || v.descriptionEn)}>
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">Version anglaise (facultative)</summary>
          <div className="flex flex-col gap-3.5 pb-3.5 pt-1">
            <label className={FIELD_LABEL}>
              Pack name
              <input value={v.nameEn} onChange={(e) => set("nameEn", e.target.value)} maxLength={120} lang="en" className={inputClass(errors.nameEn)} />
              <span className={FIELD_ERR}>{errors.nameEn}</span>
            </label>
            <label className={FIELD_LABEL}>
              Description
              <textarea
                value={v.descriptionEn}
                onChange={(e) => set("descriptionEn", e.target.value)}
                rows={3}
                maxLength={2000}
                lang="en"
                className={`${inputClass(errors.descriptionEn)} resize-y leading-normal`}
              />
              <span className={FIELD_ERR}>{errors.descriptionEn}</span>
            </label>
          </div>
        </details>

        <fieldset className="m-0 flex flex-col gap-2.5 rounded-[14px] border border-[#E2DCCF] bg-white p-3.5">
          <legend className="px-1 text-sm font-medium">Contenu du pack</legend>
          {v.items.length === 0 && <span className="text-[13px] text-[#4A443C]">Aucun produit pour l&apos;instant.</span>}
          {v.items.map((it, idx) => {
            const options = products.filter((p) => p.id === it.productId || !used.has(p.id));
            return (
              <div key={it.productId} className="flex items-center gap-2">
                <select
                  value={it.productId}
                  onChange={(e) => setItem(idx, { productId: e.target.value })}
                  aria-label={`Produit ${idx + 1}`}
                  className="min-h-11 min-w-0 flex-1 rounded-[12px] border border-[#E2DCCF] bg-white px-2.5 text-sm"
                >
                  {!byId.has(it.productId) && <option value={it.productId}>(produit introuvable)</option>}
                  {options.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {fmtXof(p.price)}
                      {p.active ? "" : " (masqué)"}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={it.qty}
                  onChange={(e) => setItem(idx, { qty: Math.max(1, Math.min(50, Math.trunc(Number(e.target.value)) || 1)) })}
                  aria-label={`Quantité du produit ${idx + 1}`}
                  className="min-h-11 w-[64px] rounded-[12px] border border-[#E2DCCF] bg-white px-2 text-center text-sm"
                />
                <button
                  type="button"
                  onClick={() => set("items", v.items.filter((_, i) => i !== idx))}
                  aria-label={`Retirer le produit ${idx + 1}`}
                  className="h-11 w-11 flex-none cursor-pointer rounded-full border border-[#D6CFC0] bg-white text-lg"
                >
                  ×
                </button>
              </div>
            );
          })}
          {errors.items && <span className={FIELD_ERR}>{errors.items}</span>}
          <button
            type="button"
            disabled={free.length === 0 || v.items.length >= MAX_PACK_ITEMS}
            onClick={() => set("items", [...v.items, { productId: free[0].id, qty: 1 }])}
            className="min-h-11 cursor-pointer self-start rounded-full border border-[#D6CFC0] bg-transparent px-4 text-[13px] hover:bg-[#F4F1EA] disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Ajouter un produit
          </button>
        </fieldset>

        <label className={FIELD_LABEL}>
          Prix du pack (F)
          <input value={v.price} onChange={(e) => set("price", e.target.value)} inputMode="numeric" className={inputClass(errors.price)} />
          <span className={FIELD_ERR}>{errors.price}</span>
        </label>

        {v.items.length > 0 && (
          <div
            aria-live="polite"
            className="flex flex-col gap-1 rounded-2xl p-3.5 text-sm leading-[1.45]"
            style={{ background: price > 0 && sav.saving > 0 ? "#E5EFE7" : "#F6E1DA" }}
          >
            <span>
              Les produits séparément : <strong>{fmtXof(sav.total)}</strong>
            </span>
            {price > 0 && sav.saving > 0 ? (
              <span style={{ color: "#1F6B4A" }}>
                Économie pour le client : <strong>{fmtXof(sav.saving)}</strong> ({sav.pct} %)
              </span>
            ) : price > 0 ? (
              <span style={{ color: "#9A3412" }}>
                {sav.saving === 0 ? "Aucune économie : le pack coûte autant que les produits séparés." : `Le pack coûte ${fmtXof(-sav.saving)} de plus que les produits séparés.`}
              </span>
            ) : (
              <span className="text-[#4A443C]">Indiquez le prix du pack pour voir l&apos;économie.</span>
            )}
            <span className="text-[#4A443C]">
              Packs vendables avec le stock actuel : <strong>{stock}</strong>
            </span>
            {hidden.length > 0 && <span style={{ color: "#9A3412" }}>Attention : {hidden.length} produit(s) du pack sont masqués de la boutique.</span>}
            {sav.missing > 0 && <span style={{ color: "#9A3412" }}>Attention : {sav.missing} produit(s) introuvables.</span>}
          </div>
        )}

        <Switch checked={v.active} onChange={(a) => set("active", a)} label={v.active ? "Visible en boutique" : "Masqué de la boutique"} />

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
          {!isNew && (
            <button
              type="button"
              onClick={() => setConfirmDel(true)}
              className="ml-auto min-h-12 cursor-pointer border-0 bg-transparent text-sm text-[#9A3412] underline underline-offset-[3px]"
            >
              Supprimer
            </button>
          )}
        </div>

        {confirmDel && (
          <div className="flex flex-col gap-2.5 rounded-2xl bg-[#F6E1DA] p-3.5">
            <span className="text-sm leading-[1.45] text-[#141210]">
              Supprimer définitivement ce pack ? Les produits qu&apos;il contient ne sont pas touchés. Pour le retirer temporairement, masquez-le plutôt.
            </span>
            {delError && (
              <span role="alert" className="text-sm font-medium text-[#9A3412]">
                {delError}
              </span>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="min-h-11 cursor-pointer rounded-full border-0 bg-[#9A3412] px-4 font-semibold text-white disabled:opacity-60"
              >
                Supprimer
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDel(false);
                  setDelError("");
                }}
                className="min-h-11 cursor-pointer rounded-full border border-[#D6CFC0] bg-white px-4"
              >
                Garder
              </button>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
