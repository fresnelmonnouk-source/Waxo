import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider, createTranslator } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import enAccount from "@/messages/en/account.json";
import enLegal from "@/messages/en/legal.json";
import frAccount from "@/messages/fr/account.json";
import frLegal from "@/messages/fr/legal.json";
import { DEFAULT_SETTINGS } from "@/lib/catalog";
import { EMPTY_LEGAL, type LegalSettings } from "@/lib/pages/types";

const db = vi.hoisted(() => ({
  page: null as null | { title: string; body_md: string; updated_at: string },
  legal: null as null | Record<string, unknown>,
  throwOnRead: false,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => createElement("a", { href, ...rest }, children),
}));
vi.mock("@/lib/supabase/env", () => ({ supabasePublicEnv: () => ({ url: "https://x.supabase.co", key: "k" }) }));
vi.mock("@/lib/supabase/public", () => ({
  createPublicClient: () => ({
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => {
          if (db.throwOnRead) throw new Error("réseau");
          return { error: null, data: table === "pages" ? db.page : db.legal ? { value: db.legal } : null };
        },
      };
      return q;
    },
  }),
}));
// Les réglages boutique viennent du catalogue (testé ailleurs) : valeurs par défaut.
vi.mock("@/lib/catalog", async (orig) => {
  const mod = await orig<typeof import("@/lib/catalog")>();
  return { ...mod, getSettings: async () => mod.DEFAULT_SETTINGS };
});
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale, namespace }: { locale: "fr" | "en"; namespace: string }) =>
    createTranslator({ locale, messages: locale === "fr" ? { ...frAccount, ...frLegal } : { ...enAccount, ...enLegal }, namespace } as never),
}));

async function render(slug: string, lang: "fr" | "en") {
  const { InfoPage } = await import("@/components/account/legal/InfoPage");
  let el = await InfoPage({ slug: slug as "cgv", lang });
  // « À propos » renvoie un composant serveur asynchrone (rendu par Next) : on le résout ici pour le rendu statique.
  if (slug === "a-propos") el = await (el.type as (p: unknown) => Promise<typeof el>)(el.props);
  return renderToStaticMarkup(
    // eslint-disable-next-line react/no-children-prop -- le typage de NextIntlClientProvider exige `children` dans les props
    createElement(NextIntlClientProvider, {
      locale: lang,
      messages: lang === "fr" ? { ...frAccount, ...frLegal } : { ...enAccount, ...enLegal },
      children: el,
      onError: () => {},
    }),
  );
}

beforeEach(() => {
  db.page = null;
  db.legal = null;
  db.throwOnRead = false;
  vi.resetModules();
});

describe("pages : lecture en base avec repli", () => {
  it("sans ligne en base : texte par défaut, bandeau « modèle à valider », « en vigueur », marqueurs « à compléter »", async () => {
    const html = await render("cgv", "fr");
    expect(html).toContain("Conditions générales de vente");
    expect(html).toContain("En vigueur au 8 octobre 2026");
    expect(html).toContain("doit être validé par un juriste");
    expect(html).toContain("<mark");
    expect(html).toContain("[à compléter]");
    expect(html).toMatch(new RegExp(`avant ${DEFAULT_SETTINGS.shipping.cutoff}\\sh`));
  });

  it("base injoignable : même repli, jamais d'exception", async () => {
    db.throwOnRead = true;
    const html = await render("livraison-retours", "en");
    expect(html).toContain("Delivery and returns");
    expect(html).toContain("<table");
    expect(html).toContain('href="/contact"');
  });

  it("ligne en base : titre et texte éditables, date de mise à jour, marqueurs remplacés par les réglages légaux", async () => {
    db.page = { title: "Mes CGV", body_md: "## Éditeur\n\n{{legal.companyName}} — IFU {{legal.ifu}} — livraison {{shipping.cotonou}}", updated_at: "2026-10-09T10:00:00.000Z" };
    db.legal = { companyName: "Waxo SARL", ifu: "", evil: "<b>x</b>" } satisfies Partial<LegalSettings> & { evil: string };
    const html = await render("cgv", "fr");
    expect(html).toContain("Mes CGV");
    expect(html).toContain("Waxo SARL");
    expect(html).toMatch(/IFU <mark[^>]*>\[à compléter\]<\/mark>/);
    expect(html).toContain("Dernière mise à jour");
    expect(html).not.toContain("En vigueur au");
    expect(html).not.toContain("<b>x</b>");
  });

  it("une ligne vide ou à moitié vide retombe sur le texte par défaut", async () => {
    db.page = { title: "Titre seul", body_md: "   ", updated_at: "2026-10-09T10:00:00.000Z" };
    const html = await render("cgu", "fr");
    expect(html).toContain("Conditions générales d&#x27;utilisation");
    expect(html).not.toContain("Titre seul");
  });

  it("le contenu édité ne peut pas injecter de HTML ni de lien dangereux", async () => {
    db.page = {
      title: `<img src=x onerror=alert(1)>`,
      body_md: `<script>alert(1)</script>\n\n[a](javascript:alert) [b](https://x.com/"onmouseover="y) [c](https://ok.example/a)\n\n| <b>h</b> |\n|---|\n| <i>c</i> |`,
      updated_at: "2026-10-09T10:00:00.000Z",
    };
    const html = await render("mentions-legales", "fr");
    expect(html).not.toMatch(/<script|<img|<b>|<i>|href="javascript/i);
    expect(html).not.toContain('onmouseover="y"');
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('href="https://ok.example/a"');
    expect(html).toMatch(/rel="noopener noreferrer"/);
  });

  it("À propos : texte d'introduction + cartes numérotées + bandeau d'appel à l'action", async () => {
    const html = await render("a-propos", "fr");
    expect(html).toContain("Une boutique en ligne pour les petites choses utiles.");
    expect(html).toContain(">01<");
    expect(html).toContain(">03<");
    expect(html).not.toContain(">04<");
    expect(html).toContain("sous 7 jours");
    expect(html).toContain("Une question avant de commander ?");
    expect(html).not.toContain("doit être validé par un juriste"); // pas de bandeau juridique sur « À propos »
    db.page = { title: "Qui sommes-nous", body_md: "Intro.\n\n## Un\n\nA\n\n## Deux\n\nB", updated_at: "2026-10-09T10:00:00.000Z" };
    vi.resetModules();
    const edited = await render("a-propos", "fr");
    expect(edited).toContain("Qui sommes-nous");
    expect(edited).toContain(">02<");
    expect(edited).not.toContain(">03<");
  });
});

describe("pages : réglages légaux publics", () => {
  it("getLegalSettings : vide sans ligne, filtré sur les clés connues sinon", async () => {
    const { getLegalSettings } = await import("@/lib/pages");
    expect(await getLegalSettings()).toEqual(EMPTY_LEGAL);
    db.legal = { companyName: " Waxo ", hostName: 5, inconnu: "x" };
    vi.resetModules();
    const again = await import("@/lib/pages");
    expect(await again.getLegalSettings()).toEqual({ ...EMPTY_LEGAL, companyName: "Waxo" });
  });
});
