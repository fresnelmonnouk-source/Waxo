// Rédacteur IA des fiches produit : lecture du lien (fetch-page.ts) et extraction du texte (page-text.ts).
// Sécurité : URL https seulement, blocage SSRF (IP privées v4/v6, IPv4 mappée, noms internes, redirection vers privé),
// délai total, coupe à 2 Mo, type de contenu. Extraction : titre, méta, JSON-LD Product, scripts retirés.
import { describe, expect, it, vi } from "vitest";
import { FETCH_MESSAGES, fetchPageText, isBlockedIp, validatePageUrl, type FetchDeps } from "@/lib/admin/ai/fetch-page";
import { decodeEntities, extractPageText, htmlToText } from "@/lib/admin/ai/page-text";

const PUBLIC_IP = "93.184.216.34";
const lookupTo = (...addresses: string[]) =>
  vi.fn(async () => addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })));

const LONG_TEXT = "Gourde isotherme en acier inoxydable. ".repeat(20);
const PAGE = `<!doctype html><html><head><title>Gourde inox 750 ml &ndash; Boutique</title>
<meta name="description" content="Gourde isotherme 750 ml, garde au frais 24 h.">
<meta property="og:title" content="Gourde inox">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"Boutique"},{"@type":"Product","name":"Gourde inox","description":"<p>Double paroi</p>","color":"Noir","material":"Acier inoxydable","weight":{"@type":"QuantitativeValue","value":350,"unitCode":"GRM"},"additionalProperty":[{"@type":"PropertyValue","name":"Contenance","value":"750 ml"}],"offers":{"price":"19.99"}}]}</script>
<script>window.secret = "ne doit pas sortir";</script><style>.x{color:red}</style></head>
<body><nav>Accueil Promo Panier</nav><main><h1>Gourde inox</h1><p>${LONG_TEXT}</p><ul><li>Bouchon bambou</li><li>Sans BPA</li></ul></main>
<noscript>Activez JavaScript</noscript><svg><text>logo</text></svg><footer>Mentions légales</footer></body></html>`;

const html = (body: string, init: ResponseInit = {}) =>
  new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" }, ...init });

/**
 * Dépendances de test : robots.txt répond 404 (lecture permise) SANS passer par `fetchImpl`, pour que les comptes d'appels
 * des tests ci-dessous ne portent que sur la page. robots.txt est testé dans product-writer-page-robots.test.ts.
 */
function deps(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>, lookup: FetchDeps["lookup"] = lookupTo(PUBLIC_IP), extra: Partial<FetchDeps> = {}): FetchDeps {
  const routed = (url: string, init?: RequestInit) => (new URL(url).pathname === "/robots.txt" ? Promise.resolve(new Response("nope", { status: 404 })) : fetchImpl(url, init));
  return { fetchImpl: routed as unknown as typeof fetch, lookup, ...extra };
}

describe("validatePageUrl", () => {
  it("accepte une page https publique (port 443 explicite normalisé)", () => {
    expect(validatePageUrl("https://boutique.com/produit/gourde?ref=1#avis")).toMatchObject({ ok: true });
    expect(validatePageUrl("https://boutique.com:443/p")).toMatchObject({ ok: true });
    const r = validatePageUrl("https://boutique.com/p#x");
    if (r.ok) expect(r.url.hash).toBe("");
  });
  it.each([
    ["http://boutique.com/p"],
    ["ftp://boutique.com/p"],
    ["javascript:alert(1)"],
    ["file:///etc/passwd"],
    ["https://boutique.com:8443/p"],
    ["https://user:pass@boutique.com/p"],
    ["https://user@boutique.com/p"],
    ["pas une url"],
    [""],
    [`https://boutique.com/${"a".repeat(2000)}`],
  ])("refuse %s", (u) => {
    expect(validatePageUrl(u)).toMatchObject({ ok: false, code: "invalid" });
  });
  it.each([
    ["https://localhost/p"],
    ["https://LOCALHOST./p"],
    ["https://api.localhost/p"],
    ["https://imprimante.local/p"],
    ["https://metadata.google.internal/p"],
    ["https://intranet/p"],
    ["https://127.0.0.1/p"],
    ["https://10.0.0.5/p"],
    ["https://2130706433/p"],
    ["https://0x7f.1/p"],
    ["https://[::1]/p"],
    ["https://[::ffff:127.0.0.1]/p"],
    ["https://93.184.216.34/p"],
  ])("refuse le nom interne ou l'IP littérale %s", (u) => {
    expect(validatePageUrl(u)).toMatchObject({ ok: false, code: "blocked" });
  });
});

