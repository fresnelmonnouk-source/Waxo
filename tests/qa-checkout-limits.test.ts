// QA (Nadia) — limites et chemins négatifs de la logique PURE de commande : franco, quantités, téléphones, schéma, anti-robot.
// Les tests `it.fails` documentent un BUG CONFIRMÉ : ils passent tant que le bug existe et ÉCHOUERONT quand il sera corrigé
// (retirer alors le `.fails`, c'est le test de non-régression). Référence : docs/reviews/nadia-qa-J1.md.
import { describe, expect, it } from "vitest";
import { checkBot } from "@/lib/auth/bot-guard";
import { isValidPhone as authValidPhone, normPhone as authNormPhone } from "@/lib/auth/validation";
import { API_STATUS, apiMessage, mapPlaceOrderError, type ApiErrorCode } from "@/lib/checkout/errors";
import { normPhone, prettyPhone, validEmail, validPhone } from "@/lib/checkout/phone";
import { clientIp, rateLimit, resetRateLimit } from "@/lib/checkout/rate-limit";
import { checkoutSchema, looksLikeBot, MIN_FORM_DELAY_MS, reviewSchema } from "@/lib/checkout/schema";
import {
  clampQty,
  DEFAULT_SHIPPING,
  enabledPayMethods,
  freeShippingPercent,
  freeShippingRemaining,
  shippingFee,
  type ShippingConfig,
  type Zone,
} from "@/lib/checkout/shipping";
import { normPhone as nlNormPhone, validPhone as nlValidPhone } from "@/components/shop/newsletter-schema";

const UUID = "3f2b8c1e-5a47-4d9a-9b1e-7c2d4e6f8a10";
const base = () => ({
  items: [{ kind: "product", id: UUID, qty: 1 }],
  customer: { name: "Afi Houngbédji", phone: "0197000000", address: "Fidjrossè, portail bleu" },
  zone: "cotonou",
  pay: "cod",
  t: 1,
});

// Règle SQL de place_order, recopiée telle quelle (supabase/migrations/0001_core.sql) : le JS d'affichage doit lui être identique.
function sqlFee(sub: number, zone: Zone, cfg: ShippingConfig): number {
  const free = cfg.freeFrom ?? 0;
  if (zone === "cotonou" && free > 0 && sub >= free) return 0;
  if (zone === "cotonou") return cfg.cotonou ?? 0;
  return cfg.autre ?? 0;
}

describe("franco : parité exacte avec place_order (SQL)", () => {
  const configs: ShippingConfig[] = [
    DEFAULT_SHIPPING,
    { ...DEFAULT_SHIPPING, freeFrom: 0 }, // franco désactivé
    { ...DEFAULT_SHIPPING, freeFrom: -1 },
    { ...DEFAULT_SHIPPING, cotonou: 0, autre: 0 },
    { cotonou: 500, autre: 3000, freeFrom: 1, cutoff: 12, returnDays: 3 },
  ];
  const subtotals = [0, 1, 999, 1000, 14_999, 15_000, 15_001, 99_999, 10_000_000];
  it("même frais que le SQL pour chaque combinaison config × zone × sous-total", () => {
    for (const cfg of configs)
      for (const zone of ["cotonou", "autre"] as const)
        for (const sub of subtotals) {
          expect(shippingFee(sub, zone, cfg), `${zone} sub=${sub} freeFrom=${cfg.freeFrom}`).toBe(sqlFee(sub, zone, cfg));
        }
  });
  it("hors Cotonou : jamais gratuit, même pour un panier énorme", () => {
    expect(shippingFee(10_000_000, "autre", DEFAULT_SHIPPING)).toBe(2500);
  });
  it("panier vide (0 F) à Cotonou : tarif plein, pas de livraison offerte", () => {
    expect(shippingFee(0, "cotonou", DEFAULT_SHIPPING)).toBe(1000);
  });
});

