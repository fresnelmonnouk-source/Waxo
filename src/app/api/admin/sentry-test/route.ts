import { getAdmin } from "@/lib/admin/guard";

/**
 * GET /api/admin/sentry-test — réservé aux administrateurs connectés : lève volontairement une erreur serveur pour vérifier que
 * Sentry la reçoit (à ouvrir une fois après le branchement du DSN). Sans session admin : 404, rien n'est révélé.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getAdmin())) return new Response("Not found", { status: 404 });
  throw new Error("Test Sentry Wá xɔ : erreur volontaire déclenchée par un administrateur");
}
