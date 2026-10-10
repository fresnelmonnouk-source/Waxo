import { describe, expect, it } from "vitest";
import { normPhone, prettyPhone, validEmail, validPhone } from "@/lib/checkout/phone";
import { parseMe } from "@/lib/checkout/me";
import { checkoutSchema, looksLikeBot, MIN_FORM_DELAY_MS, reviewSchema } from "@/lib/checkout/schema";
import { apiMessage, mapPlaceOrderError } from "@/lib/checkout/errors";
import { parseLastOrder } from "@/lib/checkout/last-order";

describe("normPhone / validPhone", () => {
  it("accepte les formats béninois usuels", () => {
    for (const v of ["0197000000", "01 97 00 00 00", "+229 01 97 00 00 00", "229 0197000000", "01-97-00-00-00"]) {
      expect(validPhone(v), v).toBe(true);
      expect(normPhone(v)).toBe("0197000000");
    }
  });
  it("rejette les numéros invalides", () => {
    for (const v of ["", "0297000000", "019700000", "01970000000", "97000000", "abc", "+33 6 12 34 56 78", null, undefined]) {
      expect(validPhone(v), String(v)).toBe(false);
    }
  });
  it("met en forme un numéro par paires", () => {
    expect(prettyPhone("+229 0197000000")).toBe("01 97 00 00 00");
  });
});

describe("validEmail", () => {
  it("valide les adresses plausibles", () => {
    expect(validEmail("afi@exemple.bj")).toBe(true);
    expect(validEmail("  afi@exemple.bj ")).toBe(true);
  });
  it("rejette les adresses invalides", () => {
    for (const v of ["", "afi", "afi@", "afi@exemple", "a fi@exemple.bj", "afi@exemple.b"]) {
      expect(validEmail(v), v).toBe(false);
    }
  });
});

const UUID = "3f2b8c1e-5a47-4d9a-9b1e-7c2d4e6f8a10";
const base = {
  items: [{ kind: "product", id: UUID, qty: 2 }],
  customer: { name: "Afi Houngbédji", phone: "01 97 00 00 00", address: "Fidjrossè, portail bleu" },
  zone: "cotonou",
  pay: "cod",
  t: 1,
};

describe("checkoutSchema", () => {
  it("accepte une commande valide et ignore les montants envoyés par le client", () => {
    const r = checkoutSchema.safeParse({ ...base, total: 1, shippingFee: 0, items: [{ ...base.items[0], price: 1 }] });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(JSON.stringify(r.data)).not.toContain("shippingFee");
      expect(r.data.items[0]).toEqual({ kind: "product", id: UUID, qty: 2 });
      expect(r.data.lang).toBe("fr");
    }
  });
  it("refuse panier vide, quantités hors bornes et identifiants non-UUID", () => {
    expect(checkoutSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, items: [{ kind: "product", id: UUID, qty: 0 }] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, items: [{ kind: "product", id: UUID, qty: 100 }] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, items: [{ kind: "product", id: "lampe", qty: 1 }] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, items: [{ kind: "gift", id: UUID, qty: 1 }] }).success).toBe(false);
  });
  it("refuse téléphone, nom, adresse, zone et paiement invalides", () => {
    const c = base.customer;
    expect(checkoutSchema.safeParse({ ...base, customer: { ...c, phone: "0297000000" } }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, customer: { ...c, name: "Af" } }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, customer: { ...c, address: "abc" } }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, customer: { ...c, email: "nope" } }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, customer: { ...c, email: "" } }).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...base, zone: "lome" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, pay: "bitcoin" }).success).toBe(false);
  });
  it("exige le numéro Mobile Money pour momo/moov/celtiis uniquement", () => {
    expect(checkoutSchema.safeParse({ ...base, pay: "momo" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, pay: "momo", payerPhone: "12" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, pay: "momo", payerPhone: "01 96 00 00 00" }).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...base, pay: "carte" }).success).toBe(true);
  });
  it("borne les longueurs", () => {
    expect(checkoutSchema.safeParse({ ...base, customer: { ...base.customer, note: "x".repeat(501) } }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, customer: { ...base.customer, address: "x".repeat(401) } }).success).toBe(false);
    expect(
      checkoutSchema.safeParse({ ...base, items: Array.from({ length: 51 }, () => ({ kind: "product", id: UUID, qty: 1 })) }).success,
    ).toBe(false);
  });
});