describe("franco : barre de progression", () => {
  it("jamais négatif ni > 100, même au-delà du franco", () => {
    expect(freeShippingRemaining(20_000, DEFAULT_SHIPPING)).toBe(0);
    expect(freeShippingRemaining(14_999, DEFAULT_SHIPPING)).toBe(1);
    expect(freeShippingPercent(0, DEFAULT_SHIPPING)).toBe(0);
    expect(freeShippingPercent(15_000, DEFAULT_SHIPPING)).toBe(100);
    expect(freeShippingPercent(1_000_000, DEFAULT_SHIPPING)).toBe(100);
  });
  it("franco désactivé (freeFrom ≤ 0) : aucun montant « restant » et pas de division par zéro", () => {
    const off = { ...DEFAULT_SHIPPING, freeFrom: 0 };
    expect(freeShippingRemaining(500, off)).toBe(0);
    expect(Number.isFinite(freeShippingPercent(500, off))).toBe(true);
  });
  // BUG QA-6 (faible) : le tiroir panier affiche « Livraison offerte à Cotonou » dès que remaining === 0,
  // y compris quand le franco est DÉSACTIVÉ (freeFrom ≤ 0). Il faut distinguer « désactivé » de « atteint ».
  // Fix attendu : exposer `freeShippingEnabled(cfg)` (freeFrom > 0) et masquer le bandeau s'il est faux.
  it("QA-6 : un helper permet de distinguer « franco atteint » de « franco désactivé »", async () => {
    const mod = (await import("@/lib/checkout/shipping")) as Record<string, unknown>;
    expect(typeof mod.freeShippingEnabled).toBe("function");
  });
});

describe("clampQty : limites", () => {
  it("stock 0 → 0 (jamais de quantité sur un produit épuisé)", () => {
    expect(clampQty(3, 0)).toBe(0);
  });
  it("stock négatif en base (donnée corrompue) → 0, pas de quantité négative", () => {
    expect(clampQty(3, -4)).toBe(0);
  });
  it("quantité négative, NaN, Infinity, décimale", () => {
    expect(clampQty(-5, 10)).toBe(0);
    expect(clampQty(Number.NaN, 10)).toBe(0);
    expect(clampQty(Number.POSITIVE_INFINITY, 10)).toBe(10);
    expect(clampQty(2.9, 10)).toBe(2);
  });
  it("stock illimité (null) borné à 99 ; stock géant borné à 99", () => {
    expect(clampQty(500, null)).toBe(99);
    expect(clampQty(500, 10_000)).toBe(99);
  });
  it("une seule unité en stock : on ne peut pas en avoir 2", () => {
    expect(clampQty(2, 1)).toBe(1);
  });
});

describe("téléphone : formats réels de saisie au Bénin", () => {
  const valid = ["0197000000", "01 97 00 00 00", "01-97-00-00-00", "01.97.00.00.00", "+229 01 97 00 00 00", "+2290197000000", "229 0197000000", "  0197000000  "];
  const invalid = [
    "", " ", "0", "019700000", "01970000000", "0297000000", "0097000000", "97000000", "+229 97 00 00 00",
    "+22997000000", "O197000000", "01 97 00 00 0a", "０１９７０００００００" /* chiffres pleine chasse */,
    "+33 1 97 00 00 00 00", "+229 +229 0197000000",
  ];
  it.each(valid)("accepte « %s »", (s) => expect(validPhone(s)).toBe(true));
  it.each(invalid)("rejette « %s »", (s) => expect(validPhone(s)).toBe(false));
  it("types inattendus (null, undefined, nombre sans zéro initial, objet) → faux, jamais d'exception", () => {
    for (const v of [null, undefined, 197000000, {}, [], true]) expect(validPhone(v)).toBe(false);
  });
  it("normPhone est idempotent et prettyPhone aussi", () => {
    expect(normPhone(normPhone("+229 01 97 00 00 00"))).toBe("0197000000");
    expect(prettyPhone(prettyPhone("0197000000"))).toBe("01 97 00 00 00");
  });
  it("e-mail : refus des formes pièges", () => {
    for (const s of ["a@b", "a b@c.de", "@c.de", "a@.de", "a@b.c", "a@@b.co", "", "   ", "a@b.co\nBcc: x@y.z"]) {
      expect(validEmail(s), JSON.stringify(s)).toBe(false);
    }
    expect(validEmail("  afi@exemple.bj  ")).toBe(true);
  });
});

