import { describe, expect, it, vi } from "vitest";
import { handleMessage } from "@/lib/accountant/handle";
import type { Writers } from "@/lib/accountant/handle";
import { fmtXof } from "@/lib/money";
import { DATA } from "./accountant-fixture";

const NOW = Date.UTC(2026, 9, 9, 10, 0);
const okWriters = (): Writers => ({ addEntry: vi.fn(async () => ({ ok: true as const })), setCost: vi.fn(async () => ({ ok: true as const })) });
const demoWriters: Writers = {
  addEntry: async () => ({ ok: false, code: "unavailable", message: "x" }),
  setCost: async () => ({ ok: false, code: "unavailable", message: "x" }),
};

describe("handleMessage", () => {
  it("note une dépense via l'écrivain injecté", async () => {
    const w = okWriters();
    const r = await handleMessage({ text: "J'ai payé 20 000 F de pub hier", data: DATA, now: NOW, writers: w });
    expect(w.addEntry).toHaveBeenCalledWith({ date: "2026-10-08", cat: "pub", label: "J'ai payé 20 000 F de pub", amount: 20000 });
    expect(r.changed).toBe(true);
    expect(r.rephrasable).toBe(false);
    expect(r.notes[0]).toContain("Publicité");
    expect(r.notes[0]).toContain(fmtXof(20000));
  });
  it("sans base : message de démo, rien d'enregistré", async () => {
    const r = await handleMessage({ text: "note 5 000 F de livraison", data: DATA, now: NOW, writers: demoWriters });
    expect(r.changed).toBe(false);
    expect(r.reply).toContain("Base non connectée (mode démo)");
  });
  it("enregistre un prix d'achat et avertit s'il dépasse le prix de vente", async () => {
    const w = okWriters();
    const r = await handleMessage({ text: "prix d'achat de la lampe 9 500 F", data: DATA, now: NOW, writers: w });
    expect(w.setCost).toHaveBeenCalledWith("lampe", 9500);
    expect(r.reply).toContain("supérieur ou égal");
  });
  it("produit introuvable : aucune écriture", async () => {
    const w = okWriters();
    const r = await handleMessage({ text: "prix d'achat tapis 1 000 F", data: DATA, now: NOW, writers: w });
    expect(w.setCost).not.toHaveBeenCalled();
    expect(r.changed).toBe(false);
  });
  it("répond aux questions sans écrire, sur le mois courant par défaut", async () => {
    const w = okWriters();
    const r = await handleMessage({ text: "Quelle est ma marge ce mois-ci ?", data: DATA, now: NOW, writers: w });
    expect(w.addEntry).not.toHaveBeenCalled();
    expect(r.reply).toContain("octobre 2026");
    expect(r.rephrasable).toBe(true);
  });
  it("respecte le mois cité puis le mois du carnet", async () => {
    const a = await handleMessage({ text: "résumé de septembre", data: DATA, now: NOW, writers: okWriters() });
    expect(a.reply).toContain("Septembre 2026");
    const b = await handleMessage({ text: "résumé", month: "2026-09", data: DATA, now: NOW, writers: okWriters() });
    expect(b.reply).toContain("Septembre 2026");
  });
});
