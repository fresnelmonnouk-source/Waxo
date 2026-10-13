import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Actions de /admin/assistant-ia : garde admin, clé absente, limiteur, brouillon jamais actif, publication.

const assertAdmin = vi.fn();
vi.mock("@/lib/admin/guard", () => ({ assertAdmin: () => assertAdmin(), requireAdmin: () => assertAdmin() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const runAnalysis = vi.fn();
const runDraft = vi.fn();
vi.mock("@/lib/admin/ai/analyze", () => ({ runAnalysis: () => runAnalysis(), runDraft: (r: string) => runDraft(r) }));

type Call = { table: string; ops: [string, ...unknown[]][] };
let calls: Call[] = [];
let respond: (c: Call) => { data: unknown; error: unknown } = () => ({ data: null, error: null });
let sbEnabled = true;
const fakeSb = {
  from(table: string) {
    const call: Call = { table, ops: [] };
    calls.push(call);
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "insert", "update", "delete", "eq", "maybeSingle", "order", "limit"]) {
      chain[m] = (...args: unknown[]) => {
        call.ops.push([m, ...args]);
        return chain;
      };
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(respond(call)).then(res, rej);
    return chain;
  },
};
vi.mock("@/lib/settings/db", () => ({ tryAdminClient: () => (sbEnabled ? fakeSb : null), withTimeout: (p: unknown) => Promise.resolve(p) }));

const ID = "11111111-1111-4111-8111-111111111111";
const ROW = { id: ID, tag: "Retours", title: "Retours hors Cotonou", text: "Le renvoi est à votre charge, sauf produit défectueux.", keywords: "retour", active: false, status: "draft", source: "ai", updated_at: "2026-10-13T10:00:00Z" };
const op = (c: Call, name: string) => c.ops.find((o) => o[0] === name);

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ""); // limiteur : repli mémoire
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  vi.stubEnv("DEEPSEEK_API_KEY", "sk-test-key-for-unit-tests-000000");
  assertAdmin.mockReset().mockResolvedValue({ id: "admin-1", email: "a@waxo.bj" });
  runAnalysis.mockReset();
  runDraft.mockReset();
  calls = [];
  respond = () => ({ data: ROW, error: null });
  sbEnabled = true;
});
afterEach(() => vi.unstubAllEnvs());

const load = () => import("@/app/admin/(panel)/assistant-ia/actions");

describe("garde admin", () => {
  it("toutes les actions refusent sans session admin, sans rien appeler", async () => {
    assertAdmin.mockResolvedValue(null);
    const a = await load();
    const results = await Promise.all([
      a.analyzeSiteAction(),
      a.draftKbAction("Rédige une fiche sur les retours"),
      a.saveKbAction({ tag: "Retours", title: "Titre", text: "x".repeat(30), keywords: "" }),
      a.setKbStateAction(ID, "published"),
      a.deleteKbAction(ID),
    ]);
    for (const r of results) expect(r).toMatchObject({ ok: false, code: "unauthorized" });
    expect(runAnalysis).not.toHaveBeenCalled();
    expect(runDraft).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });
});

describe("IA : clé absente, limiteur, erreurs", () => {
  it("clé DeepSeek absente → message clair, aucun appel", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    const a = await load();
    const r = await a.analyzeSiteAction();
    expect(r).toMatchObject({ ok: false, code: "unavailable" });
    if (!r.ok) expect(r.message).toContain("DEEPSEEK_API_KEY");
    expect(await a.draftKbAction("Rédige une fiche sur les retours")).toMatchObject({ ok: false, code: "unavailable" });
    expect(runAnalysis).not.toHaveBeenCalled();
  });

  it("10 analyses par heure et par admin, puis refus", async () => {
    runAnalysis.mockResolvedValue({ ok: true, analysis: { issues: [], missingTopics: [], kbDrafts: [] }, meta: {} });
    const a = await load();
    for (let i = 0; i < 10; i++) expect((await a.analyzeSiteAction()).ok).toBe(true);
    expect(await a.analyzeSiteAction()).toMatchObject({ ok: false, code: "rate_limited" });
    expect(runAnalysis).toHaveBeenCalledTimes(10);
  });

  it("échec de l'IA → message lisible, jamais d'exception", async () => {
    const a = await load();
    runAnalysis.mockResolvedValueOnce({ ok: false, code: "timeout" });
    expect(await a.analyzeSiteAction()).toMatchObject({ ok: false, code: "error", message: expect.stringContaining("trop de temps") });
    runAnalysis.mockRejectedValueOnce(new Error("boom"));
    expect(await a.analyzeSiteAction()).toMatchObject({ ok: false, code: "error" });
  });

  it("rédaction : demande validée puis brouillon renvoyé (rien n'est enregistré)", async () => {
    runDraft.mockResolvedValue({ ok: true, draft: { tag: "Retours", title: "T", text: "t", keywords: "" }, meta: {} });
    const a = await load();
    expect(await a.draftKbAction("court")).toMatchObject({ ok: false, code: "invalid" });
    expect(await a.draftKbAction("Rédige une fiche sur les retours hors Cotonou")).toMatchObject({ ok: true });
    expect(calls).toEqual([]);
  });
});

