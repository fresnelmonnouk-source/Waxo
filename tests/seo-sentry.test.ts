import { describe, expect, it } from "vitest";
import { scrubEvent, sentryDsn } from "@/lib/tracking/sentry";

describe("Sentry (protégé)", () => {
  it("DSN : absent ou mal formé = inerte", () => {
    expect(sentryDsn({})).toBeNull();
    expect(sentryDsn({ SENTRY_DSN: "pas-un-dsn" })).toBeNull();
    expect(sentryDsn({ SENTRY_DSN: "https://abc@o1.ingest.sentry.io/123" })).toBe("https://abc@o1.ingest.sentry.io/123");
    expect(sentryDsn({ NEXT_PUBLIC_SENTRY_DSN: "https://abc@o1.ingest.sentry.io/123" })).not.toBeNull();
  });
  it("scrubEvent retire cookies, en-têtes, corps et utilisateur", () => {
    const e = scrubEvent({
      request: { url: "https://x/y", method: "POST", cookies: { a: "1" }, headers: { authorization: "t" }, data: { phone: "01" } },
      user: { email: "a@b" },
    });
    expect(e.request).toEqual({ url: "https://x/y", method: "POST" });
    expect("user" in e).toBe(false);
  });
});
