import "server-only";
import demo from "@/lib/demo/kb.json";
import { withTimeout } from "@/lib/auth/timeout";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabasePublicEnv } from "@/lib/supabase/env";
import type { KbEntry, Lang } from "./types";

type DemoEntry = (typeof demo)[number];

function demoKb(lang: Lang): KbEntry[] {
  return (demo as DemoEntry[]).map((d) => {
    const loc = lang === "en" && d.en ? d.en : d;
    return { id: d.id, tag: loc.tag, title: loc.title, text: loc.text, keywords: loc.keywords };
  });
}

/** Fiches génériques de démonstration (livraison, paiement, retours, compte, boutique) : jamais les fiches PRODUIT,
 * qui décrivent des articles fictifs. Servies UNIQUEMENT sans Supabase (développement, tests). */
function genericKb(lang: Lang): KbEntry[] {
  return demoKb(lang).filter((e) => e.tag !== "Produit" && e.tag !== "Product");
}

/**
 * Fiches de la base de connaissances réelle (migration 0021) que le moteur reconnaît par leur identifiant historique
 * (`kbOverride` et les liens « Livraison et retours » de engine.ts) : pour ces sujets, la réponse est reconstruite avec
 * les VALEURS DES RÉGLAGES (heure limite, frais, moyens de paiement, délai de retour) plutôt qu'avec le texte figé.
 */
export const KB_LEGACY_IDS: Readonly<Record<string, string>> = {
  "5eed0000-0000-4000-8000-000000000002": "kb1", // Zones et délais de livraison
  "5eed0000-0000-4000-8000-000000000005": "kb3", // Moyens de paiement
  "5eed0000-0000-4000-8000-000000000010": "kb4", // Retours et échanges
  "5eed0000-0000-4000-8000-000000000011": "kb5", // Produit défectueux ou erreur
};

const TTL_MS = 5 * 60_000;
let cache: { at: number; rows: KbEntry[] } | null = null;

/** Vide le cache (tests). */
export function resetKbCache() {
  cache = null;
}

type KbRow = { id: unknown; tag: string; title: string; text: string; keywords: string | null };

function toEntry(r: KbRow): KbEntry {
  const id = String(r.id);
  return { id: KB_LEGACY_IDS[id] ?? id, tag: r.tag, title: r.title, text: r.text, keywords: r.keywords ?? "" };
}

/**
 * Base de connaissances : table `kb` (lue en service_role côté serveur, jamais exposée au navigateur). Les lignes sont
 * rédigées en français ; l'assistant s'appuie dessus dans les deux langues.
 * Même règle que le catalogue (décision D6 du 2026-10-12) :
 * - sans Supabase (développement) : fiches génériques de démonstration ;
 * - base branchée : les fiches actives de la base, même si la liste est VIDE (jamais la démo en production) ;
 * - base injoignable ou en erreur : dernière lecture réussie (même expirée), sinon liste vide ; on réessaie au prochain appel.
 */
export async function loadKb(lang: Lang): Promise<KbEntry[]> {
  if (!supabasePublicEnv()) return genericKb(lang);
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.rows;
  try {
    const { data, error } = await withTimeout(
      createAdminClient().from("kb").select("id,tag,title,text,keywords").eq("active", true).limit(200),
    );
    if (error || !data) throw new Error("kb_unavailable");
    const rows = (data as KbRow[]).map(toEntry);
    cache = { at: now, rows };
    return rows;
  } catch {
    // Clé service_role absente, délai dépassé, table illisible : jamais de repli sur la démo.
    return cache?.rows ?? [];
  }
}
