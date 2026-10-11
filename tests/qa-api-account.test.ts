// QA (Nadia) — routes compte / contact / suivi / newsletter / catalogue : chemins négatifs, anti-énumération, colonnes protégées.
// Supabase, session et catalogue sont simulés (aucun réseau). Les modules de route ont des limiteurs globaux : vi.resetModules() à chaque test.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signRecovery } from "@/lib/auth/recovery";

const admin = vi.hoisted(() => ({ create: vi.fn() }));
const env = vi.hoisted(() => ({ get: vi.fn() }));
const session = vi.hoisted(() => ({ create: vi.fn() }));
const pub = vi.hoisted(() => ({ create: vi.fn() }));
const identify = vi.hoisted(() => ({ resolveEmail: vi.fn() }));
const userMod = vi.hoisted(() => ({ getSessionContext: vi.fn(), getCurrentUser: vi.fn() }));
const cookieStore = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
const catalog = vi.hoisted(() => ({ getProductsByIds: vi.fn(), getProducts: vi.fn(), getSettings: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin.create() }));
vi.mock("@/lib/supabase/env", () => ({ supabasePublicEnv: () => env.get() }));
vi.mock("@/lib/supabase/server", () => ({ createSessionClient: () => session.create() }));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => pub.create() }));
vi.mock("@/lib/auth/identify", () => identify);
vi.mock("@/lib/auth/user", () => userMod);
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("@/lib/catalog", () => catalog);

const old = () => Date.now() - 30_000;
let ipSeq = 0;
const req = (url: string, body?: unknown, method = "POST", ip = `10.0.0.${++ipSeq}`) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
type Handler = (r: Request, ctx?: never) => Promise<Response>;
async function call(mod: string, name: "POST" | "GET" | "PATCH", request: Request) {
  const m = (await import(mod)) as Record<string, Handler>;
  const res = await m[name](request);
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, headers: res.headers };
}

