import { describe, expect, it } from "vitest";
import { escapeHtml, findMarkers, inlineText, parseMarkdown, safeHref, toHtml, type MarkerResolver } from "@/lib/pages/markdown";

const resolve: MarkerResolver = (key) => {
  if (key === "brand.email") return { status: "ok", text: "contact@waxo.bj" };
  if (key === "shipping.cotonou") return { status: "ok", text: "1 000 F" };
  if (key === "legal.ifu") return { status: "empty", label: "[à compléter]" };
  return { status: "unknown" };
};
const html = (md: string) => toHtml(parseMarkdown(md, { resolve }));

describe("pages : escapeHtml", () => {
  it("échappe & < > \" ' (sûr aussi dans un attribut)", () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&`)).toBe("&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;");
  });
});

describe("pages : markdown de base", () => {
  it("titres, paragraphes, retour à la ligne simple", () => {
    expect(html("## Titre\n\nLigne 1\nLigne 2\n\nAutre")).toBe("<h2>Titre</h2>\n<p>Ligne 1<br>Ligne 2</p>\n<p>Autre</p>");
  });
  it("listes à puces et numérotées, avec continuation indentée", () => {
    expect(html("- a\n- b\n  suite\n\n1. un\n2. deux")).toBe("<ul><li>a</li><li>b suite</li></ul>\n<ol><li>un</li><li>deux</li></ol>");
  });
  it("gras, italique, échappement par antislash, étoile isolée", () => {
    expect(html("**gras** et *ital* et 2 * 3 et \\*pas\\*")).toBe("<p><strong>gras</strong> et <em>ital</em> et 2 * 3 et *pas*</p>");
  });
  it("tableau avec en-tête et cellule à pipe échappé", () => {
    const out = html("| Zone | Frais |\n|---|---|\n| Cotonou | {{shipping.cotonou}} |\n| A \\| B | – |");
    expect(out).toContain("<th>Zone</th><th>Frais</th>");
    expect(out).toContain("<td>Cotonou</td><td>1 000 F</td>");
    expect(out).toContain("<td>A | B</td>");
  });
  it("ne plante jamais sur une entrée vide ou absurde", () => {
    expect(parseMarkdown("")).toEqual([]);
    expect(() => parseMarkdown("[".repeat(5000) + "*".repeat(5000) + "{{".repeat(3000))).not.toThrow();
    expect(() => parseMarkdown("|\n|---|\n|")).not.toThrow();
  });
});

describe("pages : marqueurs dans le markdown", () => {
  it("remplace les valeurs, rend « à compléter » si vide, laisse l'inconnu visible", () => {
    expect(html("Mail {{ brand.email }}, IFU {{legal.ifu}}, {{legal.oups}}")).toBe(
      "<p>Mail contact@waxo.bj, IFU <mark>[à compléter]</mark>, {{legal.oups}}</p>",
    );
  });
  it("{{todo:…}} affiche une note éditoriale jaune", () => {
    expect(html("{{todo:Préciser l'outil}}")).toBe("<p><mark>[Préciser l&#39;outil]</mark></p>");
  });
  it("la valeur d'un marqueur est du texte, jamais du HTML", () => {
    const evil: MarkerResolver = () => ({ status: "ok", text: `<img src=x onerror="alert(1)">` });
    expect(toHtml(parseMarkdown("{{brand.email}}", { resolve: evil }))).toBe("<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>");
  });
  it("findMarkers liste les clés (hors todo)", () => {
    expect(findMarkers("{{a.b}} {{ c.d }} {{todo:x}} {{a.b}}").sort()).toEqual(["a.b", "c.d"]);
  });
  it("un lien dont le marqueur d'URL est vide perd son lien mais garde son texte", () => {
    expect(html("[{{legal.ifu}}](mailto:{{legal.ifu}})")).toBe("<p><mark>[à compléter]</mark></p>");
    expect(html("[écrire](mailto:{{brand.email}})")).toBe('<p><a href="mailto:contact@waxo.bj" rel="noopener noreferrer" target="_blank">écrire</a></p>');
  });
});

describe("pages : liens et XSS", () => {
  it("n'accepte que http(s), mailto et les chemins internes", () => {
    expect(safeHref("https://example.com/a?b=1")?.internal).toBe(false);
    expect(safeHref("http://example.com")).not.toBeNull();
    expect(safeHref("mailto:a@b.co")).not.toBeNull();
    expect(safeHref("/cgv")).toEqual({ href: "/cgv", internal: true });
    for (const bad of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      " javascript:alert(1)",
      "data:text/html,<script>",
      "vbscript:x",
      "//evil.com",
      "/\\evil.com",
      "https://",
      'https://x.com/"onmouseover="alert(1)',
      "https://x.com/'onmouseover='alert(1)",
      "https://x.com/a b",
      "tel:+22901",
      "",
    ]) {
      expect(safeHref(bad), bad).toBeNull();
    }
  });
  it("un lien dangereux est rendu en texte simple", () => {
    expect(html("[clic](javascript:alert(1))")).not.toContain("<a");
    expect(html("[clic](javascript:void)")).toBe("<p>clic</p>");
    expect(html("[clic](data:text/html;base64,AAAA)")).toBe("<p>clic</p>");
  });
  it("le HTML brut et les attributs injectés restent du texte échappé", () => {
    const out = html(`<script>alert(1)</script> <img src=x onerror=alert(1)> [x"y](https://a.com/ok)`);
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(out).toContain("x&quot;y");
  });
  it("lien en bouton : {button}", () => {
    const [b] = parseMarkdown("[Contact](/contact){button}");
    expect(b).toMatchObject({ t: "p", c: [{ t: "link", button: true, internal: true, href: "/contact" }] });
  });
  it("inlineText concatène le texte brut", () => {
    const [b] = parseMarkdown("a **b** [c](/d)");
    expect(b.t === "p" && inlineText(b.c)).toBe("a b c");
  });
});
