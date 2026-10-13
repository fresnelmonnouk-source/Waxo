import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONSENT_MAX_AGE_S, CONSENT_STORAGE_KEY, consentCookieString, makeConsent, parseConsent, parseCookieValue, readCookieValue } from "@/lib/tracking/consent";
import { CONSENT_PRESET_CSS, CONSENT_PRESET_STYLE_ID, consentPresetScript } from "@/lib/tracking/consent-preset";

const NOW = 1_800_000_000_000;

type FakeEl = { id: string; textContent: string };

/** Exécute le script inline comme le navigateur, avec un localStorage / document simulés ; renvoie la règle posée (ou null). */
function runPreset({ ls, cookie = "", lsThrows = false }: { ls?: string | null; cookie?: string; lsThrows?: boolean }): FakeEl | null {
  const head: FakeEl[] = [];
  const localStorage = {
    getItem: (k: string) => {
      if (lsThrows) throw new Error("SecurityError");
      return k === CONSENT_STORAGE_KEY ? (ls ?? null) : null;
    },
  };
  const document = {
    cookie,
    head: { appendChild: (el: FakeEl) => head.push(el) },
    createElement: () => ({ id: "", textContent: "" }),
    getElementById: (id: string) => head.find((e) => e.id === id) ?? null,
  };
  new Function("localStorage", "document", consentPresetScript())(localStorage, document);
  return head[0] ?? null;
}

/** Ce que décidera le client après hydratation (même ordre que consent-client.readStored). */
function clientHasChoice(ls: string | null | undefined, cookie: string): boolean {
  return !!(parseConsent(ls ?? null, NOW) ?? parseCookieValue(readCookieValue(cookie), NOW));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("bandeau de cookies : script inline avant peinture", () => {
  it("sans choix : rien n'est masqué (le bandeau serveur reste peint)", () => {
    expect(runPreset({ ls: null })).toBeNull();
  });

  it("choix valable en localStorage : masque la version « en attente » seulement", () => {
    const el = runPreset({ ls: JSON.stringify(makeConsent({ analytics: false, marketing: false }, NOW - 1000)) });
    expect(el).toEqual({ id: CONSENT_PRESET_STYLE_ID, textContent: CONSENT_PRESET_CSS });
    expect(CONSENT_PRESET_CSS).toBe("#waxo-consent[data-pending]{display:none}");
  });

  it("localStorage bloqué : le cookie fait foi", () => {
    const cookie = `a=1; ${consentCookieString(makeConsent({ analytics: true, marketing: true }, NOW - 5000), true).split(";")[0]}; b=2`;
    expect(runPreset({ lsThrows: true, cookie })).not.toBeNull();
  });

  it("le script donne la même réponse que le client (aucun bandeau qui disparaît ou réapparaît à l'hydratation)", () => {
    const ok = makeConsent({ analytics: true, marketing: false }, NOW - 1000);
    const expired = makeConsent({ analytics: true, marketing: true }, NOW - CONSENT_MAX_AGE_S * 1000 - 1);
    const future = makeConsent({ analytics: true, marketing: true }, NOW + 120_000);
    const cookieOf = (c: ReturnType<typeof makeConsent>) => consentCookieString(c, false).split(";")[0];
    const cases: { ls?: string | null; cookie?: string }[] = [
      { ls: JSON.stringify(ok) },
      { ls: JSON.stringify(expired) },
      { ls: JSON.stringify(future) },
      { ls: JSON.stringify({ ...ok, v: 2 }) },
      { ls: JSON.stringify({ ...ok, analytics: "oui" }) },
      { ls: "{pas du json" },
      { ls: null, cookie: cookieOf(ok) },
      { ls: null, cookie: cookieOf(expired) },
      { ls: null, cookie: "waxo_consent=1.a1.m1.abc" },
      { ls: null, cookie: "xwaxo_consent=" + cookieOf(ok).split("=")[1] },
      { ls: JSON.stringify(expired), cookie: cookieOf(ok) },
    ];
    for (const c of cases) {
      expect({ c, hidden: runPreset(c) !== null }).toEqual({ c, hidden: clientHasChoice(c.ls, c.cookie ?? "") });
    }
  });

  it("idempotent : une seule règle même si le script passe deux fois", () => {
    const ls = JSON.stringify(makeConsent({ analytics: false, marketing: true }, NOW));
    const head: FakeEl[] = [];
    const document = {
      cookie: "",
      head: { appendChild: (el: FakeEl) => head.push(el) },
      createElement: () => ({ id: "", textContent: "" }),
      getElementById: (id: string) => head.find((e) => e.id === id) ?? null,
    };
    const run = new Function("localStorage", "document", consentPresetScript());
    run({ getItem: () => ls }, document);
    run({ getItem: () => ls }, document);
    expect(head).toHaveLength(1);
  });

  it("ne contient ni balise fermante ni guillemet qui casserait le HTML inline", () => {
    const s = consentPresetScript();
    expect(s).not.toMatch(/<\/script/i);
    expect(s).not.toContain("<!--");
  });
});
