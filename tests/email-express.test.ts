import { describe, expect, it } from "vitest";
import { renderOrderEmail, type OrderEmailData } from "@/lib/email/template";

const base: OrderEmailData = {
  locale: "fr",
  number: "WX-10300",
  name: "Afi Houngbédji",
  items: [{ name: "Lampe", qty: 1, unitPrice: 8900 }],
  total: 9900,
  pay: "momo",
  paid: true,
  deliveryDate: "aujourd'hui",
  brand: { shopName: "Wá xɔ", whatsapp: "+229 01 54 55 45 49", waNumber: "2290154554549", email: "commande@waxo.boutique", hours: "" },
  siteUrl: "https://www.waxo.boutique",
  zone: "cotonou",
};

describe("e-mails : Livraison Express", () => {
  it("slogan en signature sur tous les e-mails, FR et EN", () => {
    expect(renderOrderEmail(base, "confirmation").html).toContain("Vos commandes livrées dans les meilleurs délais.");
    expect(renderOrderEmail({ ...base, locale: "en" }, "annulee").html).toContain("Your orders, delivered as fast as we can.");
  });
  it("pastille Express : Cotonou & Calavi, livraison à venir seulement", () => {
    expect(renderOrderEmail(base, "confirmation").html).toContain("Livraison Express");
    expect(renderOrderEmail(base, "livraison").html).toContain("Livraison Express");
    expect(renderOrderEmail(base, "annulee").html).not.toContain("Livraison Express");
    expect(renderOrderEmail(base, "livree").html).not.toContain("Livraison Express");
    expect(renderOrderEmail({ ...base, zone: "autre" }, "confirmation").html).not.toContain("Livraison Express");
  });
  it("aucun tiret cadratin", () => {
    for (const k of ["confirmation", "paid", "preparation", "livraison", "livree", "annulee"] as const) {
      const m = renderOrderEmail(base, k);
      expect(m.html + m.text).not.toContain("\u2014");
    }
  });
});
