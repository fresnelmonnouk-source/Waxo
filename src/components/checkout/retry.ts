// Paiement en ligne échoué (audit Mia 9) : le panier n'est plus perdu. Au départ vers la page de paiement, on garde un
// instantané (lignes, zone, coordonnées) dans le sessionStorage ; l'écran d'échec le restaure (« Réessayer » ou
// « Payer à la livraison ») et le tunnel reprend prérempli, avec la référence de l'ancienne commande (`replaces`)
// pour que le serveur libère son stock. Pur côté logique : stockage injectable, testable sans navigateur.

import type { CartLine } from "@/lib/cart/store";
import type { PayMethod, Zone } from "@/lib/checkout/shipping";

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

const SNAPSHOT_KEY = "waxo:checkout-snapshot:v1";
const RESUME_KEY = "waxo:checkout-resume:v1";
/** Au-delà, l'instantané est ignoré (prix et stock ont pu changer ; le serveur reste de toute façon l'autorité). */
const MAX_AGE_MS = 24 * 3600_000;

export type CheckoutForm = { name: string; phone: string; email: string; address: string };

export type CheckoutSnapshot = {
  number: string;
  lines: CartLine[];
  zone: Zone;
  pay: PayMethod;
  form: CheckoutForm;
  at: number;
};

/** Reprise demandée par l'écran d'échec, lue (et effacée) à l'ouverture du tunnel. */
export type CheckoutResume = {
  form: CheckoutForm;
  zone: Zone;
  /** Moyen à présélectionner : « cod » pour « Payer à la livraison », sinon celui de la tentative échouée. */
  pay: PayMethod;
  /** Ancienne commande à remplacer, prouvée par le jeton du retour de paiement (absent si inconnu). */
  replaces: { n: string; k: string } | null;
};

const PAY: readonly PayMethod[] = ["momo", "moov", "celtiis", "carte", "cod"];
const str = (v: unknown, max = 400) => (typeof v === "string" ? v.slice(0, max) : "");

function safeSession(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

function parseForm(v: unknown): CheckoutForm {
  const f = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return { name: str(f.name, 120), phone: str(f.phone, 40), email: str(f.email, 200), address: str(f.address, 400) };
}

function parseLines(v: unknown): CartLine[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((l): l is Record<string, unknown> => !!l && typeof l === "object")
    .filter((l) => (l.kind === "product" || l.kind === "pack") && typeof l.id === "string" && Number.isInteger(l.qty) && (l.qty as number) > 0)
    .slice(0, 50)
    .map((l) => ({
      kind: l.kind as CartLine["kind"],
      id: str(l.id, 64),
      qty: Math.min(99, l.qty as number),
      slug: str(l.slug, 200),
      name: str(l.name, 200),
      price: typeof l.price === "number" && Number.isFinite(l.price) ? l.price : 0,
      bg: typeof l.bg === "string" ? l.bg.slice(0, 200) : null,
      imageUrl: typeof l.imageUrl === "string" ? l.imageUrl.slice(0, 600) : null,
    }));
}

export function saveCheckoutSnapshot(s: Omit<CheckoutSnapshot, "at">, storage: Storage | null = safeSession(), now = Date.now()): void {
  try {
    storage?.setItem(SNAPSHOT_KEY, JSON.stringify({ ...s, at: now }));
  } catch {
    /* stockage bloqué : l'écran d'échec proposera seulement WhatsApp et le catalogue */
  }
}

/** Instantané de la commande `number`, ou null (absent, autre commande, trop ancien, altéré). */
export function readCheckoutSnapshot(number: string | null, storage: Storage | null = safeSession(), now = Date.now()): CheckoutSnapshot | null {
  try {
    const raw = storage?.getItem(SNAPSHOT_KEY);
    if (!raw || !number) return null;
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (o.number !== number || typeof o.at !== "number" || now - o.at > MAX_AGE_MS || now < o.at - 60_000) return null;
    const lines = parseLines(o.lines);
    if (lines.length === 0) return null;
    return {
      number,
      lines,
      zone: o.zone === "autre" ? "autre" : "cotonou",
      pay: PAY.find((p) => p === o.pay) ?? "cod",
      form: parseForm(o.form),
      at: o.at,
    };
  } catch {
    return null;
  }
}

/** Prépare la reprise du tunnel ; l'appelant restaure ensuite le panier avec `snap.lines`. */
export function saveResume(snap: CheckoutSnapshot, opts: { pay?: PayMethod; token: string | null }, storage: Storage | null = safeSession()): void {
  const resume: CheckoutResume = {
    form: snap.form,
    zone: snap.zone,
    pay: opts.pay ?? snap.pay,
    replaces: opts.token ? { n: snap.number, k: opts.token } : null,
  };
  try {
    storage?.setItem(RESUME_KEY, JSON.stringify(resume));
  } catch {
    /* le tunnel s'ouvrira simplement vide */
  }
}

/** Lit ET efface la reprise (une seule utilisation). */
export function takeResume(storage: Storage | null = safeSession()): CheckoutResume | null {
  try {
    const raw = storage?.getItem(RESUME_KEY);
    if (!raw) return null;
    storage?.removeItem(RESUME_KEY);
    const o = JSON.parse(raw) as Record<string, unknown>;
    const rep = (o.replaces && typeof o.replaces === "object" ? o.replaces : null) as Record<string, unknown> | null;
    const replaces =
      rep && typeof rep.n === "string" && /^WX-\d{1,12}$/.test(rep.n) && typeof rep.k === "string" && /^[0-9a-f]{16,64}$/.test(rep.k)
        ? { n: rep.n, k: rep.k }
        : null;
    return { form: parseForm(o.form), zone: o.zone === "autre" ? "autre" : "cotonou", pay: PAY.find((p) => p === o.pay) ?? "cod", replaces };
  } catch {
    return null;
  }
}

/** Lien WhatsApp direct avec message prérempli (numéro au format international, chiffres seulement). */
export function whatsappHref(waNumber: string, text: string): string | null {
  const digits = waNumber.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
