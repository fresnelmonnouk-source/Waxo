// Rédacteur IA des fiches : contrôles APRÈS génération (contacts retirés, « à vérifier » décidé par le serveur, phrase
// recopiée, marque du site lu), masquage dédié des notes, et déroulé côté tiroir (saisie pendant la rédaction : W1).
import { describe, expect, it } from "vitest";
import { EMPTY_DETAILS } from "@/lib/catalog/details";
import { applyDraft, type DraftField, type DraftTarget, type ProductDraft } from "@/lib/admin/ai/product-draft";
import { BRAND_WARNING, CONTACT_WARNING, NEAR_COPY_WARNING, finalizeDraft, hasContact, sharesWordRun } from "@/lib/admin/ai/product-writer-output";
import { MASK, scrubText, scrubWriterText } from "@/lib/admin/ai/scrub";
import { CONNECTION_LOST, runWriter, type WriterResponse } from "@/components/admin/products/ai-writer-run";

const draft = (over: Partial<ProductDraft> = {}): ProductDraft => ({
  name: "Gourde isotherme inox 750 ml",
  nameEn: "",
  description: "Une gourde pour garder votre eau fraîche toute la journée.",
  descriptionEn: "",
  keyword: "gourde",
  details: { ...EMPTY_DETAILS, specs: "Contenance : 750 ml" },
  detailsEn: { ...EMPTY_DETAILS },
  fromLink: [],
  ...over,
});
const ctx = (over: Partial<Parameters<typeof finalizeDraft>[1]> = {}) => ({ withLink: true, pageText: "", brands: [] as string[], notes: "", ...over });

describe("contacts dans la sortie", () => {
  it.each([
    "https://x.com/a",
    "www.boutique.bj",
    "voir sav-xyz.bj",
    "wa.me/22997123456",
    "contact@boutique.bj",
    "Suivez @ma_boutique",
    "+229 01 97 12 34 56",
    "22997123456",
    "01 97 12 34 56",
    "0197123456",
    "+33 6 12 34 56 78",
    "+1 (555) 123-4567",
    "0033612345678",
  ])("détecte %s", (s) => {
    expect(hasContact(s)).toBe(true);
  });
  it.each([
    "Pointures : 36 37 38 39 40 41",
    "Compatible iPhone 12 13 14 15",
    "USB 2.0 3.0 3.1 3.2",
    "Tailles : 38-40-42-44",
    "Dimensions : 7,5 x 26 cm",
    "Contenance : 0.75 l, 750 ml",
    "Puissance : 1200 W, 220-240 V",
    "Lot de 3. Ne passe pas au micro-ondes.",
    "Acier inoxydable 18/10",
    "Référence 2024-0153",
  ])("ne touche pas à %s", (s) => {
    expect(hasContact(s)).toBe(false);
  });
  it("nettoie chaque champ et le signale", () => {
    const d = finalizeDraft(
      draft({ nameEn: "Bottle - www.shop.com", details: { ...EMPTY_DETAILS, specs: "Contenance : 750 ml\nSAV : +229 01 97 12 34 56", color: "Noir, voir x.bj" } }),
      ctx({ withLink: false }),
    );
    expect(d.nameEn).toBe("Bottle");
    expect(d.details.specs).toBe("Contenance : 750 ml");
    expect(d.details.color).toBe("Noir, voir");
    expect(d.warnings?.nameEn).toEqual([CONTACT_WARNING]);
    expect(d.warnings?.["fr.specs"]).toEqual([CONTACT_WARNING]);
  });
});

describe("« à vérifier » décidé par le serveur", () => {
  it("avec un lien : tous les champs remplis, quelle que soit la liste du modèle", () => {
    const d = finalizeDraft(draft({ fromLink: [] }), ctx());
    expect(d.fromLink).toEqual(["name", "description", "keyword", "fr.specs"] satisfies DraftField[]);
  });
  it("sans lien : aucun", () => {
    expect(finalizeDraft(draft({ fromLink: ["name"] }), ctx({ withLink: false })).fromLink).toEqual([]);
  });
});

describe("phrase recopiée (Helena J1)", () => {
  const page = "Texte de la page :\nCette gourde en acier inoxydable garde vos boissons fraîches pendant 24 heures, même en plein soleil !";
  it("8 mots consécutifs partagés (casse, accents et ponctuation ignorés) → avertissement", () => {
    expect(sharesWordRun("Cette GOURDE en acier inoxydable, garde vos boissons fraiches pendant longtemps.", page)).toBe(true);
    const d = finalizeDraft(draft({ description: "Pratique. Cette gourde en acier inoxydable garde vos boissons fraîches pendant la journée." }), ctx({ pageText: page }));
    expect(d.warnings?.description).toEqual([NEAR_COPY_WARNING]);
  });
  it("7 mots seulement, ou reformulation → rien", () => {
    expect(sharesWordRun("Cette gourde en acier inoxydable garde vos clés.", page)).toBe(false);
    const d = finalizeDraft(draft({ description: "Une gourde en inox qui tient vos boissons au frais toute la journée." }), ctx({ pageText: page }));
    expect(d.warnings).toBeUndefined();
  });
  it("description anglaise contrôlée aussi", () => {
    const en = "This insulated bottle keeps your drinks cold for twenty four hours in the sun.";
    const d = finalizeDraft(draft({ descriptionEn: "Great: this insulated bottle keeps your drinks cold for twenty four hours." }), ctx({ pageText: en }));
    expect(d.warnings?.descriptionEn).toEqual([NEAR_COPY_WARNING]);
  });
});

