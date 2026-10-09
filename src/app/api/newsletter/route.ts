import { NextResponse } from "next/server";
import { isTooFast, newsletterSchema, storedValue } from "@/components/shop/newsletter-schema";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/newsletter : inscription par e-mail ou WhatsApp.
 * Défenses : taille bornée, Zod strict, honeypot (champ `website`), délai minimal 2,5 s (`t`), limite mémoire par IP.
 * Les réponses ne contiennent que des codes ({ ok, error }) : jamais de détail interne. Doublon = succès silencieux.
 * Écriture via service_role côté serveur uniquement ; si Supabase n'est pas configuré → 503 « unavailable ».
 */
export const runtime = "nodejs";

const MAX_BODY = 2000;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 8;
const hits = new Map<string, number[]>();

function limited(ip: string, now: number): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  }
  return recent.length > MAX_PER_WINDOW;
}

const json = (body: { ok: boolean; error?: string }, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const now = Date.now();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limited(ip, now)) return json({ ok: false, error: "rate" }, 429);

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY) return json({ ok: false, error: "invalid" }, 413);

  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return json({ ok: false, error: "invalid" }, 413);
    raw = JSON.parse(text);
  } catch {
    return json({ ok: false, error: "invalid" }, 400);
  }

  const parsed = newsletterSchema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, error: "invalid" }, 400);
  const input = parsed.data;

  // Honeypot rempli : on fait semblant que tout va bien, sans rien enregistrer.
  if (input.website && input.website.trim() !== "") return json({ ok: true });
  if (isTooFast(input.t, now)) return json({ ok: false, error: "too_fast" }, 429);

  try {
    const { error } = await createAdminClient()
      .from("newsletter_subs")
      .insert({ channel: input.channel, value: storedValue(input), consent: true });
    // 23505 = déjà inscrit (clé unique channel+value) : succès silencieux, pour ne pas révéler les contacts connus.
    if (error && error.code !== "23505") return json({ ok: false, error: "unavailable" }, 503);
    return json({ ok: true });
  } catch {
    // Supabase non configuré ou injoignable.
    return json({ ok: false, error: "unavailable" }, 503);
  }
}
