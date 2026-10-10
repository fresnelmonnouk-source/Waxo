// QA (Nadia) — chemins négatifs de POST /api/checkout et POST /api/reviews (Supabase, session et paiement simulés ; aucun réseau).
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const createAdminClient = vi.fn();
const publicEnv = vi.fn();
const getUser = vi.fn();
const createSessionClient = vi.fn();
const createCheckout = vi.fn();
const sendOrderEmail = vi.fn();
const findByIdem = vi.fn(); // orders.select(...).eq("idem_key", k).maybeSingle()
const updateOrder = vi.fn(); // orders.update(patch).eq("id", id)

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => createAdminClient() }));
vi.mock("@/lib/supabase/env", () => ({ supabasePublicEnv: () => publicEnv() }));
vi.mock("@/lib/supabase/server", () => ({ createSessionClient: () => createSessionClient() }));
vi.mock("@/lib/email", () => ({ sendOrderEmail: (...a: unknown[]) => sendOrderEmail(...a) }));
vi.mock("@/lib/payment", () => ({ getPaymentProvider: () => ({ name: "test", createCheckout }) }));

import { POST as checkoutPOST } from "@/app/api/checkout/route";
import { POST as reviewsPOST } from "@/app/api/reviews/route";
import { resetRateLimit } from "@/lib/checkout/rate-limit";

const UUID = "3f2b8c1e-5a47-4d9a-9b1e-7c2d4e6f8a10";
const ROW = { order_id: "o-1", order_number: "WX-10263", subtotal: 6000, shipping_fee: 1000, total: 7000 };

const checkoutBody = (over: Record<string, unknown> = {}) => ({
  items: [{ kind: "product", id: UUID, qty: 2 }],
  customer: { name: "Afi Houngbédji", phone: "01 97 00 00 00", address: "Fidjrossè, portail bleu" },
  zone: "cotonou",
  pay: "cod",
  lang: "fr",
  website: "",
  t: Date.now() - 10_000,
  ...over,
});
const post = (handler: (r: Request) => Promise<Response>, payload: unknown, ip = "7.7.7.7") =>
  handler(
    new Request("http://localhost/api/x", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: typeof payload === "string" ? payload : JSON.stringify(payload),
    }),
  );
const checkout = (payload: unknown, ip?: string) => post(checkoutPOST, payload, ip);

beforeEach(() => {
  resetRateLimit();
  for (const m of [rpc, createAdminClient, publicEnv, getUser, createSessionClient, createCheckout, sendOrderEmail, findByIdem, updateOrder]) m.mockReset();
  sendOrderEmail.mockResolvedValue(undefined);
  findByIdem.mockResolvedValue({ data: null, error: null });
  updateOrder.mockResolvedValue({ error: null });
  createAdminClient.mockReturnValue({
    rpc,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => findByIdem() }) }),
      update: (patch: unknown) => ({ eq: (_c: string, id: string) => updateOrder(patch, id) }),
    }),
  });
  publicEnv.mockReturnValue(null);
  createSessionClient.mockResolvedValue({ auth: { getUser } });
  rpc.mockResolvedValue({ data: [ROW], error: null });
});

