import { describe, expect, it } from "vitest";
import type { Product } from "@/lib/catalog/types";
import {
  DEFAULT_FILTERS,
  bestSellerIds,
  buildSearchEntry,
  computeSelection,
  cssUrl,
  filterCatalog,
  filtersToQuery,
  fmtRating,
  heroProducts,
  impliedSort,
  inBudget,
  mixOrder,
  newIds,
  parseFilters,
  productTag,
  promoLabel,
  searchSuggestions,
  stockKind,
  storeRating,
} from "@/components/shop/logic";

const base: Product = {
  id: "a",
  slug: "a",
  name: "Lampe LED",
  description: "Rechargeable en USB-C",
  categoryId: "maison",
  price: 5000,
  comparePrice: null,
  stock: 10,
  sold: 10,
  keyword: "lampe",
  bg: null,
  imageUrl: null,
  createdAt: "2026-01-01",
  rating: { average: 4.5, count: 10 },
};
const p = (o: Partial<Product>): Product => ({ ...base, slug: o.id ?? base.slug, ...o });

const catalog: Product[] = [
  p({ id: "lampe", name: "Lampe LED rechargeable", categoryId: "maison", price: 8900, sold: 412, createdAt: "2026-04-12" }),
  p({ id: "boites", name: "Set de boîtes hermétiques", description: "Verre", keyword: "boîtes", categoryId: "cuisine", price: 7500, sold: 274, createdAt: "2026-04-28" }),
  p({ id: "blender", name: "Blender", categoryId: "cuisine", price: 12500, comparePrice: 15000, sold: 38, createdAt: "2026-09-30", rating: { average: 4.9, count: 5 } }),
  p({ id: "cables", name: "Câbles", categoryId: "tech", price: 2500, sold: 156, stock: 0, createdAt: "2026-06-12" }),
  p({ id: "organiseurs", name: "Organiseurs", categoryId: "voyage", price: 7000, sold: 12, createdAt: "2026-10-04" }),
  p({ id: "carnet", name: "Carnet", categoryId: "bureau", price: 3000, sold: 92, createdAt: "2026-07-01" }),
];
const ctx = {
  catLabels: { maison: "Maison", cuisine: "Cuisine", tech: "Tech", voyage: "Voyage", bureau: "Bureau" } as Record<string, string>,
  newIds: [] as string[],
  selectionIds: [] as string[],
};

describe("étiquettes et stock", () => {
  it("priorité épuisé > remise > nouveau > best-seller", () => {
    expect(productTag(p({ stock: 0, comparePrice: 9000 }))).toBe("soldout");
    expect(productTag(p({ comparePrice: 9000 }), { newIds: ["a"], bestIds: ["a"] })).toBe("promo");
    expect(productTag(p({}), { newIds: ["a"], bestIds: ["a"] })).toBe("new");
    expect(productTag(p({}), { bestIds: ["a"] })).toBe("best");
    expect(productTag(p({}))).toBeNull();
  });
  it("un prix barré égal ou inférieur au prix n'est pas une promo", () => {
    expect(productTag(p({ comparePrice: 5000 }))).toBeNull();
    expect(productTag(p({ comparePrice: 4000 }))).toBeNull();
  });
  it("libellé de remise avec espace insécable", () => {
    expect(promoLabel(p({ price: 12500, comparePrice: 15000 }))).toBe("-17 %");
  });
  it("seuils de stock : épuisé, 5 ou moins, au-delà", () => {
    expect(stockKind(0)).toBe("out");
    expect(stockKind(-2)).toBe("out");
    expect(stockKind(1)).toBe("low");
    expect(stockKind(5)).toBe("low");
    expect(stockKind(6)).toBe("ok");
  });
  it("best-sellers : 4 produits en stock les plus vendus, sans muter l'entrée", () => {
    const copy = [...catalog];
    expect(bestSellerIds(catalog)).toEqual(["lampe", "boites", "carnet", "blender"]);
    expect(catalog).toEqual(copy);
  });
  it("nouveautés : 30 jours avant le produit le plus récent", () => {
    expect(newIds(catalog).sort()).toEqual(["blender", "organiseurs"]);
    expect(newIds([])).toEqual([]);
  });
});

