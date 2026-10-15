import "server-only";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { extractPageText, type PageText } from "./page-text";
import { robotsAllows } from "./robots";

/**
 * Lecture d'une page produit d'un AUTRE site pour le rédacteur IA des fiches (admin seulement). Serveur seulement.
 *
 * Défenses SSRF (le serveur ne doit jamais servir de relais vers le réseau interne de l'hébergeur) :
 *  - `https:` uniquement, port 443 implicite, pas d'identifiants dans l'URL, 2 000 caractères au plus ;
 *  - nom de domaine obligatoire (IP littérales refusées, `localhost`, `.local`, `.internal`… refusés) ;
 *  - le nom est résolu (toutes les adresses) et la requête est refusée si UNE adresse est privée ou réservée ;
 *  - redirections suivies à la main (3 au plus), chaque cible re-validée (schéma + DNS) ;
 *  - 8 s au total (robots.txt + résolution + redirections + lecture), corps lu en flux et coupé à 2 Mo, `text/html` ou
 *    `text/plain` ;
 *  - robots.txt de l'hôte respecté (WaxoBot, sinon `*`), lu avec les MÊMES défenses (Helena O2).
 *
 * ⚠ RÈGLE DE SÉCURITÉ INTOUCHABLE (audit Raphaël, 2026-10-14) : « https seul + port implicite (443) + certificat vérifié »
 * est LA parade au DNS rebinding. `fetch` résout le nom une seconde fois : un DNS malveillant pourrait alors répondre une
 * IP interne, mais la poignée de main TLS exige un certificat valide pour le nom de l'attaquant, qu'aucun service interne
 * ne peut présenter : la connexion échoue (« unreachable »), sans lecture ni oracle. Ne jamais désactiver la vérification
 * TLS (`NODE_TLS_REJECT_UNAUTHORIZED`, `rejectUnauthorized`, dispatcher global). Si un jour `http:` ou un port explicite
 * est autorisé, il faudra ÉPINGLER l'IP vérifiée (dispatcher undici avec `connect.lookup`) : sans TLS, plus de parade.
 */

export const FETCH_CFG = {
  timeoutMs: 8_000,
  maxBytes: 2 * 1024 * 1024,
  maxRedirects: 3,
  maxUrlLength: 2_000,
  userAgent: "WaxoBot/1.0 (+https://www.waxo.boutique)",
  /** En dessous (texte visible + données produit), la page est jugée vide : rendue en JavaScript ou protégée. */
  minChars: 200,
  /** robots.txt : lu au plus 512 Ko, en 2,5 s au plus (pris DANS le budget total de 8 s). */
  robotsMaxBytes: 512 * 1024,
  robotsTimeoutMs: 2_500,
  /** Jeton de produit cherché dans les groupes « User-agent » de robots.txt. */
  robotsAgent: "waxobot",
} as const;

export type FetchFailCode = "invalid" | "blocked" | "unreachable" | "timeout" | "refused" | "not_found" | "unsupported" | "empty";
export type FetchPageOk = { ok: true; url: string; page: PageText; bytes: number; cut: boolean; redirects: number };
export type FetchPageResult = FetchPageOk | { ok: false; code: FetchFailCode; status?: number };

/**
 * Consigne quand le lien ne peut pas être lu : noter les caractéristiques de SON article, jamais coller la page d'un autre
 * site (ce serait contourner son refus et envoyer un texte protégé au modèle : Helena J3).
 */
export const COPY_HINT = "notez dans vos notes les caractéristiques de votre article (mesures, matières, contenu de la boîte).";
export const FETCH_MESSAGES: Record<FetchFailCode, string> = {
  invalid: "Lien invalide : collez l'adresse complète d'une page produit, commençant par https://.",
  blocked: "Ce lien n'est pas autorisé : seules les pages de sites publics peuvent être lues.",
  unreachable: `Site injoignable : vérifiez le lien, ou ${COPY_HINT}`,
  timeout: `Le site met trop de temps à répondre : réessayez, ou ${COPY_HINT}`,
  refused: `Le site refuse la lecture automatique : ${COPY_HINT}`,
  not_found: `Page introuvable sur ce site : vérifiez le lien, ou ${COPY_HINT}`,
  unsupported: `Ce lien ne mène pas à une page web lisible (image, PDF…) : ${COPY_HINT}`,
  empty: `Le site refuse la lecture automatique : ${COPY_HINT}`,
};

