// QA (Nadia) — panier et favoris (localStorage) : fusion, bornes, données corrompues, stockage bloqué.
// Aucun navigateur : `localStorage` est un faux en mémoire ; les modules ont un cache global → vi.resetModules() à chaque test.
import { beforeEach, describe, expect, it, vi } from "vitest";

class FakeStorage {
  data = new Map<string, string>();
  throwOnSet = false;
  sets: string[] = [];
  getItem(k: string) {
    return this.data.has(k) ? (this.data.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    if (this.throwOnSet) throw new Error("QuotaExceededError");
    this.sets.push(v);
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

let ls: FakeStorage;
beforeEach(() => {
  vi.resetModules();
  ls = new FakeStorage();
  vi.stubGlobal("localStorage", ls);
});

const line = (id: string, over: Record<string, unknown> = {}) => ({
  kind: "product" as const,
  id,
  slug: `slug-${id}`,
  name: `Produit ${id}`,
  price: 1000,
  bg: null,
  imageUrl: null,
  ...over,
});
const CART = "waxo:cart:v1";
const stored = () => JSON.parse(ls.data.get(CART) ?? "[]") as { kind: string; id: string; qty: number; price: number }[];
const loadCart = async () => (await import("@/lib/cart/store")).cart;

describe("panier : ajout et fusion", () => {
  it("ajoute une ligne neuve avec qty 1 par défaut", async () => {
    const cart = await loadCart();
    cart.add(line("a"));
    expect(stored()).toMatchObject([{ id: "a", qty: 1 }]);
  });
  it("même produit ajouté deux fois = une seule ligne, quantités additionnées", async () => {
    const cart = await loadCart();
    cart.add(line("a"), 2);
    cart.add(line("a"), 3);
    expect(stored()).toHaveLength(1);
    expect(stored()[0].qty).toBe(5);
  });
  it("un produit et un pack de même id restent deux lignes distinctes", async () => {
    const cart = await loadCart();
    cart.add(line("x"));
    cart.add(line("x", { kind: "pack" }));
    expect(stored().map((l) => l.kind)).toEqual(["product", "pack"]);
  });
  it("plafond de 99, à l'ajout comme au cumul", async () => {
    const cart = await loadCart();
    cart.add(line("a"), 500);
    expect(stored()[0].qty).toBe(99);
    cart.add(line("a"), 5);
    expect(stored()[0].qty).toBe(99);
  });
  it("ajouter qty 0 ou négatif à une ligne neuve donne 1, jamais 0", async () => {
    const cart = await loadCart();
    cart.add(line("a"), 0);
    cart.add(line("b"), -3);
    expect(stored().map((l) => l.qty)).toEqual([1, 1]);
  });
  it("le ré-ajout met à jour l'instantané d'affichage (prix changé) sans perdre la quantité", async () => {
    const cart = await loadCart();
    cart.add(line("a", { price: 1000 }), 2);
    cart.add(line("a", { price: 1200 }), 1);
    expect(stored()[0]).toMatchObject({ qty: 3, price: 1200 });
  });
  // BUG QA-7 (faible) : un `qty` négatif sur une ligne EXISTANTE n'est pas borné (1 + (-5) = -4 stocké puis filtré au rechargement :
  // la ligne disparaît en silence). Aucun appelant actuel ne passe de négatif ; à garder en tête si une API « retirer 1 » apparaît.
  it.fails("QA-7 : ajouter une quantité négative à une ligne existante ne produit jamais une quantité < 1", async () => {
    const cart = await loadCart();
    cart.add(line("a"), 1);
    cart.add(line("a"), -5);
    expect(stored()[0].qty).toBeGreaterThanOrEqual(1);
  });
});

describe("panier : modification et suppression", () => {
  it("setQty 0 ou négatif retire la ligne ; au-delà de 99 plafonne", async () => {
    const cart = await loadCart();
    cart.add(line("a"), 3);
    cart.setQty("product", "a", 500);
    expect(stored()[0].qty).toBe(99);
    cart.setQty("product", "a", 0);
    expect(stored()).toEqual([]);
    cart.add(line("b"), 2);
    cart.setQty("product", "b", -1);
    expect(stored()).toEqual([]);
  });
  it("setQty / remove sur une ligne inconnue ne changent rien", async () => {
    const cart = await loadCart();
    cart.add(line("a"), 2);
    cart.setQty("product", "zzz", 7);
    cart.setQty("pack", "a", 7); // même id mais autre kind
    cart.remove("product", "zzz");
    expect(stored()).toMatchObject([{ id: "a", qty: 2 }]);
  });
  it("clear vide le panier et persiste le vide", async () => {
    const cart = await loadCart();
    cart.add(line("a"));
    cart.clear();
    expect(stored()).toEqual([]);
  });
});

describe("panier : stockage corrompu ou bloqué", () => {
  it("JSON illisible → panier vide, l'ajout suivant repart proprement", async () => {
    ls.data.set(CART, "{pas du json");
    const cart = await loadCart();
    cart.add(line("a"));
    expect(stored()).toMatchObject([{ id: "a", qty: 1 }]);
  });
  it("contenu non-tableau (objet, nombre, chaîne) → vide", async () => {
    for (const raw of ['{"a":1}', "42", '"x"', "null"]) {
      vi.resetModules();
      ls.data.set(CART, raw);
      const cart = await loadCart();
      cart.add(line("n"));
      expect(stored().map((l) => l.id), raw).toEqual(["n"]);
    }
  });
  it("lignes invalides filtrées au chargement : sans id, qty 0, négative, décimale, texte, null", async () => {
    ls.data.set(
      CART,
      JSON.stringify([
        { ...line("ok"), qty: 2 },
        { ...line("zero"), qty: 0 },
        { ...line("neg"), qty: -1 },
        { ...line("dec"), qty: 1.5 },
        { ...line("txt"), qty: "3" },
        { kind: "product", qty: 1 },
        null,
        "oops",
      ]),
    );
    const cart = await loadCart();
    cart.add(line("new")); // déclenche un write() qui persiste l'état filtré
    expect(stored().map((l) => l.id)).toEqual(["ok", "new"]);
  });
  it("localStorage indisponible (navigation privée / quota) : l'état reste en mémoire, rien ne jette", async () => {
    ls.throwOnSet = true;
    const cart = await loadCart();
    expect(() => cart.add(line("a"), 2)).not.toThrow();
    ls.throwOnSet = false;
    cart.add(line("b"));
    // le deuxième écrit contient AUSSI la première ligne : la mémoire a survécu à l'échec d'écriture
    expect(stored().map((l) => l.id)).toEqual(["a", "b"]);
  });
  it("aucun localStorage du tout (SSR, navigateur verrouillé) : aucune exception", async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("localStorage", undefined);
    const cart = await loadCart();
    expect(() => {
      cart.add(line("a"));
      cart.setQty("product", "a", 3);
      cart.remove("product", "a");
      cart.clear();
    }).not.toThrow();
  });
  // BUG QA-8 (moyen, latent) : le panier garde les identifiants vus en MODE DÉMO (« lampe », « air »…, non-UUID). Une fois
  // Supabase branché, ces lignes restent dans le localStorage des testeurs et POST /api/checkout répond 422 cart_invalid
  // à chaque tentative, sans que l'écran dise quel article retirer. Fix : filtrer à la lecture (ou à l'ouverture de /commande)
  // les lignes dont l'id n'est pas un UUID.
  it.fails("QA-8 : une ligne dont l'id n'est pas un UUID est écartée au chargement", async () => {
    ls.data.set(CART, JSON.stringify([{ ...line("lampe"), qty: 1 }]));
    const cart = await loadCart();
    cart.add(line("3f2b8c1e-5a47-4d9a-9b1e-7c2d4e6f8a10"));
    expect(stored().map((l) => l.id)).toEqual(["3f2b8c1e-5a47-4d9a-9b1e-7c2d4e6f8a10"]);
  });
});

describe("favoris", () => {
  const FAV = "waxo:favorites:v1";
  const favs = async () => (await import("@/lib/favorites/store")).favorites;
  const storedFav = () => JSON.parse(ls.data.get(FAV) ?? "[]") as string[];

  it("toggle ajoute puis retire ; deux produits indépendants", async () => {
    const f = await favs();
    f.toggle("a");
    f.toggle("b");
    expect(storedFav()).toEqual(["a", "b"]);
    f.toggle("a");
    expect(storedFav()).toEqual(["b"]);
  });
  it("double-tap rapide = retour à l'état initial (pas de doublon)", async () => {
    const f = await favs();
    f.toggle("a");
    f.toggle("a");
    expect(storedFav()).toEqual([]);
  });
  it("contenu corrompu ou non-chaînes filtrés", async () => {
    ls.data.set(FAV, JSON.stringify(["ok", 3, null, { a: 1 }, "ok2"]));
    const f = await favs();
    f.toggle("new");
    expect(storedFav()).toEqual(["ok", "ok2", "new"]);
  });
  it("JSON illisible → vide ; stockage bloqué → pas d'exception", async () => {
    ls.data.set(FAV, "[oops");
    ls.throwOnSet = true;
    const f = await favs();
    expect(() => f.toggle("a")).not.toThrow();
  });
  it("clear vide la liste", async () => {
    const f = await favs();
    f.toggle("a");
    f.clear();
    expect(storedFav()).toEqual([]);
  });
});
