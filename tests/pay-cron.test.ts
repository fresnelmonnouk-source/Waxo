import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const sendOrderEmail = vi.fn();
const tables: Record<string, unknown[]> = {};

function query(table: string) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const m of ["select", "eq", "neq", "lt", "in", "limit"]) chain[m] = self;
  chain.then = (resolve: (v: unknown) => void) => resolve({ data: tables[table] ?? [], error: null });
  return chain;
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc, from: (t: string) => query(t) }) }));
vi.mock("@/lib/email", () => ({ sendOrderEmail: (...a: unknown[]) => sendOrderEmail(...a) }));

import { GET } from "@/app/api/cron/expire-orders/route";

const call = (auth?: string) =>
  GET(new Request("http://localhost/api/cron/expire-orders", { headers: auth ? { authorization: auth } : {} }));

beforeEach(() => {
  rpc.mockReset();
  sendOrderEmail.mockReset();
  for (const k of Object.keys(tables)) delete tables[k];
  vi.stubEnv("CRON_SECRET", "cron-secret");
  vi.stubEnv("FEDAPAY_SECRET_KEY", "");
});

describe("GET /api/cron/expire-orders", () => {
  it("503 sans CRON_SECRET, 401 sans ou avec un mauvais jeton", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer x")).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "cron-secret");
    expect((await call()).status).toBe(401);
    expect((await call("Bearer nope")).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("appelle expire_stale_orders et prévient les commandes réellement annulées", async () => {
    tables.orders = [{ id: "o1" }];
    rpc.mockResolvedValue({ data: 1, error: null });
    sendOrderEmail.mockResolvedValue({ sent: true });
    const res = await call("Bearer cron-secret");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, expired: 1, rescued: 0, notified: 1 });
    expect(rpc).toHaveBeenCalledWith("expire_stale_orders", { p_minutes: 60 });
    expect(sendOrderEmail).toHaveBeenCalledWith("o1", "annulee");
  });

  it("erreur SQL : 500 générique sans détail", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "relation secret_table" } });
    const res = await call("Bearer cron-secret");
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret_table");
  });
});