// ───────────────────────── Adresses IP interdites ─────────────────────────

function parseV4(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const out = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return out.every((n) => n >= 0 && n <= 255) ? out : null;
}

/** [préfixe, longueur] des blocs IPv4 privés, partagés, réservés, de documentation et multicast. */
const V4_BLOCKED: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4], // inclut 255.255.255.255
];

const v4Int = (p: number[]) => ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
const inV4 = (ip: number, base: string, len: number) => {
  const mask = len === 0 ? 0 : (0xffffffff << (32 - len)) >>> 0;
  return ((ip & mask) >>> 0) === ((v4Int(parseV4(base)!) & mask) >>> 0);
};

/** 8 groupes de 16 bits, ou null si l'adresse n'est pas une IPv6 valide. Gère `::`, la zone `%eth0` et la fin IPv4. */
function parseV6(input: string): number[] | null {
  let s = input.toLowerCase().replace(/^\[|\]$/g, "");
  const zone = s.indexOf("%");
  if (zone >= 0) s = s.slice(0, zone);
  const last = s.lastIndexOf(":");
  if (last >= 0 && s.slice(last + 1).includes(".")) {
    const v4 = parseV4(s.slice(last + 1));
    if (!v4) return null;
    s = `${s.slice(0, last + 1)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

/** true = adresse interdite (privée, locale, réservée, de transition ou illisible). En cas de doute : interdite. */
export function isBlockedIp(ip: string): boolean {
  const v4 = parseV4(ip);
  if (v4) {
    const n = v4Int(v4);
    return V4_BLOCKED.some(([base, len]) => inV4(n, base, len));
  }
  const g = parseV6(ip);
  if (!g) return true;
  // Seul l'espace unicast global 2000::/3 est permis : exclut d'office ::, ::1, ::ffff:0:0/96 (IPv4 mappée),
  // ::/96 (IPv4 compatible), 64:ff9b::/96 et 64:ff9b:1::/48 (NAT64), 100::/64, fc00::/7, fe80::/10, fec0::/10, ff00::/8.
  if ((g[0] & 0xe000) !== 0x2000) return true;
  if (g[0] === 0x2001 && g[1] < 0x0200) return true; // 2001::/23 : Teredo, ORCHID, bancs d'essai…
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // 2001:db8::/32 : documentation
  if (g[0] === 0x2002) return true; // 2002::/16 : 6to4 (embarque une IPv4 arbitraire)
  if (g[0] === 0x3fff && g[1] < 0x1000) return true; // 3fff::/20 : documentation
  return false;
}

// ───────────────────────── Validation de l'URL ─────────────────────────

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".intranet", ".lan", ".home", ".corp", ".home.arpa", ".localdomain", ".test", ".invalid", ".example", ".onion"];

/** Forme de l'URL (sans réseau) : https, port implicite, sans identifiants, nom de domaine public. */
export function validatePageUrl(raw: unknown): { ok: true; url: URL } | { ok: false; code: "invalid" | "blocked" } {
  if (typeof raw !== "string") return { ok: false, code: "invalid" };
  const s = raw.trim();
  if (!s || s.length > FETCH_CFG.maxUrlLength) return { ok: false, code: "invalid" };
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return { ok: false, code: "invalid" };
  }
  if (url.protocol !== "https:") return { ok: false, code: "invalid" };
  // `new URL` normalise « :443 » en port vide : tout autre port est refusé.
  if (url.port !== "") return { ok: false, code: "invalid" };
  if (url.username || url.password) return { ok: false, code: "invalid" };
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  // IP littérale (y compris les formes que `new URL` normalise : 0x7f.1, 2130706433, [::1]) : refusée, même publique.
  if (isIP(host.replace(/^\[|\]$/g, "")) !== 0) return { ok: false, code: "blocked" };
  if (!host.includes(".") || host === "localhost" || BLOCKED_SUFFIXES.some((x) => host.endsWith(x))) return { ok: false, code: "blocked" };
  url.hash = "";
  return { ok: true, url };
}

// ───────────────────────── Lecture ─────────────────────────

type LookupFn = (hostname: string, opts: { all: true; verbatim: true }) => Promise<{ address: string; family: number }[]>;
export type FetchDeps = { fetchImpl?: typeof fetch; lookup?: LookupFn; timeoutMs?: number; maxBytes?: number; robotsTimeoutMs?: number };

class Deadline extends Error {}

/** Résout le nom et refuse si une seule adresse est interdite (ou si aucune). */
async function checkDns(host: string, lookup: LookupFn, signal: AbortSignal): Promise<"ok" | "blocked" | "unreachable" | "timeout"> {
  try {
    const addrs = await Promise.race([
      lookup(host.replace(/\.$/, ""), { all: true, verbatim: true }),
      new Promise<never>((_, rej) => {
        if (signal.aborted) rej(new Deadline());
        signal.addEventListener("abort", () => rej(new Deadline()), { once: true });
      }),
    ]);
    if (!addrs.length) return "unreachable";
    return addrs.some((a) => isBlockedIp(a.address)) ? "blocked" : "ok";
  } catch (e) {
    return e instanceof Deadline ? "timeout" : "unreachable";
  }
}

function charsetOf(contentType: string): string {
  const m = contentType.match(/charset\s*=\s*["']?([\w.:-]+)/i);
  return m ? m[1].toLowerCase() : "";
}

function decode(bytes: Uint8Array, charset: string): string {
  const tryDecode = (label: string) => {
    try {
      return new TextDecoder(label, { fatal: false }).decode(bytes);
    } catch {
      return null;
    }
  };
  if (charset) return tryDecode(charset) ?? tryDecode("utf-8")!;
  const utf8 = tryDecode("utf-8")!;
  // Pas de charset dans l'en-tête : on respecte une balise <meta charset> ancienne (windows-1252, iso-8859-1…).
  const meta = utf8.slice(0, 4096).match(/<meta[^>]+charset\s*=\s*["']?([\w.:-]+)/i)?.[1]?.toLowerCase();
  return meta && meta !== "utf-8" && meta !== "utf8" ? (tryDecode(meta) ?? utf8) : utf8;
}

/** Lit le corps en flux et s'arrête à `max` octets (le reste n'est pas téléchargé). */
async function readCapped(res: Response, max: number): Promise<{ bytes: Uint8Array; cut: boolean }> {
  if (!res.body) return { bytes: new Uint8Array(0), cut: false };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let cut = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (size + value.byteLength > max) {
      chunks.push(value.subarray(0, max - size));
      size = max;
      cut = true;
      await reader.cancel().catch(() => {});
      break;
    }
    chunks.push(value);
    size += value.byteLength;
  }
  const out = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return { bytes: out, cut };
}

const REFUSED_STATUS = new Set([401, 402, 403, 406, 407, 429, 451, 503]);

const requestHeaders = (accept: string) => ({ "User-Agent": FETCH_CFG.userAgent, Accept: accept, "Accept-Language": "fr,en;q=0.8" });

/**
 * Texte du robots.txt de l'hôte de `page`, lu avec les MÊMES défenses que la page (URL re-validée, DNS vérifié à chaque
 * saut, redirections manuelles, 3 au plus, 512 Ko au plus) et un délai court PRIS DANS le budget total (le signal global
 * l'interrompt aussi). null = absent, illisible, en erreur ou trop lent : la lecture de la page est alors permise.
 */
async function readRobots(page: URL, doFetch: typeof fetch, lookup: LookupFn, outer: AbortSignal, timeoutMs: number): Promise<string | null> {
  const ctrl = new AbortController();
  const stop = () => ctrl.abort();
  if (outer.aborted) return null;
  outer.addEventListener("abort", stop, { once: true });
  const timer = setTimeout(stop, timeoutMs);
  try {
    let url = new URL("/robots.txt", page);
    for (let hop = 0; hop <= FETCH_CFG.maxRedirects; hop++) {
      const checked = validatePageUrl(url.toString());
      if (!checked.ok) return null;
      if ((await checkDns(checked.url.hostname, lookup, ctrl.signal)) !== "ok") return null;
      let res: Response;
      try {
        res = await doFetch(checked.url.toString(), { method: "GET", redirect: "manual", signal: ctrl.signal, headers: requestHeaders("text/plain,*/*;q=0.5") });
      } catch {
        return null;
      }
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        await res.body?.cancel().catch(() => {});
        if (!location) return null;
        try {
          url = new URL(location, checked.url);
        } catch {
          return null;
        }
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel().catch(() => {});
        return null;
      }
      const { bytes } = await readCapped(res, FETCH_CFG.robotsMaxBytes);
      return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    outer.removeEventListener("abort", stop);
  }
}

export async function fetchPageText(rawUrl: unknown, deps: FetchDeps = {}): Promise<FetchPageResult> {
  const first = validatePageUrl(rawUrl);
  if (!first.ok) return first;
  const doFetch = deps.fetchImpl ?? fetch;
  const lookup = deps.lookup ?? (dnsLookup as unknown as LookupFn);
  const max = deps.maxBytes ?? FETCH_CFG.maxBytes;
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, deps.timeoutMs ?? FETCH_CFG.timeoutMs);

  // robots.txt lu une fois par hôte (une redirection vers un autre hôte relit le sien).
  const robots = new Map<string, string | null>();

  try {
    let url = first.url;
    for (let hop = 0; ; hop++) {
      const dns = await checkDns(url.hostname, lookup, ctrl.signal);
      if (dns !== "ok") return { ok: false, code: dns };
      // Respect de robots.txt AVANT toute requête vers la page (chaque cible de redirection comprise).
      if (!robots.has(url.host)) robots.set(url.host, await readRobots(url, doFetch, lookup, ctrl.signal, deps.robotsTimeoutMs ?? FETCH_CFG.robotsTimeoutMs));
      if (timedOut) return { ok: false, code: "timeout" }; // budget total épuisé pendant robots.txt
      const rules = robots.get(url.host);
      if (rules && !robotsAllows(rules, FETCH_CFG.robotsAgent, `${url.pathname}${url.search}`)) return { ok: false, code: "refused" };
      let res: Response;
      try {
        res = await doFetch(url.toString(), {
          method: "GET",
          redirect: "manual",
          signal: ctrl.signal,
          headers: requestHeaders("text/html,text/plain;q=0.9"),
        });
      } catch {
        return { ok: false, code: timedOut ? "timeout" : "unreachable" };
      }

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        await res.body?.cancel().catch(() => {});
        if (!location) return { ok: false, code: "unreachable", status: res.status };
        if (hop >= FETCH_CFG.maxRedirects) return { ok: false, code: "refused", status: res.status };
        let next: URL;
        try {
          next = new URL(location, url);
        } catch {
          return { ok: false, code: "invalid" };
        }
        // Chaque cible est re-validée : une redirection vers http://, une IP ou un nom interne est refusée.
        const checked = validatePageUrl(next.toString());
        if (!checked.ok) return { ok: false, code: checked.code === "invalid" ? "blocked" : checked.code };
        url = checked.url;
        continue;
      }

      if (!res.ok) {
        await res.body?.cancel().catch(() => {});
        if (res.status === 404 || res.status === 410) return { ok: false, code: "not_found", status: res.status };
        return { ok: false, code: REFUSED_STATUS.has(res.status) ? "refused" : "unreachable", status: res.status };
      }

      const type = (res.headers.get("content-type") ?? "").toLowerCase();
      const mime = type.split(";")[0].trim();
      if (mime !== "text/html" && mime !== "text/plain") {
        await res.body?.cancel().catch(() => {});
        return { ok: false, code: "unsupported", status: res.status };
      }

      let body: { bytes: Uint8Array; cut: boolean };
      try {
        body = await readCapped(res, max);
      } catch {
        return { ok: false, code: timedOut ? "timeout" : "unreachable" };
      }
      const raw = decode(body.bytes, charsetOf(type));
      const page = mime === "text/plain" ? extractPageText(`<body><pre>${raw.replace(/</g, "&lt;")}</pre></body>`) : extractPageText(raw);
      if (page.challenge) return { ok: false, code: "refused", status: res.status };
      if (page.bodyChars + (page.hasProductData ? FETCH_CFG.minChars : 0) < FETCH_CFG.minChars) return { ok: false, code: "empty", status: res.status };
      return { ok: true, url: url.toString(), page, bytes: body.bytes.byteLength, cut: body.cut, redirects: hop };
    }
  } finally {
    clearTimeout(timer);
  }
}
