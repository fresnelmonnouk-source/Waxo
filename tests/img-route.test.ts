// Route GET /api/img (photos filigranées) : validation stricte (anti-SSRF), en-têtes de cache, fail-open. fetch mocké,
// sharp réel sur de petites images.
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/img/route";
import { WATERMARK_VERSION } from "@/lib/media/watermark-version";
import { readFileSync } from "node:fs";

const HOST = "btarkkjimnkmiaxzonzq.supabase.co";
const SRC = `https://${HOST}/storage/v1/object/public/products/2026/10/photo-1.webp`;

const call = (query: string) => GET(new Request(`https://waxo.test/api/img${query}`));
const valid = (over: Record<string, string> = {}, drop: string[] = []) => {
  const p: Record<string, string> = { u: SRC, w: "480", v: WATERMARK_VERSION, ...over };
  for (const k of drop) delete p[k];
  return `?${new URLSearchParams(p).toString()}`;
};

let fetchMock: ReturnType<typeof vi.fn>;
let original: Buffer;
beforeEach(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `https://${HOST}`);
  original = await sharp({ create: { width: 600, height: 600, channels: 3, background: "#d8c8a8" } }).webp().toBuffer();
  fetchMock = vi.fn(async () => new Response(new Uint8Array(original), { status: 200, headers: { "Content-Type": "image/webp" } }));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/img : succès", () => {
  it("URL valide : 200, WebP filigrané à la largeur demandée, cache d'un an immuable, aucun cookie", async () => {
    const res = await call(valid());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, s-maxage=31536000, immutable");
    expect(res.headers.get("Vary")).toBe("Accept-Encoding");
    expect(res.headers.get("Set-Cookie")).toBeNull();
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 480, 480]);
  });

  it("télécharge l'URL reconstruite : redirections interdites, délai borné, pas de cache de données Next", async () => {
    await call(valid());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(SRC);
    expect(init.redirect).toBe("error");
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([320, 480, 720, 1080, 1200])("largeur %i acceptée", async (w) => {
    expect((await call(valid({ w: String(w) }))).status).toBe(200);
  });
});

