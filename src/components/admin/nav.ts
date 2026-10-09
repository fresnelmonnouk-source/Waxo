// Navigation du back-office (UNE seule source). Chaque entrée = un dossier de pages sous src/app/admin/(panel)/<href>.
// Posée par le socle : les agents n'éditent PAS ce fichier (les routes listées existeront toutes à la fin de J2).
export type AdminNavItem = { id: string; label: string; href: string; group: "vente" | "boutique" | "pilotage" };

export const ADMIN_NAV: AdminNavItem[] = [
  { id: "dashboard", label: "Tableau de bord", href: "/admin", group: "pilotage" },
  { id: "orders", label: "Commandes", href: "/admin/commandes", group: "vente" },
  { id: "delivery", label: "Livraisons", href: "/admin/livraisons", group: "vente" },
  { id: "clients", label: "Clients", href: "/admin/clients", group: "vente" },
  { id: "products", label: "Produits", href: "/admin/produits", group: "boutique" },
  { id: "packs", label: "Packs", href: "/admin/packs", group: "boutique" },
  { id: "reviews", label: "Avis", href: "/admin/avis", group: "boutique" },
  { id: "pages", label: "Pages d'infos", href: "/admin/pages", group: "boutique" },
  { id: "messages", label: "Messages", href: "/admin/messages", group: "vente" },
  { id: "newsletter", label: "Newsletter", href: "/admin/newsletter", group: "vente" },
  { id: "stats", label: "Statistiques", href: "/admin/stats", group: "pilotage" },
  { id: "ledger", label: "Carnet de comptes", href: "/admin/carnet", group: "pilotage" },
  { id: "settings", label: "Réglages", href: "/admin/reglages", group: "pilotage" },
];
