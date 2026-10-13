// Discussion côté admin : garde assertAdmin, réponse équipe + e-mail « Vous avez une réponse », note interne jamais envoyée,
// brouillon IA sans donnée personnelle. Supabase, réglages, Resend et DeepSeek simulés.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const guard = vi.hoisted(() => ({ assertAdmin: vi.fn() }));
const admin = vi.hoisted(() => ({ create: vi.fn() }));
const resend = vi.hoisted(() => ({ sendViaResend: vi.fn() }));
const catalog = vi.hoisted(() => ({ getSettings: vi.fn() }));

vi.mock("@/lib/admin/guard", () => ({ assertAdmin: () => guard.assertAdmin(), requireAdmin: () => guard.assertAdmin() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: () => { throw new Error("hors requête"); } }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin.create() }));
vi.mock("@/lib/email/resend", () => resend);
vi.mock("@/lib/catalog", () => catalog);
vi.mock("@/lib/payment/ready", () => ({ onlinePayAvailable: async () => false }));
vi.mock("@/lib/admin/data/settings", () => ({
  getAllKbDocs: async () => ({ docs: [{ id: "k1", kind: "kb", tag: "Retours", title: "Retours", text: "Retours sous 7 jours.", keywords: "retour abime casse colis" }] }),
  getSettingsForm: async () => ({ form: { aiSign: "L'équipe Wá xɔ", shopName: "Wá xɔ", autoDraft: false } }),
}));

const ID = "44444444-4444-4444-8444-444444444444";
const ADMIN_ID = "77777777-7777-4777-8777-777777777777";
const conv = { id: ID, subject: "Colis abîmé", category: "plainte", status: "nouveau", order_number: "WX-10300", created_at: "2026-10-12T10:00:00Z", locale: "fr", customer_name: "Kossi Agbo", customer_contact: "kossi@agbo.bj", user_id: null, source: "contact", last_message_at: "2026-10-12T10:00:00Z", unread_admin: true };
const msgs = [
  { id: "m1", author: "client", body: "Bonjour, Kossi Agbo ici (0197000000). Ma commande WX-10300 est arrivée cassée.", created_at: "2026-10-12T10:00:00Z" },
  { id: "m2", author: "note_interne", body: "NOTE-SECRETE vérifier le livreur", created_at: "2026-10-12T10:05:00Z" },
];

function fakeDb() {
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => ({
    data: fn === "conversation_post" ? [{ message_id: `msg-${String(args.p_author)}-0000-0000-000000000000`, was_unread_admin: true, new_status: "en_cours" }] : null,
    error: null,
  }));
  const inserts: { table: string; row: unknown }[] = [];
  const from = (table: string) => {
    const b: Record<string, unknown> = {};
    for (const op of ["select", "eq", "in", "order", "limit", "update", "or"]) b[op] = () => b;
    b.insert = (row: unknown) => {
      inserts.push({ table, row });
      return b;
    };
    b.maybeSingle = async () => ({ data: table === "conversations" ? conv : table === "orders" ? { number: "WX-10300", status: "livree" } : { id: ID }, error: null });
    b.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: table === "conversation_messages" ? msgs : null, error: null }).then(res);
    return b;
  };
  return { db: { from, rpc, auth: { admin: { getUserById: async () => ({ data: { user: null } }) } } }, rpc, inserts };
}

