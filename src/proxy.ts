import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { withSession } from "./lib/supabase/proxy";

const handleIntl = createIntlMiddleware(routing);

// Session AVANT i18n. /admin (français seulement) et /api n'ont pas de préfixe de langue.
// L'autorisation réelle reste dans la couche données (RLS) et les server actions, jamais dans le proxy seul.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAppRoute = pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/");
  return withSession(request, (req) => (isAppRoute ? NextResponse.next({ request: req }) : handleIntl(req)));
}

export const config = {
  // Exclut les fichiers statiques et meta (robots, sitemap, manifest, images OG…) : sinon next-intl les réécrit en /fr/… (404).
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
