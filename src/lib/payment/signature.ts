import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Vérification de la signature d'un webhook FedaPay.
 * En-tête `X-FEDAPAY-SIGNATURE: t=<timestamp>,s=<hex>` ; s = HMAC-SHA256(secret, `${t}.${corps brut}`).
 * Comparaison à temps constant ; horodatage borné pour limiter le rejeu (l'idempotence en base couvre le reste).
 */

export const SIGNATURE_TOLERANCE_SECONDS = 60 * 60;

export type SignatureCheck = { ok: true } | { ok: false; reason: "missing" | "malformed" | "stale" | "mismatch" };

export function parseSignatureHeader(header: string | null | undefined): { t: string; signatures: string[] } | null {
  if (!header) return null;
  let t = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === "t") t = v;
    else if (k === "s" || k === "v1") signatures.push(v);
  }
  return t && signatures.length > 0 ? { t, signatures } : null;
}

function safeEqualHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]+$/i.test(a) || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a.toLowerCase(), "hex"), Buffer.from(b.toLowerCase(), "hex"));
}

export function verifyFedapaySignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
  nowMs: number = Date.now(),
  toleranceSeconds: number = SIGNATURE_TOLERANCE_SECONDS,
): SignatureCheck {
  if (!header) return { ok: false, reason: "missing" };
  const parsed = parseSignatureHeader(header);
  if (!parsed || !/^\d{9,13}$/.test(parsed.t)) return { ok: false, reason: "malformed" };
  const ts = Number(parsed.t);
  // Horodatage en secondes (ou, par tolérance, en millisecondes).
  const tsSeconds = parsed.t.length > 11 ? ts / 1000 : ts;
  if (Math.abs(nowMs / 1000 - tsSeconds) > toleranceSeconds) return { ok: false, reason: "stale" };
  const expected = createHmac("sha256", secret).update(`${parsed.t}.${rawBody}`).digest("hex");
  return parsed.signatures.some((s) => safeEqualHex(s, expected)) ? { ok: true } : { ok: false, reason: "mismatch" };
}

/** Construit un en-tête valide (utile pour les tests). */
export function signFedapayPayload(rawBody: string, secret: string, tSeconds: number): string {
  const s = createHmac("sha256", secret).update(`${tSeconds}.${rawBody}`).digest("hex");
  return `t=${tSeconds},s=${s}`;
}