beforeEach(() => {
  vi.resetModules();
  for (const m of [admin.create, env.get, session.create, pub.create, identify.resolveEmail, userMod.getSessionContext, userMod.getCurrentUser, cookieStore.get, cookieStore.set, catalog.getProductsByIds, catalog.getProducts, catalog.getSettings]) m.mockReset();
  env.get.mockReturnValue({ url: "u", key: "k" });
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

// ───────────────────────── Contact ─────────────────────────
describe("POST /api/contact", () => {
  const valid = () => ({ name: "Afi H", contact: "Afi@Exemple.BJ", subject: "order", orderNumber: "wx 10258", body: "Ma commande n'est pas arrivée.", website: "", t: old() });
  const insert = vi.fn();
  beforeEach(() => {
    insert.mockReset();
    insert.mockResolvedValue({ error: null });
    admin.create.mockReturnValue({ from: () => ({ insert }) });
  });
  const send = (b: unknown, ip?: string) => call("@/app/api/contact/route", "POST", req("/api/contact", b, "POST", ip));

  it("enregistre un message normalisé : e-mail en minuscules, libellé FR du sujet, numéro WX-… normalisé", async () => {
    const r = await send(valid());
    expect(r.status).toBe(200);
    expect(insert).toHaveBeenCalledWith({ name: "Afi H", contact: "afi@exemple.bj", subject: "Commande", order_number: "WX-10258", body: "Ma commande n'est pas arrivée." });
  });
  it("contact téléphone : normalisé sur 10 chiffres", async () => {
    await send({ ...valid(), contact: "+229 01 97 11 22 33", orderNumber: "" });
    expect(insert.mock.calls[0][0]).toMatchObject({ contact: "0197112233", order_number: null });
  });
  it("honeypot : faux succès, rien d'écrit", async () => {
    const r = await send({ ...valid(), website: "http://spam" });
    expect(r).toMatchObject({ status: 200, json: { ok: true } });
    expect(insert).not.toHaveBeenCalled();
  });
  it("envoi trop rapide et horodatage absent → 429", async () => {
    expect((await send({ ...valid(), t: Date.now() })).status).toBe(429);
    const { t: _t, ...noT } = valid();
    void _t;
    expect((await send(noT)).status).toBe(429);
  });
  it.each([
    ["message de 9 caractères", { body: "123456789" }],
    ["message de 3001 caractères", { body: "x".repeat(3001) }],
    ["sujet inconnu", { subject: "hack" }],
    ["contact ni e-mail ni téléphone", { contact: "pas valable" }],
    ["numéro de commande farfelu", { orderNumber: "ABC" }],
    ["nom d'une lettre", { name: "A" }],
  ])("%s → 422 avec le champ fautif, rien d'écrit", async (_n, over) => {
    const r = await send({ ...valid(), ...over });
    expect(r.status).toBe(422);
    expect(Object.keys((r.json?.fields as object) ?? {}).length).toBeGreaterThan(0);
    expect(insert).not.toHaveBeenCalled();
  });
  it("corps non-JSON, tableau ou de plus de 12 000 caractères → 400", async () => {
    expect((await send("{oops")).status).toBe(400);
    expect((await send("[]")).status).toBe(400);
    expect((await send({ ...valid(), pad: "x".repeat(13_000) })).status).toBe(400);
  });
  it("base en erreur ou Supabase absent → 503 sans détail", async () => {
    insert.mockResolvedValue({ error: { message: "relation messages secret" } });
    const r = await send(valid());
    expect(r.status).toBe(503);
    expect(JSON.stringify(r.json)).not.toContain("secret");
    admin.create.mockImplementation(() => {
      throw new Error("non configuré");
    });
    expect((await send(valid())).status).toBe(503);
  });
  it("la 6e requête d'une même IP reçoit 429", async () => {
    let last = 0;
    for (let i = 0; i < 6; i++) last = (await send({ ...valid(), body: "court" }, "5.5.5.5")).status;
    expect(last).toBe(429);
  });
});

// ───────────────────────── Inscription ─────────────────────────
describe("POST /api/auth/signup", () => {
  const valid = () => ({ firstName: "Afi", lastName: "Houngbédji", phone: "+229 01 97 00 00 00", email: "Afi@Exemple.bj", password: "motdepasse1", cgu: true, news: false, lang: "fr", website: "", t: old() });
  const signUp = vi.fn();
  const adminCalls: string[] = [];
  beforeEach(() => {
    signUp.mockReset();
    adminCalls.length = 0;
    session.create.mockResolvedValue({ auth: { signUp } });
    admin.create.mockReturnValue({
      from: (t: string) => ({
        update: () => ({ eq: async () => void adminCalls.push(`${t}.update`) }),
        upsert: async () => void adminCalls.push(`${t}.upsert`),
      }),
    });
  });
  const send = (b: unknown) => call("@/app/api/auth/signup/route", "POST", req("/api/auth/signup", b));

  it("succès : confirmation e-mail attendue ; métadonnées normalisées ; le rôle n'est jamais transmis", async () => {
    signUp.mockResolvedValue({ data: { user: { id: "u1", identities: [{}] }, session: null }, error: null });
    const r = await send({ ...valid(), role: "admin", data: { role: "admin" } });
    expect(r).toMatchObject({ status: 200, json: { ok: true, status: "confirm" } });
    const arg = signUp.mock.calls[0][0];
    expect(arg.email).toBe("afi@exemple.bj");
    expect(arg.options.data).toEqual({ first_name: "Afi", last_name: "Houngbédji", phone: "0197000000", locale: "fr" }); // locale = langue des e-mails de compte
    expect(JSON.stringify(arg)).not.toContain("admin");
    expect(arg.options.emailRedirectTo).toMatch(/\/api\/auth\/callback\/fr\/signup$/);
  });
  it("ANTI-ÉNUMÉRATION : e-mail déjà inscrit (erreur OU faux utilisateur sans identité) = même réponse que le succès", async () => {
    signUp.mockResolvedValueOnce({ data: { user: { id: "u1", identities: [{}] }, session: null }, error: null });
    const fresh = await send(valid());
    signUp.mockResolvedValueOnce({ data: { user: null, session: null }, error: { code: "user_already_exists", status: 422 } });
    const dupError = await send(valid());
    signUp.mockResolvedValueOnce({ data: { user: { id: "ghost", identities: [] }, session: null }, error: null });
    const dupFake = await send(valid());
    expect(dupError).toEqual(expect.objectContaining({ status: fresh.status, json: fresh.json }));
    expect(dupFake).toEqual(expect.objectContaining({ status: fresh.status, json: fresh.json }));
  });
  it("préférence newsletter écrite SEULEMENT pour un compte réellement créé, jamais pour un e-mail existant", async () => {
    signUp.mockResolvedValue({ data: { user: { id: "ghost", identities: [] }, session: null }, error: null });
    await send({ ...valid(), news: true });
    expect(adminCalls).toEqual([]);
    signUp.mockResolvedValue({ data: { user: { id: "u2", identities: [{}] }, session: null }, error: null });
    await send({ ...valid(), news: true });
    expect(adminCalls).toEqual(["profiles.update", "newsletter_subs.upsert"]);
  });
  it("échec d'écriture de la préférence newsletter : l'inscription réussit quand même", async () => {
    signUp.mockResolvedValue({ data: { user: { id: "u2", identities: [{}] }, session: null }, error: null });
    admin.create.mockImplementation(() => {
      throw new Error("service_role absent");
    });
    expect((await send({ ...valid(), news: true })).status).toBe(200);
  });
  it.each([
    ["mot de passe de 7 caractères", { password: "1234567" }],
    ["mot de passe de 73 caractères", { password: "x".repeat(73) }],
    ["CGU non acceptées", { cgu: false }],
    ["CGU absentes", { cgu: undefined }],
    ["téléphone invalide", { phone: "12345" }],
    ["e-mail invalide", { email: "afi@" }],
    ["prénom d'une lettre", { firstName: "A" }],
  ])("%s → 422 sans appel à Supabase", async (_n, over) => {
    const r = await send({ ...valid(), ...over });
    expect(r.status).toBe(422);
    expect(signUp).not.toHaveBeenCalled();
  });
  it("mot de passe jugé faible par Supabase → 422 passWeak ; limite d'envoi e-mail → 429 ; panne → 503", async () => {
    signUp.mockResolvedValueOnce({ data: {}, error: { code: "weak_password", status: 422 } });
    expect((await send(valid())).json).toMatchObject({ fields: { password: "passWeak" } });
    signUp.mockResolvedValueOnce({ data: {}, error: { code: "over_email_send_rate_limit", status: 429 } });
    expect((await send(valid())).status).toBe(429);
    signUp.mockResolvedValueOnce({ data: {}, error: { code: "unexpected", status: 503 } });
    expect((await send(valid())).status).toBe(503);
  });
  it("Supabase non configuré → 503 ; session qui plante → 503, jamais de 500", async () => {
    env.get.mockReturnValue(null);
    expect((await send(valid())).status).toBe(503);
    env.get.mockReturnValue({ url: "u", key: "k" });
    session.create.mockRejectedValue(new Error("boom"));
    expect((await send(valid())).status).toBe(503);
  });
  it("honeypot → faux succès sans appel ; trop rapide → 429", async () => {
    expect((await send({ ...valid(), website: "x" })).json).toMatchObject({ ok: true });
    expect((await send({ ...valid(), t: Date.now() })).status).toBe(429);
    expect(signUp).not.toHaveBeenCalled();
  });
});

// ───────────────────────── Connexion / mot de passe oublié ─────────────────────────
describe("POST /api/auth/login", () => {
  const signIn = vi.fn();
  beforeEach(() => {
    signIn.mockReset();
    session.create.mockResolvedValue({ auth: { signInWithPassword: signIn } });
  });
  const send = (b: unknown) => call("@/app/api/auth/login/route", "POST", req("/api/auth/login", b));

  it("ANTI-ÉNUMÉRATION : compte inconnu et mot de passe faux donnent EXACTEMENT la même réponse", async () => {
    identify.resolveEmail.mockResolvedValueOnce(null);
    const unknown = await send({ id: "inconnu@exemple.bj", password: "motdepasse1" });
    identify.resolveEmail.mockResolvedValueOnce("afi@exemple.bj");
    signIn.mockResolvedValueOnce({ error: { code: "invalid_credentials", status: 400, name: "AuthApiError" } });
    const wrong = await send({ id: "afi@exemple.bj", password: "mauvais-mdp" });
    expect(unknown.status).toBe(401);
    expect({ status: wrong.status, json: wrong.json }).toEqual({ status: unknown.status, json: unknown.json });
  });
  it("e-mail non confirmé → 403 emailNotConfirmed ; panne Supabase → 503 (pas pris pour un mauvais mot de passe)", async () => {
    identify.resolveEmail.mockResolvedValue("afi@exemple.bj");
    signIn.mockResolvedValueOnce({ error: { code: "email_not_confirmed", status: 400 } });
    expect((await send({ id: "afi@exemple.bj", password: "x" })).json).toMatchObject({ code: "emailNotConfirmed" });
    signIn.mockResolvedValueOnce({ error: { status: 502, name: "AuthRetryableFetchError" } });
    expect((await send({ id: "afi@exemple.bj", password: "x" })).status).toBe(503);
  });
  it("succès → ok ; identifiant ou mot de passe vide → 422 sans appel", async () => {
    identify.resolveEmail.mockResolvedValue("afi@exemple.bj");
    signIn.mockResolvedValue({ error: null });
    expect((await send({ id: "afi@exemple.bj", password: "motdepasse1" })).json).toEqual({ ok: true });
    signIn.mockClear();
    expect((await send({ id: "", password: "x" })).status).toBe(422);
    expect((await send({ id: "a@b.co", password: "" })).status).toBe(422);
    expect(signIn).not.toHaveBeenCalled();
  });
  it("champ piège rempli → 401 générique ; Supabase absent → 503", async () => {
    expect((await send({ id: "a@b.co", password: "x", website: "bot" })).json).toMatchObject({ code: "invalidCredentials" });
    env.get.mockReturnValue(null);
    expect((await send({ id: "a@b.co", password: "x" })).status).toBe(503);
  });
  it("verrou par identifiant : la 9e tentative sur le même e-mail → 429 (même depuis une autre IP)", async () => {
    identify.resolveEmail.mockResolvedValue("v@exemple.bj");
    signIn.mockResolvedValue({ error: { code: "invalid_credentials", status: 400 } });
    let last = 0;
    for (let i = 0; i < 9; i++) last = (await send({ id: "v@exemple.bj", password: "x" + i })).status;
    expect(last).toBe(429);
  });
  // Risque QA-10 (faible) : la clé du verrou est `id.toLowerCase()` BRUTE. Pour un téléphone, « 0197000000 », « 01 97 00 00 00 »
  // et « +229 0197000000 » sont trois clés différentes : le verrou par identifiant se contourne (reste le seuil par IP : 20/10 min).
  it("QA-10 : le verrou par identifiant ignore le format de saisie d'un téléphone", async () => {
    identify.resolveEmail.mockResolvedValue("v@exemple.bj");
    signIn.mockResolvedValue({ error: { code: "invalid_credentials", status: 400 } });
    const formats = ["0197000000", "01 97 00 00 00", "+229 0197000000", "01-97-00-00-00", "01.97.00.00.00", "229 0197000000", "0197000000 ", "+229 01 97 00 00 00", " 01 97000000"];
    let last = 0;
    for (const id of formats) last = (await send({ id, password: "x" })).status;
    expect(last).toBe(429);
  });
});

describe("POST /api/auth/forgot", () => {
  const reset = vi.fn();
  beforeEach(() => {
    reset.mockReset();
    reset.mockResolvedValue({ error: null });
    session.create.mockResolvedValue({ auth: { resetPasswordForEmail: reset } });
  });
  const send = (b: unknown) => call("@/app/api/auth/forgot/route", "POST", req("/api/auth/forgot", b));
  const body = (id: string) => ({ id, website: "", t: old(), lang: "en" });

  it("ANTI-ÉNUMÉRATION : compte existant, inconnu et panne d'envoi → même réponse 200", async () => {
    identify.resolveEmail.mockResolvedValueOnce("afi@exemple.bj");
    const known = await send(body("afi@exemple.bj"));
    identify.resolveEmail.mockResolvedValueOnce(null);
    const unknown = await send(body("0197000000"));
    identify.resolveEmail.mockResolvedValueOnce("afi@exemple.bj");
    reset.mockRejectedValueOnce(new Error("smtp down"));
    const broken = await send(body("afi@exemple.bj"));
    for (const r of [known, unknown, broken]) expect({ status: r.status, json: r.json }).toEqual({ status: 200, json: { ok: true } });
    expect(reset).toHaveBeenCalledTimes(2);
    expect(reset.mock.calls[0][1].redirectTo).toMatch(/\/api\/auth\/callback\/en\/recovery$/);
  });
  it("au-delà de 3 demandes/heure pour un même identifiant : réponse neutre, plus aucun e-mail envoyé", async () => {
    identify.resolveEmail.mockResolvedValue("afi@exemple.bj");
    for (let i = 0; i < 6; i++) expect((await send(body("afi@exemple.bj"))).json).toEqual({ ok: true });
    expect(reset).toHaveBeenCalledTimes(3);
  });
  it("trop rapide → 429 ; identifiant vide → 422 ; Supabase absent → 503", async () => {
    expect((await send({ ...body("a@b.co"), t: Date.now() })).status).toBe(429);
    expect((await send(body(""))).status).toBe(422);
    env.get.mockReturnValue(null);
    expect((await send(body("a@b.co"))).status).toBe(503);
  });
});

// ───────────────────────── Retour de lien e-mail ─────────────────────────
describe("GET /api/auth/callback/[lang]/[kind]", () => {
  const exchange = vi.fn();
  beforeEach(() => {
    exchange.mockReset();
    session.create.mockResolvedValue({ auth: { exchangeCodeForSession: exchange } });
    vi.stubEnv("RECOVERY_COOKIE_SECRET", "test-recovery-secret");
  });
  afterEach(() => vi.unstubAllEnvs());
  const go = async (lang: string, kind: string, qs = "?code=abc") => {
    const m = await import("@/app/api/auth/callback/[lang]/[kind]/route");
    const res = await m.GET(new Request(`http://localhost/api/auth/callback/${lang}/${kind}${qs}`), { params: Promise.resolve({ lang, kind }) });
    return { status: res.status, location: res.headers.get("location") };
  };

  it("sans code → page de connexion avec erreur « link » (jamais de 500)", async () => {
    expect(await go("fr", "signup", "")).toEqual({ status: 303, location: "http://localhost/fr/connexion?error=link" });
  });
  it("lien expiré / déjà utilisé → connexion avec erreur", async () => {
    exchange.mockResolvedValue({ data: { user: null }, error: { message: "expired" } });
    expect((await go("en", "signup")).location).toBe("http://localhost/en/connexion?error=link");
  });
  it("échange qui plante ou ne répond jamais → même repli", async () => {
    exchange.mockRejectedValue(new Error("timeout"));
    expect((await go("fr", "signup")).location).toBe("http://localhost/fr/connexion?error=link");
  });
  it("confirmation d'inscription réussie → /compte", async () => {
    exchange.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    expect((await go("en", "signup")).location).toBe("http://localhost/en/compte");
    expect(cookieStore.set).not.toHaveBeenCalled();
  });
  it("réinitialisation réussie → cookie de récupération HttpOnly + onglet sécurité", async () => {
    exchange.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const r = await go("fr", "recovery");
    expect(r.location).toBe("http://localhost/fr/compte?tab=security&recovery=1");
    expect(cookieStore.set.mock.calls[0][2]).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/api", maxAge: 900 });
    expect(cookieStore.set.mock.calls[0][1]).toMatch(/^u1\.\d+\.[0-9a-f]{64}$/); // signé, pas l'id nu
  });
  it("réinitialisation sans secret serveur → aucun cookie posé (l'ancien mot de passe reste exigé)", async () => {
    vi.stubEnv("RECOVERY_COOKIE_SECRET", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    exchange.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    expect((await go("fr", "recovery")).location).toBe("http://localhost/fr/compte?tab=security&recovery=1");
    expect(cookieStore.set).not.toHaveBeenCalled();
  });
  it("OPEN REDIRECT : langue piégée ou `kind` inattendu → jamais de redirection hors du site", async () => {
    exchange.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    for (const lang of ["evil.com", "//evil.com", "https://evil.com", "..%2F..", "FR"]) {
      const r = await go(lang, "signup");
      expect(r.location, lang).toMatch(/^http:\/\/localhost\/fr\//);
    }
    expect((await go("fr", "https://evil.com")).location).toBe("http://localhost/fr/compte");
  });
  it("NEXT_PUBLIC_SITE_URL prime sur l'hôte de la requête (en-tête Host falsifiable)", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://waxo.bj/";
    expect((await go("fr", "signup", "")).location).toBe("https://waxo.bj/fr/connexion?error=link");
  });
});

describe("GET /api/auth/confirm (liens des e-mails de compte, token_hash)", () => {
  const verify = vi.fn();
  beforeEach(() => {
    verify.mockReset();
    session.create.mockResolvedValue({ auth: { verifyOtp: verify } });
    vi.stubEnv("RECOVERY_COOKIE_SECRET", "test-recovery-secret");
  });
  afterEach(() => vi.unstubAllEnvs());
  const go = async (qs: string) => {
    const m = await import("@/app/api/auth/confirm/route");
    const res = await m.GET(new Request(`http://localhost/api/auth/confirm${qs}`));
    return { status: res.status, location: res.headers.get("location") };
  };

  it("paramètres manquants ou type inconnu → connexion avec erreur, sans appel à Supabase", async () => {
    for (const qs of ["", "?type=email&lang=en", "?token_hash=h&lang=en", "?token_hash=h&type=sms&lang=en"]) {
      expect((await go(qs)).location, qs).toMatch(/\/connexion\?error=link$/);
    }
    expect(verify).not.toHaveBeenCalled();
  });
  it("confirmation d'inscription → verifyOtp(type, token_hash) puis /compte dans la langue du lien", async () => {
    verify.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    expect(await go("?token_hash=pkce_abc&type=email&lang=en")).toEqual({ status: 303, location: "http://localhost/en/compte" });
    expect(verify).toHaveBeenCalledWith({ type: "email", token_hash: "pkce_abc" });
    expect(cookieStore.set).not.toHaveBeenCalled();
  });
  it("réinitialisation (et invitation) → cookie de récupération signé + onglet sécurité", async () => {
    verify.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    for (const type of ["recovery", "invite"]) {
      expect((await go(`?token_hash=h&type=${type}&lang=fr`)).location).toBe("http://localhost/fr/compte?tab=security&recovery=1");
    }
    expect(cookieStore.set.mock.calls[0][1]).toMatch(/^u1\.\d+\.[0-9a-f]{64}$/);
  });
  it("lien expiré ou Supabase qui plante → connexion avec erreur (jamais de 500)", async () => {
    verify.mockResolvedValueOnce({ data: { user: null }, error: { message: "expired" } });
    expect((await go("?token_hash=h&type=email&lang=fr")).location).toBe("http://localhost/fr/connexion?error=link");
    verify.mockRejectedValueOnce(new Error("timeout"));
    expect((await go("?token_hash=h&type=email&lang=en")).location).toBe("http://localhost/en/connexion?error=link");
  });
  it("OPEN REDIRECT : langue piégée → toujours sur le site, en français", async () => {
    verify.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    for (const lang of ["evil.com", "//evil.com", "https%3A%2F%2Fevil.com", "FR"]) {
      expect((await go(`?token_hash=h&type=email&lang=${lang}`)).location, lang).toBe("http://localhost/fr/compte");
    }
  });
});

// ───────────────────────── Espace client ─────────────────────────
describe("routes /api/me/* — accès refusé aux anonymes", () => {
  beforeEach(() => userMod.getSessionContext.mockResolvedValue(null));
  it("orders, profile, password → 401 unauthorized, aucune lecture", async () => {
    expect((await call("@/app/api/me/orders/route", "GET", req("/api/me/orders", undefined, "GET"))).status).toBe(401);
    expect((await call("@/app/api/me/profile/route", "PATCH", req("/api/me/profile", { firstName: "A" }, "PATCH"))).status).toBe(401);
    expect((await call("@/app/api/me/password/route", "POST", req("/api/me/password", { next: "motdepasse1" }))).status).toBe(401);
  });
  it("GET /api/me : invité → { user: null } ; getCurrentUser qui jette → toujours 200 { user: null }", async () => {
    userMod.getCurrentUser.mockResolvedValueOnce(null);
    expect(await call("@/app/api/me/route", "GET", req("/api/me", undefined, "GET"))).toMatchObject({ status: 200, json: { user: null } });
    userMod.getCurrentUser.mockRejectedValueOnce(new Error("boom"));
    expect(await call("@/app/api/me/route", "GET", req("/api/me", undefined, "GET"))).toMatchObject({ status: 200, json: { user: null } });
  });
  it("les réponses de session ne sont jamais mises en cache", async () => {
    userMod.getCurrentUser.mockResolvedValue(null);
    const r = await call("@/app/api/me/route", "GET", req("/api/me", undefined, "GET"));
    expect(r.headers.get("cache-control")).toBe("no-store");
  });
});

describe("PATCH /api/me/profile — colonnes protégées", () => {
  const update = vi.fn();
  const eq = vi.fn();
  beforeEach(() => {
    update.mockReset();
    eq.mockReset();
    eq.mockResolvedValue({ error: null });
    update.mockReturnValue({ eq });
    userMod.getSessionContext.mockResolvedValue({ sb: { from: () => ({ update }) }, userId: "u1", email: "Afi@Exemple.bj", meta: {}, createdAt: "" });
    admin.create.mockReturnValue({ from: () => ({ upsert: async () => ({}), delete: () => ({ eq: () => ({ eq: async () => ({}) }) }) }) });
  });
  const valid = { firstName: "Afi", lastName: "Houngbédji", phone: "01 97 00 00 00", address: "Cotonou", news: false };
  const send = (b: unknown) => call("@/app/api/me/profile/route", "PATCH", req("/api/me/profile", b, "PATCH"));

  it("n'écrit QUE first_name, last_name, phone, address, news — même si le client ajoute role/id/email", async () => {
    const r = await send({ ...valid, role: "admin", id: "autre", email: "x@y.z", user_id: "autre" });
    expect(r.status).toBe(200);
    expect(Object.keys(update.mock.calls[0][0]).sort()).toEqual(["address", "first_name", "last_name", "news", "phone"]);
    expect(update.mock.calls[0][0].phone).toBe("0197000000");
    expect(eq).toHaveBeenCalledWith("id", "u1"); // toujours l'id de la SESSION, jamais celui du corps
  });
  it("adresse de 401 caractères, nom vide, téléphone invalide, news non booléen → 422", async () => {
    for (const over of [{ address: "a".repeat(401) }, { firstName: "" }, { phone: "123" }, { news: "oui" }]) {
      expect((await send({ ...valid, ...over })).status, JSON.stringify(over)).toBe(422);
    }
    expect(update).not.toHaveBeenCalled();
  });
  it("erreur base → 502 générique", async () => {
    eq.mockResolvedValue({ error: { message: "secret" } });
    const r = await send(valid);
    expect(r.status).toBe(502);
    expect(JSON.stringify(r.json)).not.toContain("secret");
  });
  it("service_role absent : le profil est quand même enregistré (newsletter = meilleur effort)", async () => {
    admin.create.mockImplementation(() => {
      throw new Error("x");
    });
    expect((await send({ ...valid, news: true })).status).toBe(200);
  });
});

describe("POST /api/me/password", () => {
  const updateUser = vi.fn();
  const probe = vi.fn();
  beforeEach(() => {
    updateUser.mockReset();
    probe.mockReset();
    updateUser.mockResolvedValue({ error: null });
    pub.create.mockReturnValue({ auth: { signInWithPassword: probe } });
    userMod.getSessionContext.mockResolvedValue({ sb: { auth: { updateUser } }, userId: "u1", email: "afi@exemple.bj", meta: {}, createdAt: "" });
    cookieStore.get.mockReturnValue(undefined);
    vi.stubEnv("RECOVERY_COOKIE_SECRET", "test-recovery-secret");
  });
  afterEach(() => vi.unstubAllEnvs());
  const send = (b: unknown) => call("@/app/api/me/password/route", "POST", req("/api/me/password", b));

  it("sans ancien mot de passe ni lien de réinitialisation → 422 passRequired, rien modifié", async () => {
    const r = await send({ next: "nouveau-mdp-1" });
    expect(r).toMatchObject({ status: 422, json: { fields: { current: "passRequired" } } });
    expect(updateUser).not.toHaveBeenCalled();
  });
  it("drapeau recovery SANS cookie de récupération → ancien mot de passe toujours exigé", async () => {
    expect((await send({ next: "nouveau-mdp-1", recovery: true })).status).toBe(422);
    expect(updateUser).not.toHaveBeenCalled();
  });
  it("ancien mot de passe faux → 422 pwCurrentWrong", async () => {
    probe.mockResolvedValue({ error: { message: "invalid" } });
    expect((await send({ current: "faux-faux-1", next: "nouveau-mdp-1" })).json).toMatchObject({ fields: { current: "pwCurrentWrong" } });
    expect(updateUser).not.toHaveBeenCalled();
  });
  it("ancien mot de passe juste → mise à jour ; nouveau identique à l'actuel ou trop court → 422", async () => {
    probe.mockResolvedValue({ error: null });
    expect((await send({ current: "ancien-mdp-1", next: "nouveau-mdp-1" })).json).toEqual({ ok: true });
    expect((await send({ current: "ancien-mdp-1", next: "ancien-mdp-1" })).status).toBe(422);
    expect((await send({ current: "ancien-mdp-1", next: "court" })).status).toBe(422);
  });
  it("lien de réinitialisation valide : pas d'ancien mot de passe, cookie effacé après usage", async () => {
    cookieStore.get.mockReturnValue({ value: signRecovery("u1") });
    expect((await send({ next: "nouveau-mdp-1", recovery: true })).json).toEqual({ ok: true });
    expect(probe).not.toHaveBeenCalled();
    expect(cookieStore.set).toHaveBeenCalledWith("wx_recovery", "", expect.objectContaining({ maxAge: 0 }));
  });
  it("cookie de récupération d'un AUTRE utilisateur → refusé", async () => {
    cookieStore.get.mockReturnValue({ value: signRecovery("u2") });
    expect((await send({ next: "nouveau-mdp-1", recovery: true })).status).toBe(422);
  });
  it("FORGE : cookie = simple id de l'utilisateur (ancien format, lisible via /api/me) → refusé, ancien mot de passe exigé", async () => {
    cookieStore.get.mockReturnValue({ value: "u1" });
    expect((await send({ next: "nouveau-mdp-1", recovery: true })).status).toBe(422);
    expect(updateUser).not.toHaveBeenCalled();
  });
  it("cookie expiré ou à signature altérée → refusé", async () => {
    cookieStore.get.mockReturnValue({ value: signRecovery("u1", Date.now() - 16 * 60_000) });
    expect((await send({ next: "nouveau-mdp-1", recovery: true })).status).toBe(422);
    const ok = signRecovery("u1") as string;
    cookieStore.get.mockReturnValue({ value: ok.slice(0, -1) + (ok.endsWith("0") ? "1" : "0") });
    expect((await send({ next: "nouveau-mdp-1", recovery: true })).status).toBe(422);
    expect(updateUser).not.toHaveBeenCalled();
  });
  it("Supabase rejette le nouveau mot de passe (faible) → 422 passWeak ; panne → 502", async () => {
    probe.mockResolvedValue({ error: null });
    updateUser.mockResolvedValueOnce({ error: { message: "Password is too weak" } });
    expect((await send({ current: "ancien-mdp-1", next: "nouveau-mdp-1" })).json).toMatchObject({ fields: { next: "passWeak" } });
    updateUser.mockRejectedValueOnce(new Error("réseau"));
    expect((await send({ current: "ancien-mdp-1", next: "nouveau-mdp-1" })).status).toBe(502);
  });
});

// ───────────────────────── Suivi invité : cas supplémentaires ─────────────────────────
describe("POST /api/orders/track — cas limites", () => {
  const maybeSingle = vi.fn();
  const row = { number: "WX-10258", status: "livraison", created_at: "2026-10-06T19:05:00Z", total: 12400, phone: "+229 01 97 11 22 33", email: null, order_items: null };
  beforeEach(() => {
    maybeSingle.mockReset();
    maybeSingle.mockResolvedValue({ data: row, error: null });
    admin.create.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) });
  });
  const send = (b: Record<string, unknown>, ip = "3.3.3.3") => call("@/app/api/orders/track/route", "POST", req("/api/orders/track", { t: old(), ...b }, "POST", ip));

  it("téléphone stocké avec indicatif et espaces (commande saisie à la main) : le suivi fonctionne", async () => {
    const r = await send({ number: "WX-10258", contact: "0197112233" });
    expect(r.status).toBe(200);
    expect((r.json?.order as { items: unknown[] }).items).toEqual([]); // order_items null → liste vide, pas de crash
  });
  it("commande SANS e-mail : le suivi par e-mail échoue comme une commande inconnue (indiscernable)", async () => {
    const byMail = await send({ number: "WX-10258", contact: "afi@exemple.bj" });
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const unknown = await send({ number: "WX-10258", contact: "afi@exemple.bj" });
    expect({ status: byMail.status, json: byMail.json }).toEqual({ status: unknown.status, json: unknown.json });
  });
  it("numéro saisi sous 5 formes → même commande interrogée", async () => {
    for (const n of ["WX-10258", "wx-10258", "WX10258", "wx 10258", "10258"]) {
      await send({ number: n, contact: "0197112233" }, `ip-${n}`);
    }
    expect(maybeSingle).toHaveBeenCalledTimes(5);
  });
  it("erreur base → 503 (pas 404 : on ne dit pas « introuvable » quand on ne sait pas)", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "x" } });
    expect((await send({ number: "WX-10258", contact: "0197112233" })).status).toBe(503);
    maybeSingle.mockRejectedValue(new Error("timeout"));
    expect((await send({ number: "WX-10258", contact: "0197112233" }, "4.4.4.4")).status).toBe(503);
  });
  it("Supabase absent → 503", async () => {
    admin.create.mockImplementation(() => {
      throw new Error("x");
    });
    expect((await send({ number: "WX-10258", contact: "0197112233" })).status).toBe(503);
  });
  it("8 essais maximum par numéro (toutes IP confondues) puis 429 : freine la devinette du téléphone", async () => {
    let last = 0;
    for (let i = 0; i < 9; i++) last = (await send({ number: "WX-10258", contact: `01970000${String(i).padStart(2, "0")}` }, `ip-brute-${i}`)).status;
    expect(last).toBe(429);
  });
  it("15 essais par IP puis 429, même sur des numéros différents", async () => {
    let last = 0;
    for (let i = 0; i < 16; i++) last = (await send({ number: `WX-${20000 + i}`, contact: "0197112233" }, "6.6.6.6")).status;
    expect(last).toBe(429);
  });
  it("contact de type inattendu (nombre, objet, tableau) ou corps de 4 001 caractères → 4xx", async () => {
    for (const contact of [197112233, {}, [], null]) expect((await send({ number: "WX-10258", contact })).status).toBeGreaterThanOrEqual(400);
    expect((await send({ number: "WX-10258", contact: "0197112233", pad: "x".repeat(4100) })).status).toBe(400);
    expect(maybeSingle).not.toHaveBeenCalled();
  });
});

