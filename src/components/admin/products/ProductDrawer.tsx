"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createProduct, deleteProduct, updateProduct } from "@/app/admin/(panel)/produits/actions";
import { fmtXof } from "@/lib/money";
import { FIELD_ERR, FIELD_LABEL, Drawer, Switch, inputClass } from "./ui";
import { PhotosField } from "./PhotosField";
import { AiWriterPanel } from "./AiWriterPanel";
import { applyDraft, type DraftField, type DraftTarget, type DraftWarnings, type ProductDraft } from "@/lib/admin/ai/product-draft";
import { publishGate } from "@/lib/admin/ai/product-writer-gate";
import { DETAIL_LABELS, SWATCHES, detailErrorKey, marginOf, parseAmount, validateProductForm } from "./logic";
import { DETAIL_KEYS, EMPTY_DETAILS, hasAnyDetail, type DetailKey, type ProductDetails } from "@/lib/catalog/details";
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
      images: [],
      details: { ...EMPTY_DETAILS },
      detailsEn: { ...EMPTY_DETAILS },
      freeShipping: false,
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
    images: p.images,
    details: { ...p.details.fr },
    detailsEn: { ...p.details.en },
    freeShipping: p.freeShipping,
    stockAtOpen: String(p.stock),
  };
}

/** Libellés anglais (la version anglaise du formulaire est rédigée en anglais, comme « Product name »). */
const DETAIL_LABELS_EN: Record<DetailKey, string> = {
  color: "Colour",
  materials: "Materials",
  specs: "Technical specifications",
  highlights: "Key features",
  uses: "Possible uses",
  care: "Use & care tips",
};

/** Exemples de saisie (une information par ligne). */
const DETAIL_PLACEHOLDERS: Record<DetailKey, string> = {
  color: "Ex. Noir mat",
  materials: "Ex. Acier inoxydable, bouchon en bambou",
  specs: "Ex.\nContenance : 750 ml\nDimensions : 7 x 26 cm",
  highlights: "Ex.\nGarde au frais 24 h\nNe fuit pas dans le sac",
  uses: "Ex.\nBureau\nSport\nVoyage",
  care: "Ex.\nLaver à la main à l'eau tiède\nNe pas passer au micro-ondes",
};

/** Ce que l'IA signale sous un champ qu'elle a rempli : lien lu (à vérifier) et avertissements de contrôle. */
type AiMarks = { fromLink: ReadonlySet<DraftField>; warnings: DraftWarnings };

/** Mentions sous un champ rempli par l'IA : « à vérifier » (lien lu) et avertissements (phrase recopiée, marque…). */
function AiHints({ field, marks }: { field: DraftField; marks: AiMarks }) {
  const warnings = marks.warnings[field] ?? [];
  if (!marks.fromLink.has(field) && !warnings.length) return null;
  return (
    <>
      {marks.fromLink.has(field) && <span className="text-xs font-normal text-[#8A5A00]">Vient du lien, à vérifier.</span>}
      {warnings.map((w) => (
        <span key={w} className="text-xs font-medium text-[#9A3412]">
          {w}
        </span>
      ))}
    </>
  );
}

/** Les six rubriques facultatives (couleur et matériaux sur une ligne, les autres en zone de texte). */
function DetailFields({
  values,
  labels,
  en = false,
  errors,
  marks,
  onChange,
}: {
  values: ProductDetails;
  labels: Record<DetailKey, string>;
  en?: boolean;
  errors: Record<string, string>;
  /** Mentions de l'IA (lien lu, avertissements). */
  marks: AiMarks;
  onChange: (k: DetailKey, value: string) => void;
}) {
  return (
    <>
      {DETAIL_KEYS.map((k) => {
        const err = errors[detailErrorKey(k, en)];
        const short = k === "color" || k === "materials";
        const common = {
          value: values[k],
          placeholder: en ? undefined : DETAIL_PLACEHOLDERS[k],
          lang: en ? "en" : undefined,
        };
        return (
          <label key={k} className={FIELD_LABEL}>
            {labels[k]}
            {short ? (
              <input {...common} onChange={(e) => onChange(k, e.target.value)} maxLength={200} className={inputClass(err)} />
            ) : (
              <textarea
                {...common}
                onChange={(e) => onChange(k, e.target.value)}
                rows={3}
                maxLength={3000}
                className={`${inputClass(err)} resize-y leading-normal`}
              />
            )}
            <AiHints field={`${en ? "en" : "fr"}.${k}`} marks={marks} />
            <span className={FIELD_ERR}>{err}</span>
          </label>
        );
      })}
    </>
  );
}

