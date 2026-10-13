// Discussion : routes publiques (contact → conversation, réponse par lien privé, « Mes demandes ») et page /discussion/{jeton}.
// Supabase, session, catalogue et e-mail simulés (aucun réseau). vi.resetModules() : les limiteurs sont globaux au module.
import { createElement, type ComponentType, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { NextIntlClientProvider, createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import frConv from "@/messages/fr/conversations.json";
import frAccount from "@/messages/fr/account.json";
import { generateToken, hashToken } from "@/lib/conversations/token";

const admin = vi.hoisted(() => ({ create: vi.fn() }));
const userMod = vi.hoisted(() => ({ getSessionContext: vi.fn(), getCurrentUser: vi.fn() }));
const catalog = vi.hoisted(() => ({ getSettings: vi.fn() }));
const resend = vi.hoisted(() => ({ sendViaResend: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin.create() }));
vi.mock("@/lib/auth/user", () => userMod);
vi.mock("@/lib/catalog", () => catalog);
vi.mock("@/lib/email/resend", () => resend);
vi.mock("next/server", () => ({ after: () => { throw new Error("hors requête"); }, connection: async () => {} }));
vi.mock("next-intl/server", () => ({
  setRequestLocale: () => {},
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) =>
    createTranslator({ locale, messages: { ...frConv, ...frAccount } as never, namespace: namespace as never }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children?: unknown }) => createElement("a", { href }, children as never),
}));

// ───────────── Faux client Supabase : enregistre les appels, ignore volontairement les filtres (teste nos doubles gardes) ─────────────
type Tables = { links?: Record<string, unknown> | null; conv?: Record<string, unknown> | null; msgs?: Record<string, unknown>[] };
function fakeDb(t: Tables, rpcImpl?: (fn: string, args: Record<string, unknown>) => unknown) {
  const calls: { table: string; op: string; args: unknown[] }[] = [];
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => ({ data: rpcImpl ? rpcImpl(fn, args) : null, error: null }));
  const from = (table: string) => {
    const result = () => {
      if (table === "conversation_links") return { data: t.links ?? null, error: null };
      if (table === "conversations") return { data: t.conv ?? null, error: null };
      return { data: t.msgs ?? [], error: null };
    };
    const b: Record<string, unknown> = {};
    for (const op of ["select", "eq", "in", "order", "limit", "update", "insert", "neq"]) {
      b[op] = (...args: unknown[]) => {
        calls.push({ table, op, args });
        return b;
      };
    }
    b.maybeSingle = async () => result();
    b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(Array.isArray(t.msgs) && table === "conversation_messages" ? result() : { data: null, error: null }).then(res, rej);
    return b;
  };
  return { db: { from, rpc, auth: { admin: { getUserById: async () => ({ data: { user: { email: "compte@x.bj" } } }) } } }, calls, rpc };
}

const CONV_ID = "44444444-4444-4444-8444-444444444444";
const conv = { id: CONV_ID, subject: "Colis abîmé", category: "plainte", status: "en_cours", order_number: "WX-10300", created_at: "2026-10-12T10:00:00Z", locale: "fr", customer_name: "Afi H", customer_contact: "afi@x.bj", user_id: null, source: "contact" };
const msgs = [
  { id: "m1", author: "client", body: "MESSAGE-CLIENT mon colis est abîmé", created_at: "2026-10-12T10:00:00Z" },
  { id: "m2", author: "note_interne", body: "NOTE-SECRETE client à surveiller", created_at: "2026-10-12T10:05:00Z" },
  { id: "m3", author: "equipe", body: "REPONSE-EQUIPE nous regardons", created_at: "2026-10-12T10:10:00Z" },
];

