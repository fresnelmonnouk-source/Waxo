"use client";

import { api, clearMe } from "@/lib/auth/client";

/** Déconnexion : efface la session côté serveur puis vide l'état local (même si le réseau échoue, l'interface se met à jour). */
export async function signOut(): Promise<void> {
  await api("/api/auth/logout", "POST");
  clearMe();
}

/** Date lisible selon la langue de l'interface. */
export function fmtDate(iso: string, locale: string, opts?: Intl.DateTimeFormatOptions): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", opts ?? { day: "numeric", month: "long", year: "numeric" }).format(d);
}
