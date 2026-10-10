import Link from "next/link";
import type { AdminPageEntry } from "@/lib/admin/data/pages";
import { PAGE_LOCALES, type PageLocale } from "@/lib/pages/types";

const LANG_LABEL: Record<PageLocale, string> = { fr: "Français", en: "English" };

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Porto-Novo" }).format(new Date(iso));
  } catch {
    return "";
  }
}

/** Liste des pages d'infos : une carte par page, une ligne par langue (état + date), lien vers l'éditeur et vers la page publique. */
export function PagesList({ entries }: { entries: AdminPageEntry[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-5 p-0">
      {entries.map((e) => (
        <li key={e.slug} className="flex flex-col gap-3.5 rounded-[22px] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="m-0 text-[17px]">{e.label}</h2>
            <Link
              href={`/admin/pages/${e.slug}`}
              className="inline-flex min-h-[44px] items-center rounded-full bg-[#141210] px-5 text-[14px] font-semibold text-[#F4F1EA] no-underline hover:bg-[#2C2823] hover:text-[#F4F1EA]"
            >
              Modifier<span className="sr-only"> : {e.label}</span>
            </Link>
          </div>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {PAGE_LOCALES.map((l) => {
              const s = e.locales[l];
              const custom = s.source === "db";
              return (
                <li key={l} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#F0EBE1] pt-2 text-[14px]">
                  <strong className="min-w-[72px]">{LANG_LABEL[l]}</strong>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
                    style={custom ? { background: "#E5EFE7", color: "#1F6B4A" } : { background: "#F0EBE1", color: "#4A443C" }}
                  >
                    {custom ? "Version enregistrée" : "Texte par défaut"}
                  </span>
                  {custom && s.updatedAt ? <span className="text-[13px] text-[#4A443C]">modifiée le {formatDate(s.updatedAt)}</span> : null}
                  <a href={`/${l}/${e.slug}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-[13px] text-[#141210] underline">
                    Voir sur le site<span className="sr-only"> ({LANG_LABEL[l]}, nouvel onglet)</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}
