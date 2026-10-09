"use client";

import { Link } from "@/i18n/navigation";

// STUB posé par le socle — l'agent « compte » le remplace (menu profil + connexion, état via /api/me, rendu statique-compatible).
// Monté dans l'en-tête par l'agent « boutique ».
export function AccountMenu() {
  return (
    <Link href="/compte" className="inline-flex h-11 items-center rounded-full border border-border-strong px-4 text-sm">
      Compte
    </Link>
  );
}