describe("POST /api/checkout — entrée hostile", () => {
  it.each([
    ["corps vide", ""],
    ["null", "null"],
    ["tableau", "[]"],
    ["nombre", "42"],
    ["chaîne", '"hello"'],
    ["JSON tronqué", '{"items":['],
  ])("%s → 4xx propre, jamais de 500 ni d'appel base", async (_n, raw) => {
    const res = await checkout(raw);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("corps de plus de 20 000 caractères → 400 sans parsing", async () => {
    const res = await checkout(JSON.stringify(checkoutBody({ pad: "x".repeat(21_000) })));
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("horodatage en chaîne (client bricolé) → traité comme robot", async () => {
    expect((await checkout(checkoutBody({ t: String(Date.now() - 10_000) }))).status).toBe(400);
  });
  it("lang inconnue → message en français par défaut, jamais de clé manquante", async () => {
    const res = await checkout(checkoutBody({ lang: "de", items: [] }));
    const json = await res.json();
    expect(json.message).toMatch(/panier|article/i);
  });
  it("lang=en + panier invalide → message anglais", async () => {
    const json = await (await checkout(checkoutBody({ lang: "en", items: [] }))).json();
    expect(json.message).toMatch(/cart/i);
  });
  it("les champs signalés ne contiennent que des NOMS de champs, jamais les valeurs saisies", async () => {
    const res = await checkout(checkoutBody({ customer: { name: "Afi Houngbédji", phone: "SECRET-123", address: "Fidjrossè" } }));
    const json = await res.json();
    expect(json.fields).toEqual(["phone"]);
    expect(JSON.stringify(json)).not.toContain("SECRET-123");
  });
  it("plusieurs champs invalides → tous signalés une seule fois", async () => {
    const json = await (await checkout(checkoutBody({ customer: { name: "A", phone: "1", address: "x" } }))).json();
    expect([...json.fields].sort()).toEqual(["address", "name", "phone"]);
  });
});

describe("POST /api/checkout — chemins métier", () => {
  it("lignes en double : les quantités sont CUMULÉES pour le plafond (10 par article) avant tout appel base", async () => {
    const items = [{ kind: "product", id: UUID, qty: 6 }, { kind: "product", id: UUID.toUpperCase(), qty: 6 }];
    const res = await checkout(checkoutBody({ items }));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("quantity_limit");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("plafonds anti-vidage de stock : 10 par article et 20 unités par commande, bornes exactes", async () => {
    const other = (n: number) => `3f2b8c1e-5a47-4d9a-9b1e-7c2d4e6f${String(n).padStart(4, "0")}`;
    const send = (items: unknown[], ip: string) => checkout(checkoutBody({ items }), ip);
    expect((await send([{ kind: "product", id: UUID, qty: 10 }], "cap1")).status).toBe(200);
    expect((await send([{ kind: "product", id: UUID, qty: 11 }], "cap2")).status).toBe(422);
    const twenty = [{ kind: "product", id: UUID, qty: 10 }, { kind: "product", id: other(1), qty: 10 }];
    expect((await send(twenty, "cap3")).status).toBe(200);
    expect((await send([...twenty, { kind: "product", id: other(2), qty: 1 }], "cap4")).status).toBe(422);
    // un produit et un pack de même id sont deux articles distincts
    expect((await send([{ kind: "product", id: UUID, qty: 10 }, { kind: "pack", id: UUID, qty: 10 }], "cap5")).status).toBe(200);
  });
  it("le 422 de plafond est localisé (EN) et oriente vers WhatsApp", async () => {
    const json = await (await checkout(checkoutBody({ lang: "en", items: [{ kind: "product", id: UUID, qty: 11 }] }))).json();
    expect(json.message).toMatch(/WhatsApp/);
  });
  it("invalid_qty levé par le SQL (somme > 99) → 422 cart_invalid", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "invalid_qty" } });
    const res = await checkout(checkoutBody());
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("cart_invalid");
  });
  it("product_unavailable → 409 ; payment_method_disabled → 422 ; shipping_not_configured → 503", async () => {
    const cases: [string, number][] = [["product_unavailable", 409], ["pack_unavailable", 409], ["payment_method_disabled", 422], ["shipping_not_configured", 503]];
    for (const [message, status] of cases) {
      rpc.mockResolvedValue({ data: null, error: { message } });
      expect((await checkout(checkoutBody(), `ip-${message}`)).status, message).toBe(status);
    }
  });
  it("rpc renvoie un objet seul (pas un tableau) → accepté", async () => {
    rpc.mockResolvedValue({ data: ROW, error: null });
    expect((await checkout(checkoutBody())).status).toBe(200);
  });
  it.each([
    ["tableau vide", []],
    ["null", null],
    ["total absent", [{ ...ROW, total: undefined }]],
    ["total en chaîne", [{ ...ROW, total: "7000" }]],
  ])("réponse SQL inattendue (%s) → 500 générique, pas de commande annoncée", async (_n, data) => {
    rpc.mockResolvedValue({ data, error: null });
    const res = await checkout(checkoutBody());
    expect(res.status).toBe(500);
    expect((await res.json()).order).toBeUndefined();
  });
  it("e-mail absent → chaîne vide transmise ; téléphone normalisé ; note vide", async () => {
    await checkout(checkoutBody({ customer: { name: "Afi H", phone: "+229 01 97 00 00 00", address: "Cotonou Akpakpa" } }));
    expect(rpc.mock.calls[0][1].p_customer).toEqual({ name: "Afi H", phone: "0197000000", email: "", address: "Cotonou Akpakpa", note: "" });
  });
  it("p_zone et p_pay viennent du client mais sont bornés par le schéma (aucune valeur libre)", async () => {
    await checkout(checkoutBody({ zone: "autre", pay: "cod" }));
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_zone: "autre", p_pay: "cod" });
  });
});