describe("isBlockedIp", () => {
  it.each([
    "0.0.0.0", "10.1.2.3", "100.64.0.1", "127.0.0.1", "169.254.169.254", "172.16.0.1", "172.31.255.255", "192.168.1.1",
    "198.18.0.1", "198.19.255.255", "224.0.0.1", "240.0.0.1", "255.255.255.255", "192.0.2.10",
    "::", "::1", "fc00::1", "fd12:3456::1", "fe80::1", "fe80::1%eth0", "ff02::1", "::ffff:127.0.0.1", "::ffff:7f00:1",
    "::ffff:10.0.0.1", "::127.0.0.1", "64:ff9b::7f00:1", "64:ff9b::a00:1", "2001:db8::1", "2002:7f00:1::1", "2001::1",
    "pas-une-ip", "1.2.3", "1:2:3",
  ])("bloque %s", (ip) => {
    expect(isBlockedIp(ip)).toBe(true);
  });
  it.each(["93.184.216.34", "8.8.8.8", "172.32.0.1", "100.128.0.1", "2606:4700:4700::1111", "2a00:1450:4007:80b::200e"])("laisse passer %s", (ip) => {
    expect(isBlockedIp(ip)).toBe(false);
  });
});

describe("fetchPageText : SSRF", () => {
  it("refuse un nom qui résout vers une IP privée (sans requête)", async () => {
    const fetchImpl = vi.fn(async () => html(PAGE));
    const r = await fetchPageText("https://boutique.com/p", deps(fetchImpl, lookupTo("10.0.0.7")));
    expect(r).toMatchObject({ ok: false, code: "blocked" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("refuse si UNE des adresses résolues est privée (IPv6 locale, IPv4 mappée)", async () => {
    for (const bad of ["fd00::1", "::ffff:192.168.0.1", "::1"]) {
      const fetchImpl = vi.fn(async () => html(PAGE));
      const r = await fetchPageText("https://boutique.com/p", deps(fetchImpl, lookupTo(PUBLIC_IP, bad)));
      expect(r).toMatchObject({ ok: false, code: "blocked" });
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });
  it("redirection vers un nom qui résout en privé : refusée, la cible n'est jamais appelée", async () => {
    const lookup = vi.fn(async (host: string) => [{ address: host === "evil.example.org" ? "169.254.169.254" : PUBLIC_IP, family: 4 }]);
    const fetchImpl = vi.fn(async (url: string) =>
      url.startsWith("https://boutique.com") ? new Response(null, { status: 302, headers: { location: "https://evil.example.org/latest/meta-data" } }) : html(PAGE),
    );
    const r = await fetchPageText("https://boutique.com/p", deps(fetchImpl, lookup));
    expect(r).toMatchObject({ ok: false, code: "blocked" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledWith("evil.example.org", { all: true, verbatim: true });
  });
  it("redirection vers http://, une IP littérale ou localhost : refusée", async () => {
    for (const location of ["http://boutique.com/p2", "https://127.0.0.1/admin", "https://localhost/x", "https://[::1]/x"]) {
      const fetchImpl = vi.fn(async () => new Response(null, { status: 301, headers: { location } }));
      const r = await fetchPageText("https://boutique.com/p", deps(fetchImpl));
      expect(r).toMatchObject({ ok: false, code: "blocked" });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  });
  it("suit au plus 3 redirections (relatives comprises), en mode manuel, avec un User-Agent honnête", async () => {
    let n = 0;
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.redirect).toBe("manual");
      expect((init?.headers as Record<string, string>)["User-Agent"]).toMatch(/^WaxoBot\/1\.0/);
      n++;
      return n <= 3 ? new Response(null, { status: 302, headers: { location: `/etape-${n}` } }) : html(PAGE);
    });
    const r = await fetchPageText("https://boutique.com/p", deps(fetchImpl));
    expect(r).toMatchObject({ ok: true, url: "https://boutique.com/etape-3", redirects: 3 });

    n = -10; // boucle de redirections
    const loop = vi.fn(async () => new Response(null, { status: 302, headers: { location: "/encore" } }));
    expect(await fetchPageText("https://boutique.com/p", deps(loop))).toMatchObject({ ok: false, code: "refused" });
    expect(loop).toHaveBeenCalledTimes(4);
  });
});

describe("fetchPageText : délais, taille, type, refus", () => {
  it("délai total dépassé (serveur muet) → timeout", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))),
    );
    const r = await fetchPageText("https://boutique.com/p", deps(fetchImpl, lookupTo(PUBLIC_IP), { timeoutMs: 50 }));
    expect(r).toMatchObject({ ok: false, code: "timeout" });
  });
  it("DNS qui ne répond pas : couvert par le même délai", async () => {
    const lookup = vi.fn(() => new Promise<{ address: string; family: number }[]>(() => {}));
    const r = await fetchPageText("https://boutique.com/p", { fetchImpl: vi.fn() as unknown as typeof fetch, lookup, timeoutMs: 50 });
    expect(r).toMatchObject({ ok: false, code: "timeout" });
  });
  it("corps lu en flux et coupé à la limite (le reste n'est pas lu)", async () => {
    let pulled = 0;
    const chunk = new TextEncoder().encode(`<p>${"x".repeat(1000)}</p>`);
    const body = new ReadableStream<Uint8Array>({
      pull(ctrl) {
        pulled++;
        if (pulled > 10_000) ctrl.close();
        else ctrl.enqueue(chunk);
      },
    });
    const fetchImpl = vi.fn(async () => new Response(body, { status: 200, headers: { "content-type": "text/html" } }));
    const r = await fetchPageText("https://boutique.com/p", deps(fetchImpl, lookupTo(PUBLIC_IP), { maxBytes: 50_000 }));
    expect(r).toMatchObject({ ok: true, cut: true, bytes: 50_000 });
    expect(pulled).toBeLessThan(100);
  });
  it("limite par défaut : 2 Mo", async () => {
    const big = `<body><p>${"Texte utile. ".repeat(250_000)}</p></body>`; // ≈ 3 Mo
    const r = await fetchPageText("https://boutique.com/p", deps(vi.fn(async () => html(big))));
    expect(r).toMatchObject({ ok: true, cut: true, bytes: 2 * 1024 * 1024 });
  });
  it.each(["application/pdf", "image/png", "application/json", "application/octet-stream", ""])("type %s refusé", async (type) => {
    const fetchImpl = vi.fn(async () => new Response(new TextEncoder().encode("x"), { status: 200, headers: type ? { "content-type": type } : {} }));
    const r = await fetchPageText("https://boutique.com/p", deps(fetchImpl));
    expect(r).toMatchObject({ ok: false, code: "unsupported" });
  });
  it("text/plain accepté", async () => {
    const fetchImpl = vi.fn(async () => new Response(LONG_TEXT, { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } }));
    const r = await fetchPageText("https://boutique.com/p", deps(fetchImpl));
    expect(r.ok && r.page.text).toContain("Gourde isotherme en acier");
  });
  it.each([
    [403, "refused"],
    [429, "refused"],
    [503, "refused"],
    [404, "not_found"],
    [500, "unreachable"],
  ])("statut %i → %s", async (status, code) => {
    const r = await fetchPageText("https://boutique.com/p", deps(vi.fn(async () => html("non", { status }))));
    expect(r).toMatchObject({ ok: false, code, status });
  });
  it("page anti-robot ou quasi vide (rendue en JavaScript) → refus, consigne « notez les caractéristiques de VOTRE article »", async () => {
    const captcha = "<html><head><title>Just a moment...</title></head><body><p>Checking your browser</p></body></html>";
    expect(await fetchPageText("https://boutique.com/p", deps(vi.fn(async () => html(captcha))))).toMatchObject({ ok: false, code: "refused" });
    const spa = '<html><body><div id="root"></div><script src="/app.js"></script></body></html>';
    expect(await fetchPageText("https://boutique.com/p", deps(vi.fn(async () => html(spa))))).toMatchObject({ ok: false, code: "empty" });
    expect(FETCH_MESSAGES.refused).toBe(
      "Le site refuse la lecture automatique : notez dans vos notes les caractéristiques de votre article (mesures, matières, contenu de la boîte).",
    );
    expect(FETCH_MESSAGES.empty).toBe(FETCH_MESSAGES.refused);
    // Helena J3 : plus jamais d'invitation à coller la page d'un autre site.
    for (const m of Object.values(FETCH_MESSAGES)) expect(m).not.toMatch(/copiez|collez le texte/i);
  });
  it("site injoignable (erreur réseau, DNS inconnu)", async () => {
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await fetchPageText("https://boutique.com/p", deps(down))).toMatchObject({ ok: false, code: "unreachable" });
    const nx = vi.fn(async () => {
      throw Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" });
    });
    expect(await fetchPageText("https://boutique.com/p", { fetchImpl: down as unknown as typeof fetch, lookup: nx })).toMatchObject({
      ok: false,
      code: "unreachable",
    });
  });
});

