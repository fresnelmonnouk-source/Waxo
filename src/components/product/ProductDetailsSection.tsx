import { BLOCK_DETAILS, INLINE_DETAILS, detailLines, specRows, type DetailKey, type ProductDetails } from "@/lib/catalog/details";

// Rubriques facultatives de la fiche produit (0025). Une rubrique vide n'est pas rendue, ni son titre ; aucune rubrique
// remplie = rien du tout. Texte brut échappé par React (jamais de HTML saisi en admin).

export type DetailLabels = Record<DetailKey, string> & { title: string };

/** Couleur et matériaux : lignes courtes « Libellé : valeur » sous la description. */
export function ProductInlineDetails({ details, labels }: { details: ProductDetails; labels: DetailLabels }) {
  const keys = INLINE_DETAILS.filter((k) => detailLines(details[k]).length > 0);
  if (keys.length === 0) return null;
  return (
    <dl className="m-0 flex flex-col gap-1.5 text-[15px] leading-[1.5]">
      {keys.map((k) => (
        <div key={k} className="flex flex-wrap gap-x-1.5">
          <dt className="font-semibold text-ink">{labels[k]} :</dt>
          <dd className="m-0 text-text">{detailLines(details[k]).join(", ")}</dd>
        </div>
      ))}
    </dl>
  );
}

function Lines({ text }: { text: string }) {
  const lines = detailLines(text);
  if (lines.length === 1) return <p className="m-0 text-[15px] leading-[1.6] text-text text-pretty">{lines[0]}</p>;
  return (
    <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-[1.55] text-text marker:text-muted">
      {lines.map((l, i) => (
        <li key={i}>{l}</li>
      ))}
    </ul>
  );
}

/** Caractéristiques : une ligne par entrée (liste, valide même quand une ligne n'a pas de libellé « Clé : »). */
function Specs({ text }: { text: string }) {
  const rows = specRows(text);
  return (
    <ul className="m-0 flex list-none flex-col p-0 text-[15px] leading-[1.5]">
      {rows.map((r, i) => (
        <li key={i} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 border-b border-border py-2.5 first:pt-0 last:border-b-0">
          {r.label ? <span className="text-muted">{r.label}</span> : null}
          <span className={`text-text ${r.label ? "text-right font-medium" : ""}`}>{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Bloc « Détails du produit » pleine largeur, sous la photo et l'achat. */
export function ProductDetailsSection({ details, labels }: { details: ProductDetails; labels: DetailLabels }) {
  const keys = BLOCK_DETAILS.filter((k) => detailLines(details[k]).length > 0);
  if (keys.length === 0) return null;
  return (
    <section aria-labelledby="product-details-title" className="mt-14 flex flex-col gap-6">
      <h2 id="product-details-title" className="font-display m-0 text-[22px] font-semibold tracking-[-0.02em]">
        {labels.title}
      </h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-x-9 gap-y-8">
        {keys.map((k) => (
          <div key={k} className="flex min-w-0 flex-col gap-3 rounded-[20px] bg-card p-5">
            <h3 className="m-0 text-[17px] font-semibold text-ink">{labels[k]}</h3>
            {k === "specs" ? <Specs text={details[k]} /> : <Lines text={details[k]} />}
          </div>
        ))}
      </div>
    </section>
  );
}
