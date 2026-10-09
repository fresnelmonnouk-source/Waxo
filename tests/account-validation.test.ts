import { describe, expect, it } from "vitest";
import {
  contactSchema,
  fieldErrors,
  forgotSchema,
  isValidEmail,
  isValidPhone,
  loginSchema,
  normOrderNumber,
  normPhone,
  passwordSchema,
  prettyPhone,
  profileSchema,
  safeInternalPath,
  signupSchema,
  trackSchema,
} from "@/lib/auth/validation";

describe("normPhone / isValidPhone", () => {
  it("retire séparateurs et indicatif Bénin", () => {
    expect(normPhone("01 97 11 22 33")).toBe("0197112233");
    expect(normPhone("+229 01 97 11 22 33")).toBe("0197112233");
    expect(normPhone("00229 0197112233")).toBe("0197112233");
    expect(normPhone("229-0197112233")).toBe("0197112233");
  });
  it("accepte uniquement 10 chiffres commençant par 01", () => {
    expect(isValidPhone("0197112233")).toBe(true);
    expect(isValidPhone("+229 01 61 22 33 44")).toBe(true);
    expect(isValidPhone("0297112233")).toBe(false);
    expect(isValidPhone("019711223")).toBe(false);
    expect(isValidPhone("01971122334")).toBe(false);
    expect(isValidPhone("")).toBe(false);
    expect(isValidPhone("abcdefghij")).toBe(false);
  });
  it("met en forme par paires", () => {
    expect(prettyPhone("+2290197112233")).toBe("01 97 11 22 33");
  });
});

describe("isValidEmail", () => {
  it("valide les e-mails plausibles et refuse le reste", () => {
    expect(isValidEmail("afi@exemple.bj")).toBe(true);
    expect(isValidEmail("  afi@exemple.bj ")).toBe(true);
    expect(isValidEmail("afi@exemple")).toBe(false);
    expect(isValidEmail("afi exemple.bj")).toBe(false);
    expect(isValidEmail(`${"a".repeat(200)}@x.bj`)).toBe(false);
  });
});

describe("normOrderNumber", () => {
  it("normalise les saisies courantes", () => {
    expect(normOrderNumber("wx-10258")).toBe("WX-10258");
    expect(normOrderNumber(" WX 10258 ")).toBe("WX-10258");
    expect(normOrderNumber("WX10258")).toBe("WX-10258");
    expect(normOrderNumber("10258")).toBe("WX-10258");
  });
});

describe("signupSchema", () => {
  const ok = { firstName: "Afi", lastName: "Houngbédji", phone: "01 97 11 22 33", email: "Afi@Exemple.bj", password: "motdepasse", cgu: true };
  it("normalise téléphone et e-mail", () => {
    const r = signupSchema.safeParse(ok);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.phone).toBe("0197112233");
      expect(r.data.email).toBe("afi@exemple.bj");
      expect(r.data.news).toBe(false);
    }
  });
  it("exige mot de passe ≥ 8 et conditions acceptées", () => {
    const r = signupSchema.safeParse({ ...ok, password: "court", cgu: false });
    expect(r.success).toBe(false);
    if (!r.success) {
      const e = fieldErrors(r.error);
      expect(e.password).toBe("passShort");
      expect(e.cgu).toBe("cguRequired");
    }
  });
  it("signale chaque champ invalide avec son code", () => {
    const r = signupSchema.safeParse({ ...ok, firstName: "A", lastName: "", phone: "123", email: "nope" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(fieldErrors(r.error)).toMatchObject({
        firstName: "firstRequired",
        lastName: "lastRequired",
        phone: "phoneInvalid",
        email: "emailInvalid",
      });
    }
  });
  it("ignore un éventuel champ `role` envoyé par le client (jamais transmis)", () => {
    const r = signupSchema.safeParse({ ...ok, role: "admin" });
    expect(r.success).toBe(true);
    if (r.success) expect("role" in r.data).toBe(false);
  });
});

