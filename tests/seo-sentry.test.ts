import { describe, expect, it } from "vitest";
import { scrubEvent, sentryDsn } from "@/lib/tracking/sentry";

describe("Sentry (protégé)", () => {
  it("DSN : absent ou mal formé = inerte", () => {
    expect(sentryDsn({})).toBeNull();
    expect(sentryDsn({ SENTRY_DSN: "pas-un-dsn" })).toBeNull();
    expect(sentryDsn({ SENTRY_DSN: "https://abc@o1.ingest.sentry.io/123" })).toBe("https://abc@o1.ingest.sentry.io/123");
    expect(sentryDsn({ NEXT_PUBLIC_SENTRY_DSN: "https://abc@o1.ingest.sentry.io/123" })).not.toBeNull();
  });
  it("scrubEvent retire cookies, en-têtes, corps, paramètres d'adresse et utilisateur", () => {
    const e = scrubEvent({
      request: { url: "https://x/y?k=jeton-secret#f", method: "POST", cookies: { a: "1" }, headers: { authorization: "t" }, data: { phone: "01" } },
      user: { email: "a@b" },
    });
    expect(e.request).toEqual({ url: "https://x/y", method: "POST" });
    expect("user" in e).toBe(false);
  });
});

describe("Sentry : fil d'Ariane et DSN navigateur", () => {
  it("les adresses perdent leurs paramètres (jeton de suivi de commande) ; saisies et textes de clic retirés", async () => {
    const { scrubBreadcrumb } = await import("@/lib/tracking/sentry");
    expect(scrubBreadcrumb({ category: "fetch", data: { url: "/api/checkout/status?n=WX-10263&k=abcdef" } })?.data?.url).toBe("/api/checkout/status");
    expect(scrubBreadcrumb({ category: "navigation", data: { from: "/fr/suivi?n=1", to: "/fr/commande/merci?n=WX-1&k=zz" } })?.data).toEqual({ from: "/fr/suivi", to: "/fr/commande/merci" });
    expect(scrubBreadcrumb({ category: "ui.input", message: "body > input" })).toBeNull();
    expect(scrubBreadcrumb({ category: "ui.click", message: "button « Payer 7 500 F »" })?.message).toBeUndefined();
  });
  it("sentryBrowserDsn ne lit que la valeur publique et valide son format", async () => {
    const { sentryBrowserDsn } = await import("@/lib/tracking/sentry");
    expect(sentryBrowserDsn(undefined)).toBeNull();
    expect(sentryBrowserDsn("n'importe quoi")).toBeNull();
    expect(sentryBrowserDsn("https://abc@o1.ingest.de.sentry.io/123")).not.toBeNull();
  });
  it("options : erreurs seulement, aucune donnée personnelle", async () => {
    const { baseOptions } = await import("@/lib/tracking/sentry");
    expect(baseOptions("https://abc@o1.ingest.sentry.io/123")).toMatchObject({ sendDefaultPii: false, tracesSampleRate: 0 });
  });
});
