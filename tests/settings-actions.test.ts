import { beforeEach, describe, expect, it, vi } from "vitest";

const assertAdmin = vi.fn();
vi.mock("@/lib/admin/guard", () => ({ assertAdmin: () => assertAdmin(), requireAdmin: () => assertAdmin() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSessionClient: vi.fn() }));

const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  assertAdmin.mockReset();
});

describe("actions admin contenu : garde et repli sans base", () => {
  it("refusent sans session admin (avant toute autre chose)", async () => {
    assertAdmin.mockResolvedValue(null);
    const reviews = await import("@/app/admin/(panel)/avis/actions");
    const messages = await import("@/app/admin/(panel)/messages/actions");
    const news = await import("@/app/admin/(panel)/newsletter/actions");
    const settings = await import("@/app/admin/(panel)/reglages/actions");
    const results = await Promise.all([
      reviews.setReviewHiddenAction(ID, true),
      reviews.deleteReviewAction(ID),
      messages.setMessageDoneAction(ID, true),
      messages.draftReplyAction(ID),
      news.deleteSubscriberAction(ID),
      settings.saveSettingsAction({}),
      settings.saveKbEntryAction({}),
      settings.deleteKbEntryAction(ID),
      settings.changePasswordAction({}),
    ]);
    for (const r of results) expect(r).toMatchObject({ ok: false, code: "unauthorized" });
  });

  it("répondent « unavailable » en mode démo (pas de base), jamais d'exception", async () => {
    assertAdmin.mockResolvedValue({ id: "demo-admin", email: "admin@waxo.local" });
    const reviews = await import("@/app/admin/(panel)/avis/actions");
    const news = await import("@/app/admin/(panel)/newsletter/actions");
    const settings = await import("@/app/admin/(panel)/reglages/actions");
    expect(await reviews.deleteReviewAction(ID)).toMatchObject({ ok: false, code: "unavailable", message: "Base non connectée (mode démo)." });
    expect(await news.deleteSubscriberAction(ID)).toMatchObject({ ok: false, code: "unavailable" });
    expect(await settings.saveSettingsAction({})).toMatchObject({ ok: false, code: "unavailable" });
    expect(await settings.changePasswordAction({ current: "a", next: "bbbbbbbb" })).toMatchObject({ ok: false, code: "unavailable" });
  });
});