/** Tiroir création / édition d'un produit (maquette 621-671) + version anglaise, prix d'achat et marge. */
export function ProductDrawer({
  product,
  categories,
  maxPhotos,
  detailsReady = true,
  aiReady = false,
  onClose,
  onSaved,
}: {
  product: AdminProduct | null;
  categories: AdminCategory[];
  /** Photos autorisées (1 tant que la migration 0024 n'est pas appliquée). */
  maxPhotos?: number;
  /** Migration 0025 appliquée (rubriques + livraison gratuite enregistrables). */
  detailsReady?: boolean;
  /** IA de l'admin configurée (clé DeepSeek) : active « Rédiger avec l'IA ». */
  aiReady?: boolean;
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
  /** Mentions de l'IA : champs « à vérifier » (lien lu) et avertissements de contrôle par champ. */
  const [marks, setMarks] = useState<AiMarks>(() => ({ fromLink: new Set(), warnings: {} }));
  // Valeurs COURANTES pour l'IA : la rédaction dure jusqu'à 48 s et la saisie continue pendant ce temps (audit Victor W1).
  const vRef = useRef(v);
  useEffect(() => {
    vRef.current = v;
  }, [v]);
  const getCurrent = useCallback((): DraftTarget => vRef.current, []);

  /** Un avertissement de l'IA disparaît dès que l'admin modifie le champ concerné. */
  const clearWarning = (f: DraftField) =>
    setMarks((m) => {
      if (!m.warnings[f]) return m;
      const warnings = { ...m.warnings };
      delete warnings[f];
      return { ...m, warnings };
    });

  const set = <K extends keyof ProductFormValues>(k: K, value: ProductFormValues[K]) => {
    setV((s) => ({ ...s, [k]: value }));
    setErrors((e) => ({ ...e, [k]: "" }));
    setFormError("");
    if (k === "name" || k === "nameEn" || k === "description" || k === "descriptionEn" || k === "keyword") clearWarning(k as DraftField);
  };
  const setDetail = (k: DetailKey, value: string, en = false) => {
    setV((s) => (en ? { ...s, detailsEn: { ...s.detailsEn, [k]: value } } : { ...s, details: { ...s.details, [k]: value } }));
    setErrors((e) => ({ ...e, [detailErrorKey(k, en)]: "", ...(en ? { nameEn: "" } : {}) }));
    setFormError("");
    clearWarning(`${en ? "en" : "fr"}.${k}`);
  };
  const detailError = DETAIL_KEYS.some((k) => errors[detailErrorKey(k)]);
  const detailEnError = DETAIL_KEYS.some((k) => errors[detailErrorKey(k, true)]);
  // Ouverts selon le contenu À L'OUVERTURE, puis au gré de l'admin (et forcés en cas d'erreur) : effacer la dernière
  // rubrique ne replie plus le panneau pendant la saisie (audit Victor V5).
  const [detailsOpen, setDetailsOpen] = useState(() => hasAnyDetail(v.details));
  const [enOpen, setEnOpen] = useState(() => Boolean(v.nameEn || v.descriptionEn || hasAnyDetail(v.detailsEn)));

  const price = parseAmount(v.price);
  const cost = v.cost.trim() === "" ? null : parseAmount(v.cost);
  const margin = price ? marginOf(price, cost) : null;
  const word = v.keyword.trim() || v.name.trim().split(/\s+/)[0]?.toLowerCase() || "";
  const rayon = categories.find((c) => c.id === v.categoryId)?.label ?? "";

  /**
   * Proposition de l'IA → formulaire (rien n'est enregistré). Appliquée sur l'état COURANT (setter fonctionnel) : le prix,
   * le stock, les photos ou un texte saisis pendant la rédaction sont gardés (audit Victor W1). Les panneaux concernés
   * s'ouvrent pour la relecture.
   */
  const applyAi = (draft: ProductDraft, mode: "replace" | "fill-empty"): DraftField[] => {
    const { filled } = applyDraft(vRef.current, draft, mode);
    setV((s) => applyDraft(s, draft, mode).values);
    setMarks({
      fromLink: new Set(draft.fromLink.filter((f) => filled.includes(f))),
      warnings: Object.fromEntries(filled.filter((f) => draft.warnings?.[f]?.length).map((f) => [f, draft.warnings![f]!])),
    });
    setErrors({});
    setFormError("");
    if (filled.some((f) => f.startsWith("fr."))) setDetailsOpen(true);
    if (filled.some((f) => f === "nameEn" || f === "descriptionEn" || f.startsWith("en."))) setEnOpen(true);
    return filled;
  };

  const save = () => {
    const check = validateProductForm(v);
    if (!check.ok) {
      setErrors(check.errors as Record<string, string>);
      return;
    }
    // Produit visible en boutique : aucun « [à confirmer] » ne doit rester (même règle côté serveur).
    const gate = publishGate(check.value);
    if (gate) {
      setErrors(gate.fields);
      setFormError(gate.message);
      return;
    }
    setFormError("");
    start(async () => {
      const res = isNew ? await createProduct(v) : await updateProduct(product.id, v);
      if (res.ok) {
        const newId = "id" in res && typeof res.id === "string" ? res.id : null;
        onSaved(isNew ? "Produit ajouté et visible en boutique." : "Produit enregistré.", isNew ? newId : product.id);
      } else {
        // Conflit de stock : la fiche reste ouverte, le stock et sa référence sont mis à jour sur place ; rubriques et
        // texte de l'IA sont gardés (audit Zoé Z5).
        if (res.code === "conflict" && typeof res.currentStock === "number") {
          const now = String(res.currentStock);
          setV((s) => ({ ...s, stock: now, stockAtOpen: now }));
        }
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
        <PhotosField images={v.images} bg={v.bg} word={word} max={maxPhotos} error={errors.images} onChange={(list) => set("images", list)} />

        <AiWriterPanel ready={aiReady} rayon={rayon} getCurrent={getCurrent} onApply={applyAi} />

        <label className={FIELD_LABEL}>
          Nom du produit
          <input value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={120} className={inputClass(errors.name)} />
          <AiHints field="name" marks={marks} />
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

        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[14px] border border-[#E2DCCF] bg-white px-3.5 py-3">
          <input
            type="checkbox"
            checked={v.freeShipping}
            onChange={(e) => set("freeShipping", e.target.checked)}
            className="mt-0.5 h-5 w-5 flex-none cursor-pointer accent-[#1F6B4A]"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">Livraison gratuite à Cotonou &amp; Calavi</span>
            <span className="text-xs text-[#4A443C]">
              Offerte quand tout le panier est composé d&apos;articles cochés (produits ou packs). Avec un article non coché, le tarif habituel s&apos;applique.
            </span>
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
          <AiHints field="description" marks={marks} />
          <span className={FIELD_ERR}>{errors.description}</span>
        </label>

        <details
          className="rounded-[14px] border border-[#E2DCCF] bg-white px-3.5 py-1"
          open={detailsOpen || detailError}
          onToggle={(e) => setDetailsOpen(e.currentTarget.open)}
        >
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">Détails du produit (facultatif)</summary>
          <div className="flex flex-col gap-3.5 pb-3.5 pt-1">
            <span className="text-xs text-[#4A443C]">
              Une information par ligne. Une rubrique laissée vide n&apos;apparaît pas sur la fiche, ni son titre.
            </span>
            <DetailFields values={v.details} labels={DETAIL_LABELS} errors={errors} marks={marks} onChange={(k, value) => setDetail(k, value)} />
          </div>
        </details>

        {!detailsReady && (
          <span role="status" className="rounded-[12px] bg-[#FBF1D9] px-3.5 py-2.5 text-xs leading-[1.45] text-[#141210]">
            Les détails du produit et la livraison gratuite seront enregistrables après la migration 0025 (éditeur SQL Supabase).
          </span>
        )}

        <details
          className="rounded-[14px] border border-[#E2DCCF] bg-white px-3.5 py-1"
          open={enOpen || detailEnError || Boolean(errors.nameEn) || Boolean(errors.descriptionEn)}
          onToggle={(e) => setEnOpen(e.currentTarget.open)}
        >
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">Version anglaise (facultative)</summary>
          <div className="flex flex-col gap-3.5 pb-3.5 pt-1">
            <label className={FIELD_LABEL}>
              Product name
              <input value={v.nameEn} onChange={(e) => set("nameEn", e.target.value)} maxLength={120} className={inputClass(errors.nameEn)} lang="en" />
              <AiHints field="nameEn" marks={marks} />
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
              <AiHints field="descriptionEn" marks={marks} />
              <span className={FIELD_ERR}>{errors.descriptionEn}</span>
            </label>
            <DetailFields values={v.detailsEn} labels={DETAIL_LABELS_EN} en errors={errors} marks={marks} onChange={(k, value) => setDetail(k, value, true)} />
            <span className="text-xs text-[#4A443C]">
              Sans nom anglais, la boutique affiche la version française. Une rubrique anglaise vide reprend la rubrique française.
            </span>
          </div>
        </details>

        <label className={FIELD_LABEL}>
          Mot affiché sans photo
          <input
            value={v.keyword}
            onChange={(e) => set("keyword", e.target.value)}
            placeholder="Ex. gourde"
            maxLength={40}
            className={inputClass(errors.keyword)}
          />
          <AiHints field="keyword" marks={marks} />
          <span className={errors.keyword ? FIELD_ERR : "text-xs font-normal text-[#4A443C]"}>
            {errors.keyword || "Visible seulement tant que le produit n'a aucune photo."}
          </span>
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
