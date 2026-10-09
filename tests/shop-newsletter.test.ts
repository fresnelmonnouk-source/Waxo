import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_FILL_MS, isTooFast, newsletterSchema, normPhone, storedValue, validEmail, validPhone } from "@/components/shop/newsletter-schema";

describe("validation e-mail et WhatsApp", () => {
  it("normalise les numéros béninois", () => {
    expect(normPhone("+229 01 97 00 00 00")).toBe("0197000000");
    expect(normPhone("0197 00 00 00")).toBe("0197000000");
    expect(normPhone("229 0197000000")).toBe("0197000000");
  });
  it("numéro valide : 10 chiffres commençant par 01", () => {
    expect(validPhone("01 97 00 00 00")).toBe(true);
    expect(validPhone("+229 01 97 00 00 00")).toBe(true);
    expect(validPhone("0297000000")).toBe(false);
    expect(validPhone("019700000")).toBe(false);
    expect(validPhone("01970000000")).toBe(false);
    expect(validPhone("")).toBe(false);
  });
  it("e-mail valide ou non", () => {
    expect(validEmail("a@b.co")).toBe(true);
    expect(validEmail(" a@b.co ")).toBe(true);
    expect(validEmail("a@b")).toBe(false);
    expect(validEmail("a b@c.com")).toBe(false);
    expect(validEmail("@c.com")).toBe(false);
    expect(validEmail("a@" + "b".repeat(200) + ".com")).toBe(false);
  });
});

describe("schéma de la newsletter", () => {
  it("accepte un e-mail et un numéro", () => {
    expect(newsletterSchema.safeParse({ channel: "email", value: "x@y.fr", t: 1 }).success).toBe(true);
    expect(newsletterSchema.safeParse({ channel: "whatsapp", value: "0197000000", website: "" }).success).toBe(true);
  });
  it("refuse canal inconnu, valeur incohérente avec le canal et champs inconnus", () => {
    expect(newsletterSchema.safeParse({ channel: "sms", value: "0197000000" }).success).toBe(false);
    expect(newsletterSchema.safeParse({ channel: "email", value: "0197000000" }).success).toBe(false);
    expect(newsletterSchema.safeParse({ channel: "whatsapp", value: "x@y.fr" }).success).toBe(false);
    expect(newsletterSchema.safeParse({ channel: "email", value: "x@y.fr", role: "admin" }).success).toBe(false);
  });
  it("borne les longueurs", () => {
    expect(newsletterSchema.safeParse({ channel: "email", value: "a".repeat(300) + "@b.co" }).success).toBe(false);
    expect(newsletterSchema.safeParse({ channel: "email", value: "x@y.fr", website: "w".repeat(500) }).success).toBe(false);
  });
  it("valeur enregistrée : e-mail en minuscules, numéro sur 10 chiffres", () => {
    expect(storedValue({ channel: "email", value: " Jean@Mail.COM " })).toBe("jean@mail.com");
    expect(storedValue({ channel: "whatsapp", value: "+229 01 97 00 00 00" })).toBe("0197000000");
  });
});

describe("délai minimal anti-robot", () => {
  it("rejette sans horodatage, trop rapide, ou horodatage forgé dans le futur", () => {
    const now = 1_000_000;
    expect(isTooFast(undefined, now)).toBe(true);
    expect(isTooFast(now - (MIN_FILL_MS - 1), now)).toBe(true);
    expect(isTooFast(now + 60_000, now)).toBe(true);
    expect(isTooFast(Number.NaN, now)).toBe(true);
  });
  it("accepte à partir de 2,5 s", () => {
    const now = 1_000_000;
    expect(isTooFast(now - MIN_FILL_MS, now)).toBe(false);
    expect(isTooFast(now - 60_000, now)).toBe(false);
  });
});

describe("POST /api/newsletter (sans Supabase configuré)", () => {
  const OLD = { ...process.env };
  beforeEach(() => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });
  afterEach(() => {
    process.env = { ...OLD };
  });

  const call = async (body: unknown, ip = "1.1.1.1") => {
    const { POST } = await import("@/app/api/newsletter/route");
    const res = await POST(
      new Request("http://localhost/api/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    );
    return { status: res.status, json: (await res.json()) as { ok: boolean; error?: string } };
  };
  const old = () => Date.now() - 60_000;

  it("JSON invalide → 400", async () => {
    expect((await call("{pas du json")).status).toBe(400);
  });
  it("corps trop gros → 413", async () => {
    expect((await call("x".repeat(3000))).status).toBe(413);
  });
  it("données invalides → 400 sans détail", async () => {
    const r = await call({ channel: "email", value: "pas-un-email", t: old() });
    expect(r.status).toBe(400);
    expect(r.json).toEqual({ ok: false, error: "invalid" });
  });
  it("honeypot rempli → faux succès, rien d'écrit", async () => {
    const r = await call({ channel: "email", value: "bot@spam.com", website: "http://spam", t: old() });
    expect(r).toEqual({ status: 200, json: { ok: true } });
  });
  it("trop rapide → 429", async () => {
    const r = await call({ channel: "email", value: "a@b.co", t: Date.now() });
    expect(r.status).toBe(429);
    expect(r.json.error).toBe("too_fast");
  });
  it("valide mais Supabase absent → 503 propre", async () => {
    const r = await call({ channel: "email", value: "a@b.co", t: old() });
    expect(r.status).toBe(503);
    expect(r.json).toEqual({ ok: false, error: "unavailable" });
  });
  it("limite par adresse IP → 429", async () => {
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await call({ channel: "email", value: "a@b.co", t: old() }, "9.9.9.9")).status;
    expect(last).toBe(429);
  });
});
