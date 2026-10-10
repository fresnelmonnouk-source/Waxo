import Link from "next/link";
import type { ReactNode } from "react";

/** Pastille de filtre (maquette : bouton pilule 40 px, actif = fond encre). Rendue en lien : l'état vit dans l'URL. */
export function ChipLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-[13px] font-medium no-underline ${
        active
          ? "border-[#141210] bg-[#141210] text-[#F4F1EA] hover:text-[#F4F1EA]"
          : "border-[#D6CFC0] bg-transparent text-[#141210] hover:text-[#141210]"
      }`}
    >
      {children}
    </Link>
  );
}
