// Audit 2026-10-12 : vérification Turnstile côté serveur, CSP du widget, remotePatterns (F5), textes security.json.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { turnstilePasses, turnstileSiteKey, verifyTurnstile } from "@/lib/auth/turnstile";
import { TURNSTILE_ORIGIN, withTurnstileCsp, withTurnstileHeaders } from "@/lib/auth/csp-turnstile";
import { buildCsp, headerRules } from "@/lib/seo/security-headers";
import fr from "@/messages/fr/security.json";
import en from "@/messages/en/security.json";

const keys = { NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: "secret" };
const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("verifyTurnstile", () => {
  it("inerte sans les DEUX clés : « disabled », aucun appel réseau, et aucun widget", async () => {
    const f = reply({ success: true });
    for (const source of [{}, { TURNSTILE_SECRET_KEY: "s" }, { NEXT_PUBLIC_TURNSTILE_SITE_KEY: "k" }]) {
      expect(await verifyTurnstile("tok", "1.1.1.1", { source, fetchImpl: f })).toBe("disabled");
      expect(turnstileSiteKey(source)).toBeNull();
    }
    expect(f).not.toHaveBeenCalled();
    expect(turnstileSiteKey(keys)).toBe("site");
  });
  it("jeton absent ou trop long → « missing » (bloquant) sans appel", async () => {
    const f = reply({ success: true });
    expect(await verifyTurnstile(undefined, null, { source: keys, fetchImpl: f })).toBe("missing");
    expect(await verifyTurnstile("x".repeat(3000), null, { source: keys, fetchImpl: f })).toBe("missing");
    expect(f).not.toHaveBeenCalled();
  });
  it("succès / refus / panne Cloudflare / secret faux", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await verifyTurnstile("t", "1.1.1.1", { source: keys, fetchImpl: reply({ success: true }) })).toBe("ok");
    expect(await verifyTurnstile("t", null, { source: keys, fetchImpl: reply({ success: false, "error-codes": ["timeout-or-duplicate"] }) })).toBe("invalid");
    expect(await verifyTurnstile("t", null, { source: keys, fetchImpl: reply({}, 502) })).toBe("unavailable");
    expect(await verifyTurnstile("t", null, { source: keys, fetchImpl: reply({ success: false, "error-codes": ["invalid-input-secret"] }) })).toBe("unavailable");
    expect(await verifyTurnstile("t", null, { source: keys, fetchImpl: vi.fn(async () => Promise.reject(new Error("net"))) as unknown as typeof fetch })).toBe("unavailable");
    err.mockRestore();
  });
  it("délai dépassé : abandon borné, « unavailable » (le client n'est pas bloqué par une panne de Cloudflare)", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const hang = vi.fn(
      (_u: string, init: RequestInit) =>
        new Promise<Response>((_r, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted")))),
    ) as unknown as typeof fetch;
    expect(await verifyTurnstile("t", null, { source: keys, fetchImpl: hang, timeoutMs: 20 })).toBe("unavailable");
    err.mockRestore();
  });
  it("seuls « missing » et « invalid » bloquent", () => {
    expect(turnstilePasses("disabled")).toBe(true);
    expect(turnstilePasses("ok")).toBe(true);
    expect(turnstilePasses("unavailable")).toBe(true);
    expect(turnstilePasses("missing")).toBe(false);
    expect(turnstilePasses("invalid")).toBe(false);
  });
});

describe("CSP du widget", () => {
  const parse = (csp: string) => Object.fromEntries(csp.split(";").map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
  it("script-src et frame-src autorisent challenges.cloudflare.com, le reste est inchangé", () => {
    const base = buildCsp(false);
    const csp = parse(withTurnstileCsp(base));
    expect(csp["script-src"]).toContain(TURNSTILE_ORIGIN);
    expect(csp["frame-src"]).toEqual(["'self'", TURNSTILE_ORIGIN]);
    expect(csp["frame-ancestors"]).toEqual(["'none'"]);
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(withTurnstileCsp(withTurnstileCsp(base))).toBe(withTurnstileCsp(base)); // sans doublon
  });
  it("appliqué aux en-têtes servis (next.config.ts)", () => {
    const rules = withTurnstileHeaders(headerRules(false));
    const csp = rules[0].headers.find((h) => h.key === "Content-Security-Policy")!.value;
    expect(csp).toContain(`frame-src 'self' ${TURNSTILE_ORIGIN}`);
    const cfg = readFileSync("next.config.ts", "utf8");
    expect(cfg).toContain("withTurnstileHeaders(headerRules(isDev))");
  });
});

describe("F5 : proxy d'images restreint au projet Waxo", () => {
  it("remotePatterns ne vise plus *.supabase.co", () => {
    const cfg = readFileSync("next.config.ts", "utf8");
    expect(cfg).toContain('hostname: "btarkkjimnkmiaxzonzq.supabase.co"');
    expect(cfg).not.toContain('"*.supabase.co"');
  });
});

describe("textes security.json", () => {
  const flat = (o: unknown, p = ""): Record<string, string> =>
    Object.entries(o as Record<string, unknown>).reduce<Record<string, string>>(
      (acc, [k, v]) => (typeof v === "string" ? { ...acc, [`${p}${k}`]: v } : { ...acc, ...flat(v, `${p}${k}.`) }),
      {},
    );
  it("mêmes clés FR / EN, sous le seul namespace « Security », sans tiret cadratin", () => {
    expect(Object.keys(fr)).toEqual(["Security"]);
    expect(Object.keys(flat(fr)).sort()).toEqual(Object.keys(flat(en)).sort());
    for (const v of [...Object.values(flat(fr)), ...Object.values(flat(en))]) expect(v).not.toContain("—");
  });
  it("FR : espace insécable avant « : ; ? ! »", () => {
    for (const v of Object.values(flat(fr))) expect(v, v).not.toMatch(/ [:;?!]/);
  });
});