describe("notes", () => {
  it("virgule en français, point en anglais", () => {
    expect(fmtRating(4.7, "fr")).toBe("4,7");
    expect(fmtRating(4.7, "en")).toBe("4.7");
  });
  it("note moyenne pondérée de la boutique", () => {
    const r = storeRating([p({ rating: { average: 5, count: 1 } }), p({ rating: { average: 3, count: 3 } })]);
    expect(r.count).toBe(4);
    expect(r.avg).toBeCloseTo(3.5);
    expect(storeRating([])).toEqual({ avg: 0, count: 0 });
  });
});

describe("accueil", () => {
  it("l'aperçu mélangé est stable et complet", () => {
    const a = mixOrder(catalog).map((x) => x.id);
    expect(mixOrder(catalog).map((x) => x.id)).toEqual(a);
    expect([...a].sort()).toEqual(catalog.map((x) => x.id).sort());
  });
  it("héro : promos en stock d'abord, puis meilleures ventes ; 4 maximum, sans épuisé", () => {
    const ids = heroProducts(catalog, bestSellerIds(catalog)).map((x) => x.id);
    expect(ids[0]).toBe("blender");
    expect(ids.length).toBeLessThanOrEqual(4);
    expect(ids).not.toContain("cables");
  });
  it("sélection de départ : produits par défaut en stock", () => {
    const sel = computeSelection([p({ id: "support" }), p({ id: "trousse", stock: 0 }), p({ id: "autre" })], { viewed: [], cartIds: [] });
    expect(sel).toEqual({ ids: ["support"], personal: false });
  });
  it("sélection de repli : meilleures notes en stock si aucun produit par défaut n'existe", () => {
    const sel = computeSelection(catalog, { viewed: [], cartIds: [] });
    expect(sel.personal).toBe(false);
    expect(sel.ids[0]).toBe("blender");
    expect(sel.ids).not.toContain("cables");
  });
  it("sélection personnalisée : rayon du panier d'abord, sans les articles déjà au panier ni les épuisés", () => {
    const sel = computeSelection(catalog, { viewed: [], cartIds: ["boites"] });
    expect(sel.personal).toBe(true);
    expect(sel.ids[0]).toBe("blender");
    expect(sel.ids).not.toContain("boites");
    expect(sel.ids).not.toContain("cables");
  });
});

describe("recherche de l'en-tête", () => {
  const entries = catalog.map((x) => buildSearchEntry(x, ctx.catLabels[x.categoryId]));
  it("ignore accents et casse, tous les mots doivent correspondre", () => {
    expect(searchSuggestions(entries, "BOITES").map((e) => e.slug)).toEqual(["boites"]);
    expect(searchSuggestions(entries, "boites verre").map((e) => e.slug)).toEqual(["boites"]);
    expect(searchSuggestions(entries, "boites tech")).toEqual([]);
  });
  it("trouve par rayon", () => {
    expect(searchSuggestions(entries, "cuisine").map((e) => e.slug)).toEqual(["boites", "blender"]);
  });
  it("moins de 2 caractères : aucune suggestion", () => {
    expect(searchSuggestions(entries, "l")).toEqual([]);
    expect(searchSuggestions(entries, "  ")).toEqual([]);
  });
});

