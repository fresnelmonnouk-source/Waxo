import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { button, escapeHtml, infoBox, items, p, renderLayout, steps } from "@/lib/email/layout";
import { renderShopNewOrder } from "@/lib/email/shop-template";

const order = {
  number: "WX-10264", name: "Afi H.", phone: "0197000000", address: "Fidjrossè", note: "", zone: "cotonou", pay: "cod", paid: false,
  subtotal: 15000, shippingFee: 1000, total: 16000, items: [{ name: "Gourde", qty: 2, unitPrice: 6500 }], siteUrl: "https://www.waxo.boutique",
};

describe("gabarit commun (layout)", () => {
  it("échappe toute chaîne passée aux composants", () => {
    const html = [p('<img src=x onerror="a">'), infoBox([{ label: "<b>", value: "<script>" }]), items([{ label: "<i>", amount: "1 F" }]), steps(["<x>"], 0)]
      .map((h) => h.__html)
      .join("");
    expect(html).not.toMatch(/<img|<script|<b>|<i>|<x>/);
    expect(html).toContain("&lt;script&gt;");
  });
  it("bouton : l'URL est échappée (pas de sortie d'attribut)", () => {
    expect(button('https://x/"onmouseover="a', "Go").__html).not.toContain('"onmouseover="');
  });
  it("page : charte (crème, encre, soleil), langue, aperçu caché, logo avec texte alternatif", () => {
    const html = renderLayout({ locale: "en", title: "T", preheader: "Aperçu", heading: "Titre <b>", body: p("x"), footer: ["f"], logoUrl: "https://s/email/logo-light.png" });
    expect(html).toContain('lang="en"');
    expect(html).toContain("#F4F1EA");
    expect(html).toContain("#141210");
    expect(html).toContain('alt="Wá xɔ"');
    expect(html).toContain("Titre &lt;b&gt;");
    expect(html).toMatch(/display:none[^>]*>Aperçu/);
  });
  it("escapeHtml", () => expect(escapeHtml(`"'<&>`)).toBe("&quot;&#39;&lt;&amp;&gt;"));
});

describe("alerte boutique « nouvelle commande »", () => {
  it("objet, client, téléphone WhatsApp, lien admin, rappel COD", () => {
    const m = renderShopNewOrder(order);
    const norm = (x: string) => x.replace(/[\s\u00A0\u202F]+/g, " ");
    expect(norm(m.subject)).toBe("Nouvelle commande WX-10264 · 16 000 F · à encaisser à la livraison");
    expect(m.html).toContain("https://wa.me/2290197000000");
    expect(m.html).toContain('href="https://www.waxo.boutique/admin/commandes"');
    expect(m.html).toContain("expire");
    expect(m.text).toContain("Admin : https://www.waxo.boutique/admin/commandes");
  });
  it("commande en ligne payée : pas de rappel COD ; données client échappées ; objet sur une ligne", () => {
    const m = renderShopNewOrder({ ...order, pay: "momo", paid: true, name: "<script>x</script>\r\nBcc: y", note: "<b>n</b>" });
    expect(m.subject).toContain("payée en ligne");
    expect(m.subject).not.toMatch(/[\r\n]/);
    expect(m.html).not.toContain("<script>x");
    expect(m.html).not.toContain("<b>n</b>");
    expect(m.html).not.toContain("expire");
  });
});

describe("modèles Supabase Auth générés", () => {
  const dir = join(process.cwd(), "supabase", "email-templates");
  const files = readdirSync(dir).filter((f) => f.endsWith(".html"));
  const config = readFileSync(join(process.cwd(), "supabase", "config.toml"), "utf8");

  it("les 6 modèles + 2 notifications existent et sont déclarés dans config.toml", () => {
    for (const n of ["confirmation", "recovery", "email_change", "magic_link", "invite", "reauthentication"]) {
      expect(files).toContain(`${n}.html`);
      expect(config).toContain(`[auth.email.template.${n}]`);
    }
    expect(config).toContain("[auth.email.notification.password_changed]");
    expect(config).toContain("[auth.email.notification.email_changed]");
    for (const m of config.matchAll(/content_path = "\.\/(.+?)"/g)) expect(existsSync(join(process.cwd(), m[1])), m[1]).toBe(true);
  });
  it("config.toml minimal : domaine de production, jamais localhost en site_url", () => {
    expect(config).toMatch(/site_url = "https:\/\/www\.waxo\.boutique"/);
    expect(config).not.toMatch(/site_url = "http:\/\/(localhost|127)/);
  });
  it("uniquement des variables Supabase connues ; aucune donnée saisie par l'utilisateur (prénom…)", () => {
    const allowed = new Set([".ConfirmationURL", ".SiteURL", ".Token", ".NewEmail", "else", "end"]);
    for (const f of files) {
      const html = readFileSync(join(dir, f), "utf8");
      for (const m of html.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)) {
        const v = m[1];
        if (v.startsWith("if ")) {
          expect(v, f).toBe('if and .Data .Data.locale (eq .Data.locale "en")');
          continue;
        }
        expect(allowed.has(v), `${f}: {{ ${v} }}`).toBe(true);
      }
      expect(html, f).not.toMatch(/first_name|last_name|\.Data\.phone/);
    }
  });
  it("chaque modèle bilingue a ses deux versions (FR par défaut) ; notifications en français seul", () => {
    for (const f of files) {
      const html = readFileSync(join(dir, f), "utf8");
      if (f.includes("notification")) {
        expect(html.startsWith("<!doctype html>"), f).toBe(true);
        continue;
      }
      expect(html, f).toMatch(/^\{\{ if [^}]+\}\}<!doctype html>[\s\S]*lang="en"[\s\S]*\{\{ else \}\}<!doctype html>[\s\S]*lang="fr"[\s\S]*\{\{ end \}\}\s*$/);
    }
  });
  it("logo servi par le site (suivi automatique du domaine)", () => {
    for (const f of files) expect(readFileSync(join(dir, f), "utf8"), f).toContain('src="{{ .SiteURL }}/email/logo-light.png"');
    expect(existsSync(join(process.cwd(), "public", "email", "logo-light.png"))).toBe(true);
  });
});