describe("loginSchema / forgotSchema", () => {
  it("demande identifiant et mot de passe", () => {
    const r = loginSchema.safeParse({ id: " ", password: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error)).toEqual({ id: "idRequired", password: "passRequired" });
    expect(forgotSchema.safeParse({ id: "afi@exemple.bj" }).success).toBe(true);
  });
});

describe("profileSchema", () => {
  it("n'accepte que les champs autorisés (le rôle est retiré)", () => {
    const bad = profileSchema.safeParse({ firstName: "Afi", lastName: "H", phone: "0197112233", address: "Fidjrossè", news: true });
    expect(bad.success).toBe(false); // nom de famille d'une seule lettre
    const ok = profileSchema.safeParse({ firstName: "Afi", lastName: "Hou", phone: "0197112233", address: "", news: true, role: "admin" });
    expect(ok.success).toBe(true);
    if (ok.success) expect(Object.keys(ok.data).sort()).toEqual(["address", "firstName", "lastName", "news", "phone"]);
  });
});

describe("passwordSchema", () => {
  it("refuse un nouveau mot de passe identique à l'actuel ou trop court", () => {
    expect(passwordSchema.safeParse({ current: "abcdefgh", next: "abcdefgh" }).success).toBe(false);
    const short = passwordSchema.safeParse({ current: "x", next: "abc" });
    expect(short.success).toBe(false);
    if (!short.success) expect(fieldErrors(short.error).next).toBe("passShort");
  });
  it("accepte l'absence d'ancien mot de passe (lien de réinitialisation)", () => {
    expect(passwordSchema.safeParse({ next: "nouveau-mdp", recovery: true }).success).toBe(true);
  });
});

describe("contactSchema", () => {
  const base = { name: "Koffi", contact: "koffi@exemple.bj", subject: "order", orderNumber: "", body: "Où en est ma commande ?" };
  it("accepte e-mail ou téléphone, numéro de commande facultatif et normalisé", () => {
    expect(contactSchema.safeParse(base).success).toBe(true);
    const r = contactSchema.safeParse({ ...base, contact: "+229 01 97 11 22 33", orderNumber: "wx 10258" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.contact).toBe("0197112233");
      expect(r.data.orderNumber).toBe("WX-10258");
    }
  });
  it("refuse contact invalide, message court, sujet inconnu, numéro de commande farfelu", () => {
    const r = contactSchema.safeParse({ ...base, contact: "12", body: "court", subject: "spam", orderNumber: "abc" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const e = fieldErrors(r.error);
      expect(e.contact).toBe("contactInvalid");
      expect(e.body).toBe("textShort");
      expect(e.subject).toBeDefined();
      expect(e.orderNumber).toBe("orderInvalid");
    }
  });
  it("borne la longueur du message", () => {
    expect(contactSchema.safeParse({ ...base, body: "x".repeat(3001) }).success).toBe(false);
  });
});

describe("trackSchema", () => {
  it("normalise le numéro et exige e-mail ou téléphone", () => {
    const r = trackSchema.safeParse({ number: "wx-10258", contact: "0197112233" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.number).toBe("WX-10258");
    expect(trackSchema.safeParse({ number: "10258", contact: "afi@exemple.bj" }).success).toBe(true);
    expect(trackSchema.safeParse({ number: "ZZ-1", contact: "0197112233" }).success).toBe(false);
    expect(trackSchema.safeParse({ number: "WX-10258", contact: "pas un contact" }).success).toBe(false);
  });
});

describe("safeInternalPath", () => {
  it("n'accepte que des chemins internes", () => {
    expect(safeInternalPath("/compte")).toBe("/compte");
    expect(safeInternalPath("/commande")).toBe("/commande");
    expect(safeInternalPath("//evil.com")).toBeNull();
    expect(safeInternalPath("https://evil.com")).toBeNull();
    expect(safeInternalPath("/a?b=c")).toBeNull();
    expect(safeInternalPath(undefined)).toBeNull();
  });
});
