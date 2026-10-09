import { beforeEach, describe, expect, it, vi } from "vitest";
import { matchTrack, TRACK_NOT_FOUND, type TrackRow } from "@/lib/auth/track";

const row: TrackRow = {
  number: "WX-10258",
  status: "livraison",
  created_at: "2026-10-06T19:05:00Z",
  total: 12400,
  phone: "0197112233",
  email: "Afi@Exemple.bj",
  order_items: [
    { name: "Lampe LED rechargeable", qty: 1, unit_price: 8900 },
    { name: "Organisateur de câbles (x10)", qty: 1, unit_price: 2500 },
  ],
};

describe("matchTrack (anti-énumération)", () => {
  it("renvoie la vue minimale quand le téléphone correspond (formats libres)", () => {
    expect(matchTrack(row, "+229 01 97 11 22 33")).toEqual({
      number: "WX-10258",
      status: "livraison",
      createdAt: "2026-10-06T19:05:00Z",
      total: 12400,
      items: [
        { name: "Lampe LED rechargeable", qty: 1, unitPrice: 8900 },
        { name: "Organisateur de câbles (x10)", qty: 1, unitPrice: 2500 },
      ],
    });
  });
  it("accepte l'e-mail sans tenir compte de la casse", () => {
    expect(matchTrack(row, "afi@exemple.bj")?.number).toBe("WX-10258");
  });
  it("ne divulgue ni téléphone, ni e-mail, ni adresse", () => {
    const view = matchTrack(row, "0197112233");
    const json = JSON.stringify(view);
    expect(json).not.toContain("0197112233");
    expect(json.toLowerCase()).not.toContain("exemple.bj");
    expect(Object.keys(view ?? {}).sort()).toEqual(["createdAt", "items", "number", "status", "total"]);
  });
  it("renvoie null pour une commande inconnue, un mauvais téléphone ou un mauvais e-mail", () => {
    expect(matchTrack(null, "0197112233")).toBeNull();
    expect(matchTrack(row, "0197000000")).toBeNull();
    expect(matchTrack(row, "autre@exemple.bj")).toBeNull();
    expect(matchTrack(row, "nimporte quoi")).toBeNull();
  });
  it("une commande sans e-mail ne se suit pas par e-mail", () => {
    expect(matchTrack({ ...row, email: null }, "afi@exemple.bj")).toBeNull();
  });
});

// ───────────── Route /api/orders/track : mêmes réponses pour « inconnu » et « contact erroné » ─────────────
const maybeSingle = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) }),
}));

async function call(body: Record<string, unknown>) {
  const { POST } = await import("@/app/api/orders/track/route");
  const res = await POST(
    new Request("http://localhost/api/orders/track", { method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": "9.9.9.9" } }),
  );
  return { status: res.status, body: await res.json() };
}

describe("POST /api/orders/track", () => {
  beforeEach(() => {
    vi.resetModules();
    maybeSingle.mockReset();
  });
  const t = () => Date.now() - 10_000;

  it("renvoie la commande quand numéro et contact correspondent", async () => {
    maybeSingle.mockResolvedValue({ data: row, error: null });
    const r = await call({ number: "wx-10258", contact: "0197112233", t: t() });
    expect(r.status).toBe(200);
    expect(r.body.order.number).toBe("WX-10258");
  });

  it("répond IDENTIQUEMENT pour un numéro inconnu et pour un contact erroné", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const unknown = await call({ number: "WX-99999", contact: "0197112233", t: t() });
    maybeSingle.mockResolvedValueOnce({ data: row, error: null });
    const wrong = await call({ number: "WX-10258", contact: "0100000000", t: t() });
    expect(unknown.status).toBe(404);
    expect(wrong).toEqual(unknown);
    expect(unknown.body).toEqual(TRACK_NOT_FOUND);
  });

  it("refuse un envoi trop rapide et traite le champ piège comme « introuvable »", async () => {
    const fast = await call({ number: "WX-10258", contact: "0197112233", t: Date.now() });
    expect(fast.status).toBe(429);
    const bot = await call({ number: "WX-10258", contact: "0197112233", t: t(), website: "x" });
    expect(bot).toEqual({ status: 404, body: TRACK_NOT_FOUND });
    expect(maybeSingle).not.toHaveBeenCalled();
  });

  it("valide l'entrée (numéro invalide → 422 sans appel base)", async () => {
    const r = await call({ number: "pas-un-numero", contact: "0197112233", t: t() });
    expect(r.status).toBe(422);
    expect(maybeSingle).not.toHaveBeenCalled();
  });
});
