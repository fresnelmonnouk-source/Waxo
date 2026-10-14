// Garde-fou « texte provisoire » : un produit ACTIF ne s'enregistre pas tant qu'un segment entre crochets ou une parenthèse
// « à confirmer / à vérifier / TBD… » reste dans ses textes publics (client ET serveur, y compris la remise en ligne depuis
// la liste) ; un produit masqué (brouillon) s'enregistre. Variantes de Zoé Z3-Z4 / Raphaël 🟡3. Slug sans marqueur (W2).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_DETAILS } from "@/lib/catalog/details";
import { findMarker, hasTbcMarker, publishGate, publishGateFromRows, stripMarkers, tbcFields, tbcPublishMessage } from "@/lib/admin/ai/product-writer-gate";
import { slugify, validateProductForm } from "@/components/admin/products/logic";
import type { ProductFormValues } from "@/components/admin/products/types";

const state = vi.hoisted(() => ({ writes: [] as { table: string; values: Record<string, unknown> }[], current: null as unknown }));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/admin/guard", () => ({ assertAdmin: async () => ({ id: "a", email: "a@b.c" }) }));
vi.mock("@/lib/admin/data/products", () => {
  const table = (name: string) => {
    let pending: Record<string, unknown> | null = null;
    let columns = "";
    const b: Record<string, unknown> = {};
    const result = () => {
      if (pending) {
        state.writes.push({ table: name, values: pending });
        return { data: name === "products" ? [{ id: "x" }] : { id: "11111111-1111-4111-8111-111111111111" }, error: null };
      }
      if (name === "products" && columns.includes("product_translations(*)")) return { data: state.current, error: null };
      if (name === "products") return { data: { id: "x", image_url: null, images: [], product_translations: [{ locale: "fr" }] }, error: null };
      return { data: null, error: null };
    };
    for (const m of ["eq", "single", "maybeSingle", "like", "limit", "upsert", "delete"]) b[m] = () => b;
    b.select = (c: string) => {
      columns = c;
      return b;
    };
    b.insert = (v: Record<string, unknown>) => {
      pending = v;
      return b;
    };
    b.update = (v: Record<string, unknown>) => {
      pending = v;
      return b;
    };
    b.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(result()).then(ok, ko);
    return b;
  };
  return { adminDb: () => ({ from: table }), takenSlugs: async () => new Set<string>() };
});

import { createProduct, setProductActive, updateProduct } from "@/app/admin/(panel)/produits/actions";

const ID = "5b4e688a-1bb0-4e16-aeb8-a933014cd3ac";
const form = (over: Partial<ProductFormValues> = {}): ProductFormValues => ({
  name: "Gourde isotherme",
  nameEn: "",
  categoryId: "cuisine",
  price: "5000",
  comparePrice: "",
  stock: "5",
  cost: "",
  description: "Garde au frais toute la journée.",
  descriptionEn: "",
  keyword: "",
  bg: "#F3E3A6",
  active: true,
  images: [],
  details: { ...EMPTY_DETAILS },
  detailsEn: { ...EMPTY_DETAILS },
  freeShipping: false,
  ...over,
});

beforeEach(() => {
  state.writes.length = 0;
  state.current = null;
});

const NFD_A = "à"; // « à » décomposé
const NBSP = " ";