describe("parité des 3 copies de normPhone (checkout / compte / newsletter)", () => {
  const samples = ["0197000000", "+229 01 97 00 00 00", "229 0197000000", "01 97 00 00 00", "97000000", "", "abc"];
  it("mêmes verdicts et mêmes normalisations sur les formats courants", () => {
    for (const s of samples) {
      expect(authNormPhone(s)).toBe(normPhone(s));
      expect(nlNormPhone(s)).toBe(normPhone(s));
      expect(authValidPhone(s)).toBe(validPhone(s));
      expect(nlValidPhone(s)).toBe(validPhone(s));
    }
  });
  // BUG QA-3 (faible) : « 00229 01 97 00 00 00 » est accepté à l'inscription/suivi (auth) mais refusé à la commande et à la
  // newsletter. Un client inscrit avec ce format ne peut pas passer commande avec le même numéro. Fix : une seule implémentation.
  it("QA-3 : « 00229… » est traité pareil partout", () => {
    const s = "00229 01 97 00 00 00";
    expect(validPhone(s)).toBe(authValidPhone(s));
    expect(nlValidPhone(s)).toBe(authValidPhone(s));
  });
});

describe("checkoutSchema : limites et rejets", () => {
  const parse = (over: Record<string, unknown>) => checkoutSchema.safeParse({ ...base(), ...over });
  const withCustomer = (c: Record<string, unknown>) => parse({ customer: { ...base().customer, ...c } });

  it("quantités : 1 et 99 acceptés ; 0, 100, -1, 1.5, '2', null rejetés", () => {
    for (const q of [1, 99]) expect(parse({ items: [{ kind: "product", id: UUID, qty: q }] }).success).toBe(true);
    for (const q of [0, 100, -1, 1.5, "2", null, Number.NaN])
      expect(parse({ items: [{ kind: "product", id: UUID, qty: q }] }).success, String(q)).toBe(false);
  });
  it("panier : 50 lignes acceptées, 51 rejetées, vide rejeté, non-tableau rejeté", () => {
    const line = (i: number) => ({ kind: "product", id: `3f2b8c1e-5a47-4d9a-9b1e-7c2d4e6f${String(i).padStart(4, "0")}`, qty: 1 });
    expect(parse({ items: Array.from({ length: 50 }, (_, i) => line(i)) }).success).toBe(true);
    expect(parse({ items: Array.from({ length: 51 }, (_, i) => line(i)) }).success).toBe(false);
    expect(parse({ items: [] }).success).toBe(false);
    expect(parse({ items: "x" }).success).toBe(false);
  });
  it("identifiants : non-UUID (slug de démo, SQL, vide) et kind inconnu rejetés", () => {
    for (const id of ["lampe", "1; drop table products", "", "3f2b8c1e-5a47-4d9a-9b1e-7c2d4e6f8a1", UUID + "0"])
      expect(parse({ items: [{ kind: "product", id, qty: 1 }] }).success, id).toBe(false);
    expect(parse({ items: [{ kind: "bundle", id: UUID, qty: 1 }] }).success).toBe(false);
    expect(parse({ items: [{ kind: "pack", id: UUID, qty: 1 }] }).success).toBe(true);
  });
  it("lignes en double acceptées par le schéma (le SQL les agrège et rejette > 99 au total)", () => {
    const r = parse({ items: [{ kind: "product", id: UUID, qty: 60 }, { kind: "product", id: UUID, qty: 60 }] });
    expect(r.success).toBe(true);
  });
  it("nom : 3 caractères mini (espaces ignorés), 120 maxi, Unicode accepté", () => {
    expect(withCustomer({ name: "  ab  " }).success).toBe(false);
    expect(withCustomer({ name: "   " }).success).toBe(false);
    expect(withCustomer({ name: "Kòkú" }).success).toBe(true);
    expect(withCustomer({ name: "ẹ".repeat(120) }).success).toBe(true);
    expect(withCustomer({ name: "a".repeat(121) }).success).toBe(false);
  });
  it("adresse : 5 mini, 400 maxi ; note : 500 maxi", () => {
    expect(withCustomer({ address: "1234" }).success).toBe(false);
    expect(withCustomer({ address: "12345" }).success).toBe(true);
    expect(withCustomer({ address: "a".repeat(400) }).success).toBe(true);
    expect(withCustomer({ address: "a".repeat(401) }).success).toBe(false);
    expect(withCustomer({ note: "n".repeat(500) }).success).toBe(true);
    expect(withCustomer({ note: "n".repeat(501) }).success).toBe(false);
  });
  it("e-mail facultatif : absent et chaîne vide acceptés, invalide refusé", () => {
    expect(withCustomer({ email: "" }).success).toBe(true);
    expect(withCustomer({ email: undefined }).success).toBe(true);
    expect(withCustomer({ email: "pas-un-mail" }).success).toBe(false);
  });
  it("zone et paiement sensibles à la casse / valeurs inconnues rejetées", () => {
    expect(parse({ zone: "Cotonou" }).success).toBe(false);
    expect(parse({ zone: "calavi" }).success).toBe(false);
    expect(parse({ pay: "MOMO" }).success).toBe(false);
    expect(parse({ pay: "bitcoin" }).success).toBe(false);
  });
  it("Mobile Money : numéro à valider obligatoire (momo, moov, celtiis) ; inutile pour carte et paiement à la livraison", () => {
    for (const pay of ["momo", "moov", "celtiis"]) {
      expect(parse({ pay }).success, pay).toBe(false);
      expect(parse({ pay, payerPhone: "12" }).success, pay).toBe(false);
      expect(parse({ pay, payerPhone: "+229 01 96 00 00 00" }).success, pay).toBe(true);
    }
    expect(parse({ pay: "carte" }).success).toBe(true);
    expect(parse({ pay: "cod" }).success).toBe(true);
  });
  it("aucun montant client n'est conservé (total, prix, frais, remise)", () => {
    const r = parse({ total: 1, subtotal: 1, shippingFee: 0, discount: 100, items: [{ kind: "product", id: UUID, qty: 1, price: 1, unit_price: 1 }] });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(JSON.stringify(r.data)).not.toMatch(/total|subtotal|shippingFee|discount|price/i);
    }
  });
  it("langue inconnue refusée, absente → fr", () => {
    expect(parse({ lang: "de" }).success).toBe(false);
    const r = parse({});
    expect(r.success && r.data.lang).toBe("fr");
  });
  it("corps non-objet (null, tableau, nombre) rejeté sans exception", () => {
    for (const v of [null, [], 3, "x", undefined]) expect(checkoutSchema.safeParse(v).success).toBe(false);
  });
});