describe("marque du site lu (Helena J2)", () => {
  it("nom ou description qui reprend la marque du JSON-LD, absente des notes → avertissement", () => {
    const d = finalizeDraft(draft({ name: "Gourde Thermos 750 ml", description: "Une gourde signée thermos." }), ctx({ brands: ["Thermos"] }));
    expect(d.warnings?.name).toEqual([BRAND_WARNING]);
    expect(d.warnings?.description).toEqual([BRAND_WARNING]);
  });
  it("marque écrite dans les notes (c'est bien la sienne), mot partiel ou marque générique → rien", () => {
    expect(finalizeDraft(draft({ name: "Gourde Thermos" }), ctx({ brands: ["Thermos"], notes: "Vraie gourde THERMOS" })).warnings).toBeUndefined();
    expect(finalizeDraft(draft({ name: "Gourde thermostatique" }), ctx({ brands: ["Thermos"] })).warnings).toBeUndefined();
    expect(finalizeDraft(draft({ name: "Gourde generic" }), ctx({ brands: ["Generic"] })).warnings).toBeUndefined();
  });
});

describe("masquage des notes pour le rédacteur (Zoé Z3)", () => {
  it.each(["Compatible avec iPhone 12 13 14 15", "Pointures : 36 37 38 39 40 41", "Tailles : 38-40-42-44", "USB 2.0 3.0 3.1 3.2", "Référence 12345678"])(
    "garde %s",
    (s) => {
      expect(scrubWriterText(s)).toBe(s);
    },
  );
  it.each([
    ["Fournisseur : +229 01 97 12 34 56", `Fournisseur : ${MASK.number}`],
    ["Appeler le 0197123456", `Appeler le ${MASK.number}`],
    ["Tel 01 97 12 34 56", `Tel ${MASK.number}`],
    ["Ancien : 229 97 12 34 56", `Ancien : ${MASK.number}`],
    ["Paris +33 6 12 34 56 78", `Paris ${MASK.number}`],
    ["Écrire à fournisseur@exemple.bj", `Écrire à ${MASK.email}`],
    ["clé sk-abcdefghijklmnopqrstu", `clé ${MASK.secret}`],
  ])("masque %s", (s, out) => {
    expect(scrubWriterText(s)).toBe(out);
  });
  it("scrubText (corpus de l'IA admin) garde son comportement strict", () => {
    expect(scrubText("Pointures : 36 37 38 39 40 41")).toBe(`Pointures : ${MASK.number}`);
  });
});

describe("saisie pendant la rédaction (audit Victor W1)", () => {
  type Form = DraftTarget & { price: string; stock: string; images: string[] };
  const empty: Form = { name: "", nameEn: "", description: "", descriptionEn: "", keyword: "", details: { ...EMPTY_DETAILS }, detailsEn: { ...EMPTY_DETAILS }, price: "", stock: "", images: [] };
  const proposal = draft({ name: "Gourde inox", description: "Une gourde.", fromLink: ["name"] });

  /** Tiroir simulé : `apply` passe par un setter fonctionnel sur l'état COURANT, comme ProductDrawer. */
  function drawer() {
    let state: Form = { ...empty };
    const setV = (fn: (s: Form) => Form) => {
      state = fn(state);
    };
    return {
      get: () => state,
      type: (patch: Partial<Form>) => setV((s) => ({ ...s, ...patch })),
      getCurrent: () => state,
      apply: (d: ProductDraft, mode: "replace" | "fill-empty") => {
        const { filled } = applyDraft(state, d, mode);
        setV((s) => applyDraft(s, d, mode).values);
        return filled;
      },
    };
  }
  const deferred = () => {
    let resolve!: (r: WriterResponse) => void;
    const promise = new Promise<WriterResponse>((r) => (resolve = r));
    return { promise, resolve };
  };

  it("prix, stock et photo saisis pendant la rédaction : gardés", async () => {
    const t = drawer();
    const req = deferred();
    const run = runWriter(() => req.promise, t.getCurrent, t.apply);
    t.type({ price: "4500", stock: "12", images: ["https://x.supabase.co/storage/v1/object/public/products/a.webp"] });
    req.resolve({ ok: true, draft: proposal });
    expect(await run).toMatchObject({ kind: "done", filled: 4 });
    expect(t.get()).toMatchObject({ price: "4500", stock: "12", name: "Gourde inox", description: "Une gourde." });
    expect(t.get().images).toHaveLength(1);
  });
  it("texte saisi pendant la rédaction : vu comme un conflit (confirmation), pas écrasé", async () => {
    const t = drawer();
    const req = deferred();
    const run = runWriter(() => req.promise, t.getCurrent, t.apply);
    t.type({ name: "Ma gourde à moi" });
    req.resolve({ ok: true, draft: proposal });
    const status = await run;
    expect(status).toMatchObject({ kind: "confirm", conflicts: ["name"] });
    expect(t.get().name).toBe("Ma gourde à moi");
    // « Remplir seulement les champs vides » : appliqué sur l'état du moment, le nom saisi reste.
    if (status.kind === "confirm") t.apply(status.draft, "fill-empty");
    expect(t.get()).toMatchObject({ name: "Ma gourde à moi", description: "Une gourde." });
  });
  it("erreur réseau ou refus : message, formulaire intact", async () => {
    const t = drawer();
    expect(await runWriter(() => Promise.reject(new Error("x")), t.getCurrent, t.apply)).toEqual({ kind: "error", message: CONNECTION_LOST });
    expect(await runWriter(async () => ({ ok: false, message: "Limite atteinte" }), t.getCurrent, t.apply)).toEqual({ kind: "error", message: "Limite atteinte" });
    expect(t.get()).toEqual(empty);
  });
});