describe("détection du texte provisoire", () => {
  it.each([
    "[à confirmer]",
    "[ À CONFIRMER ]",
    "Contenance : [a confirmer]",
    "Capacity: [to be confirmed]",
    "[to confirm]",
    "[TBC]",
    // Variantes qui passaient avant (Zoé Z4, Raphaël 🟡3)
    "Capacity [TBD]",
    "[to be determined]",
    "[to be checked]",
    "[pending confirmation]",
    "[taille à confirmer]",
    "[à confirmer : couleur]",
    "[à confirmer.]",
    "[à vérifier]",
    "[à préciser]",
    "[to be specified]",
    "Autonomie : [à confirmer : 6 ou 8 h]",
    "(à confirmer)",
    "Hauteur : 26 cm (à vérifier)",
    "Poids (à préciser)",
    "Weight (to be confirmed)",
    "Weight (to be determined)",
    "Battery (TBD)",
    "Battery (tbc)",
    "（à confirmer）",
    "［à confirmer］",
    `[${NFD_A} confirmer]`,
    `(taille ${NFD_A} confirmer)`,
    `(à${NBSP}confirmer)`,
    // Masquage recopié par le modèle (Zoé Z3) et marqueur coupé par une limite de longueur
    "Compatible iPhone [numéro masqué]",
    "Noir, blanc, [à",
  ])("détecte %s", (s) => {
    expect(hasTbcMarker(s)).toBe(true);
  });
  it.each(["à confirmer", "Contenance : 750 ml", "", "Poids (350 g)", "Lampe (modèle solaire)", "Usage (cuisine, bureau)", "Pointures : 36 37 38 39 40 41"])(
    "ignore %s",
    (s) => {
      expect(hasTbcMarker(s)).toBe(false);
    },
  );
  it("renvoie le segment trouvé (pour le message)", () => {
    expect(findMarker("Gourde [taille à confirmer] noire")).toBe("[taille à confirmer]");
    expect(findMarker("Poids (à préciser) environ")).toBe("(à préciser)");
    expect(findMarker("Noir, [à")).toBe("[à");
  });
  it("liste tous les champs concernés, rubriques FR et EN comprises", () => {
    const v = form({
      name: "Lampe [à confirmer]",
      nameEn: "Lamp",
      descriptionEn: "[to be confirmed]",
      details: { ...EMPTY_DETAILS, specs: "Autonomie : [à confirmer]" },
      detailsEn: { ...EMPTY_DETAILS, color: "[TBD]" },
    });
    expect(tbcFields(v)).toEqual(["name", "descriptionEn", "en_color", "d_specs"]);
  });
  it("sans nom anglais, la version anglaise n'est pas enregistrée : ses champs ne bloquent pas", () => {
    expect(tbcFields(form({ nameEn: "", descriptionEn: "Capacity [TBD]", detailsEn: { ...EMPTY_DETAILS, color: "[TBD]" } }))).toEqual([]);
  });
});

describe("gate côté client (même module)", () => {
  it("actif + marqueur → refusé avec un message qui nomme le champ, et une erreur sous le champ", () => {
    const check = validateProductForm(form({ details: { ...EMPTY_DETAILS, specs: "Poids : [à confirmer]" } }));
    expect(check.ok).toBe(true);
    const gate = check.ok ? publishGate(check.value) : null;
    expect(gate?.message).toBe(tbcPublishMessage(["d_specs"]));
    expect(gate?.message).toContain("Caractéristiques techniques");
    expect(gate?.message).toMatch(/masquez le produit/);
    expect(gate?.fields.d_specs).toBe("Contient « [à confirmer] » : remplacez-le par la bonne information.");
  });
  it("message à plusieurs champs : libellés FR et anglais", () => {
    expect(tbcPublishMessage(["name", "en_color"])).toContain("ces champs : Nom, Couleur (anglais).");
  });
  it("masqué (brouillon) + marqueur → permis ; actif sans marqueur → permis", () => {
    const draft = validateProductForm(form({ active: false, description: "Une lampe [à confirmer] pour la maison." }));
    expect(draft.ok && publishGate(draft.value)).toBeNull();
    const clean = validateProductForm(form());
    expect(clean.ok && publishGate(clean.value)).toBeNull();
  });
});