// ───────────────────────── Catalogue public (Favoris, tiroir panier) ─────────────────────────
describe("GET /api/products", () => {
  const get = (qs: string) => call("@/app/api/products/route", "GET", req(`/api/products${qs}`, undefined, "GET"));
  it("sans ids ou ids tous invalides → liste vide SANS interroger le catalogue", async () => {
    expect((await get("")).json).toEqual({ products: [] });
    expect((await get("?ids=" + encodeURIComponent("a b,../x,<script>,'; drop"))).json).toEqual({ products: [] });
    expect(catalog.getProductsByIds).not.toHaveBeenCalled();
  });
  it("filtre les ids invalides, garde les valides, borne à 60", async () => {
    catalog.getProductsByIds.mockResolvedValue([]);
    const ids = [...Array.from({ length: 80 }, (_, i) => `id${i}`), "bad id"].join(",");
    await get(`?ids=${encodeURIComponent(ids)}&lang=en`);
    const [lang, passed] = catalog.getProductsByIds.mock.calls[0];
    expect(lang).toBe("en");
    expect(passed).toHaveLength(60);
    expect(passed).not.toContain("bad id");
  });
  it("langue inconnue → fr ; panne du catalogue → 502 { products: [], error } (l'écran affiche « réessayer »)", async () => {
    catalog.getProductsByIds.mockResolvedValueOnce([]);
    await get("?ids=a&lang=de");
    expect(catalog.getProductsByIds.mock.calls[0][0]).toBe("fr");
    catalog.getProductsByIds.mockRejectedValueOnce(new Error("db"));
    expect(await get("?ids=a")).toMatchObject({ status: 502, json: { products: [], error: true } });
  });
});

