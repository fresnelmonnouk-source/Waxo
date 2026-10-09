import { describe, expect, it } from "vitest";
import { checkBot, MIN_FILL_MS } from "@/lib/auth/bot-guard";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import { withTimeout } from "@/lib/auth/timeout";

describe("checkBot", () => {
  const now = 1_000_000_000_000;
  it("laisse passer un humain (champ piège vide, délai respecté)", () => {
    expect(checkBot({ website: "", t: now - MIN_FILL_MS - 1 }, now)).toBe("ok");
    expect(checkBot({ t: now - 60_000 }, now)).toBe("ok");
  });
  it("détecte le champ piège rempli", () => {
    expect(checkBot({ website: "http://spam.example", t: now - 60_000 }, now)).toBe("honeypot");
  });
  it("refuse un envoi trop rapide ou sans horodatage", () => {
    expect(checkBot({ t: now - 500 }, now)).toBe("tooFast");
    expect(checkBot({ t: now - (MIN_FILL_MS - 1) }, now)).toBe("tooFast");
    expect(checkBot({}, now)).toBe("tooFast");
    expect(checkBot({ t: "abc" }, now)).toBe("tooFast");
    expect(checkBot(null, now)).toBe("tooFast");
  });
  it("ne bloque pas une horloge cliente très en avance", () => {
    expect(checkBot({ t: now + 3_600_000 }, now)).toBe("ok");
  });
});

describe("createRateLimiter", () => {
  it("bloque au-delà du maximum puis libère après la fenêtre", () => {
    const rl = createRateLimiter({ windowMs: 1000, max: 2 });
    expect(rl.hit("a", 0)).toBe(true);
    expect(rl.hit("a", 100)).toBe(true);
    expect(rl.hit("a", 200)).toBe(false);
    expect(rl.hit("b", 200)).toBe(true); // clés indépendantes
    expect(rl.hit("a", 1101)).toBe(true);
  });
});

describe("withTimeout", () => {
  it("rejette une promesse qui ne résout jamais", async () => {
    await expect(withTimeout(new Promise(() => {}), 20)).rejects.toThrow("timeout");
  });
  it("renvoie la valeur d'une promesse rapide", async () => {
    await expect(withTimeout(Promise.resolve(7), 500)).resolves.toBe(7);
  });
});
