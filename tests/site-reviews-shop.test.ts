import { createElement, type ComponentType, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import frShop from "@/messages/fr/shop.json";
import enShop from "@/messages/en/shop.json";
import type { SiteReview } from "@/lib/site-reviews/logic";

// Section « Avis sur la boutique » + page « Donner mon avis » : messages FR/EN alignés, typographie, rendu honnête.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: unknown } & Record<string, unknown>) => {
    const { locale: _l, prefetch: _p, ...props } = rest;
    void _l;
    void _p;
    return createElement("a", { href, ...props }, children as never);
  },
}));

const Provider = NextIntlClientProvider as unknown as ComponentType<{
  locale: string;
  messages: Record<string, unknown>;
  onError: (e: { code?: string }) => void;
  children?: ReactNode;
}>;

function render(locale: "fr" | "en", el: ReactElement) {
  const errors: unknown[] = [];
  const html = renderToString(
    createElement(
      Provider,
      {
        locale,
        messages: locale === "fr" ? frShop : enShop,
        onError: (e) => {
          if (e.code !== "ENVIRONMENT_FALLBACK") errors.push(e);
        },
      },
      el,
    ),
  );
  return { html, errors };
}

// Données de TEST uniquement (jamais en base ni à l'écran en production).
const review = (i: number, rating: number, extra: Partial<SiteReview> = {}): SiteReview => ({
  id: `test-${i}`,
  author: `Testeur${i} T.`,
  city: i % 2 ? "Cotonou" : null,
  rating,
  body: `Texte de test numéro ${i} pour la section.`,
  verified: i % 2 === 1,
  publishedAt: "2026-10-01T00:00:00Z",
  ...extra,
});

const fr = (frShop as { SiteReviews: Record<string, string> }).SiteReviews;
const en = (enShop as { SiteReviews: Record<string, string> }).SiteReviews;

describe("messages SiteReviews", () => {
  it("mêmes clés en FR et en EN", () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
  });
  it("aucun tiret cadratin, espace insécable avant « : ; ! ? » en FR", () => {
    for (const v of [...Object.values(fr), ...Object.values(en)]) expect(v).not.toContain("—");
    for (const v of Object.values(fr)) expect(v).not.toMatch(/(^|[^ ]) ?[:;!?](\s|$)/u);
  });
  it("textes imposés par le propriétaire", () => {
    expect(fr.inviteTitle).toBe("Votre avis compte");
    expect(fr.inviteText).toBe(
      "Vous avez déjà commandé chez nous ? Dites-nous ce que vous avez pensé de la livraison, du service et de vos articles.",
    );
    expect(fr.cta).toBe("Donner mon avis");
    expect(fr.title).toBe("Ce que nos clients disent de Wá xɔ");
    expect(en.title).toBe("What our customers say about Wá xɔ");
    expect(fr.success).toBe("Merci ! Votre avis sera publié après relecture.");
    expect(fr.pageNote).toBe("Réservé aux clients qui ont reçu une commande. Votre avis est publié après relecture.");
  });
});

describe("section SiteReviews (accueil)", () => {
  it.each([0, 1, 2])("%i avis publiés : invitation honnête, aucun avis ni note", async (n) => {
    const { SiteReviews } = await import("@/components/shop/SiteReviews");
    for (const locale of ["fr", "en"] as const) {
      const reviews = Array.from({ length: n }, (_, i) => review(i + 1, 5));
      const { html, errors } = render(locale, createElement(SiteReviews, { reviews }));
      expect(errors).toEqual([]);
      const m = locale === "fr" ? fr : en;
      expect(html).toContain('data-site-reviews="invite"');
      expect(html).toContain(m.inviteTitle);
      expect(html).toContain('href="/avis-boutique"');
      expect(html).not.toContain("Testeur");
      expect(html).not.toContain("/5");
      expect(html).not.toContain(m.title);
      expect(html).not.toContain("<li");
    }
  });

  it("≥ 3 avis : cartes, moyenne RÉELLE formatée, étoiles accessibles, badge vérifié", async () => {
    const { SiteReviews } = await import("@/components/shop/SiteReviews");
    const reviews = [review(1, 5), review(2, 4), review(3, 5)]; // moyenne 4,666… → 4,7
    const frR = render("fr", createElement(SiteReviews, { reviews }));
    expect(frR.errors).toEqual([]);
    expect(frR.html).toContain('data-site-reviews="list"');
    expect(frR.html).toContain("Ce que nos clients disent de Wá xɔ");
    expect(frR.html).toContain("4,7/5 · 3 avis");
    expect(frR.html).toContain('aria-label="5 sur 5"');
    expect(frR.html).toContain('aria-label="4 sur 5"');
    expect(frR.html).toContain("Testeur1 T. · Cotonou");
    expect(frR.html).toMatch(/Testeur2 T\.<\/span>/);
    expect((frR.html.match(/Client vérifié/g) ?? []).length).toBe(2);
    expect(frR.html).not.toContain(fr.inviteTitle);

    const enR = render("en", createElement(SiteReviews, { reviews }));
    expect(enR.errors).toEqual([]);
    expect(enR.html).toContain("4.7/5 · 3 reviews");
    expect(enR.html).toContain('aria-label="5 out of 5"');
    expect(enR.html).toContain("Verified customer");
  });

  it("6 cartes maximum, moyenne calculée sur tous les avis reçus", async () => {
    const { SiteReviews } = await import("@/components/shop/SiteReviews");
    const reviews = Array.from({ length: 10 }, (_, i) => review(i + 1, i < 6 ? 5 : 1)); // (30 + 4) / 10 = 3,4
    const { html } = render("fr", createElement(SiteReviews, { reviews }));
    expect((html.match(/<li/g) ?? []).length).toBe(6);
    expect(html).toContain("3,4/5 · 10 avis");
    expect(html).not.toContain("Testeur7");
  });
});

describe("formulaire SiteReviewForm", () => {
  it("rendu FR/EN : 5 boutons radio, honeypot, champs, sans erreur de message", async () => {
    const { SiteReviewForm } = await import("@/components/shop/SiteReviewForm");
    for (const locale of ["fr", "en"] as const) {
      const { html, errors } = render(locale, createElement(SiteReviewForm));
      expect(errors).toEqual([]);
      expect((html.match(/type="radio"/g) ?? []).length).toBe(5);
      expect(html).toContain('name="website"');
      expect(html).toContain('name="body"');
      expect(html).toContain('name="city"');
      expect(html).toContain(locale === "fr" ? "Envoyer mon avis" : "Send my review");
    }
  });
});
