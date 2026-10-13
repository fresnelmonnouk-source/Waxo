import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Corpus de l'IA de l'admin : aucune donnée personnelle, aucun secret, taille bornée.

const tables: string[] = [];
const fakeSb = {
  from(table: string) {
    tables.push(table);
    const rows = [
      { id: "11111111-1111-4111-8111-111111111111", tag: "Retours", title: "Retours", text: "Retour sous 7 jours. Contact : jean.client@gmail.com, +229 01 97 12 34 56.", keywords: "", active: true, status: "published", source: "manual", updated_at: "2026-10-01T10:00:00Z" },
      { id: "22222222-2222-4222-8222-222222222222", tag: "Paiement", title: "Brouillon paiement", text: "Clé sk_live_AbCdEf0123456789xyz à ne jamais montrer.", keywords: "", active: false, status: "draft", source: "ai", updated_at: "2026-10-02T10:00:00Z" },
    ];
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "order", "limit", "eq"]) chain[m] = () => chain;
    chain.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(res);
    return chain;
  },
};
vi.mock("@/lib/settings/db", () => ({ tryAdminClient: () => fakeSb, withTimeout: (p: unknown) => Promise.resolve(p) }));

const SETTINGS = {
  brand: { shopName: "Wá xɔ", whatsapp: "+229 01 61 23 45 67", waNumber: "2290161234567", email: "patron.waxo@gmail.com", hours: "7 j/7, de 8 h à 20 h" },
  shipping: { cotonou: 1000, autre: 2500, freeFrom: 15000, cutoff: 20, returnDays: 7 },
  pay: { momo: true, moov: true, celtiis: true, carte: false, cod: true },
  features: { packs: true },
};
vi.mock("@/lib/catalog", () => ({
  getSettings: async () => SETTINGS,
  getProducts: async () => [
    { id: "p1", name: "Lampe solaire", price: 12500, comparePrice: 15000, stock: 4, description: "Lampe rechargeable. Appelez le 97 12 34 56 78 ou ecrivez a vendeur@waxo.bj.", categoryId: "c1" },
  ],
  getCategories: async () => [{ id: "c1", label: "Maison", bg: "", sort: 1 }],
}));
vi.mock("@/lib/pages", () => ({
  getLegalSettings: async () => ({
    companyName: "Koffi Mensah",
    legalForm: "Entreprise individuelle",
    ifu: "3202312345678",
    rccm: "RB/COT/23 A 12345",
    address: "Lot 12, rue des Cocotiers, Cotonou",
    phone: "+229 01 90 00 00 01",
    email: "koffi.mensah@example.com",
    hostName: "",
    hostAddress: "",
    publicationDirector: "Koffi Mensah",
    apdpReceipt: "",
  }),
  getPage: async (slug: string) => ({ slug, locale: "fr", title: `Titre ${slug}`, body: `Texte de ${slug}. {{shipping.cotonou}}`, source: "db", updatedAt: null }),
}));
vi.mock("@/lib/campaigns/data", () => ({
  getLiveCampaigns: async () => [
    { id: "c", slug: "noel", nameFr: "Noël", nameEn: "Christmas", taglineFr: "Petits prix", taglineEn: "", startsAt: "2026-12-01T00:00:00Z", endsAt: "2026-12-26T00:00:00Z", active: true, showMenu: true, showBanner: true, showCountdown: true, items: [{ productId: "p1", salePrice: 9900 }] },
  ],
}));
vi.mock("@/lib/payment/ready", () => ({ onlinePayAvailable: async () => false }));

const SECRET_ENV = {
  DEEPSEEK_API_KEY: "sk-SENTINELdeepseek0123456789",
  SUPABASE_SERVICE_ROLE_KEY: "SENTINEL-service-role-value-42",
  SETTINGS_ENCRYPTION_KEY: "SENTINEL-encryption-key-77",
  FEDAPAY_SECRET_KEY: "SENTINEL-fedapay-secret-99",
};

beforeEach(() => {
  tables.length = 0;
  for (const [k, v] of Object.entries(SECRET_ENV)) vi.stubEnv(k, v);
});
afterEach(() => vi.unstubAllEnvs());

