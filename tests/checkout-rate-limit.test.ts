import { beforeEach, describe, expect, it } from "vitest";
import { clientIp, rateLimit, resetRateLimit } from "@/lib/checkout/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => resetRateLimit());

  it("autorise jusqu'à la limite puis bloque", () => {
    for (let i = 0; i < 3; i++) expect(rateLimit("ip-a", 3, 60_000, 1000 + i)).toBe(true);
    expect(rateLimit("ip-a", 3, 60_000, 1010)).toBe(false);
  });
  it("isole les clés entre elles", () => {
    for (let i = 0; i < 3; i++) rateLimit("ip-a", 3, 60_000, 1000);
    expect(rateLimit("ip-b", 3, 60_000, 1000)).toBe(true);
  });
  it("libère après la fenêtre", () => {
    for (let i = 0; i < 3; i++) rateLimit("ip-a", 3, 60_000, 1000);
    expect(rateLimit("ip-a", 3, 60_000, 1000 + 60_001)).toBe(true);
  });
});

describe("clientIp", () => {
  it("prend la première IP de x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "41.0.0.1, 10.0.0.2" }))).toBe("41.0.0.1");
  });
  it("replie sur x-real-ip puis « unknown »", () => {
    expect(clientIp(new Headers({ "x-real-ip": "41.0.0.9" }))).toBe("41.0.0.9");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
