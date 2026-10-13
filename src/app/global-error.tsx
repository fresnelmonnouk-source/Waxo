"use client";

import Link from "next/link";
import { useEffect } from "react";
import { fontClassNames } from "@/lib/fonts";
import "./globals.css";

/**
 * Erreur dans le layout de langue lui-même (dernier recours) : Next remplace tout le document, sans messages next-intl.
 * Texte en français avec une ligne anglaise, `<html lang="fr">`, liens en dur. `retry` relit les données et relance le rendu.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const btn = "flex min-h-[46px] cursor-pointer items-center rounded-full px-5 text-[15px] font-semibold no-underline";
  return (
    <html lang="fr" className={fontClassNames}>
      <body>
        <title>Petit souci | Waxo</title>
        <main className="mx-auto flex min-h-[80vh] max-w-[760px] flex-col items-start justify-center gap-4 px-5 py-16">
          <span className="text-terracotta-deep text-[13px] font-semibold tracking-[0.04em] uppercase">Petit souci</span>
          <h1 className="font-display m-0 text-[clamp(30px,4.4vw,48px)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">
            La page n&apos;a pas pu s&apos;afficher.
          </h1>
          <p className="text-text m-0 max-w-[560px] text-[17px] leading-[1.6]">
            Un souci technique de notre côté, pas du vôtre. Réessayez dans un instant, et si cela continue, écrivez-nous.
          </p>
          <p lang="en" className="text-muted m-0 max-w-[560px] text-[15px] leading-[1.6]">
            A technical issue on our side. Please try again in a moment.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <button type="button" onClick={() => retry()} className={`${btn} bg-ink text-cream border-0`}>
              Réessayer
            </button>
            <Link href="/fr" className={`${btn} border-border-strong text-ink! border bg-white`}>
              Retour à l&apos;accueil
            </Link>
            <Link href="/fr/contact" className={`${btn} border-border-strong text-ink! border bg-white`}>
              Nous écrire
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