describe("gate côté serveur", () => {
  it("createProduct actif avec marqueur : refusé, rien d'écrit", async () => {
    const r = await createProduct(form({ description: "Une gourde [à confirmer] pour tous les jours." }));
    expect(r).toMatchObject({ ok: false, code: "invalid", message: tbcPublishMessage(["description"]) });
    if (!r.ok) expect(r.fields).toHaveProperty("description");
    expect(state.writes).toEqual([]);
  });
  it("updateProduct actif avec marqueur (version anglaise) : refusé, rien d'écrit", async () => {
    const r = await updateProduct(ID, form({ nameEn: "Bottle", descriptionEn: "Capacity [to be confirmed].", stockAtOpen: "5" }));
    expect(r).toMatchObject({ ok: false, code: "invalid" });
    expect(state.writes).toEqual([]);
  });
  it("updateProduct actif avec « [TBD] » ou « (à vérifier) » : refusé (variantes Zoé Z4)", async () => {
    for (const over of [{ nameEn: "Bottle", descriptionEn: "Capacity [TBD]." }, { description: "Hauteur : 26 cm (à vérifier)." }]) {
      expect(await updateProduct(ID, form({ ...over, stockAtOpen: "5" }))).toMatchObject({ ok: false, code: "invalid" });
    }
    expect(state.writes).toEqual([]);
  });
  it("brouillon (masqué) avec marqueur : enregistré", async () => {
    const r = await createProduct(form({ active: false, name: "Lampe [à confirmer]" }));
    expect(r.ok).toBe(true);
    expect(state.writes.some((w) => w.table === "products" && w.values.active === false)).toBe(true);
  });
  it("remise en ligne depuis la liste : refusée tant qu'un texte enregistré contient le marqueur (message qui nomme le champ)", async () => {
    state.current = { keyword: "lampe", product_translations: [{ locale: "fr", name: "Lampe", description: "Une lampe.", specs: "Autonomie : [à confirmer]" }] };
    expect(await setProductActive(ID, true)).toMatchObject({ ok: false, code: "invalid", message: tbcPublishMessage(["d_specs"]) });
    state.current = {
      keyword: "lampe",
      product_translations: [
        { locale: "fr", name: "Lampe", description: "Une lampe." },
        { locale: "en", name: "Lamp", description: "Battery (TBD)" },
      ],
    };
    expect(await setProductActive(ID, true)).toMatchObject({ ok: false, code: "invalid", message: tbcPublishMessage(["descriptionEn"]) });
    expect(state.writes).toEqual([]);
  });
  it("remise en ligne d'un produit propre : permise ; masquer : toujours permis", async () => {
    state.current = { keyword: "lampe", product_translations: [{ locale: "fr", name: "Lampe", description: "Une lampe solaire." }] };
    expect((await setProductActive(ID, true)).ok).toBe(true);
    state.current = { keyword: "lampe", product_translations: [{ locale: "fr", name: "Lampe [à confirmer]", description: "x" }] };
    expect((await setProductActive(ID, false)).ok).toBe(true);
  });
  it("publishGateFromRows tolère une base sans rubriques (0025 absente)", () => {
    expect(publishGateFromRows("lampe", [{ locale: "fr", name: "Lampe", description: "Une lampe." }])).toBeNull();
    expect(publishGateFromRows(null, null)).toBeNull();
  });
});

describe("slug sans marqueur (audit Victor W2)", () => {
  it.each([
    ["Gourde isotherme [à confirmer]", "gourde-isotherme"],
    ["Gourde [taille à confirmer] 750 ml", "gourde-750-ml"],
    ["Lampe solaire (à vérifier)", "lampe-solaire"],
    ["Bottle [to be confirmed]", "bottle"],
    ["Bottle (TBD)", "bottle"],
    [`Gourde ${NFD_A} confirmer`, "gourde"],
    ["［à confirmer］ Gourde", "gourde"],
    ["[à confirmer]", "produit"],
  ])("%s → %s", (name, slug) => {
    const s = slugify(stripMarkers(name));
    expect(s).toBe(slug);
    expect(s).not.toMatch(/confirm|verifier|preciser|tbd|tbc/);
  });
  it("brouillon créé avec un nom marqué : les slugs enregistrés (FR et EN) n'ont pas le marqueur, le nom est gardé", async () => {
    const r = await createProduct(form({ active: false, name: "Gourde isotherme [à confirmer]", nameEn: "Insulated bottle [to be confirmed]" }));
    expect(r.ok).toBe(true);
    const tr = state.writes.filter((w) => w.table === "product_translations");
    expect(tr.map((w) => w.values.slug)).toEqual(["gourde-isotherme", "insulated-bottle"]);
    expect(tr[0].values.name).toBe("Gourde isotherme [à confirmer]");
  });
});