describe("reviewSchema : limites", () => {
  const ok = { productId: UUID, rating: 5, body: "Très bon produit, livraison rapide.", t: 1 };
  it("note : 1..5 entiers uniquement", () => {
    for (const r of [1, 5]) expect(reviewSchema.safeParse({ ...ok, rating: r }).success).toBe(true);
    for (const r of [0, 6, 4.5, "5", null]) expect(reviewSchema.safeParse({ ...ok, rating: r }).success, String(r)).toBe(false);
  });
  it("texte : 15 mini (après trim), 1500 maxi", () => {
    expect(reviewSchema.safeParse({ ...ok, body: "a".repeat(14) }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...ok, body: "  " + "a".repeat(14) + "  " }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...ok, body: "a".repeat(15) }).success).toBe(true);
    expect(reviewSchema.safeParse({ ...ok, body: "a".repeat(1500) }).success).toBe(true);
    expect(reviewSchema.safeParse({ ...ok, body: "a".repeat(1501) }).success).toBe(false);
  });
  it("produit : un identifiant non-UUID (slug de démo) est refusé", () => {
    expect(reviewSchema.safeParse({ ...ok, productId: "lampe" }).success).toBe(false);
  });
});

describe("anti-robot : bornes exactes (horloge injectée, aucun sleep)", () => {
  const now = 1_800_000_000_000;
  it("délai minimal : 2499 ms = robot, 2500 ms = humain", () => {
    expect(looksLikeBot({ t: now - (MIN_FORM_DELAY_MS - 1) }, now)).toBe(true);
    expect(looksLikeBot({ t: now - MIN_FORM_DELAY_MS }, now)).toBe(false);
  });
  it("honeypot : espaces seuls ne comptent pas, un caractère compte", () => {
    expect(looksLikeBot({ website: "   ", t: now - 10_000 }, now)).toBe(false);
    expect(looksLikeBot({ website: "x", t: now - 10_000 }, now)).toBe(true);
  });
  it("horodatage absent = robot ; horodatage flottant refusé par le schéma", () => {
    expect(looksLikeBot({}, now)).toBe(true);
    expect(checkoutSchema.safeParse({ ...base(), t: 1.5 }).success).toBe(false);
  });
  // BUG QA-1 (ÉLEVÉ) : `t` est l'heure du TÉLÉPHONE du client. Si son horloge avance de plus de ~1 s sur le serveur (fréquent :
  // téléphones à l'heure manuelle / fuseau erroné), `t > now + 1000` classe TOUT envoi comme robot : commande et avis
  // refusés (400 « invalid_request » générique) sans issue pour le client. L'auth tolère 10 min, la newsletter 5 s.
  // Fix : tolérance d'horloge alignée sur auth/bot-guard (10 min) — ou mieux, horodatage émis par le serveur.
  it("QA-1 : un client dont l'horloge avance de 60 s n'est pas pris pour un robot", () => {
    const t = now + 60_000 - 10_000; // formulaire ouvert il y a 10 s selon SON horloge, qui avance de 60 s
    expect(looksLikeBot({ t }, now)).toBe(false);
  });
  // QA-1b (ÉLEVÉ, même cause) : auth/bot-guard.ts a la logique de tolérance À L'ENVERS. `elapsed < 2500 && elapsed > -10 min`
  // renvoie "tooFast" pour une horloge cliente en avance de 3 s à 10 min (contact, inscription, mot de passe oublié, suivi), et
  // ne laisse passer que les horloges en avance de PLUS de 10 min (cas du test existant « +1 h »). Même fix.
  it("QA-1b : formulaires du compte — horloge cliente en avance de 60 s n'est pas « trop rapide »", () => {
    expect(checkBot({ t: now + 60_000 - 10_000 }, now)).toBe("ok");
  });
  it("(contrôle) horloge en retard : jamais bloqué", () => {
    expect(looksLikeBot({ t: now - 3_600_000 }, now)).toBe(false);
  });
});

