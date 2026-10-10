import Link from "next/link";
import { PagesList } from "@/components/admin/pages/PagesList";
import { getAdminPages } from "@/lib/admin/data/pages";
import { requireAdmin } from "@/lib/admin/guard";
import { getLegalSettings } from "@/lib/pages";
import { LEGAL_KEYS } from "@/lib/pages/types";

export const metadata = { title: "Pages d'infos" };

// Liste des pages d'infos × langues. Garde admin obligatoire en première ligne (le layout seul ne suffit pas).
export default async function AdminPagesPage() {
  await requireAdmin();
  const [{ entries, connected }, legal] = await Promise.all([getAdminPages(), getLegalSettings()]);
  const missing = LEGAL_KEYS.filter((k) => !legal[k]).length;

  return (
    <div className="flex flex-col gap-5">
      {!connected ? (
        <div role="note" className="rounded-[14px] bg-[#FBEFC9] px-3.5 py-2.5 text-[13px] leading-[1.45] text-[#4A443C]">
          Base non connectée (mode démo) : les textes par défaut sont affichés et l&apos;enregistrement est désactivé.
        </div>
      ) : null}
      {missing > 0 ? (
        <div role="note" className="rounded-[14px] bg-[#FBEFC9] px-3.5 py-2.5 text-[13px] leading-[1.45] text-[#4A443C]">
          {missing === 1 ? "1 réglage légal est vide" : `${missing} réglages légaux sont vides`} (raison sociale, IFU, RCCM, adresse…) : les textes juridiques affichent «&nbsp;[à compléter]&nbsp;» à la place.{" "}
          <Link href="/admin/reglages" className="font-semibold text-[#141210] underline">
            Les renseigner dans Réglages
          </Link>
          .
        </div>
      ) : null}
      <PagesList entries={entries} />
      <p className="m-0 max-w-[720px] text-[13px] leading-[1.5] text-[#4A443C]">
        Ces textes sont des modèles à faire valider par un professionnel du droit avant la mise en ligne. Le bandeau d&apos;avertissement reste affiché sur les pages légales du site.
      </p>
    </div>
  );
}
