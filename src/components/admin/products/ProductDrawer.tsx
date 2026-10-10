"use client";

import { useState, useTransition } from "react";
import { createProduct, deleteProduct, updateProduct } from "@/app/admin/(panel)/produits/actions";
import { fmtXof } from "@/lib/money";
import { FIELD_ERR, FIELD_LABEL, Drawer, Switch, inputClass } from "./ui";
import { PhotoField } from "./PhotoField";
import { SWATCHES, marginOf, parseAmount, validateProductForm } from "./logic";
import type { AdminCategory, AdminProduct, ProductFormValues } from "./types";

function initialValues(p: AdminProduct | null, categories: AdminCategory[]): ProductFormValues {
  if (!p) {
    return {
      name: "",
      nameEn: "",
      categoryId: categories[0]?.id ?? "maison",
      price: "",
      comparePrice: "",
      stock: "",
      cost: "",
      description: "",
      descriptionEn: "",
      keyword: "",
      bg: SWATCHES[0],
      active: true,
      imageUrl: null,
    };
  }
  return {
    name: p.fr.name,
    nameEn: p.en?.name ?? "",
    categoryId: p.categoryId,
    price: String(p.price),
    comparePrice: p.comparePrice ? String(p.comparePrice) : "",
    stock: String(p.stock),
    cost: p.cost !== null ? String(p.cost) : "",
    description: p.fr.description,
    descriptionEn: p.en?.description ?? "",
    keyword: p.keyword,
    bg: (p.bg ?? SWATCHES[0]).toUpperCase(),
    active: p.active,
    imageUrl: p.imageUrl,
  };
}