describe("GET /api/checkout/config", () => {
  const settings = { brand: {}, shipping: { cotonou: 1000, autre: 2500, freeFrom: 15000, cutoff: 18, returnDays: 7 }, pay: { cod: true } };
  const p = (id: string, price: number, stock: number) => ({ id, slug: id, name: id, price, stock, bg: null, imageUrl: null });
  const get = (qs: string) => call("@/app/api/checkout/config/route", "GET", req(`/api/checkout/config${qs}`, undefined, "GET"));

  it("renvoie le stock des seuls articles du panier ; suggestions = petits prix en stock hors panier, 2 maximum", async () => {
    catalog.getSettings.mockResolvedValue(settings);
    catalog.getProducts.mockResolvedValue([p("a", 5000, 3), p("b", 1500, 4), p("c", 2000, 0), p("d", 2500, 9), p("e", 3000, 1), p("f", 3001, 9)]);
    const r = await get("?ids=a,e");
    expect(r.json).toMatchObject({ ok: true, stock: { a: 3, e: 1 } });
    expect((r.json?.upsell as { id: string }[]).map((u) => u.id)).toEqual(["b", "d"]);
  });
  it("panier contenant un produit retiré du catalogue : absent de `stock` (l'UI ne doit pas planter)", async () => {
    catalog.getSettings.mockResolvedValue(settings);
    catalog.getProducts.mockResolvedValue([p("a", 5000, 3)]);
    expect((await get("?ids=a,fantome")).json?.stock).toEqual({ a: 3 });
  });
  it("QA-8 : `stale` liste les ids absents du catalogue qui ne sont PAS des UUID (restes de démo), jamais un UUID", async () => {
    const UUID = "3f2b8c1e-5a47-4d9a-9b1e-7c2d4e6f8a10";
    catalog.getSettings.mockResolvedValue(settings);
    catalog.getProducts.mockResolvedValue([p("a", 5000, 3)]);
    // Catalogue de démo servi par erreur (base lente) : un vrai UUID de client n'est jamais déclaré périmé.
    expect((await get(`?ids=a,lampe,air,${UUID}`)).json?.stale).toEqual(["lampe", "air"]);
    expect((await get("?ids=a")).json?.stale).toEqual([]);
  });
  it("catalogue en panne → 200 { ok: false } : jamais de 5xx, le tiroir garde ses réglages par défaut", async () => {
    catalog.getSettings.mockRejectedValue(new Error("db"));
    catalog.getProducts.mockResolvedValue([]);
    expect(await get("?ids=a")).toMatchObject({ status: 200, json: { ok: false } });
  });
});

