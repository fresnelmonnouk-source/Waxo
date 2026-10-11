import { describe, expect, it } from "vitest";
import { deliveryState, otherCitiesWindow, safeCutoff } from "@/lib/delivery/promise";
import { deliveryExpression } from "@/lib/email/delivery";

// Heures en UTC ; Bénin = UTC+1. Mercredi 7 octobre 2026, samedi 10, dimanche 11.
const at = (d: number, hUtc: number, m = 0) => Date.UTC(2026, 9, d, hUtc, m);

describe("promesse de livraison selon l'heure (Cotonou & Calavi, 20 h, 7 j/7)", () => {
  it("avant 20 h : aujourd'hui ; 19 h 59 encore aujourd'hui ; 20 h pile : demain", () => {
    expect(deliveryState(at(7, 9))).toBe("today"); // 10 h
    expect(deliveryState(at(7, 18, 59))).toBe("today"); // 19 h 59
    expect(deliveryState(at(7, 19))).toBe("tomorrow"); // 20 h
  });
  it("samedi soir : demain dimanche ; dimanche matin : aujourd'hui (on livre le dimanche)", () => {
    expect(deliveryState(at(10, 20))).toBe("tomorrowSunday"); // samedi 21 h
    expect(deliveryState(at(11, 8))).toBe("today"); // dimanche 9 h
  });
  it("heure limite réglable et bornée", () => {
    expect(deliveryState(at(7, 18), 18)).toBe("tomorrow"); // 19 h avec limite 18 h
    expect(safeCutoff(21)).toBe(21);
    expect(safeCutoff("20")).toBe(20);
    expect(safeCutoff(0)).toBe(20);
  });
  it("autres villes : J+2 à J+3", () => {
    const w = otherCitiesWindow(at(7, 9));
    expect(w.from.getUTCDate()).toBe(9);
    expect(w.to.getUTCDate()).toBe(10);
  });
});

describe("e-mails : date prévue", () => {
  const args = { cutoff: 20, locale: "fr" as const };
  it("Cotonou avant 20 h : aujourd'hui ; après : demain ; dimanche compris", () => {
    expect(deliveryExpression({ zone: "cotonou", createdAt: at(7, 9), now: at(7, 9), ...args })).toBe("aujourd'hui");
    expect(deliveryExpression({ zone: "cotonou", createdAt: at(7, 20), now: at(7, 20), ...args })).toBe("demain");
    expect(deliveryExpression({ zone: "cotonou", createdAt: at(10, 20), now: at(10, 20), ...args })).toBe("demain"); // samedi soir → dimanche
  });
  it("paiement à la livraison pas encore confirmé : dès la confirmation", () => {
    expect(deliveryExpression({ zone: "cotonou", createdAt: at(7, 9), now: at(7, 9), awaitingConfirmation: true, ...args })).toBe("dès la confirmation");
    expect(deliveryExpression({ zone: "cotonou", createdAt: at(7, 9), now: at(7, 9), awaitingConfirmation: true, cutoff: 20, locale: "en" })).toBe("once confirmed");
  });
  it("autres villes : 48 à 72 h ; jamais plus de 25 caractères", () => {
    expect(deliveryExpression({ zone: "autre", createdAt: at(7, 9), now: at(7, 9), ...args })).toBe("sous 48 à 72 h");
    for (const locale of ["fr", "en"] as const)
      for (const zone of ["cotonou", "autre"])
        for (const h of [8, 21])
          for (const aw of [false, true])
            expect(deliveryExpression({ zone, createdAt: at(7, h - 1), now: at(7, h - 1), cutoff: 20, locale, awaitingConfirmation: aw }).length).toBeLessThanOrEqual(25);
  });
});