let f: ReturnType<typeof fakeDb>;
beforeEach(() => {
  vi.resetModules();
  guard.assertAdmin.mockReset();
  guard.assertAdmin.mockResolvedValue({ id: ADMIN_ID, email: "admin@waxo.boutique" });
  f = fakeDb();
  admin.create.mockReturnValue(f.db);
  resend.sendViaResend.mockReset();
  resend.sendViaResend.mockResolvedValue({ ok: true, id: "r" });
  catalog.getSettings.mockResolvedValue({
    brand: { shopName: "Wá xɔ", whatsapp: "+229 01 00 00 00 00", waNumber: "2290100000000", email: "contact@waxo.boutique", hours: "" },
    shipping: { cotonou: 1000, autre: 2500, freeFrom: 15000, cutoff: 20, returnDays: 7 },
    pay: { momo: false, moov: false, celtiis: false, carte: false, cod: true },
  });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.waxo.boutique");
  vi.stubEnv("DEEPSEEK_API_KEY", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const actions = () => import("@/app/admin/(panel)/messages/actions");

describe("actions Discussions : garde admin", () => {
  it("non-admin : toutes les actions refusées, rien n'est écrit ni envoyé", async () => {
    guard.assertAdmin.mockResolvedValue(null);
    const a = await actions();
    const results = await Promise.all([
      a.replyAction(ID, "Bonjour"),
      a.addNoteAction(ID, "note"),
      a.setStatusAction(ID, "resolu"),
      a.setCategoryAction(ID, "retour"),
      a.setMessageDoneAction(ID, true),
      a.issueLinkAction(ID),
      a.draftReplyAction(ID),
    ]);
    for (const r of results) expect(r).toMatchObject({ ok: false, code: "unauthorized" });
    expect(f.rpc).not.toHaveBeenCalled();
    expect(resend.sendViaResend).not.toHaveBeenCalled();
  });
  it("valeurs invalides refusées (statut, catégorie, id)", async () => {
    const a = await actions();
    expect(await a.setStatusAction(ID, "ferme")).toMatchObject({ ok: false, code: "invalid" });
    expect(await a.setCategoryAction(ID, "spam")).toMatchObject({ ok: false, code: "invalid" });
    expect(await a.replyAction("pas-un-uuid", "x")).toMatchObject({ ok: false, code: "invalid" });
  });
});

describe("réponse de l'équipe", () => {
  it("ajoutée comme « equipe » avec l'admin ; e-mail au client avec un NOUVEAU lien privé (hash seul en base)", async () => {
    const a = await actions();
    const r = await a.replyAction(ID, "Bonjour, nous vous renvoyons un article.");
    expect(r).toMatchObject({ ok: true, outcome: "sent" });
    expect(f.rpc).toHaveBeenCalledWith("conversation_post", { p_conversation: ID, p_author: "equipe", p_body: "Bonjour, nous vous renvoyons un article.", p_admin: ADMIN_ID });
    const link = f.inserts.find((i) => i.table === "conversation_links")!.row as { token_hash: string };
    expect(link.token_hash).toMatch(/^[0-9a-f]{64}$/);
    const mail = resend.sendViaResend.mock.calls[0][0] as { to: string; subject: string; html: string; text: string };
    expect(mail.to).toBe("kossi@agbo.bj");
    expect(mail.subject).toBe("Vous avez une réponse de Wá xɔ");
    expect(mail.text).toMatch(/https:\/\/www\.waxo\.boutique\/fr\/discussion\/[A-Za-z0-9_-]{43}/);
    expect(mail.text).not.toContain(link.token_hash);
    expect(mail.text).not.toContain("nous vous renvoyons"); // la réponse se lit sur le site
  });
  it("client sans e-mail (téléphone) : réponse enregistrée, outcome no_email, aucun e-mail", async () => {
    conv.customer_contact = "0197000000";
    try {
      const a = await actions();
      expect(await a.replyAction(ID, "Bonjour")).toMatchObject({ ok: true, outcome: "no_email" });
      expect(resend.sendViaResend).not.toHaveBeenCalled();
    } finally {
      conv.customer_contact = "kossi@agbo.bj";
    }
  });
});

describe("note interne", () => {
  it("enregistrée comme note_interne, AUCUN e-mail, aucun lien créé", async () => {
    const a = await actions();
    expect(await a.addNoteAction(ID, "Client fiable")).toMatchObject({ ok: true });
    expect(f.rpc).toHaveBeenCalledWith("conversation_post", expect.objectContaining({ p_author: "note_interne" }));
    expect(resend.sendViaResend).not.toHaveBeenCalled();
    expect(f.inserts).toEqual([]);
  });
});

describe("brouillon IA", () => {
  it("DeepSeek ne reçoit ni nom, ni téléphone, ni e-mail, ni numéro de commande, ni note interne ; prénom remis localement", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-test");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "Bonjour {{prenom}}, désolé pour ce colis abîmé." } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const a = await actions();
    const r = await a.draftReplyAction(ID);
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.draft.text).toBe("Bonjour Kossi, désolé pour ce colis abîmé.\n\nL'équipe Wá xɔ");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    for (const leak of ["Kossi", "Agbo", "0197000000", "kossi@agbo.bj", "10300", "NOTE-SECRETE"]) expect(init.body).not.toContain(leak);
    expect(init.body).toContain("Plainte");
  });
  it("sans clé DeepSeek : modèle automatique, aucun appel réseau", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const a = await actions();
    const r = await a.draftReplyAction(ID);
    expect(r).toMatchObject({ ok: true, draft: { mode: "Modèle automatique" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