// ───────────────────────── Newsletter ─────────────────────────
describe("POST /api/newsletter — base", () => {
  const insert = vi.fn();
  beforeEach(() => {
    insert.mockReset();
    admin.create.mockReturnValue({ from: () => ({ insert }) });
  });
  const send = (b: Record<string, unknown>, ip = "2.2.2.2") => call("@/app/api/newsletter/route", "POST", req("/api/newsletter", { t: old(), website: "", ...b }, "POST", ip));

  it("DOUBLON (23505) = succès silencieux, indiscernable d'une inscription neuve", async () => {
    insert.mockResolvedValueOnce({ error: null });
    const fresh = await send({ channel: "email", value: "a@b.co" });
    insert.mockResolvedValueOnce({ error: { code: "23505" } });
    const dup = await send({ channel: "email", value: "a@b.co" });
    expect({ status: dup.status, json: dup.json }).toEqual({ status: fresh.status, json: fresh.json });
  });
  it("autre erreur base → 503 sans détail", async () => {
    insert.mockResolvedValue({ error: { code: "XX000", message: "secret" } });
    const r = await send({ channel: "email", value: "a@b.co" });
    expect(r.status).toBe(503);
    expect(JSON.stringify(r.json)).not.toContain("secret");
  });
  it("valeurs enregistrées normalisées : e-mail en minuscules, WhatsApp sur 10 chiffres", async () => {
    insert.mockResolvedValue({ error: null });
    await send({ channel: "email", value: "  Afi@Exemple.BJ " });
    await send({ channel: "whatsapp", value: "+229 01 97 00 00 00" });
    expect(insert.mock.calls.map((c) => c[0])).toEqual([
      { channel: "email", value: "afi@exemple.bj", consent: true },
      { channel: "whatsapp", value: "0197000000", consent: true },
    ]);
  });
  // BUG QA-1c : la newsletter classe « trop rapide » TOUT horodatage futur (t > now → now - t < 2500). Même cause que QA-1.
  it("QA-1c : horloge cliente en avance de 3 s sur le serveur, formulaire ouvert depuis 10 s → accepté", async () => {
    insert.mockResolvedValue({ error: null });
    const r = await send({ channel: "email", value: "a@b.co", t: Date.now() + 3_000 - 10_000 + 10_000 }, "ip-skew");
    expect(r.status).toBe(200);
  });
});
