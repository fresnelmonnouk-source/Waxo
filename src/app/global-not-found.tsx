import type { Metadata } from "next";
import Link from "next/link";
import { fontClassNames } from "@/lib/fonts";
import "./globals.css";

// 404 des URL hors de toute route (sans préfixe de langue ni redirection du proxy, ex. un fichier inexistant). Le layout
// racine est sous `[lang]` : Next rend ce document à part (`experimental.globalNotFound` dans next.config.ts), d'où
// `<html lang="fr">`, les styles et les polices importés ici. Les URL `/{lang}/…` inconnues ont, elles, la 404 localisée
// de la boutique (`[lang]/(shop)/[...rest]`). Statut 404 et `noindex` posés par Next.
export const metadata: Metadata = {
  title: "Page introuvable | Waxo",
  description: "Cette page n'existe pas, ou plus. Retrouvez la boutique Wá xɔ à Cotonou.",
};

const BTN = "flex min-h-[46px] items-center rounded-full px-5 text-[15px] font-semibold no-underline";

export default function GlobalNotFound() {
  return (
    <html lang="fr" className={fontClassNames}>
      <body>
        <main className="mx-auto flex min-h-[80vh] max-w-[760px] flex-col items-start justify-center gap-4 px-5 py-16">
          <Link href="/fr" className="font-display text-ink! text-[22px] font-semibold no-underline">
            Wá xɔ
          </Link>
          <span className="text-terracotta-deep text-[13px] font-semibold tracking-[0.04em] uppercase">Erreur 404</span>
          <h1 className="font-display m-0 text-[clamp(30px,4.4vw,48px)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">
            Cette page n&apos;existe pas, ou plus.
          </h1>
          <p className="text-text m-0 max-w-[560px] text-[17px] leading-[1.6]">
            Le lien est peut-être ancien. Le reste de la boutique vous attend.
          </p>
          <nav aria-label="Liens utiles" className="mt-2 flex flex-wrap gap-3">
            <Link href="/fr" className={`${BTN} bg-ink text-cream! hover:text-cream!`}>
              Retour à l&apos;accueil
            </Link>
            <Link href="/fr/catalogue" className={`${BTN} border-border-strong text-ink! hover:text-ink! border bg-white`}>
              Voir le catalogue
            </Link>
            <Link href="/fr/contact" className={`${BTN} border-border-strong text-ink! hover:text-ink! border bg-white`}>
              Nous écrire
            </Link>
            <Link href="/en" lang="en" className={`${BTN} text-ink! hover:text-ink! underline`}>
              English
            </Link>
          </nav>
        </main>
      </body>
    </html>
  );
}
