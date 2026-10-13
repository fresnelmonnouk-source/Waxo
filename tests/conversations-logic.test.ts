// Discussion : jetons, validation, pseudonymisation, passage depuis l'assistant, invite IA (aucune donnée personnelle).
import { timingSafeEqual } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { escalationCategory, escalationContactPath, escalationSummary, isEscalationKind } from "@/lib/assistant/escalation";
import { buildDraftPrompt, finalizeDraft, type DraftFacts } from "@/lib/conversations/ai-draft";
import { redactPii } from "@/lib/conversations/redact";
import { createSchema, tokenReplySchema } from "@/lib/conversations/schema";
import { discussionPath, generateToken, hashToken, isTokenShape, safeEqualHex } from "@/lib/conversations/token";
import { excerpt, publicMessages, subjectFrom } from "@/lib/conversations/types";

vi.mock("node:crypto", async (orig) => {
  const real = await orig<typeof import("node:crypto")>();
  return { ...real, timingSafeEqual: vi.fn(real.timingSafeEqual) };
});

describe("jetons des liens privés", () => {
  it("32 octets aléatoires en base64url (43 caractères), jamais deux fois le même", () => {
    const set = new Set(Array.from({ length: 200 }, generateToken));
    expect(set.size).toBe(200);
    for (const t of set) expect(isTokenShape(t)).toBe(true);
    expect(Buffer.from([...set][0], "base64url")).toHaveLength(32);
  });
  it("empreinte SHA-256 hex stable ; le jeton n'apparaît pas dans l'empreinte", () => {
    const t = generateToken();
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toContain(t);
    expect(hashToken(t)).not.toBe(hashToken(generateToken()));
  });
  it("forme : refuse vide, trop court, caractères hors base64url, chemin", () => {
    for (const bad of ["", "abc", "x".repeat(42), "x".repeat(44), `${"x".repeat(42)}/`, `${"x".repeat(42)}=`, null, 42]) expect(isTokenShape(bad)).toBe(false);
  });
  it("comparaison d'empreintes en temps constant (timingSafeEqual), fausse si format différent", () => {
    const h = hashToken(generateToken());
    vi.mocked(timingSafeEqual).mockClear();
    expect(safeEqualHex(h, h)).toBe(true);
    expect(safeEqualHex(h, hashToken(generateToken()))).toBe(false);
    expect(vi.mocked(timingSafeEqual)).toHaveBeenCalledTimes(2);
    expect(safeEqualHex(h, h.slice(0, 63))).toBe(false);
    expect(safeEqualHex(h, h.toUpperCase())).toBe(false);
  });
  it("chemin du fil avec langue", () => {
    expect(discussionPath("en", "abc")).toBe("/en/discussion/abc");
  });
});

describe("validation de la demande", () => {
  const base = { name: "Afi", contact: "afi@x.bj", body: "Bonjour, ma commande est en retard." };
  it("catégorie obligatoire (5 valeurs) ; ancien sujet accepté et converti", () => {
    expect(createSchema.safeParse(base).success).toBe(false);
    expect(createSchema.safeParse({ ...base, category: "spam" }).success).toBe(false);
    expect(createSchema.parse({ ...base, category: "plainte" }).category).toBe("plainte");
    expect(createSchema.parse({ ...base, subject: "returns" }).category).toBe("retour");
    expect(createSchema.parse({ ...base, category: "question", source: "assistant", lang: "en" })).toMatchObject({ source: "assistant", lang: "en" });
  });
  it("source inconnue refusée ; réponse client de 1 caractère ou de 3001 refusée", () => {
    expect(createSchema.safeParse({ ...base, category: "autre", source: "admin" }).success).toBe(false);
    expect(tokenReplySchema.safeParse({ token: "t", body: "x" }).success).toBe(false);
    expect(tokenReplySchema.safeParse({ token: "t", body: "x".repeat(3001) }).success).toBe(false);
    expect(tokenReplySchema.safeParse({ token: "t", body: "ok" }).success).toBe(true);
  });
  it("objet tiré du message, coupé sur un mot ; extrait borné", () => {
    expect(subjectFrom("Colis abîmé. Le reste du message est long.")).toBe("Colis abîmé.");
    const s = subjectFrom("mot ".repeat(60));
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith("…")).toBe(true);
    expect(excerpt("a ".repeat(300), 50).length).toBeLessThanOrEqual(50);
  });
  it("publicMessages : écarte toute note interne (filet après la requête)", () => {
    const rows = [
      { id: 1, author: "client", body: "a", created_at: "t" },
      { id: 2, author: "note_interne", body: "secret", created_at: "t" },
      { id: 3, author: "equipe", body: "b", created_at: "t" },
    ];
    expect(publicMessages(rows).map((m) => m.author)).toEqual(["client", "equipe"]);
  });
});