describe("base de connaissances : brouillons et publication", () => {
  const draft = { tag: "Retours", title: "Retours hors Cotonou", text: "Le renvoi est à votre charge, sauf produit défectueux.", keywords: "retour" };

  it("une fiche créée sans « Publier » est un brouillon INACTIF", async () => {
    const a = await load();
    const r = await a.saveKbAction({ ...draft, source: "ai" });
    expect(r).toMatchObject({ ok: true, entry: { status: "draft", active: false, source: "ai" } });
    const payload = op(calls[0], "insert")![1] as Record<string, unknown>;
    expect(payload).toMatchObject({ status: "draft", active: false, source: "ai" });
  });

  it("une ligne « draft » renvoyée active par la base reste affichée inactive", async () => {
    respond = () => ({ data: { ...ROW, active: true }, error: null });
    const a = await load();
    const r = await a.saveKbAction({ ...draft, source: "ai" });
    expect(r).toMatchObject({ ok: true, entry: { active: false } });
  });

  it("« Publier » à la création : publiée et active", async () => {
    respond = () => ({ data: { ...ROW, status: "published", active: true }, error: null });
    const a = await load();
    await a.saveKbAction({ ...draft, publish: true });
    expect(op(calls[0], "insert")![1]).toMatchObject({ status: "published", active: true, source: "manual" });
  });

  it("modification sans « Publier » : statut inchangé", async () => {
    const a = await load();
    await a.saveKbAction({ ...draft, id: ID });
    const payload = op(calls[0], "update")![1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("active");
  });

  it("« [à confirmer] » interdit à la publication (création, modification, changement de statut)", async () => {
    const a = await load();
    const tbc = { ...draft, text: "Le renvoi coûte [à confirmer] francs, sauf défaut." };
    expect(await a.saveKbAction({ ...tbc, publish: true })).toMatchObject({ ok: false, code: "invalid" });
    expect(calls).toEqual([]);
    respond = () => ({ data: { title: "T", text: "Délai [à confirmer]." }, error: null });
    expect(await a.setKbStateAction(ID, "published")).toMatchObject({ ok: false, code: "invalid" });
    expect(calls.every((c) => !op(c, "update"))).toBe(true);
    // Fiche déjà en ligne : on ne peut pas y laisser un « [à confirmer] ».
    calls = [];
    respond = () => ({ data: { active: true, status: "published" }, error: null });
    expect(await a.saveKbAction({ ...tbc, id: ID })).toMatchObject({ ok: false, code: "invalid" });
    expect(calls.every((c) => !op(c, "update"))).toBe(true);
    // Brouillon : « [à confirmer] » accepté.
    calls = [];
    respond = (c) => (op(c, "update") ? { data: ROW, error: null } : { data: { active: false, status: "draft" }, error: null });
    expect(await a.saveKbAction({ ...tbc, id: ID })).toMatchObject({ ok: true });
  });

  it("changement de statut : publier, repasser en brouillon, désactiver", async () => {
    const a = await load();
    respond = (c) => (op(c, "update") ? { data: { ...ROW, status: "published", active: true }, error: null } : { data: { title: "T", text: "Texte complet." }, error: null });
    expect(await a.setKbStateAction(ID, "published")).toMatchObject({ ok: true, entry: { status: "published", active: true } });
    expect(op(calls.at(-1)!, "update")![1]).toEqual({ status: "published", active: true });
    await a.setKbStateAction(ID, "draft");
    expect(op(calls.at(-1)!, "update")![1]).toEqual({ status: "draft", active: false });
    await a.setKbStateAction(ID, "disabled");
    expect(op(calls.at(-1)!, "update")![1]).toEqual({ status: "published", active: false });
    expect(await a.setKbStateAction(ID, "archived")).toMatchObject({ ok: false, code: "invalid" });
    expect(await a.setKbStateAction("pas-un-uuid", "draft")).toMatchObject({ ok: false, code: "invalid" });
  });

  it("suppression : par id validé ; introuvable signalé", async () => {
    const a = await load();
    respond = () => ({ data: { id: ID }, error: null });
    expect(await a.deleteKbAction(ID)).toEqual({ ok: true });
    expect(op(calls[0], "eq")).toEqual(["eq", "id", ID]);
    respond = () => ({ data: null, error: null });
    expect(await a.deleteKbAction(ID)).toMatchObject({ ok: false, code: "not_found" });
    expect(await a.deleteKbAction("1; drop table kb")).toMatchObject({ ok: false, code: "invalid" });
  });

  it("migration 0022 absente → message explicite ; base absente → unavailable", async () => {
    const a = await load();
    respond = () => ({ data: null, error: { code: "42703", message: 'column "status" does not exist' } });
    expect(await a.saveKbAction(draft)).toMatchObject({ ok: false, code: "unavailable", message: expect.stringContaining("0022") });
    sbEnabled = false;
    expect(await a.saveKbAction(draft)).toMatchObject({ ok: false, code: "unavailable" });
  });

  it("entrée invalide refusée (thème, longueurs, champ inconnu)", async () => {
    const a = await load();
    expect(await a.saveKbAction({ ...draft, tag: "Pirate" })).toMatchObject({ ok: false, code: "invalid" });
    expect(await a.saveKbAction({ ...draft, text: "court" })).toMatchObject({ ok: false, code: "invalid" });
    expect(await a.saveKbAction({ ...draft, status: "published" })).toMatchObject({ ok: false, code: "invalid" });
    expect(await a.saveKbAction({ ...draft, active: true })).toMatchObject({ ok: false, code: "invalid" });
    expect(calls).toEqual([]);
  });
});
