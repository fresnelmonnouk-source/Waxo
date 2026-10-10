// Titres, sous-titres et pastilles de la coque (maquette : `titles`, `badges`, `NAV`). Fonction pure, testable.
import { ADMIN_NAV } from "../nav";
import type { ShellCounts } from "@/lib/admin/data/dashboard";
import { plural } from "@/lib/stats/format";
import type { NavEntry } from "./NavLinks";
import type { PageMeta } from "./PageHeading";

const TITLES: Record<string, string> = {
  dashboard: "Tableau de bord",
  orders: "Commandes",
  delivery: "Livraisons",
  clients: "Clients",
  products: "Produits",
  packs: "Packs",
  reviews: "Avis clients",
  pages: "Pages d'infos",
  messages: "Messages",
  newsletter: "Newsletter",
  stats: "Statistiques",
  ledger: "Carnet de comptes",
  settings: "Réglages",
};

export function buildPageMeta(c: ShellCounts, todayLabel: string): PageMeta[] {
  const subs: Record<string, string> = {
    dashboard: todayLabel,
    orders: `${plural(c.ordersTotal, "commande", "commandes")} · ${c.ordersTodo} à traiter`,
    delivery: `${plural(c.ordersTodo, "commande à expédier", "commandes à expédier")} · ${c.ordersShipping} en route`,
    clients: plural(c.clients, "compte client", "comptes clients"),
    products: `${plural(c.productsTotal, "produit", "produits")} · ${c.productsLow} en stock faible`,
    packs: "Offres groupées à prix réduit",
    reviews: `${plural(c.reviewsTotal, "avis", "avis")} · ${plural(c.reviewsHidden, "masqué", "masqués")}`,
    pages: "À propos, livraison, conditions et mentions légales",
    messages: plural(c.messagesTodo, "message à traiter", "messages à traiter"),
    newsletter: plural(c.subscribers, "inscrit", "inscrits"),
    stats: "Sur la période choisie, hors commandes annulées",
    ledger: "Ventes, prix d'achat, dépenses et résultat, avec votre comptable IA",
    settings: "Boutique, livraison, paiement et assistants IA",
  };
  return ADMIN_NAV.map((n) => ({ href: n.href, title: TITLES[n.id] ?? n.label, sub: subs[n.id] ?? "" }));
}

const GROUP_ORDER = ["pilotage", "vente", "boutique"] as const;

/** Entrées de navigation ordonnées par groupe (tableau de bord d'abord, puis vente, boutique, pilotage), avec pastilles. */
export function buildNavEntries(c: ShellCounts): NavEntry[] {
  const badges: Record<string, number> = { orders: c.ordersTodo, delivery: c.ordersShipping, products: c.productsLow, messages: c.messagesTodo };
  const dash = ADMIN_NAV.filter((n) => n.id === "dashboard");
  const rest = ADMIN_NAV.filter((n) => n.id !== "dashboard");
  const ordered = [
    ...dash,
    ...[GROUP_ORDER[1], GROUP_ORDER[2], GROUP_ORDER[0]].flatMap((g) => rest.filter((n) => n.group === g)),
  ];
  let prevGroup = "";
  return ordered.map((n, idx) => {
    const gapBefore = idx > 0 && n.group !== prevGroup;
    prevGroup = n.group;
    return { id: n.id, label: n.label, href: n.href, badge: badges[n.id] ?? 0, gapBefore };
  });
}