const old = () => Date.now() - 30_000;
let ipSeq = 0;
const req = (url: string, body?: unknown, method = "POST") =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json", "x-forwarded-for": `10.9.0.${++ipSeq}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
async function call(mod: string, name: "POST" | "GET", request: Request, ctx?: unknown) {
  const m = (await import(mod)) as Record<string, (r: Request, c?: unknown) => Promise<Response>>;
  const res = await m[name](request, ctx);
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

beforeEach(() => {
  vi.resetModules();
  admin.create.mockReset();
  userMod.getSessionContext.mockReset();
  userMod.getSessionContext.mockResolvedValue(null);
  catalog.getSettings.mockReset();
  catalog.getSettings.mockResolvedValue({ brand: { shopName: "Wá xɔ", whatsapp: "+229 01 00 00 00 00", waNumber: "2290100000000", email: "contact@waxo.boutique", hours: "" } });
  resend.sendViaResend.mockReset();
  resend.sendViaResend.mockResolvedValue({ ok: true, id: "r1" });
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.waxo.boutique");
  vi.stubEnv("ORDER_NOTIFY_EMAIL", "");
});
afterEach(() => vi.unstubAllEnvs());

// ───────────────────────── Création ─────────────────────────
describe("création d'une conversation (POST /api/contact)", () => {
  const valid = () => ({ name: "Afi Houngbédji", contact: "afi@x.bj", category: "plainte", body: "Mon colis est arrivé abîmé, que faire ?", website: "", t: old() });

  it("contact : accusé de réception au client AVEC lien privé dont seul le hash est en base ; alerte équipe en extrait", async () => {
    const f = fakeDb({}, () => CONV_ID);
    admin.create.mockReturnValue(f.db);
    const r = await call("@/app/api/contact/route", "POST", req("/api/contact", { ...valid(), body: `${"Long détail de la plainte. ".repeat(20)}FIN-DU-MESSAGE` }));
    expect(r.status).toBe(200);
    const token = String(r.json.path).split("/").pop()!;
    expect(f.rpc.mock.calls[0][1].p_token_hash).toBe(hashToken(token));
    expect(JSON.stringify(f.rpc.mock.calls)).not.toContain(token);
    const mails = resend.sendViaResend.mock.calls.map((c) => c[0] as { to: string; html: string; text: string; subject: string });
    const client = mails.find((m) => m.to === "afi@x.bj")!;
    expect(client.subject).toBe("Nous avons bien reçu votre demande");
    expect(client.html).toContain(`https://www.waxo.boutique/fr/discussion/${token}`);
    const team = mails.find((m) => m.to === "contact@waxo.boutique")!;
    expect(team.subject).toMatch(/^Nouvelle demande · Plainte/);
    expect(team.text).not.toContain("FIN-DU-MESSAGE"); // extrait seulement
    expect(team.text).not.toContain("afi@x.bj"); // aucune coordonnée
    expect(team.text).not.toContain("Houngbédji");
  });

  it("escalade de l'assistant : source « assistant », résumé dans le 1er message, client connecté rattaché (e-mail du compte)", async () => {
    const f = fakeDb({}, () => CONV_ID);
    admin.create.mockReturnValue(f.db);
    userMod.getSessionContext.mockResolvedValue({ userId: "55555555-5555-4555-8555-555555555555", email: "compte@x.bj" });
    const r = await call("@/app/api/contact/route", "POST", req("/api/contact", { ...valid(), contact: "0197000000", category: "retour", source: "assistant", lang: "en", body: "I want a refund\nMy order never came" }));
    expect(r.status).toBe(200);
    expect(r.json.path).toMatch(/^\/en\/discussion\//);
    expect(f.rpc.mock.calls[0][1]).toMatchObject({ p_source: "assistant", p_category: "retour", p_locale: "en", p_user_id: "55555555-5555-4555-8555-555555555555", p_body: "I want a refund\nMy order never came" });
    const client = resend.sendViaResend.mock.calls.map((c) => c[0]).find((m) => m.to === "compte@x.bj");
    expect(client?.subject).toBe("We've received your request");
  });

  it("Turnstile configuré : jeton absent → 403, rien n'est créé", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "s");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "k");
    const f = fakeDb({}, () => CONV_ID);
    admin.create.mockReturnValue(f.db);
    const r = await call("@/app/api/contact/route", "POST", req("/api/contact", valid()));
    expect(r).toMatchObject({ status: 403, json: { code: "captcha" } });
    expect(f.rpc).not.toHaveBeenCalled();
  });
});

