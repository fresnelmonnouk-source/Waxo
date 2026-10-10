import { describe, expect, it } from "vitest";
import { CSV_BOM, csvCell, toCsv } from "@/lib/settings/csv";
import { buildDraft, replyLink, retrieve, type KbDoc } from "@/lib/settings/kb-search";
import { fmtDateShort } from "@/lib/settings/format";

describe("settings : CSV", () => {
  it("neutralise les formules (= + - @) et les tabulations", () => {
    for (const v of ["=1+1", "+33", "-2", "@cmd", "\tx"]) expect(csvCell(v).replace(/^"/, "").startsWith("'")).toBe(true);
  });
  it("échappe les séparateurs, guillemets et retours à la ligne", () => {
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell('dit "oui"')).toBe('"dit ""oui"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell(null)).toBe("");
  });
  it("produit un CSV UTF-8 avec BOM, séparateur « ; » et CRLF", () => {
    const out = toCsv([
      ["Canal", "Contact"],
      ["E-mail", "a@b.bj"],
    ]);
    expect(out.startsWith(CSV_BOM)).toBe(true);
    expect(out).toBe(`${CSV_BOM}Canal;Contact\r\nE-mail;a@b.bj\r\n`);
  });
});

const docs: KbDoc[] = [
  {
    id: "1",
    kind: "kb",
    tag: "Livraison",
    title: "Délais et frais de livraison",
    text: "Cotonou : livraison le lendemain avant 18 h. Autres villes : 48 à 72 h. Frais 2 500 F.",
    keywords: "parakou délai ville",
  },
  { id: "2", kind: "kb", tag: "Retours", title: "Retours", text: "Retour sous 7 jours si le produit est intact.", keywords: "retour rembours" },
];

describe("settings : base de connaissances", () => {
  it("retrouve la fiche pertinente", () => {
    const hits = retrieve("Livrez-vous à Parakou ?", docs);
    expect(hits[0]?.id).toBe("1");
    expect(retrieve("xyzzy", docs)).toEqual([]);
    expect(retrieve("", docs)).toEqual([]);
  });
  it("brouillon : salutation, statut de commande, signature, sources", () => {
    const d = buildDraft(
      { name: "Hermann Quenum", contact: "x@y.bj", subject: "Livraison", text: "Livrez-vous à Parakou ?", orderNumber: "WX-10262", orderStatusLabel: "Reçue", aiSign: "L'équipe Wá xɔ" },
      docs,
    );
    expect(d.text.startsWith("Bonjour Hermann,")).toBe(true);
    expect(d.text).toContain("WX-10262");
    expect(d.text).toContain("« Reçue »");
    expect(d.text.endsWith("L'équipe Wá xɔ")).toBe(true);
    expect(d.sources[0].title).toBe("Délais et frais de livraison");
  });
  it("brouillon sans fiche : formule d'attente, aucune source", () => {
    const d = buildDraft({ name: "Awa", contact: "", subject: "", text: "zzzz", orderNumber: null, orderStatusLabel: null, aiSign: "S" }, docs);
    expect(d.text).toContain("Nous vérifions et revenons vers vous très vite.");
    expect(d.sources).toEqual([]);
  });
  it("lien de réponse : mailto sans injection de paramètre, sinon WhatsApp", () => {
    const mail = replyLink("a@b.bj", "Wá xɔ", "Bonjour");
    expect(mail.channel).toBe("email");
    expect(mail.href.startsWith("mailto:a@b.bj?subject=")).toBe(true);
    const evil = replyLink("a@b.bj?bcc=x@y.z", "Wá xɔ", null);
    expect(evil.href).not.toContain("?bcc");
    const wa = replyLink("0162334455", "Wá xɔ", "Salut");
    expect(wa.channel).toBe("whatsapp");
    expect(wa.href).toBe("https://wa.me/2290162334455?text=Salut");
  });
  it("formate les dates à l'heure du Bénin", () => {
    expect(fmtDateShort("2026-10-07T10:12:00")).toMatch(/10:12/);
  });
});
