import { asStatus } from "./status";
import type { TrackView } from "./types";
import { isValidEmail, isValidPhone, normPhone } from "./validation";

/** Ligne lue en base (service_role) pour le suivi invité. */
export type TrackRow = {
  number: string;
  status: string;
  created_at: string;
  total: number;
  phone: string;
  email: string | null;
  order_items: { name: string; qty: number; unit_price: number }[] | null;
};

/**
 * Suivi invité : renvoie la vue publique SI la ligne existe ET que le contact (e-mail ou téléphone) correspond.
 * Dans tous les autres cas : null. L'appelant répond alors TOUJOURS la même chose (anti-énumération :
 * numéro inconnu et contact erroné sont indiscernables).
 */
export function matchTrack(row: TrackRow | null, contact: string): TrackView | null {
  if (!row) return null;
  let ok = false;
  if (isValidEmail(contact)) {
    ok = !!row.email && row.email.trim().toLowerCase() === contact.trim().toLowerCase();
  } else if (isValidPhone(contact)) {
    ok = normPhone(row.phone) === normPhone(contact);
  }
  if (!ok) return null;
  return {
    number: row.number,
    status: asStatus(row.status),
    createdAt: row.created_at,
    total: row.total,
    items: (row.order_items ?? []).map((i) => ({ name: i.name, qty: i.qty, unitPrice: i.unit_price })),
  };
}

export const TRACK_NOT_FOUND = { ok: false, code: "notFound" } as const;