describe("POST /api/checkout — rattachement au compte", () => {
  it("invité (Supabase configuré mais pas de session) → p_user null", async () => {
    publicEnv.mockReturnValue({ url: "u", key: "k" });
    getUser.mockResolvedValue({ data: { user: null } });
    await checkout(checkoutBody());
    expect(rpc.mock.calls[0][1].p_user).toBeNull();
  });
  it("connecté → p_user = id de l'utilisateur vérifié", async () => {
    publicEnv.mockReturnValue({ url: "u", key: "k" });
    getUser.mockResolvedValue({ data: { user: { id: "user-42" } } });
    await checkout(checkoutBody());
    expect(rpc.mock.calls[0][1].p_user).toBe("user-42");
  });
  it("le client ne peut pas imposer p_user (champ userId ignoré)", async () => {
    publicEnv.mockReturnValue({ url: "u", key: "k" });
    getUser.mockResolvedValue({ data: { user: null } });
    await checkout(checkoutBody({ userId: "victime", user_id: "victime", p_user: "victime" }));
    expect(rpc.mock.calls[0][1].p_user).toBeNull();
  });
  it("lecture de session qui plante ou ne répond jamais → commande passée en invité, jamais bloquée", async () => {
    publicEnv.mockReturnValue({ url: "u", key: "k" });
    createSessionClient.mockRejectedValue(new Error("cookies indisponibles"));
    const res = await checkout(checkoutBody());
    expect(res.status).toBe(200);
    expect(rpc.mock.calls[0][1].p_user).toBeNull();
  });
});

