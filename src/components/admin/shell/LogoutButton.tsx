"use client";

import { useState } from "react";
import { api } from "@/lib/auth/client";

/** Déconnexion : POST /api/auth/logout puis retour à la page de connexion admin. */
export function LogoutButton({ className, children }: { className: string; children: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className={className}
      onClick={async () => {
        setBusy(true);
        await api("/api/auth/logout", "POST");
        // Navigation complète voulue : repartir d'un état serveur propre après la déconnexion.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/admin/connexion");
      }}
    >
      {children}
    </button>
  );
}