const PERSONAL = ["+229 01 61 23 45 67", "2290161234567", "patron.waxo@gmail.com", "Koffi Mensah", "koffi.mensah", "3202312345678", "RB/COT/23", "rue des Cocotiers", "jean.client@gmail.com", "97 12 34 56", "vendeur@waxo.bj"];

describe("corpus de l'IA de l'admin", () => {
  it("ne contient ni donnée personnelle, ni coordonnée, ni valeur légale", async () => {
    const { loadCorpus } = await import("@/lib/admin/ai/corpus");
    const c = await loadCorpus();
    for (const p of PERSONAL) expect(c.text, p).not.toContain(p);
    expect(c.text).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    expect(c.text).not.toMatch(/\d(?:[\s.\-  ]?\d){7,}/);
    // Les mentions légales sont réduites à « renseigné / vide ».
    expect(c.text).toMatch(/Mentions légales renseignées : Raison sociale, Forme juridique, IFU, RCCM/);
    expect(c.text).toMatch(/Numéro WhatsApp de la boutique renseigné : oui/);
  });

  it("ne contient aucun secret (variables d'environnement, clés de paiement)", async () => {
    const { loadCorpus } = await import("@/lib/admin/ai/corpus");
    const c = await loadCorpus();
    for (const v of Object.values(SECRET_ENV)) expect(c.text).not.toContain(v);
    expect(c.text).not.toMatch(/sk_live_|sk_sandbox_|wh_live_|SENTINEL/);
    expect(c.text).toContain("[secret masqué]");
  });

  it("ne lit en base que la table kb (jamais commandes, clients, messages, avis, réglages privés)", async () => {
    const { loadCorpusSources } = await import("@/lib/admin/ai/corpus");
    await loadCorpusSources();
    expect([...new Set(tables)]).toEqual(["kb"]);
  });

  it("contient les faits utiles : réglages, FAQ, pages, produits, campagnes, fiches avec statut", async () => {
    const { loadCorpus } = await import("@/lib/admin/ai/corpus");
    const c = await loadCorpus();
    expect(c.text).toMatch(/Carte bancaire non/);
    expect(c.text).toMatch(/réellement proposé au client aujourd'hui : non/);
    expect(c.text).toMatch(/Comment puis-je payer/);
    expect(c.text).toContain("Titre livraison-retours");
    expect(c.text).toMatch(/Lampe solaire \| Maison \| 12.500.F/);
    expect(c.text).toMatch(/Noël : Petits prix/);
    expect(c.text).toContain("[Brouillon] (Paiement) Brouillon paiement");
    expect(c.text).toContain("[Publiée] (Retours) Retours");
  });

  it("respecte le budget et le signale", async () => {
    const { buildCorpus } = await import("@/lib/admin/ai/corpus");
    const big = "Ligne de texte assez longue pour remplir le budget.\n".repeat(3000);
    const c = buildCorpus(
      {
        settings: SETTINGS,
        onlinePay: true,
        legal: null,
        pages: [{ slug: "cgv", label: "CGV", title: "CGV", body: big, source: "db" }],
        products: Array.from({ length: 150 }, (_, i) => ({ name: `Produit ${i}`, price: 1000, comparePrice: null, stock: 1, description: big.slice(0, 500), category: "Maison" })),
        campaigns: [],
        kb: [],
      },
      { budget: 20_000 },
    );
    expect(c.chars).toBeLessThanOrEqual(20_000 + 200);
    expect(c.truncated).toBe(true);
    expect(c.text).toContain("[… tronqué]");
    expect(c.sections.find((s) => s.name === "reglages")!.truncated).toBe(false);
  });
});

describe("scrubText", () => {
  it("masque e-mails, numéros et jetons, garde prix, heures et dates courtes", async () => {
    const { scrubText } = await import("@/lib/admin/ai/scrub");
    const s = scrubText("Écrivez à a.b@c.bj ou au +229 01 97 00 00 00. Prix 15 000 F, avant 20 h, 7 j/7, 48 à 72 h. Jeton eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZSJ9.abc wh_sandbox_abcdef123");
    expect(s).toBe("Écrivez à [e-mail masqué] ou au [numéro masqué]. Prix 15 000 F, avant 20 h, 7 j/7, 48 à 72 h. Jeton [secret masqué] [secret masqué]");
  });
});
