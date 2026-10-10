import type { DataSource } from "@/lib/admin/data/stats";

/** Avertit quand les chiffres ne viennent pas de la vraie base (démo) ou quand la lecture a échoué. */
export function SourceBanner({ source }: { source: DataSource }) {
  if (source === "db") return null;
  const demo = source === "demo";
  return (
    <div
      role={demo ? "note" : "alert"}
      className={`rounded-[14px] px-3.5 py-2.5 text-[13px] leading-[1.45] ${demo ? "bg-[#FBEFC9] text-[#4A443C]" : "bg-[#F6E1DA] text-[#9A3412]"}`}
    >
      {demo
        ? "Base non connectée (mode démo) : les chiffres affichés sont des données d'exemple."
        : "Les données n'ont pas pu être lues pour le moment. Rechargez la page dans un instant."}
    </div>
  );
}
