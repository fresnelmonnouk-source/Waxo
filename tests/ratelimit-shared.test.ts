import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));

import { clientIp } from "@/lib/checkout/rate-limit";
import { createSharedLimiter, rateLimitShared, resetSharedLimiterState } from "@/lib/ratelimit";

beforeEach(() => {
  rpc.mockReset();
  resetSharedLimiterState();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
});

describe("limiteur partagé (rate_hit)", () => {
  it("suit la décision de la base et préfixe la clé du nom du limiteur", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: false, error: null });
    const l = createSharedLimiter({ name: "login", windowMs: 10 * 60_000, max: 8 });
    expect(await l.hit("1.2.3.4")).toBe(true);
    expect(await l.hit("1.2.3.4")).toBe(false);
    expect(rpc).toHaveBeenCalledWith("rate_hit", { p_key: "login:1.2.3.4", p_max: 8, p_window_seconds: 600 });
  });

  it("deux limiteurs ne partagent pas leurs compteurs", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await createSharedLimiter({ name: "a", windowMs: 1000, max: 1 }).hit("k");
    await createSharedLimiter({ name: "b", windowMs: 1000, max: 1 }).hit("k");
    expect(rpc.mock.calls.map((c) => c[1].p_key)).toEqual(["a:k", "b:k"]);
  });

  it("base indisponible / migration absente → repli mémoire (la limite tient quand même)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "function rate_hit does not exist" } });
    const l = createSharedLimiter({ name: "x", windowMs: 60_000, max: 2 });
    expect(await l.hit("ip")).toBe(true);
    expect(await l.hit("ip")).toBe(true);
    expect(await l.hit("ip")).toBe(false);
  });

  it("après un échec, le partagé est ignoré un moment (pas d'attente ajoutée à chaque requête)", async () => {
    rpc.mockRejectedValue(new Error("boom"));
    const l = createSharedLimiter({ name: "y", windowMs: 60_000, max: 5 });
    await l.hit("ip");
    await l.hit("ip");
    await l.hit("ip");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("appel qui ne répond jamais → fail-open rapide vers la mémoire", async () => {
    vi.useFakeTimers();
    rpc.mockReturnValue(new Promise(() => {}));
    const p = createSharedLimiter({ name: "z", windowMs: 60_000, max: 5 }).hit("ip");
    await vi.advanceTimersByTimeAsync(900);
    expect(await p).toBe(true);
    vi.useRealTimers();
  });

  it("sans Supabase configuré : mémoire seule, aucun appel réseau", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const l = createSharedLimiter({ name: "m", windowMs: 60_000, max: 1 });
    expect(await l.hit("ip")).toBe(true);
    expect(await l.hit("ip")).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rateLimitShared : clé complète, décision de la base", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await rateLimitShared("checkout:1.1.1.1", 8, 600_000)).toBe(false);
    expect(rpc).toHaveBeenCalledWith("rate_hit", { p_key: "checkout:1.1.1.1", p_max: 8, p_window_seconds: 600 });
  });
});

describe("clientIp", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  it("préfère les en-têtes écrits par la plateforme à x-forwarded-for (falsifiable)", () => {
    expect(clientIp(h({ "x-vercel-forwarded-for": "9.9.9.9", "x-forwarded-for": "6.6.6.6" }))).toBe("9.9.9.9");
    expect(clientIp(h({ "x-real-ip": "8.8.8.8", "x-forwarded-for": "6.6.6.6" }))).toBe("8.8.8.8");
    expect(clientIp(h({ "x-forwarded-for": "6.6.6.6, 7.7.7.7" }))).toBe("6.6.6.6");
    expect(clientIp(h({}))).toBe("unknown");
  });
});
