import { describe, expect, it } from "vitest";
import { signFedapayPayload, verifyFedapaySignature, parseSignatureHeader } from "@/lib/payment/signature";
import { orderStatusToken, verifyOrderStatusToken } from "@/lib/payment/token";
import { cronAuthorized } from "@/lib/payment/cron-auth";
import { fedapayConfig, siteUrl } from "@/lib/payment/config";

const SECRET = "whsec_test_secret";
const BODY = JSON.stringify({ name: "transaction.approved", entity: { id: 42 } });
const NOW = 1_800_000_000_000;
const T = Math.floor(NOW / 1000);

describe("signature du webhook FedaPay", () => {
  it("accepte une signature valide", () => {
    expect(verifyFedapaySignature(BODY, signFedapayPayload(BODY, SECRET, T), SECRET, NOW)).toEqual({ ok: true });
  });
  it("refuse un corps modifié, un mauvais secret, un en-tête absent ou mal formé", () => {
    const h = signFedapayPayload(BODY, SECRET, T);
    expect(verifyFedapaySignature(BODY + " ", h, SECRET, NOW)).toEqual({ ok: false, reason: "mismatch" });
    expect(verifyFedapaySignature(BODY, h, "autre", NOW)).toEqual({ ok: false, reason: "mismatch" });
    expect(verifyFedapaySignature(BODY, null, SECRET, NOW)).toEqual({ ok: false, reason: "missing" });
    expect(verifyFedapaySignature(BODY, "nimporte quoi", SECRET, NOW)).toEqual({ ok: false, reason: "malformed" });
    expect(verifyFedapaySignature(BODY, `t=${T},s=zzzz`, SECRET, NOW)).toEqual({ ok: false, reason: "mismatch" });
  });
  it("refuse un horodatage trop ancien (rejeu)", () => {
    const old = T - 3 * 3600;
    expect(verifyFedapaySignature(BODY, signFedapayPayload(BODY, SECRET, old), SECRET, NOW)).toEqual({ ok: false, reason: "stale" });
  });
  it("lit l'en-tête t=…,s=…", () => {
    expect(parseSignatureHeader("t=123456789,s=abcd")).toEqual({ t: "123456789", signatures: ["abcd"] });
    expect(parseSignatureHeader("")).toBeNull();
  });
});

describe("jeton de suivi du retour de paiement", () => {
  const env = { FEDAPAY_WEBHOOK_SECRET: "s3cret" };
  it("est stable, lié au numéro, et vérifié à temps constant", () => {
    const k = orderStatusToken("WX-10263", env);
    expect(k).toMatch(/^[0-9a-f]{32}$/);
    expect(orderStatusToken("WX-10263", env)).toBe(k);
    expect(orderStatusToken("WX-10264", env)).not.toBe(k);
    expect(verifyOrderStatusToken("WX-10263", k!, env)).toBe(true);
    expect(verifyOrderStatusToken("WX-10264", k!, env)).toBe(false);
    expect(verifyOrderStatusToken("WX-10263", "0".repeat(32), env)).toBe(false);
    expect(verifyOrderStatusToken("WX-10263", "court", env)).toBe(false);
  });
  it("n'existe pas sans secret (mode mock)", () => {
    expect(orderStatusToken("WX-1", {})).toBeNull();
    expect(verifyOrderStatusToken("WX-1", "a".repeat(32), {})).toBe(false);
  });
});

describe("autorisation du cron", () => {
  it("n'accepte que Bearer <CRON_SECRET>", () => {
    expect(cronAuthorized("Bearer abc", "abc")).toBe(true);
    expect(cronAuthorized("Bearer abd", "abc")).toBe(false);
    expect(cronAuthorized("abc", "abc")).toBe(false);
    expect(cronAuthorized(null, "abc")).toBe(false);
    expect(cronAuthorized("Bearer abc", undefined)).toBe(false);
    expect(cronAuthorized("Bearer ", "")).toBe(false);
  });
});

describe("configuration FedaPay", () => {
  it("déduit l'environnement de la clé, FEDAPAY_ENV prime", () => {
    expect(fedapayConfig({})).toBeNull();
    expect(fedapayConfig({ FEDAPAY_SECRET_KEY: "sk_sandbox_x" })?.apiBase).toBe("https://sandbox-api.fedapay.com/v1");
    expect(fedapayConfig({ FEDAPAY_SECRET_KEY: "sk_live_x" })?.apiBase).toBe("https://api.fedapay.com/v1");
    expect(fedapayConfig({ FEDAPAY_SECRET_KEY: "sk_live_x", FEDAPAY_ENV: "sandbox" })?.env).toBe("sandbox");
  });
  it("origine du site", () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "https://waxo.bj/" })).toBe("https://waxo.bj");
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "waxo.vercel.app" })).toBe("https://waxo.vercel.app");
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "javascript:alert(1)" })).toBeNull();
    expect(siteUrl({})).toBeNull();
  });
});
