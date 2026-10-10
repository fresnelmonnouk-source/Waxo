import type { AccountantData } from "@/lib/accountant/types";

/** Jeu de données minimal et vérifiable à la main (octobre 2026 = mois courant des tests). */
export const DATA: AccountantData = {
  products: [
    { id: "lampe", name: "Lampe LED rechargeable", price: 8900, cost: 4600 },
    { id: "ventilo", name: "Mini ventilateur USB", price: 6000, cost: 3100 },
    { id: "gourde", name: "Gourde isotherme", price: 5000, cost: null },
  ],
  orders: [
    { date: "2026-10-02T10:00:00", status: "livree", sub: 17800, ship: 1000, items: [{ pid: "lampe", name: "Lampe LED rechargeable", price: 8900, qty: 2 }] },
    { date: "2026-10-05T10:00:00", status: "nouvelle", sub: 6000, ship: 1000, items: [{ pid: "ventilo", name: "Mini ventilateur USB", price: 6000, qty: 1 }] },
    { date: "2026-10-06T10:00:00", status: "annulee", sub: 99999, ship: 1000, items: [{ pid: "lampe", name: "Lampe LED rechargeable", price: 8900, qty: 9 }] },
    { date: "2026-10-07T10:00:00", status: "livree", sub: 5000, ship: 0, items: [{ pid: "gourde", name: "Gourde isotherme", price: 5000, qty: 1 }] },
    { date: "2026-09-10T10:00:00", status: "livree", sub: 8900, ship: 1000, items: [{ pid: "lampe", name: "Lampe LED rechargeable", price: 8900, qty: 1 }] },
  ],
  ledger: [
    { id: "1", date: "2026-10-03", cat: "pub", label: "Pub FB", amount: 10000 },
    { id: "2", date: "2026-10-04", cat: "stock", label: "Réassort", amount: 200000 },
    { id: "3", date: "2026-10-05", cat: "loyer", label: "Loyer", amount: 5000 },
    { id: "4", date: "2026-09-04", cat: "pub", label: "Pub", amount: 2000 },
  ],
};
