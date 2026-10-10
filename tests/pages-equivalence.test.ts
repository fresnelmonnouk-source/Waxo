import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en/account.json";
import fr from "@/messages/fr/account.json";
import { DEFAULT_SETTINGS } from "@/lib/catalog";
import { DEFAULT_PAGES } from "@/lib/pages/defaults";
import { makeMarkerResolver } from "@/lib/pages/markers";
import { parseMarkdown } from "@/lib/pages/markdown";
import { EMPTY_LEGAL, type PageLocale, type PageSlug } from "@/lib/pages/types";
import { MarkdownBlocks, type AnchorProps } from "@/components/account/legal/MarkdownView";

// Le lien i18n dépend du routeur Next : remplacé par un <a> simple pour le rendu serveur isolé.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => createElement("a", { href, ...rest }, children),
}));

const Anchor = ({ href, children }: AnchorProps) => createElement("a", { href }, children);

/** HTML → texte comparable : balises → espace, entités décodées, blocs « à compléter » (<mark>) réduits à §, espaces collapsés. */
function norm(html: string): string {
  return html
    .replace(/<mark[^>]*>[\s\S]*?<\/mark>/g, "§")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/§(\s*,\s*§)+/g, "§") // la liste « hébergeur, adresse, téléphone » perd le téléphone (pas de réglage dédié)
    .replace(/\s+/g, " ")
    .replace(/\s([,.;:])/g, "$1")
    .trim();
}

async function legacy(doc: "cgv" | "cgu" | "mentions" | "privacy" | "shipping", locale: PageLocale, settings = DEFAULT_SETTINGS) {
  const { LegalDoc } = await import("@/components/account/legal/LegalDoc");
  const { ShippingDoc } = await import("@/components/account/legal/ShippingDoc");
  const messages = locale === "fr" ? fr : en;
  const inner = doc === "shipping" ? createElement(ShippingDoc, { settings }) : createElement(LegalDoc, { doc, settings });
  const html = renderToStaticMarkup(
    // eslint-disable-next-line react/no-children-prop -- le typage de NextIntlClientProvider exige `children` dans les props
    createElement(NextIntlClientProvider, { locale, messages, children: inner, onError: () => {} }),
  );
  const article = /<article[^>]*>([\s\S]*)<\/article>/.exec(html)?.[1] ?? "";
  // La ligne « En vigueur au … » est gérée à part par InfoPage.
  return norm(article.replace(/<span class="text-\[14px\] text-muted">[^<]*<\/span>/, ""));
}

function fromDefaults(slug: PageSlug, locale: PageLocale, settings = DEFAULT_SETTINGS) {
  const d = DEFAULT_PAGES[slug][locale];
  const blocks = parseMarkdown(d.body, { resolve: makeMarkerResolver({ locale, shop: settings, legal: { ...EMPTY_LEGAL } }) });
  const html = renderToStaticMarkup(createElement("article", null, createElement("h1", null, d.title), createElement(MarkdownBlocks, { blocks, Anchor })));
  return norm(html);
}

const PAIRS = [
  ["cgv", "cgv"],
  ["cgu", "cgu"],
  ["mentions-legales", "mentions"],
  ["confidentialite", "privacy"],
  ["livraison-retours", "shipping"],
] as const;

describe("pages : le texte par défaut (markdown) reproduit exactement le contenu J1 (messages)", () => {
  for (const locale of ["fr", "en"] as const) {
    for (const [slug, doc] of PAIRS) {
      it(`${slug} (${locale})`, async () => {
        const a = fromDefaults(slug, locale); const b = await legacy(doc, locale); expect(b.length).toBeGreaterThan(300); expect(a).toBe(b);
      });
    }
  }

  it("suit les réglages comme J1 : franco, délai de retour au singulier et paiement à la livraison coupé", async () => {
    const settings = { ...DEFAULT_SETTINGS, shipping: { ...DEFAULT_SETTINGS.shipping, freeFrom: 20000, returnDays: 1 }, pay: { ...DEFAULT_SETTINGS.pay, cod: false } };
    for (const [slug, doc] of PAIRS) {
      expect(fromDefaults(slug, "fr", settings), slug).toBe(await legacy(doc, "fr", settings));
    }
  });

  it("À propos : le héro et les 3 cartes reprennent les messages J1", () => {
    for (const [locale, m] of [
      ["fr", fr.About],
      ["en", en.About],
    ] as const) {
      const text = fromDefaults("a-propos", locale);
      for (const k of ["p1", "p2", "c1t", "c1p", "c2t", "c2p"] as const) expect(text).toContain(norm(m[k]));
      expect(text).toContain(norm(m.c3t));
      expect(text).toContain(locale === "fr" ? "sous 7 jours" : "within 7 days");
      expect(text.startsWith(norm(m.title))).toBe(true);
    }
  });
});
