import { describe, expect, it } from "vitest";
import { DEFAULT_FORM, formFromSettings, parseSettingsForm, type SettingsForm } from "@/lib/settings/schema";
import { normalizeWhatsapp, prettyPhone } from "@/lib/settings/phone";

const base = (): SettingsForm => ({ ...DEFAULT_FORM, pay: { ...DEFAULT_FORM.pay }, legal: { ...DEFAULT_FORM.legal } });

describe("settings : formulaire", () => {
  it("accepte les valeurs par défaut et normalise le WhatsApp", () => {
    const r = parseSettingsForm(base());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.brand.whatsapp).toBe("+229 01 00 00 00 00");
      expect(r.data.brand.waNumber).toBe("2290100000000");
      expect(r.data.shipping).toEqual({ cotonou: 1000, autre: 2500, freeFrom: 15000, cutoff: 18 });
      expect(r.data.flags.autoDraft).toBe(true);
    }
  });

  it("accepte des nombres avec espaces (« 15 000 »)", () => {
    const r = parseSettingsForm({ ...base(), freeFrom: "15 000" });
    expect(r.ok && r.data.shipping.freeFrom).toBe(15000);
  });

  it.each(["-5", "abc", "", "1.5e3", "1234567890123"])("refuse un montant invalide : %s", (v) => {
    const r = parseSettingsForm({ ...base(), shipCotonou: v });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.shipCotonou).toBeTruthy();
  });

  it("borne l'heure limite à 0-23", () => {
    expect(parseSettingsForm({ ...base(), cutoff: "0" }).ok).toBe(true);
    expect(parseSettingsForm({ ...base(), cutoff: "23" }).ok).toBe(true);
    const r = parseSettingsForm({ ...base(), cutoff: "24" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.cutoff).toBe("Entre 0 et 23 h.");
  });

  it("exige au moins un moyen de paiement actif", () => {
    const r = parseSettingsForm({ ...base(), pay: { momo: false, moov: false, celtiis: false, carte: false, cod: false } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.pay).toMatch(/au moins un moyen/);
    expect(parseSettingsForm({ ...base(), pay: { momo: false, moov: false, celtiis: false, carte: false, cod: true } }).ok).toBe(true);
  });

  it("refuse un e-mail, un WhatsApp ou un e-mail légal invalide", () => {
    const r = parseSettingsForm({ ...base(), email: "pas-un-email", whatsapp: "123", legal: { ...base().legal, email: "x" } });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.email).toBeTruthy();
      expect(r.errors.whatsapp).toBeTruthy();
      expect(r.errors["legal.email"]).toBeTruthy();
    }
  });

  it("refuse les champs inconnus et les types faux (strict)", () => {
    expect(parseSettingsForm({ ...base(), role: "admin" }).ok).toBe(false);
    expect(parseSettingsForm({ ...base(), autoDraft: "oui" }).ok).toBe(false);
    expect(parseSettingsForm(null).ok).toBe(false);
  });

  it("normalise le téléphone légal ; laisse les mentions vides par défaut", () => {
    const r = parseSettingsForm({ ...base(), legal: { ...base().legal, phone: "0196554433" } });
    expect(r.ok && r.data.legal.phone).toBe("+229 01 96 55 44 33");
    expect(r.ok && r.data.legal.companyName).toBe("");
  });

  it("formFromSettings : défauts si absent, valeurs de la base sinon", () => {
    expect(formFromSettings({})).toEqual(DEFAULT_FORM);
    const f = formFromSettings({ shipping: { cotonou: 500, autre: 2000, freeFrom: 10000, cutoff: 17 }, flags: { autoDraft: false }, legal: { ifu: "123" } });
    expect(f.shipCotonou).toBe("500");
    expect(f.autoDraft).toBe(false);
    expect(f.legal.ifu).toBe("123");
    expect(f.legal.rccm).toBe("");
  });
});

describe("settings : téléphone", () => {
  it("normalise les formats béninois", () => {
    expect(normalizeWhatsapp("0196554433")).toEqual({ display: "+229 01 96 55 44 33", waNumber: "2290196554433" });
    expect(normalizeWhatsapp("+229 01 96 55 44 33")?.waNumber).toBe("2290196554433");
    expect(normalizeWhatsapp("96554433")?.waNumber).toBe("2290196554433");
    expect(normalizeWhatsapp("00229 0196554433")?.waNumber).toBe("2290196554433");
  });
  it("accepte un numéro international, refuse le reste", () => {
    expect(normalizeWhatsapp("+33 6 12 34 56 78")).toEqual({ display: "+33612345678", waNumber: "33612345678" });
    expect(normalizeWhatsapp("12345")).toBeNull();
    expect(normalizeWhatsapp("")).toBeNull();
    expect(normalizeWhatsapp("0296554433")).toBeNull();
  });
  it("prettyPhone", () => expect(prettyPhone("2290196554433")).toBe("01 96 55 44 33"));
});