describe("pseudonymisation avant l'IA", () => {
  it("retire e-mail, téléphone, lien, numéro de commande, adresse et nom du client", () => {
    const out = redactPii(
      "Je suis Afi Houngbédji, afi.h@mail.com, +229 01 97 11 22 33, commande WX-10258, lot 234 Akpakpa, voir https://x.y/z. Merci Afi !",
      ["Afi Houngbédji"],
    );
    for (const leak of ["Afi", "Houngbédji", "afi.h@mail.com", "97 11", "10258", "lot 234", "https://"]) expect(out).not.toContain(leak);
    expect(out).toContain("[e-mail]");
    expect(out).toContain("[téléphone]");
    expect(out).toContain("[nom]");
  });
});

describe("passage depuis l'assistant", () => {
  it("lien sans donnée personnelle ; catégorie selon le motif ; résumé = 3 derniers messages", () => {
    expect(escalationContactPath("refund")).toBe("/contact?depuis=assistant&motif=refund");
    expect(isEscalationKind("refund")).toBe(true);
    expect(isEscalationKind("x")).toBe(false);
    expect(escalationCategory("refund", "Je veux être remboursé")).toBe("retour");
    expect(escalationCategory("refund", "C'est une arnaque")).toBe("plainte");
    expect(escalationCategory("health", "")).toBe("plainte");
    expect(escalationCategory("legal", "")).toBe("question");
    expect(escalationSummary(["a", "b", "c", "d"])).toBe("b\nc\nd");
    expect(escalationSummary(["x".repeat(2000)]).length).toBe(1500);
  });
});

describe("brouillon IA : invite sans donnée personnelle", () => {
  const facts: DraftFacts = {
    shopName: "Wá xɔ",
    shipping: { cotonou: 1000, autre: 2500, freeFrom: 15000, cutoff: 20, returnDays: 7 },
    pay: { online: false, cod: true },
    kb: [{ title: "Retours", text: "Retours sous 7 jours." }],
  };
  const prompt = buildDraftPrompt({
    lang: "fr",
    category: "plainte",
    orderStatusLabel: "Livrée",
    customerName: "Kossi Agbo",
    facts,
    messages: [
      { author: "client", body: "Bonjour, ici Kossi Agbo (kossi@agbo.bj, 0197000000). Ma commande WX-10300 est arrivée cassée." },
      { author: "note_interne", body: "NOTE-SECRETE client difficile" },
      { author: "equipe", body: "Nous regardons." },
    ],
  });
  const all = prompt.system + prompt.user;
  it("ni nom, ni e-mail, ni téléphone, ni numéro de commande, ni note interne", () => {
    for (const leak of ["Kossi", "Agbo", "kossi@agbo.bj", "0197000000", "10300", "NOTE-SECRETE"]) expect(all).not.toContain(leak);
  });
  it("contient la catégorie, le statut de commande, les faits boutique (frais, retours à la charge du client hors zone)", () => {
    expect(prompt.user).toContain("Plainte");
    expect(prompt.user).toContain("Livrée");
    expect(prompt.user).toMatch(/1\s000/);
    expect(prompt.user).toContain("renvoi est à la charge du client");
    expect(prompt.user).toContain("Pas de paiement en ligne");
  });
  it("finalisation : prénom remis localement, marqueurs retirés, signature", () => {
    expect(finalizeDraft("Bonjour {{prenom}}, votre [commande] arrive.", "Kossi", "L'équipe", "fr")).toBe("Bonjour Kossi, votre arrive.\n\nL'équipe");
    expect(finalizeDraft("Bonjour {{prenom}}, merci.", "", "", "fr")).toBe("Bonjour, merci.");
  });
});

describe("e-mails Discussion (rendu)", () => {
  it("client : données échappées, lien privé présent, aucune espace insécable avant « : » en anglais", async () => {
    const { renderCustomerMail } = await import("@/lib/email/conversation");
    const brand = { shopName: "Wá xɔ", whatsapp: "+229 01 00 00 00 00", email: "contact@waxo.boutique" };
    const link = "https://www.waxo.boutique/fr/discussion/abc";
    const fr = renderCustomerMail({ kind: "received", locale: "fr", name: "<script>x</script>", subject: "<img src=x>", category: "plainte", orderNumber: null, link, brand, siteUrl: "https://www.waxo.boutique" });
    expect(fr.html).not.toContain("<script>x");
    expect(fr.html).not.toContain("<img src=x>");
    expect(fr.html).toContain(link);
    expect(fr.text).toContain("Ce lien est personnel :");
    const en = renderCustomerMail({ kind: "reply", locale: "en", name: "Afi", subject: "Late order", category: "commande", orderNumber: "WX-10300", link, brand, siteUrl: null });
    expect(en.subject).toBe("You have a reply from Wá xɔ");
    expect(en.text).not.toContain(" :");
    expect(en.text).toContain(`Read the reply: ${link}`);
  });
  it("équipe : extrait de 160 caractères au plus, prénom seulement", async () => {
    const { renderTeamMail } = await import("@/lib/email/conversation");
    const m = renderTeamMail({ kind: "new", conversationId: "id", category: "plainte", source: "contact", subject: "s", orderNumber: null, name: "Afi Houngbédji", body: "x ".repeat(400) + "FIN", siteUrl: "https://www.waxo.boutique" });
    expect(m.text).not.toContain("FIN");
    expect(m.text).not.toContain("Houngbédji");
    expect(m.text).toContain("https://www.waxo.boutique/admin/messages?c=id");
  });
});
