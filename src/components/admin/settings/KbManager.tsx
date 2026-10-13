"use client";

import Link from "next/link";
import type { KbDoc, KbEntry } from "@/lib/settings/kb-search";
import { plural } from "@/lib/settings/format";
import { btnDark, cardCls } from "./ui";

/**
 * Résumé de la base de connaissances dans « Réglages ». La gestion complète (brouillons de l'IA, publication, test d'une
 * question) vit à un seul endroit : /admin/assistant-ia. `initial` = fiches publiées actives (lecture de getKbEntries).
 */
export function KbManager({ initial, productDocs, connected }: { initial: KbEntry[]; productDocs: KbDoc[]; connected: boolean }) {
  return (
    <section className={`${cardCls} gap-3.5`} aria-labelledby="kb-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-[640px] flex-col gap-1">
          <h2 id="kb-title" className="m-0 text-[17px] font-bold">
            Base de connaissances
          </h2>
          <span className="text-[13px] leading-normal text-text">
            L&apos;assistant de la boutique et les brouillons de réponse cherchent ici les passages utiles avant de répondre.{" "}
            {plural(initial.length, "fiche publiée", "fiches publiées")}, {plural(productDocs.length, "fiche produit", "fiches produits")} indexées automatiquement. Les fiches se
            rédigent, se relisent et se publient dans l&apos;espace Assistant IA, avec l&apos;aide de l&apos;IA si vous le souhaitez.
          </span>
        </div>
        <Link href="/admin/assistant-ia" className={`${btnDark} min-h-[44px] px-4 text-[13px]`}>
          Gérer les fiches
        </Link>
      </div>
      {!connected ? (
        <div role="note" className="rounded-2xl bg-[#FFF4D6] px-4 py-3 text-[13px] text-[#8A5A00]">
          Base non connectée (mode démo) : les fiches sont des exemples.
        </div>
      ) : null}
    </section>
  );
}
