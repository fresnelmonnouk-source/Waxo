// Lecture (pure) de l'URL de retour de paiement : /commande/merci?n=WX-…&k=<jeton>&id=<transaction>&p=unavailable
// Les valeurs sont validées par motif ; elles ne servent qu'à interroger le serveur, jamais à décider de l'état affiché.

export type ReturnPayState = "paid" | "pending" | "failed" | "unknown" | "unavailable" | "none";

export type ReturnParams = {
  number: string | null;
  token: string | null;
  transactionId: string | null;
  /** Commande enregistrée mais paiement non lancé (provider indisponible). */
  unavailable: boolean;
};

export function parseReturnParams(search: string): ReturnParams {
  const p = new URLSearchParams(search);
  const n = p.get("n") ?? "";
  const k = p.get("k") ?? "";
  const id = p.get("id") ?? "";
  return {
    number: /^WX-\d{1,12}$/.test(n) ? n : null,
    token: /^[0-9a-f]{16,64}$/.test(k) ? k : null,
    transactionId: /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : null,
    unavailable: p.get("p") === "unavailable",
  };
}