describe("reviewSchema", () => {
  const ok = { productId: UUID, rating: 5, body: "Très bon produit, je recommande." };
  it("accepte un avis valide", () => {
    expect(reviewSchema.safeParse(ok).success).toBe(true);
  });
  it("refuse note hors 1-5, texte trop court ou trop long", () => {
    expect(reviewSchema.safeParse({ ...ok, rating: 0 }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...ok, rating: 6 }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...ok, rating: 4.5 }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...ok, body: "court" }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...ok, body: "x".repeat(1501) }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...ok, body: "x".repeat(1500) }).success).toBe(true);
    expect(reviewSchema.safeParse({ ...ok, productId: "lampe" }).success).toBe(false);
  });
});

describe("looksLikeBot (honeypot + délai)", () => {
  const now = 1_000_000;
  it("laisse passer un humain", () => {
    expect(looksLikeBot({ website: "", t: now - MIN_FORM_DELAY_MS - 1 }, now)).toBe(false);
  });
  it("bloque honeypot rempli, envoi trop rapide, horodatage absent ; accepte une horloge client en avance", () => {
    expect(looksLikeBot({ website: "http://spam", t: now - 60_000 }, now)).toBe(true);
    expect(looksLikeBot({ website: "", t: now - 1000 }, now)).toBe(true);
    expect(looksLikeBot({ website: "" }, now)).toBe(true);
    // Horloge du téléphone en avance : pas un robot (corrige QA-1 / Zoé n°2).
    expect(looksLikeBot({ website: "", t: now + 60_000 }, now)).toBe(false);
  });
});

describe("codes d'erreur de place_order", () => {
  it("traduit les exceptions SQL en codes publics", () => {
    expect(mapPlaceOrderError("out_of_stock")).toBe("out_of_stock");
    expect(mapPlaceOrderError("product_unavailable")).toBe("product_unavailable");
    expect(mapPlaceOrderError("pack_unavailable")).toBe("product_unavailable");
    expect(mapPlaceOrderError("payment_method_disabled")).toBe("payment_method_disabled");
    expect(mapPlaceOrderError("invalid_qty")).toBe("cart_invalid");
    expect(mapPlaceOrderError("shipping_not_configured")).toBe("unavailable");
  });
  it("n'expose jamais un message interne inconnu", () => {
    expect(mapPlaceOrderError('invalid input syntax for type uuid: "lampe"')).toBe("server_error");
    expect(mapPlaceOrderError(undefined)).toBe("server_error");
  });
  it("a un message FR et EN pour chaque code", () => {
    for (const code of ["invalid_request", "out_of_stock", "payment_method_disabled", "unavailable", "login_required"] as const) {
      expect(apiMessage("fr", code).length).toBeGreaterThan(5);
      expect(apiMessage("en", code).length).toBeGreaterThan(5);
      expect(apiMessage("fr", code)).not.toBe(apiMessage("en", code));
    }
  });
});

describe("parseMe (réponse de /api/me)", () => {
  it("lit camelCase et snake_case", () => {
    expect(parseMe({ user: { firstName: "Afi", lastName: "H", phone: "0197000000", address: "Cotonou" } })).toEqual({
      name: "Afi H",
      first: "Afi",
      phone: "0197000000",
      address: "Cotonou",
    });
    expect(parseMe({ user: { first_name: "Koffi", last_name: "A" } })?.name).toBe("Koffi A");
  });
  it("renvoie null pour invité ou réponse inattendue", () => {
    expect(parseMe({ user: null })).toBeNull();
    expect(parseMe(null)).toBeNull();
    expect(parseMe("x")).toBeNull();
    expect(parseMe({})).toBeNull();
  });
});

describe("parseLastOrder", () => {
  it("valide et normalise", () => {
    const raw = JSON.stringify({ number: "WX-10263", total: 9900, pay: "cod", zone: "autre", name: "Afi", phone: "0197000000", pending: false, placedAt: 5 });
    expect(parseLastOrder(raw)).toMatchObject({ number: "WX-10263", total: 9900, pay: "cod", zone: "autre" });
  });
  it("rejette un contenu altéré", () => {
    expect(parseLastOrder(null)).toBeNull();
    expect(parseLastOrder("{")).toBeNull();
    expect(parseLastOrder(JSON.stringify({ number: "<script>", total: 1 }))).toBeNull();
    expect(parseLastOrder(JSON.stringify({ number: "WX-1", total: "1" }))).toBeNull();
  });
});