describe("catalogue : URL et filtres", () => {
  const cats = ["maison", "cuisine", "tech"];
  const get = (o: Record<string, string>) => (k: string) => o[k] ?? null;

  it("valeurs par défaut et valeurs invalides ignorées", () => {
    expect(parseFilters(get({}), cats)).toEqual(DEFAULT_FILTERS);
    expect(parseFilters(get({ cat: "inconnu", col: "x", sort: "y", budget: "z" }), cats)).toEqual(DEFAULT_FILTERS);
  });
  it("tri implicite selon la collection", () => {
    expect(impliedSort("nouveautes")).toBe("nouveautes");
    expect(impliedSort("notes")).toBe("notes");
    expect(impliedSort("promos")).toBe("ventes");
    expect(parseFilters(get({ col: "nouveautes" }), cats).sort).toBe("nouveautes");
    expect(parseFilters(get({ col: "nouveautes", sort: "asc" }), cats).sort).toBe("asc");
  });
  it("aller-retour URL : les valeurs par défaut ne sont pas écrites", () => {
    expect(filtersToQuery(DEFAULT_FILTERS)).toBe("");
    const f = { cat: "cuisine", col: "nouveautes" as const, sort: "asc" as const, q: "verre", budget: "3to7" as const };
    const qs = new URLSearchParams(filtersToQuery(f));
    expect(parseFilters((k) => qs.get(k), cats)).toEqual(f);
    expect(filtersToQuery({ ...DEFAULT_FILTERS, col: "notes", sort: "notes" })).toBe("col=notes");
  });
  it("recherche limitée à 100 caractères", () => {
    expect(parseFilters(get({ q: "x".repeat(300) }), cats).q).toHaveLength(100);
  });
  it("tranches de budget : 3 000 et 7 000 inclus dans la tranche du milieu", () => {
    expect(inBudget(2999, "lt3")).toBe(true);
    expect(inBudget(3000, "lt3")).toBe(false);
    expect(inBudget(3000, "3to7")).toBe(true);
    expect(inBudget(7000, "3to7")).toBe(true);
    expect(inBudget(7001, "gt7")).toBe(true);
    expect(inBudget(7000, "gt7")).toBe(false);
    expect(inBudget(1, "all")).toBe(true);
  });
  it("filtre par rayon, budget, recherche et collection", () => {
    const ids = (f: Partial<typeof DEFAULT_FILTERS>) => filterCatalog(catalog, { ...DEFAULT_FILTERS, ...f }, ctx).map((x) => x.id);
    expect(ids({ cat: "cuisine" })).toEqual(["boites", "blender"]);
    expect(ids({ budget: "lt3" })).toEqual(["cables"]);
    expect(ids({ q: "boîtes" })).toEqual(["boites"]);
    expect(ids({ col: "promos" })).toEqual(["blender"]);
    expect(ids({ col: "nouveautes" })).toEqual([]);
    expect(filterCatalog(catalog, { ...DEFAULT_FILTERS, col: "nouveautes" }, { ...ctx, newIds: ["organiseurs"] }).map((x) => x.id)).toEqual(["organiseurs"]);
    expect(filterCatalog(catalog, { ...DEFAULT_FILTERS, col: "selection" }, { ...ctx, selectionIds: ["carnet", "lampe"] }).map((x) => x.id)).toEqual(["lampe", "carnet"]);
  });
  it("tris : ventes, notes, nouveautés, prix", () => {
    const ids = (sort: typeof DEFAULT_FILTERS.sort) => filterCatalog(catalog, { ...DEFAULT_FILTERS, sort }, ctx).map((x) => x.id);
    expect(ids("ventes")[0]).toBe("lampe");
    expect(ids("notes")[0]).toBe("blender");
    expect(ids("nouveautes")[0]).toBe("organiseurs");
    expect(ids("asc")[0]).toBe("cables");
    expect(ids("desc")[0]).toBe("blender");
  });
  it("ne modifie pas la liste d'entrée", () => {
    const copy = catalog.map((x) => x.id);
    filterCatalog(catalog, { ...DEFAULT_FILTERS, sort: "asc" }, ctx);
    expect(catalog.map((x) => x.id)).toEqual(copy);
  });
});

describe("cssUrl", () => {
  it("encode les caractères qui permettraient de sortir de url(\"…\")", () => {
    const u = cssUrl("https://x.test/a\").evil{(\\\n'");
    expect(u.startsWith('url("')).toBe(true);
    expect(u.endsWith('")')).toBe(true);
    expect(u.slice(5, -2)).not.toMatch(/["()\\\n']/);
  });
});