describe("GET /api/img : refus (400), sans aucun téléchargement", () => {
  it.each([
    ["u manquant", valid({}, ["u"])],
    ["u vide", valid({ u: "" })],
    ["hôte différent", valid({ u: `https://evil.test/storage/v1/object/public/products/a.webp` })],
    ["sous-domaine piégé", valid({ u: `https://${HOST}.evil.test/storage/v1/object/public/products/a.webp` })],
    ["hôte interne (SSRF)", valid({ u: "http://169.254.169.254/latest/meta-data" })],
    ["http", valid({ u: `http://${HOST}/storage/v1/object/public/products/a.webp` })],
    ["chemin hors bucket", valid({ u: `https://${HOST}/storage/v1/object/public/avatars/a.webp` })],
    ["chemin privé", valid({ u: `https://${HOST}/storage/v1/object/authenticated/products/a.webp` })],
    ["..", valid({ u: `https://${HOST}/storage/v1/object/public/products/../avatars/a.webp` })],
    ["%2e%2e", valid({ u: `https://${HOST}/storage/v1/object/public/products/%2e%2e/a.webp` })],
    ["requête dans u", valid({ u: `${SRC}?x=1` })],
    ["ancre dans u", valid({ u: `${SRC}#x` })],
    ["u trop long", valid({ u: `https://${HOST}/storage/v1/object/public/products/${"a".repeat(480)}.webp` })],
    ["w manquant", valid({}, ["w"])],
    ["w hors liste", valid({ w: "999" })],
    ["w énorme", valid({ w: "100000" })],
    ["w non numérique", valid({ w: "abc" })],
    ["w décimal", valid({ w: "480.5" })],
    ["w négatif", valid({ w: "-480" })],
    ["paramètre inconnu", `${valid()}&x=1`],
    ["u répété", `${valid()}&u=${encodeURIComponent(SRC)}`],
    ["v invalide", valid({ v: "<script>" })],
  ])("%s", async (_n, query) => {
    const res = await call(query);
    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sans NEXT_PUBLIC_SUPABASE_URL : tout est refusé", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect((await call(valid())).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/img : version du filigrane", () => {
  it("version absente ou périmée : 307 vers l'URL courante (jamais de variante stockée sous une version arbitraire)", async () => {
    for (const q of [valid({}, ["v"]), valid({ v: "0" })]) {
      const res = await call(q);
      expect(res.status).toBe(307);
      expect(res.headers.get("Location")).toBe(`/api/img?u=${encodeURIComponent(SRC)}&w=480&v=${WATERMARK_VERSION}`);
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/img : source et traitement", () => {
  it("objet inexistant : 404 (Supabase répond 404, ou 400 « not_found »)", async () => {
    for (const status of [404, 400]) {
      fetchMock.mockResolvedValueOnce(new Response('{"statusCode":"404"}', { status, headers: { "Content-Type": "application/json" } }));
      const res = await call(valid());
      expect(res.status).toBe(404);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    }
  });

  it("fetch en erreur, timeout ou redirection : 302 vers l'original, sans cache, journal sans contenu", async () => {
    for (const err of [new TypeError("fetch failed"), new DOMException("The operation timed out", "TimeoutError")]) {
      fetchMock.mockRejectedValueOnce(err);
      const res = await call(valid());
      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe(SRC);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    }
    expect(console.error).toHaveBeenCalledTimes(2);
    const logged = (console.error as unknown as { mock: { calls: string[][] } }).mock.calls.flat().join(" ");
    expect(logged).not.toContain(SRC);
  });

  it("source en erreur 5xx : 302 vers l'original, sans cache", async () => {
    fetchMock.mockResolvedValueOnce(new Response("oops", { status: 503 }));
    const res = await call(valid());
    expect([res.status, res.headers.get("Location"), res.headers.get("Cache-Control")]).toEqual([302, SRC, "no-store"]);
  });

  it.each(["text/html", "application/octet-stream", "application/json", "image/svg+xml", ""])("type « %s » : rejeté (415)", async (type) => {
    fetchMock.mockResolvedValueOnce(new Response("<svg/>", { status: 200, headers: type ? { "Content-Type": type } : {} }));
    const res = await call(valid());
    expect(res.status).toBe(415);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("image illisible malgré un type image/* : fail-open (302, sans cache)", async () => {
    fetchMock.mockResolvedValueOnce(new Response("pas une image", { status: 200, headers: { "Content-Type": "image/webp" } }));
    const res = await call(valid());
    expect([res.status, res.headers.get("Location"), res.headers.get("Cache-Control")]).toEqual([302, SRC, "no-store"]);
  });

  it("plafond 8 Mo : content-length annoncé trop grand, ou flux trop long coupé : 302 sans traitement", async () => {
    fetchMock.mockResolvedValueOnce(new Response("x", { status: 200, headers: { "Content-Type": "image/webp", "Content-Length": String(9 * 1024 * 1024) } }));
    expect((await call(valid())).status).toBe(302);

    let cancelled = false;
    const chunk = new Uint8Array(1024 * 1024);
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1;
        controller.enqueue(chunk);
        if (sent > 50) controller.close();
      },
      cancel() {
        cancelled = true;
      },
    });
    fetchMock.mockResolvedValueOnce(new Response(stream, { status: 200, headers: { "Content-Type": "image/webp" } }));
    const res = await call(valid());
    expect(res.status).toBe(302);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(cancelled).toBe(true);
    expect(sent).toBeLessThan(15); // coupé peu après 8 Mo, pas lu en entier
  });
});

describe("proxy", () => {
  it("/api/img est exclu du proxy (ni session ni i18n : pas de Set-Cookie sur une image mise en cache)", () => {
    // proxy.ts importe next-intl (non chargeable sous vitest) : on lit le matcher dans la source.
    const src = readFileSync("src/proxy.ts", "utf8");
    const m = /matcher:\s*\[\s*"((?:[^"\\]|\\.)*)"\s*\]/.exec(src);
    expect(m).not.toBeNull();
    const pattern = JSON.parse(`"${m![1]}"`) as string;
    const re = new RegExp(`^${pattern}$`);
    expect(re.test("/api/img")).toBe(false);
    expect(re.test("/fr/produit/lampe")).toBe(true);
    expect(re.test("/api/products")).toBe(true);
    expect(re.test("/robots.txt")).toBe(false);
  });
});