// ───────────────────────── Réponse par lien privé ─────────────────────────
describe("réponse du client par lien privé (POST /api/conversations/reply)", () => {
  const token = generateToken();
  const send = (b: Record<string, unknown>) => call("@/app/api/conversations/reply/route", "POST", req("/api/conversations/reply", { website: "", t: old(), ...b }));

  it("jeton mal formé ou inconnu : même 404 neutre ; mal formé = aucune requête en base", async () => {
    const f = fakeDb({ links: null });
    admin.create.mockReturnValue(f.db);
    const bad = await send({ token: "pas-un-jeton", body: "Bonjour" });
    expect(f.calls).toEqual([]);
    const unknown = await send({ token: generateToken(), body: "Bonjour" });
    expect(bad).toEqual(unknown);
    expect(bad).toMatchObject({ status: 404, json: { ok: false, code: "notFound" } });
  });

  it("recherche par EMPREINTE (jamais par jeton) ; une empreinte relue différente est refusée", async () => {
    const f = fakeDb({ links: { token_hash: hashToken(generateToken()), conversation_id: CONV_ID } });
    admin.create.mockReturnValue(f.db);
    const r = await send({ token, body: "Bonjour" });
    expect(r.status).toBe(404);
    expect(f.calls.find((c) => c.op === "eq")?.args).toEqual(["token_hash", hashToken(token)]);
    expect(JSON.stringify(f.calls)).not.toContain(token);
  });

  it("jeton valide : message ajouté comme « client » ; alerte équipe si la conversation était lue", async () => {
    const f = fakeDb({ links: { token_hash: hashToken(token), conversation_id: CONV_ID }, conv }, (fn) =>
      fn === "conversation_post" ? [{ message_id: "66666666-6666-4666-8666-666666666666", was_unread_admin: false, new_status: "en_cours" }] : null,
    );
    admin.create.mockReturnValue(f.db);
    const r = await send({ token, body: "Merci, j'attends votre retour." });
    expect(r).toMatchObject({ status: 200, json: { ok: true, status: "en_cours" } });
    expect(f.rpc).toHaveBeenCalledWith("conversation_post", { p_conversation: CONV_ID, p_author: "client", p_body: "Merci, j'attends votre retour.", p_admin: null });
    const team = resend.sendViaResend.mock.calls.map((c) => c[0]).find((m) => m.to === "contact@waxo.boutique");
    expect(team?.subject).toMatch(/^Réponse d'un client/);
  });

  it("honeypot : faux succès sans écriture ; trop rapide → 429 ; message vide → 422", async () => {
    const f = fakeDb({ links: { token_hash: hashToken(token), conversation_id: CONV_ID } });
    admin.create.mockReturnValue(f.db);
    expect(await send({ token, body: "Bonjour", website: "x" })).toMatchObject({ status: 200, json: { ok: true } });
    expect((await send({ token, body: "Bonjour", t: Date.now() })).status).toBe(429);
    expect((await send({ token, body: " " })).status).toBe(422);
    expect(f.rpc).not.toHaveBeenCalled();
  });
});

// ───────────────────────── Mes demandes ─────────────────────────
describe("« Mes demandes » (client connecté)", () => {
  const ctx = { params: Promise.resolve({ id: CONV_ID }) };
  it("sans session → 401 (liste, fil, réponse)", async () => {
    expect((await call("@/app/api/conversations/mine/route", "GET", req("/api/conversations/mine", undefined, "GET"))).status).toBe(401);
    expect((await call("@/app/api/conversations/mine/[id]/route", "GET", req("/x", undefined, "GET"), ctx)).status).toBe(401);
    expect((await call("@/app/api/conversations/mine/[id]/route", "POST", req("/x", { body: "Bonjour" }), ctx)).status).toBe(401);
  });

  it("fil : filtré par propriétaire, notes internes JAMAIS renvoyées (même si la base en renvoyait)", async () => {
    const own = fakeDb({ conv, msgs });
    userMod.getSessionContext.mockResolvedValue({ sb: own.db, userId: "u-1", email: "a@x.bj" });
    admin.create.mockReturnValue(fakeDb({}).db);
    const r = await call("@/app/api/conversations/mine/[id]/route", "GET", req("/x", undefined, "GET"), ctx);
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.json)).not.toContain("NOTE-SECRETE");
    expect(JSON.stringify(r.json)).not.toContain("afi@x.bj");
    expect(own.calls).toContainEqual({ table: "conversations", op: "eq", args: ["user_id", "u-1"] });
    expect(own.calls).toContainEqual({ table: "conversation_messages", op: "in", args: ["author", ["client", "equipe"]] });
  });

  it("réponse sur la conversation d'un autre (RLS : rien) → 404, aucune écriture", async () => {
    const own = fakeDb({ conv: null });
    const adminDb = fakeDb({});
    userMod.getSessionContext.mockResolvedValue({ sb: own.db, userId: "u-2", email: "b@x.bj" });
    admin.create.mockReturnValue(adminDb.db);
    const r = await call("@/app/api/conversations/mine/[id]/route", "POST", req("/x", { body: "Je réponds" }), ctx);
    expect(r.status).toBe(404);
    expect(adminDb.rpc).not.toHaveBeenCalled();
  });
});

// ───────────────────────── Page /discussion/{jeton} ─────────────────────────
const Provider = NextIntlClientProvider as unknown as ComponentType<{ locale: string; messages: Record<string, unknown>; onError: () => void; children?: ReactNode }>;

describe("page /[lang]/discussion/[token]", () => {
  const page = async (token: string) => {
    const mod = await import("@/app/[lang]/(shop)/discussion/[token]/page");
    return mod.default({ params: Promise.resolve({ lang: "fr", token }) }) as Promise<ReactElement>;
  };

  it("jeton mal formé ou inconnu → 404 neutre (notFound)", async () => {
    admin.create.mockReturnValue(fakeDb({ links: null }).db);
    await expect(page("court")).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(page(generateToken())).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("jeton valide : fil affiché, note interne absente, aucune coordonnée ; noindex + no-referrer", async () => {
    const token = generateToken();
    admin.create.mockReturnValue(fakeDb({ links: { token_hash: hashToken(token), conversation_id: CONV_ID }, conv, msgs }).db);
    const el = await page(token);
    const html = renderToString(createElement(Provider, { locale: "fr", messages: { ...frConv, ...frAccount }, onError: () => {} }, el));
    expect(html).toContain("MESSAGE-CLIENT");
    expect(html).toContain("REPONSE-EQUIPE");
    expect(html).not.toContain("NOTE-SECRETE");
    expect(html).not.toContain("afi@x.bj");
    const mod = await import("@/app/[lang]/(shop)/discussion/[token]/page");
    const meta = await mod.generateMetadata({ params: Promise.resolve({ lang: "fr", token }) });
    expect(meta).toMatchObject({ robots: { index: false, follow: false }, referrer: "no-referrer" });
    expect(JSON.stringify(meta)).not.toContain(token);
  });
});