/** Tiroir création / édition d'un produit (maquette 621-671) + version anglaise, prix d'achat et marge. */
export function ProductDrawer({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product: AdminProduct | null;
  categories: AdminCategory[];
  onClose: () => void;
  onSaved: (message: string, id: string | null) => void;
}) {
  const isNew = !product;
  const [v, setV] = useState<ProductFormValues>(() => initialValues(product, categories));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [delError, setDelError] = useState("");
  const [pending, start] = useTransition();

  const set = <K extends keyof ProductFormValues>(k: K, value: ProductFormValues[K]) => {
    setV((s) => ({ ...s, [k]: value }));
    setErrors((e) => ({ ...e, [k]: "" }));
    setFormError("");
  };

  const price = parseAmount(v.price);
  const cost = v.cost.trim() === "" ? null : parseAmount(v.cost);
  const margin = price ? marginOf(price, cost) : null;
  const word = v.keyword.trim() || v.name.trim().split(/\s+/)[0]?.toLowerCase() || "";

  const save = () => {
    const check = validateProductForm(v);
    if (!check.ok) {
      setErrors(check.errors as Record<string, string>);
      return;
    }
    setFormError("");
    start(async () => {
      const res = isNew ? await createProduct(v) : await updateProduct(product.id, v);
      if (res.ok) {
        const newId = "id" in res && typeof res.id === "string" ? res.id : null;
        onSaved(isNew ? "Produit ajouté et visible en boutique." : "Produit enregistré.", isNew ? newId : product.id);
      } else {
        setErrors(res.fields ?? {});
        setFormError(res.message);
      }
    });
  };

  const remove = () => {
    if (!product) return;
    setDelError("");
    start(async () => {
      const res = await deleteProduct(product.id);
      if (res.ok) onSaved("Produit supprimé.", null);
      else setDelError(res.message);
    });
  };

  return (
    <Drawer title={isNew ? "Nouveau produit" : "Modifier le produit"} onClose={onClose}>
      <div className="flex flex-col gap-3.5 p-5">
        <PhotoField imageUrl={v.imageUrl} bg={v.bg} word={word} onChange={(url) => set("imageUrl", url)} />
        {errors.imageUrl && <span className={FIELD_ERR}>{errors.imageUrl}</span>}

        <label className={FIELD_LABEL}>
          Nom du produit
          <input value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={120} className={inputClass(errors.name)} />
          <span className={FIELD_ERR}>{errors.name}</span>
        </label>

        <label className={FIELD_LABEL}>
          Catégorie
          <select
            value={v.categoryId}
            onChange={(e) => set("categoryId", e.target.value)}
            className="min-h-[46px] rounded-[12px] border border-[#E2DCCF] bg-white px-3 text-[15px] font-normal"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-3 gap-2.5">
          <label className={FIELD_LABEL}>
            Prix (F)
            <input value={v.price} onChange={(e) => set("price", e.target.value)} inputMode="numeric" className={inputClass(errors.price)} />
            <span className={FIELD_ERR}>{errors.price}</span>
          </label>
          <label className={FIELD_LABEL}>
            Ancien prix
            <input
              value={v.comparePrice}
              onChange={(e) => set("comparePrice", e.target.value)}
              inputMode="numeric"
              placeholder="Facultatif"
              className={inputClass(errors.comparePrice)}
            />
            <span className={FIELD_ERR}>{errors.comparePrice}</span>
          </label>
          <label className={FIELD_LABEL}>
            Stock
            <input value={v.stock} onChange={(e) => set("stock", e.target.value)} inputMode="numeric" className={inputClass(errors.stock)} />
            <span className={FIELD_ERR}>{errors.stock}</span>
          </label>
        </div>

        <label className={FIELD_LABEL}>
          Prix d&apos;achat (F)
          <input
            value={v.cost}
            onChange={(e) => set("cost", e.target.value)}
            inputMode="numeric"
            placeholder="Facultatif, visible de vous seul"
            className={inputClass(errors.cost)}
          />
          <span className={errors.cost ? FIELD_ERR : "text-xs font-normal text-[#4A443C]"}>
            {errors.cost ||
              (margin
                ? `Marge : ${fmtXof(margin.amount)} par unité (${margin.pct} %)`
                : "Sert au calcul de la marge dans le carnet de comptes.")}
          </span>
        </label>

        <label className={FIELD_LABEL}>
          Description
          <textarea
            value={v.description}
            onChange={(e) => set("description", e.target.value)}
            rows={4}
            maxLength={2000}
            className={`${inputClass(errors.description)} resize-y leading-normal`}
          />
          <span className={FIELD_ERR}>{errors.description}</span>
        </label>

        <details className="rounded-[14px] border border-[#E2DCCF] bg-white px-3.5 py-1" open={Boolean(v.nameEn || v.descriptionEn)}>
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">Version anglaise (facultative)</summary>
          <div className="flex flex-col gap-3.5 pb-3.5 pt-1">
            <label className={FIELD_LABEL}>
              Product name
              <input value={v.nameEn} onChange={(e) => set("nameEn", e.target.value)} maxLength={120} className={inputClass(errors.nameEn)} lang="en" />
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
            <span className="text-xs text-[#4A443C]">Sans nom anglais, la boutique affiche la version française.</span>
          </div>
        </details>

        <label className={FIELD_LABEL}>
          Mot affiché sans photo
          <input
            value={v.keyword}
            onChange={(e) => set("keyword", e.target.value)}
            placeholder="Ex. gourde"
            maxLength={40}
            className={inputClass()}
          />
        </label>

        <div className="flex flex-col gap-2 text-sm font-medium">
          Couleur de fond
          <div role="group" aria-label="Couleur de fond" className="flex flex-wrap gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set("bg", c)}
                aria-label={`Couleur ${c}`}
                aria-pressed={v.bg.toUpperCase() === c}
                className="h-11 w-11 cursor-pointer rounded-full"
                style={{ background: c, border: `3px solid ${v.bg.toUpperCase() === c ? "#141210" : "#fff"}` }}
              />
            ))}
          </div>
        </div>

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
              Supprimer définitivement ce produit ? Les commandes passées restent intactes. Pour le retirer temporairement, masquez-le plutôt.
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
