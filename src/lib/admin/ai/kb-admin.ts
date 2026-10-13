import "server-only";
import demo from "@/lib/demo/admin.json";
import { tryAdminClient, withTimeout } from "@/lib/settings/db";
import type { AdminKbRow, KbListData, KbSource, KbStatus } from "./kb-types";

export * from "./kb-types";

/**
 * Lecture admin de TOUTE la base de connaissances (publiées, brouillons, désactivées), en service_role.
 * Tolère l'absence de la migration 0022 (colonnes status/source/updated_at) : repli sur les colonnes d'origine.
 */

const FULL = "id,tag,title,text,keywords,active,status,source,updated_at";
const LEGACY = "id,tag,title,text,keywords,active";

type Row = Record<string, unknown>;

export function rowToKb(r: Row): AdminKbRow {
  const status: KbStatus = r.status === "draft" ? "draft" : "published";
  const source: KbSource = r.source === "ai" ? "ai" : "manual";
  return {
    id: String(r.id),
    tag: String(r.tag ?? "Autre"),
    title: String(r.title ?? ""),
    text: String(r.text ?? ""),
    keywords: String(r.keywords ?? ""),
    // Un brouillon n'est jamais actif, même si la ligne le prétend (base sans trigger 0022).
    active: status === "draft" ? false : r.active !== false,
    status,
    source,
    updatedAt: typeof r.updated_at === "string" ? r.updated_at : null,
  };
}

/** Code Postgres « colonne inconnue » (migration 0022 absente). */
export const isMissingColumn = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === "42703" || e.code === "PGRST204" || /column .* does not exist|schema cache/i.test(e.message ?? ""));

export async function listKbAdmin(): Promise<KbListData> {
  const sb = tryAdminClient();
  if (sb) {
    try {
      const full = await withTimeout(sb.from("kb").select(FULL).order("updated_at", { ascending: false }).limit(300));
      if (!full.error && full.data) return { rows: (full.data as Row[]).map(rowToKb), connected: true, draftsReady: true };
      if (isMissingColumn(full.error)) {
        const legacy = await withTimeout(sb.from("kb").select(LEGACY).order("title").limit(300));
        if (!legacy.error && legacy.data) return { rows: (legacy.data as Row[]).map(rowToKb), connected: true, draftsReady: false };
      }
    } catch {
      /* lecture en échec : liste vide signalée (jamais les exemples de démo quand la base est branchée) */
    }
    return { rows: [], connected: true, draftsReady: false, failed: true };
  }
  return {
    rows: demo.kb.map((k) => rowToKb({ ...k, active: true, status: "published", source: "manual" })),
    connected: false,
    draftsReady: false,
  };
}
