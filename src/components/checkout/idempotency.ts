// Clé d'idempotence d'une tentative de commande (côté navigateur). Même clé tant que le contenu de la commande est
// identique : un nouvel essai après coupure réseau ne crée pas de seconde commande. Contenu modifié → nouvelle clé.

const STORAGE_KEY = "waxo:checkout-idem:v1";

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

/** Empreinte stable du contenu de la commande (lignes triées, zone, moyen de paiement, coordonnées). */
export function orderSignature(parts: {
  items: { kind: string; id: string; qty: number }[];
  zone: string;
  pay: string;
  phone: string;
  name: string;
  address: string;
}): string {
  const items = [...parts.items]
    .map((i) => `${i.kind}:${i.id}:${i.qty}`)
    .sort()
    .join(",");
  return [items, parts.zone, parts.pay, parts.phone, parts.name, parts.address].join("|");
}

function newKey(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* repli ci-dessous */
  }
  const hex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-a${hex().slice(1)}-${hex()}${hex()}${hex()}`;
}

/** Renvoie la clé de la tentative courante (créée si le contenu a changé ou si rien n'est stocké). */
export function idempotencyKeyFor(signature: string, storage: Storage | null = safeStorage()): string {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as { sig?: unknown; key?: unknown };
      if (saved.sig === signature && typeof saved.key === "string") return saved.key;
    }
  } catch {
    /* clé illisible : on en crée une */
  }
  const key = newKey();
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify({ sig: signature, key }));
  } catch {
    /* stockage bloqué : la clé vit le temps de cette tentative seulement */
  }
  return key;
}

export function clearIdempotencyKey(storage: Storage | null = safeStorage()): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    /* rien à faire */
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}