describe("POST /api/checkout — horloge du téléphone (non-régression QA-1)", () => {
  it("horloge cliente en AVANCE de 60 s, formulaire ouvert depuis 10 s selon elle : commande acceptée", async () => {
    const res = await checkout(checkoutBody({ t: Date.now() + 60_000 - 10_000 }));
    expect(res.status).toBe(200);
  });
  it("horloge en RETARD d'une heure : acceptée", async () => {
    expect((await checkout(checkoutBody({ t: Date.now() - 3_600_000 }), "late")).status).toBe(200);
  });
  it("`elapsed` (durée mesurée sur une seule horloge) est prioritaire : 1 s = trop rapide (refus 4xx), 5 s = ok, même si `t` ment", async () => {
    const fast = await checkout(checkoutBody({ elapsed: 1000, t: 1 }), "e1");
    expect(fast.status).toBeGreaterThanOrEqual(400);
    expect((await fast.json()).code).toBe("too_fast");
    expect((await checkout(checkoutBody({ elapsed: 5000, t: Date.now() }), "e2")).status).toBe(200);
  });
  it("sans `t` ni `elapsed` : traité comme robot (400) ; `elapsed` en chaîne ignoré", async () => {
    const { t: _t, ...noT } = checkoutBody();
    void _t;
    expect((await checkout(noT, "n1")).status).toBe(400);
    expect((await checkout(checkoutBody({ t: undefined, elapsed: "5000" }), "n2")).status).toBe(400);
  });
  it("envoi réellement trop rapide (t = maintenant) : refus 4xx localisé ; honeypot : 400", async () => {
    const r = await checkout(checkoutBody({ t: Date.now() - 200, lang: "en" }), "f1");
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
    expect((await r.json()).code).toBe("too_fast");
    expect((await checkout(checkoutBody({ website: "x" }), "f2")).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("POST /api/checkout — idempotence (non-régression QA-12)", () => {
  const IDEM = "9b2f6c84-1d3a-4e57-8a90-0c1b2d3e4f56";
  const existing = { id: "o-old", number: "WX-10200", subtotal: 6000, shipping_fee: 1000, total: 7000, pay: "cod", paid: false };

  it("même clé rejouée (coupure réseau puis nouvel essai) : AUCUNE seconde commande, on renvoie la première", async () => {
    findByIdem.mockResolvedValue({ data: existing, error: null });
    const res = await checkout(checkoutBody({ idem: IDEM }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.order).toMatchObject({ number: "WX-10200", total: 7000 });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejeu d'une commande en ligne déjà payée : payment.kind = « paid », fournisseur non rappelé", async () => {
    findByIdem.mockResolvedValue({ data: { ...existing, pay: "carte", paid: true }, error: null });
    const json = await (await checkout(checkoutBody({ idem: IDEM, pay: "carte" }))).json();
    expect(json.payment).toEqual({ kind: "paid" });
    expect(createCheckout).not.toHaveBeenCalled();
  });
  it("première tentative : la clé est enregistrée sur la commande créée", async () => {
    await checkout(checkoutBody({ idem: IDEM }));
    expect(updateOrder).toHaveBeenCalledWith({ idem_key: IDEM }, "o-1");
  });
  it("course : deux requêtes simultanées avec la même clé, la perdante est ANNULÉE (stock restitué) et la gagnante renvoyée", async () => {
    updateOrder.mockResolvedValue({ error: { code: "23505" } });
    findByIdem.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: existing, error: null });
    const rpcCalls: string[] = [];
    rpc.mockImplementation(async (name: string) => {
      rpcCalls.push(name);
      return name === "place_order" ? { data: [ROW], error: null } : { data: true, error: null };
    });
    const json = await (await checkout(checkoutBody({ idem: IDEM }))).json();
    expect(rpcCalls).toEqual(["place_order", "cancel_order"]);
    expect(json.order.number).toBe("WX-10200");
  });
  it("clé invalide (non UUID, objet, vide) ignorée : aucune écriture de clé", async () => {
    for (const idem of ["abc", "", 42, { a: 1 }, null]) {
      updateOrder.mockClear();
      await checkout(checkoutBody({ idem }), `idem-${String(idem)}`);
      expect(updateOrder.mock.calls.some((c) => (c[0] as Record<string, unknown>).idem_key !== undefined)).toBe(false);
    }
  });
  it("recherche par clé en erreur (migration 0007 absente) : la commande est quand même créée, jamais bloquée", async () => {
    findByIdem.mockRejectedValue(new Error("column idem_key does not exist"));
    expect((await checkout(checkoutBody({ idem: IDEM }))).status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("e-mail de confirmation : demandé pour le paiement à la livraison, pas pour un paiement en ligne non payé ; son échec ne bloque pas", async () => {
    sendOrderEmail.mockRejectedValue(new Error("resend down"));
    expect((await checkout(checkoutBody(), "mail1")).status).toBe(200);
    expect(sendOrderEmail).toHaveBeenCalledWith("o-1", "confirmation");
    sendOrderEmail.mockClear();
    createCheckout.mockResolvedValue({ pending: true });
    await checkout(checkoutBody({ pay: "carte" }), "mail2");
    expect(sendOrderEmail).not.toHaveBeenCalled();
  });
});

describe("POST /api/checkout — paiement en ligne", () => {
  const momo = () => checkoutBody({ pay: "momo", payerPhone: "01 96 00 00 00" });
  it("URL de redirection https acceptée", async () => {
    createCheckout.mockResolvedValue({ redirectUrl: "https://checkout.fedapay.com/abc" });
    const json = await (await checkout(checkoutBody({ pay: "carte" }))).json();
    expect(json.payment).toEqual({ kind: "redirect", url: "https://checkout.fedapay.com/abc" });
  });
  it.each(["http://evil.example/x", "javascript:alert(1)", "//evil.example", "data:text/html,x", ""])(
    "URL de redirection non-https « %s » → jamais renvoyée au navigateur (pending)",
    async (redirectUrl) => {
      createCheckout.mockResolvedValue({ redirectUrl });
      const json = await (await checkout(checkoutBody({ pay: "carte" }))).json();
      expect(json.payment).toEqual({ kind: "pending" });
    },
  );
  it("le fournisseur plante → 502 payment_unavailable, la commande créée est annoncée (pas de double commande à l'écran)", async () => {
    createCheckout.mockRejectedValue(new Error("fedapay 500: secret interne"));
    const res = await checkout(momo());
    const json = await res.json();
    expect(res.status).toBe(502);
    expect(json.code).toBe("payment_unavailable");
    expect(json.order).toMatchObject({ number: "WX-10263", total: 7000 });
    expect(JSON.stringify(json)).not.toContain("secret interne");
  });
  it("le numéro Mobile Money est normalisé avant d'être transmis au fournisseur", async () => {
    createCheckout.mockResolvedValue({ pending: true });
    await checkout(checkoutBody({ pay: "momo", payerPhone: "+229 01 96 00 00 00" }));
    expect(createCheckout.mock.calls[0][0]).toMatchObject({ payerPhone: "0196000000", method: "momo", total: 7000 });
  });
  it("le montant envoyé au fournisseur est celui de la BASE, jamais celui du client", async () => {
    createCheckout.mockResolvedValue({ pending: true });
    await checkout(checkoutBody({ pay: "carte", total: 1, amount: 1 }));
    expect(createCheckout.mock.calls[0][0].total).toBe(7000);
  });
  it("paiement à la livraison : le fournisseur n'est JAMAIS appelé", async () => {
    await checkout(checkoutBody({ pay: "cod" }));
    expect(createCheckout).not.toHaveBeenCalled();
  });
  it("Mobile Money sans numéro → 400 avec champ payerPhone, aucune commande créée", async () => {
    const res = await checkout(checkoutBody({ pay: "momo" }));
    expect(res.status).toBe(400);
    expect((await res.json()).fields).toEqual(["payerPhone"]);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("POST /api/checkout — repli sans Supabase", () => {
  // BUG QA-2 (MOYEN) : en mode démo, le catalogue sert des ids NON-UUID (« lampe », « air »…). Le schéma les refuse AVANT de
  // regarder si Supabase existe → 422 « Votre panier contient un article invalide » au lieu du 503 « Service indisponible »
  // promis par le brief J1. Même effet si Supabase tombe pendant une régénération ISR (la page retombe sur la démo).
  // Fix : tester `createAdminClient()` AVANT la validation d'ids (ou répondre 503 si le catalogue est en mode démo).
  it("QA-2 : sans Supabase, un panier d'articles de démonstration reçoit 503 « unavailable » (pas 422 cart_invalid)", async () => {
    createAdminClient.mockImplementation(() => {
      throw new Error("Supabase service_role non configuré");
    });
    const res = await checkout(checkoutBody({ items: [{ kind: "product", id: "lampe", qty: 1 }] }));
    expect(res.status).toBe(503);
  });
  it("(contrôle) sans Supabase, panier valide → 503 propre", async () => {
    createAdminClient.mockImplementation(() => {
      throw new Error("x");
    });
    expect((await checkout(checkoutBody())).status).toBe(503);
  });
});

describe("POST /api/checkout — débit", () => {
  // Risque QA-4 (MOYEN, design) : le seau de limitation (8 / 10 min / IP) est consommé par TOUTE requête, y compris les
  // refus de validation. Les opérateurs mobiles béninois partagent des IP (CGNAT) : quelques clients derrière la même IP
  // ou quelques fautes de frappe suffisent à bloquer la commande 10 minutes. Ce test documente le comportement actuel.
  it("(caractérisation) 8 requêtes invalides épuisent le seau : la 9e, même valide, reçoit 429", async () => {
    for (let i = 0; i < 8; i++) await checkout(checkoutBody({ items: [] }), "cgnat");
    const res = await checkout(checkoutBody(), "cgnat");
    expect(res.status).toBe(429);
  });
  it("le 429 est localisé et sans détail", async () => {
    for (let i = 0; i < 8; i++) await checkout(checkoutBody({ items: [] }), "cgnat2");
    const json = await (await checkout(checkoutBody({ lang: "en" }), "cgnat2")).json();
    expect(json.code).toBe("rate_limited");
  });
});

// ───────────────────────── Avis ─────────────────────────
type Existing = { id: string }[];
function fakeAdmin(opts: { profile?: { first_name: string; last_name: string } | null; existing?: Existing; existingError?: boolean; insertError?: boolean }) {
  const inserts: Record<string, unknown>[] = [];
  const from = (table: string) => {
    if (table === "profiles") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.profile ?? null }) }) }) };
    return {
      select: () => ({ eq: () => ({ eq: () => ({ limit: async () => (opts.existingError ? { data: null, error: { message: "boom" } } : { data: opts.existing ?? [], error: null }) }) }) }),
      insert: (row: Record<string, unknown>) => {
        inserts.push(row);
        return { select: () => ({ single: async () => (opts.insertError ? { data: null, error: { message: "fk" } } : { data: { id: "r-1", created_at: "2026-10-09T10:00:00Z" }, error: null }) }) };
      },
    };
  };
  return { admin: { from }, inserts };
}
const review = (over: Record<string, unknown> = {}) => ({
  productId: UUID,
  rating: 5,
  body: "Très bon produit, livraison rapide à Cotonou.",
  author: "",
  lang: "fr",
  website: "",
  t: Date.now() - 20_000,
  ...over,
});
const sendReview = (payload: unknown, ip = "8.8.8.8") => post(reviewsPOST, payload, ip);
const loggedIn = (id: string | null = "user-1") => {
  publicEnv.mockReturnValue({ url: "u", key: "k" });
  getUser.mockResolvedValue({ data: { user: id ? { id } : null } });
};

describe("POST /api/reviews", () => {
  it("sans Supabase → 503 propre", async () => {
    const res = await sendReview(review());
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("unavailable");
  });
  it("visiteur non connecté → 401 login_required, rien d'écrit", async () => {
    loggedIn(null);
    const f = fakeAdmin({});
    createAdminClient.mockReturnValue(f.admin);
    const res = await sendReview(review());
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("login_required");
    expect(f.inserts).toHaveLength(0);
  });
  it("déjà noté → 409 already_reviewed, pas de seconde insertion", async () => {
    loggedIn();
    const f = fakeAdmin({ existing: [{ id: "old" }] });
    createAdminClient.mockReturnValue(f.admin);
    const res = await sendReview(review());
    expect(res.status).toBe(409);
    expect(f.inserts).toHaveLength(0);
  });
  it("insère verified=false, seed=false, hidden=false, même si le client demande l'inverse", async () => {
    loggedIn();
    const f = fakeAdmin({ profile: { first_name: "Afi", last_name: "Houngbédji" } });
    createAdminClient.mockReturnValue(f.admin);
    const res = await sendReview(review({ verified: true, seed: true, hidden: false, user_id: "autre", rating: 5 }));
    expect(res.status).toBe(200);
    expect(f.inserts[0]).toMatchObject({ verified: false, seed: false, hidden: false, user_id: "user-1", author: "Afi H." });
  });
  it("l'auteur vient du PROFIL ; le nom envoyé par le client ne l'emporte pas (usurpation)", async () => {
    loggedIn();
    const f = fakeAdmin({ profile: { first_name: "Afi", last_name: "Houngbédji" } });
    createAdminClient.mockReturnValue(f.admin);
    await sendReview(review({ author: "Le Directeur Général" }));
    expect(f.inserts[0].author).toBe("Afi H.");
  });
  it("profil sans nom : repli sur l'auteur envoyé, puis sur « Client » / « Customer »", async () => {
    loggedIn();
    let f = fakeAdmin({ profile: { first_name: "", last_name: "" } });
    createAdminClient.mockReturnValue(f.admin);
    await sendReview(review({ author: "Kossi" }), "ip-a");
    expect(f.inserts[0].author).toBe("Kossi");
    f = fakeAdmin({ profile: null });
    createAdminClient.mockReturnValue(f.admin);
    await sendReview(review({ author: "", lang: "en" }), "ip-b");
    expect(f.inserts[0].author).toBe("Customer");
  });
  it("prénom seul (nom de famille vide) → pas de point orphelin", async () => {
    loggedIn();
    const f = fakeAdmin({ profile: { first_name: "Afi", last_name: "" } });
    createAdminClient.mockReturnValue(f.admin);
    await sendReview(review());
    expect(f.inserts[0].author).toBe("Afi");
  });
  it.each([
    ["note 0", { rating: 0 }],
    ["note 6", { rating: 6 }],
    ["note décimale", { rating: 4.5 }],
    ["texte de 14 caractères", { body: "a".repeat(14) }],
    ["texte de 1501 caractères", { body: "a".repeat(1501) }],
    ["produit de démonstration non-UUID", { productId: "lampe" }],
    ["honeypot rempli", { website: "http://spam" }],
    ["envoi en 500 ms", { t: Date.now() - 500 }],
  ])("%s → 400, rien d'écrit", async (_n, over) => {
    loggedIn();
    const f = fakeAdmin({});
    createAdminClient.mockReturnValue(f.admin);
    const res = await sendReview(review(over));
    expect(res.status).toBe(400);
    expect(f.inserts).toHaveLength(0);
  });
  it("erreur base à la lecture des avis existants ou à l'insertion (produit supprimé) → 500 générique", async () => {
    loggedIn();
    createAdminClient.mockReturnValue(fakeAdmin({ existingError: true }).admin);
    expect((await sendReview(review(), "ip-c")).status).toBe(500);
    createAdminClient.mockReturnValue(fakeAdmin({ insertError: true }).admin);
    const res = await sendReview(review(), "ip-d");
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/fk|boom/);
  });
  it("JSON invalide et corps de plus de 6 000 caractères → 400", async () => {
    expect((await sendReview("{oops", "ip-e")).status).toBe(400);
    expect((await sendReview(JSON.stringify(review({ pad: "x".repeat(7000) })), "ip-f")).status).toBe(400);
  });
  it("limite : la 7e requête d'une même IP reçoit 429", async () => {
    let last = 0;
    for (let i = 0; i < 7; i++) last = (await sendReview(review({ rating: 0 }), "ip-g")).status;
    expect(last).toBe(429);
  });
  // BUG QA-9 (MOYEN, base) : l'unicité « 1 avis par client et par produit » n'est garantie que par un SELECT puis un INSERT
  // (course : deux envois simultanés / double-tap passent tous les deux). Aucun index unique sur reviews(product_id, user_id).
  // Fix SQL : create unique index reviews_one_per_user on public.reviews(product_id, user_id) where user_id is not null;
  // puis traiter l'erreur 23505 comme already_reviewed. Voir tests/qa-schema-static.test.ts.
  it("(caractérisation de la course) deux envois simultanés insèrent deux avis", async () => {
    loggedIn();
    const f = fakeAdmin({ profile: { first_name: "Afi", last_name: "H" }, existing: [] });
    createAdminClient.mockReturnValue(f.admin);
    const [a, b] = await Promise.all([sendReview(review(), "ip-h"), sendReview(review(), "ip-h2")]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(f.inserts).toHaveLength(2);
  });
});
