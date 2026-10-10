import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/guard";
import { dbWriters, loadAccountantData } from "@/lib/accountant/data";
import { handleMessage } from "@/lib/accountant/handle";
import { rephrase } from "@/lib/accountant/llm";
import { accountantRequestSchema, allow, MAX_BODY_BYTES } from "@/lib/accountant/schema";
import type { AccountantResponse } from "@/lib/accountant/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

function json(body: AccountantResponse, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  // 1. Garde admin : première instruction.
  const admin = await assertAdmin();
  if (!admin) return json({ ok: false, code: "unauthorized", message: "Session expirée : reconnectez-vous." }, 401);

  // Anti-CSRF : JSON obligatoire + origine identique à l'hôte quand le navigateur l'envoie.
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  let sameOrigin = true;
  if (origin && host) {
    try {
      sameOrigin = new URL(origin).host === host;
    } catch {
      sameOrigin = false;
    }
  }
  if (!(req.headers.get("content-type") ?? "").includes("application/json") || !sameOrigin) {
    return json({ ok: false, code: "forbidden", message: "Requête refusée." }, 403);
  }

  if (!allow(`accountant:${admin.id}`, 20, 60_000)) {
    return json({ ok: false, code: "rate_limited", message: "Trop de questions d'un coup, patientez une minute." }, 429);
  }

  // 2. Corps borné + Zod.
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return json({ ok: false, code: "bad_request", message: "Requête illisible." }, 400);
  }
  if (raw.length > MAX_BODY_BYTES) return json({ ok: false, code: "too_large", message: "Message trop long." }, 413);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json({ ok: false, code: "bad_request", message: "Requête invalide." }, 400);
  }
  const body = accountantRequestSchema.safeParse(parsed);
  if (!body.success || body.data.messages[body.data.messages.length - 1].role !== "user") {
    return json({ ok: false, code: "bad_request", message: "Question invalide (500 caractères maximum)." }, 400);
  }
  const question = body.data.messages[body.data.messages.length - 1].text;

  // 3. Calcul déterministe (et écriture éventuelle) : le LLM n'y participe jamais.
  try {
    const { data } = await loadAccountantData();
    const result = await handleMessage({ text: question, month: body.data.month, data, now: Date.now(), writers: dbWriters() });

    // 4. Reformulation facultative : agrégats déjà calculés seulement ; repli sur le texte calculé si échec/infidèle.
    let reply = result.reply;
    let mode: "deterministic" | "llm" = "deterministic";
    if (result.rephrasable) {
      const better = await rephrase(question, result.reply);
      if (better) {
        reply = better;
        mode = "llm";
      }
    }
    return json({ ok: true, reply, notes: result.notes, changed: result.changed, mode });
  } catch {
    // Jamais de détail interne côté client.
    return json({ ok: false, code: "internal", message: "Le comptable n'a pas pu répondre. Réessayez dans un instant." }, 500);
  }
}
