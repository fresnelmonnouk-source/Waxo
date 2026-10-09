import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

/**
 * Balises des messages riches (<cgv>…</cgv>, <tbc>…</tbc>…) partagées par les pages d'information.
 * `tbc` = « à compléter » : marqueur visible tant que l'entité légale (raison sociale, IFU, RCCM, adresse) n'est pas renseignée.
 */
const link = (href: string) =>
  function RichLink(chunks: ReactNode) {
    return <Link href={href}>{chunks}</Link>;
  };

export const richTags = {
  tbc: (chunks: ReactNode) => <mark className="rounded-[4px] bg-[#FBEFC9] px-1 text-ink">{chunks}</mark>,
  cgv: link("/cgv"),
  cgu: link("/cgu"),
  privacy: link("/confidentialite"),
  shipping: link("/livraison-retours"),
  contact: link("/contact"),
  faq: link("/faq"),
  track: link("/suivi"),
  account: link("/compte"),
};
