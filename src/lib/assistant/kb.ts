import "server-only";
import demo from "@/lib/demo/kb.json";
import { withTimeout } from "@/lib/auth/timeout";
import { createAdminClient } from "@/lib/supabase/admin";
import type { KbEntry, Lang } from "./types";

type DemoEntry = (typeof demo)[number];

function demoKb(lang: Lang): KbEntry[] {
  return (demo as DemoEntry[]).map((d) => {
    const loc = lang === "en" && d.en ? d.en : d;
    return { id: d.id, tag: loc.tag, title: loc.title, text: loc.text, keywords: loc.keywords };
  });
}

const TTL_MS = 5 * 60_000;
let cache: { at: number; rows: KbEntry[] } | null = null;

/**
 * Base de connaissances : table `kb` (lue en service_role côté serveur, jamais exposée au navigateur), repli sur
 * `src/lib/demo/kb.json`. Les lignes de la base sont rédigées en français : en anglais, seul le repli est traduit.
 */
export async function loadKb(lang: Lang): Promise<KbEntry[]> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.rows.length ? cache.rows : demoKb(lang);
  let rows: KbEntry[] = [];
  try {
    const { data, error } = await withTimeout(
      createAdminClient().from("kb").select("id,tag,title,text,keywords").eq("active", true).limit(200),
    );
    if (!error && data) rows = data.map((r) => ({ id: String(r.id), tag: r.tag, title: r.title, text: r.text, keywords: r.keywords ?? "" }));
    cache = { at: now, rows };
  } catch {
    /* Supabase absent ou injoignable : repli démo, on réessaiera plus tard */
  }
  return rows.length ? rows : demoKb(lang);
}
