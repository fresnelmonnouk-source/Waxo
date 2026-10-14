// Rédacteur IA des fiches : durcissements de la lecture du lien (revues du 2026-10-14).
//  - Extraction du texte en coût LINÉAIRE sur du HTML hostile de 2 Mo (Raphaël 🟡1 / Victor W3 / Zoé Z6).
//  - Marque du JSON-LD exposée (Helena J2).
//  - robots.txt respecté, lu avec les mêmes défenses que la page (Helena O2).
import { describe, expect, it, vi } from "vitest";
import { fetchPageText, type FetchDeps } from "@/lib/admin/ai/fetch-page";
import { extractPageText, htmlToText } from "@/lib/admin/ai/page-text";
import { robotsAllows } from "@/lib/admin/ai/robots";

const PUBLIC_IP = "93.184.216.34";
const lookupTo = (...addresses: string[]) =>
  vi.fn(async () => addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })));
const LONG_TEXT = "Gourde isotherme en acier inoxydable. ".repeat(20);
const PAGE = `<!doctype html><html><head><title>Gourde inox 750 ml &ndash; Boutique</title>
<meta name="description" content="Gourde isotherme 750 ml, garde au frais 24 h.">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Gourde inox","color":"Noir"}</script>
</head><body><main><h1>Gourde inox</h1><p>${LONG_TEXT}</p></main></body></html>`;
const html = (body: string, init: ResponseInit = {}) => new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" }, ...init });
const raw = (fetchImpl: (url: string, init?: RequestInit) => Promise<Response>, extra: Partial<FetchDeps> = {}): FetchDeps => ({
  fetchImpl: fetchImpl as unknown as typeof fetch,
  lookup: lookupTo(PUBLIC_IP),
  ...extra,
});

describe("extraction : coût linéaire sur du HTML hostile", () => {
  const MB2 = 2 * 1024 * 1024;
  const fill = (unit: string) => unit.repeat(Math.ceil(MB2 / unit.length)).slice(0, MB2);
  it.each([
    ["« < » répété", fill("<")],
    ["« <nav » répété", fill("<nav ")],
    ["« <meta » répété", fill("<meta ")],
    ["« <a » répété", fill("<a ")],
    ["« <title> » répété", fill("<title>")],
    ["« <body » répété", fill("<body ")],
    ["« <script type=ld+json> » non refermé", fill(`<script type="application/ld+json">{`)],
    ["« <script> » non refermé", fill("<script>x")],
    ["« <li » répété", fill("<li ")],
    ["mélange", fill("<<nav <meta a=<title><p x")],
    ["balise <meta> géante", `<meta ${"a".repeat(MB2 - 10)}>`],
    ["attribut sans fin", `<meta content="${"a".repeat(MB2 - 20)}`],
    ["texte normal suivi de 2 Mo de « < »", `<html><body><p>x</p>${fill("<")}`],
  ])("%s : 2 Mo traités en moins d'une seconde", (_label, input) => {
    const t0 = performance.now();
    extractPageText(input);
    expect(performance.now() - t0).toBeLessThan(1000);
  });
  it("le résultat reste correct avec les nouveaux motifs", () => {
    expect(htmlToText(`<p class="a">Gourde</p><img alt="x"><br/>inox`)).toBe("Gourde\ninox");
    const p = extractPageText(PAGE);
    expect(p.text).toContain("Titre de la page : Gourde inox 750 ml – Boutique");
    expect(p.text).toContain("Description (méta) : Gourde isotherme 750 ml, garde au frais 24 h.");
    expect(p.text).toContain("Données produit structurées :\nNom : Gourde inox\nCouleur : Noir");
  });
  it("marque du JSON-LD exposée pour le contrôle après génération", () => {
    const withBrand = PAGE.replace(`"name":"Gourde inox",`, `"name":"Gourde inox","brand":{"@type":"Brand","name":"Thermos"},`);
    expect(extractPageText(withBrand).brands).toEqual(["Thermos"]);
    expect(extractPageText(PAGE).brands).toEqual([]);
  });
});