describe("rate-limit mémoire : bornes", () => {
  it("fenêtre : à t0+fenêtre exactement l'appel est de nouveau autorisé", () => {
    resetRateLimit();
    expect(rateLimit("k", 1, 1000, 0)).toBe(true);
    expect(rateLimit("k", 1, 1000, 999)).toBe(false);
    expect(rateLimit("k", 1, 1000, 1000)).toBe(true);
  });
  it("limite 0 : tout est refusé", () => {
    resetRateLimit();
    expect(rateLimit("z", 0, 1000, 0)).toBe(false);
  });
  it("les appels refusés ne prolongent pas le blocage", () => {
    resetRateLimit();
    rateLimit("p", 1, 1000, 0);
    for (let t = 100; t < 900; t += 100) expect(rateLimit("p", 1, 1000, t)).toBe(false);
    expect(rateLimit("p", 1, 1000, 1000)).toBe(true);
  });
  it("clientIp : en-tête vide ou absent → « unknown » (tous les anonymes partagent alors UN seul seau)", () => {
    expect(clientIp(new Headers())).toBe("unknown");
    expect(clientIp(new Headers({ "x-forwarded-for": " , 1.2.3.4" }))).toBe("unknown");
    expect(clientIp(new Headers({ "x-forwarded-for": "5.5.5.5, 6.6.6.6" }))).toBe("5.5.5.5");
  });
});

describe("codes d'erreur API : cohérence", () => {
  const codes = Object.keys(API_STATUS) as ApiErrorCode[];
  it("chaque code a un statut 4xx/5xx et un message FR et EN non vides, sans accolades ni détail technique", () => {
    for (const c of codes) {
      expect(API_STATUS[c]).toBeGreaterThanOrEqual(400);
      for (const l of ["fr", "en"] as const) {
        const m = apiMessage(l, c);
        expect(m.length, `${l}.${c}`).toBeGreaterThan(10);
        expect(m).not.toMatch(/[{}]|SQL|supabase|stack|postgres/i);
      }
    }
  });
  it("mapPlaceOrderError : variantes de message, null et casse", () => {
    expect(mapPlaceOrderError("Error: out_of_stock")).toBe("out_of_stock");
    expect(mapPlaceOrderError("pack_unavailable")).toBe("product_unavailable");
    expect(mapPlaceOrderError("invalid_qty")).toBe("cart_invalid");
    expect(mapPlaceOrderError("shipping_not_configured")).toBe("unavailable");
    expect(mapPlaceOrderError('invalid input syntax for type uuid: "lampe"')).toBe("server_error");
    expect(mapPlaceOrderError(null)).toBe("server_error");
    expect(mapPlaceOrderError(undefined)).toBe("server_error");
    expect(mapPlaceOrderError("")).toBe("server_error");
  });
  it("moyens de paiement : tous désactivés → liste vide (l'UI doit gérer ce cas) ; objet null → tous actifs", () => {
    expect(enabledPayMethods({ momo: false, moov: false, celtiis: false, carte: false, cod: false })).toEqual([]);
    expect(enabledPayMethods(null)).toHaveLength(5);
    expect(enabledPayMethods({ cod: false })).not.toContain("cod");
  });
});