describe("extraction du texte", () => {
  it("titre, méta, Open Graph et JSON-LD Product (dans @graph) ; scripts, styles, nav, footer, svg retirés ; prix ignoré", () => {
    const p = extractPageText(PAGE);
    expect(p.hasProductData).toBe(true);
    expect(p.text).toContain("Titre de la page : Gourde inox 750 ml – Boutique");
    expect(p.text).toContain("Description (méta) : Gourde isotherme 750 ml, garde au frais 24 h.");
    expect(p.text).toContain("Titre (Open Graph) : Gourde inox");
    expect(p.text).toContain("Données produit structurées :\nNom : Gourde inox\nDescription : Double paroi\nCouleur : Noir\nMatière : Acier inoxydable\nPoids : 350 GRM\nContenance : 750 ml");
    expect(p.text).toContain("- Bouchon bambou");
    for (const absent of ["ne doit pas sortir", "color:red", "Accueil Promo Panier", "Mentions légales", "logo", "Activez JavaScript", "19.99", "<"]) {
      expect(p.text).not.toContain(absent);
    }
    // Le JSON-LD passe AVANT le texte visible (il survit à la troncature).
    expect(p.text.indexOf("Données produit")).toBeLessThan(p.text.indexOf("Texte de la page"));
  });
  it("tronque à 12 000 caractères", () => {
    const p = extractPageText(`<body><p>${"mot ".repeat(10_000)}</p></body>`);
    expect(p.truncated).toBe(true);
    expect(p.text.length).toBeLessThanOrEqual(12_000);
  });
  it("décode les entités et compacte les espaces", () => {
    expect(decodeEntities("&eacute;t&eacute; &amp; caf&#233; &#x2014; 5&nbsp;cm &inconnu;")).toBe("été & café — 5 cm &inconnu;");
    expect(htmlToText("<div>  a   b </div>\n\n<div>a b</div><p>c</p>")).toBe("a b\nc");
  });
  it("JSON-LD invalide ou géant : ignoré sans planter", () => {
    const bad = `<script type="application/ld+json">{oops</script><body><p>${LONG_TEXT}</p></body>`;
    expect(extractPageText(bad).hasProductData).toBe(false);
    const deep = `<script type="application/ld+json">${"[".repeat(5000)}${"]".repeat(5000)}</script><body><p>ok</p></body>`;
    expect(() => extractPageText(deep)).not.toThrow();
  });
  it("script non refermé : retiré jusqu'à la fin", () => {
    expect(htmlToText("<p>avant</p><script>var x = 'secret'")).toBe("avant");
  });
});