describe("robots.txt respecté avant la lecture", () => {
  /** Faux site : robots.txt donné (null = 404), la page sinon ; liste les requêtes vers la page. */
  function site(robots: string | Response | null) {
    const pageCalls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      if (new URL(url).pathname === "/robots.txt") {
        if (robots instanceof Response) return robots;
        return robots === null ? new Response("", { status: 404 }) : new Response(robots, { status: 200, headers: { "content-type": "text/plain" } });
      }
      pageCalls.push(url);
      return html(PAGE);
    });
    return { fetchImpl, pageCalls };
  }

  it("chemin interdit pour « * » : refus (même code), la page n'est jamais demandée", async () => {
    const s = site("User-agent: *\nDisallow: /produits/\n");
    expect(await fetchPageText("https://boutique.com/produits/gourde", raw(s.fetchImpl))).toMatchObject({ ok: false, code: "refused" });
    expect(s.pageCalls).toEqual([]);
    expect(s.fetchImpl).toHaveBeenCalledWith("https://boutique.com/robots.txt", expect.objectContaining({ redirect: "manual" }));
  });
  it("chemin interdit pour WaxoBot : refus ; un groupe WaxoBot qui permet l'emporte sur « * »", async () => {
    const deny = site("User-agent: Googlebot\nDisallow:\n\nUser-agent: WaxoBot\nDisallow: /\n");
    expect(await fetchPageText("https://boutique.com/p", raw(deny.fetchImpl))).toMatchObject({ ok: false, code: "refused" });
    const allow = site("User-agent: *\nDisallow: /\n\nUser-agent: waxobot/1.0\nAllow: /\n");
    expect(await fetchPageText("https://boutique.com/p", raw(allow.fetchImpl))).toMatchObject({ ok: true });
  });
  it("chemin permis, fichier absent, en erreur ou vide : lecture permise", async () => {
    for (const robots of ["User-agent: *\nDisallow: /panier\n", null, new Response("boom", { status: 500 }), ""]) {
      const s = site(robots);
      expect(await fetchPageText("https://boutique.com/p", raw(s.fetchImpl))).toMatchObject({ ok: true });
      expect(s.pageCalls).toEqual(["https://boutique.com/p"]);
    }
  });
  it("robots.txt muet : délai court puis lecture permise ; budget total dépassé : timeout", async () => {
    const fetchImpl = vi.fn((url: string, init?: RequestInit) =>
      new URL(url).pathname === "/robots.txt"
        ? new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))
        : Promise.resolve(html(PAGE)),
    );
    const t0 = Date.now();
    expect(await fetchPageText("https://boutique.com/p", raw(fetchImpl, { robotsTimeoutMs: 50 }))).toMatchObject({ ok: true });
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(await fetchPageText("https://boutique.com/p", raw(fetchImpl, { robotsTimeoutMs: 5000, timeoutMs: 50 }))).toMatchObject({ ok: false, code: "timeout" });
  });
  it("redirection de robots.txt vers une adresse interne : jamais suivie (traité comme absent)", async () => {
    const lookup = vi.fn(async (host: string) => [{ address: host === "evil.example.org" ? "10.0.0.1" : PUBLIC_IP, family: 4 }]);
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      calls.push(url);
      if (url === "https://boutique.com/robots.txt") return new Response(null, { status: 301, headers: { location: "https://evil.example.org/robots.txt" } });
      return html(PAGE);
    });
    expect(await fetchPageText("https://boutique.com/p", { fetchImpl: fetchImpl as unknown as typeof fetch, lookup })).toMatchObject({ ok: true });
    expect(calls).toEqual(["https://boutique.com/robots.txt", "https://boutique.com/p"]);
    expect(lookup).toHaveBeenCalledWith("evil.example.org", { all: true, verbatim: true });
  });
  it("redirection de la PAGE vers un autre hôte : le robots.txt de cet hôte est lu et respecté", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      calls.push(url);
      if (url === "https://boutique.com/robots.txt") return new Response("", { status: 404 });
      if (url === "https://boutique.com/p") return new Response(null, { status: 302, headers: { location: "https://autre.com/fiche" } });
      if (url === "https://autre.com/robots.txt") return new Response("User-agent: *\nDisallow: /fiche\n", { status: 200 });
      return html(PAGE);
    });
    expect(await fetchPageText("https://boutique.com/p", raw(fetchImpl))).toMatchObject({ ok: false, code: "refused" });
    expect(calls).toEqual(["https://boutique.com/robots.txt", "https://boutique.com/p", "https://autre.com/robots.txt"]);
  });
  it("robots.txt de plus de 512 Ko : lu jusqu'à la limite, la règle du début s'applique", async () => {
    const s = site(`User-agent: *\nDisallow: /p\n${"# commentaire\n".repeat(60_000)}`);
    expect(await fetchPageText("https://boutique.com/p", raw(s.fetchImpl))).toMatchObject({ ok: false, code: "refused" });
  });
});

describe("robotsAllows (lecture simple)", () => {
  const A = "waxobot";
  it.each([
    ["User-agent: *\nDisallow: /", "/p", false],
    ["User-agent: *\nDisallow:", "/p", true],
    ["User-agent: *\nDisallow: /private", "/private/x", false],
    ["User-agent: *\nDisallow: /private", "/public", true],
    ["User-agent: *\nDisallow: /produits/\nAllow: /produits/gourde", "/produits/gourde-inox", true],
    ["User-agent: *\nAllow: /produits/\nDisallow: /produits/gourde", "/produits/gourde-inox", false],
    ["User-agent: *\nDisallow: /p\nAllow: /p", "/p", true],
    ["User-agent: *\nDisallow: /*.pdf$", "/doc/notice.pdf", false],
    ["User-agent: *\nDisallow: /*.pdf$", "/doc/notice.pdf?x=1", true],
    ["User-agent: *\nDisallow: /*?sessionid", "/p?sessionid=3", false],
    ["User-agent: *\nDisallow: /fr/*/avis", "/fr/gourde/avis", false],
    ["User-agent: *\nDisallow: /fr/*/avis", "/fr/gourde", true],
    ["User-agent: *\nDisallow: /exact$", "/exact", false],
    ["User-agent: *\nDisallow: /exact$", "/exact/plus", true],
    ["User-agent: Googlebot\nDisallow: /", "/p", true],
    ["User-agent: Googlebot\nUser-agent: WaxoBot\nDisallow: /p # commentaire", "/p", false],
    ["Disallow: /\nUser-agent: *\nAllow: /", "/p", true],
    ["user-agent: *\r\ndisallow: /P", "/p", true],
    ["User-agent: *\nDisallow: /café", "/caf%C3%A9/x", false],
  ] as const)("%j sur %s → %s", (txt, path, allowed) => {
    expect(robotsAllows(txt, A, path)).toBe(allowed);
  });
  it("motif hostile (beaucoup de jokers) : réponse rapide", () => {
    const txt = `User-agent: *\nDisallow: /${"a*".repeat(250)}b\n`;
    const t0 = performance.now();
    expect(robotsAllows(txt, A, `/${"a".repeat(2000)}`)).toBe(true);
    expect(performance.now() - t0).toBeLessThan(500);
  });
});
