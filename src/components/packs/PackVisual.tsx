import { cssUrl } from "@/components/shop/logic";
import type { Pack } from "./logic";

const FALLBACK_BG = "#E9E2D3";

/**
 * Visuel d'un pack : photo du pack si elle existe, sinon mosaïque des produits (pastel + mot-clé, comme les cartes produit).
 * Pur affichage (utilisable côté serveur et côté client). `large` agrandit les mots-clés pour la page détail.
 */
export function PackVisual({
  pack,
  label,
  large = false,
  radius = 20,
  className = "",
}: {
  pack: Pick<Pack, "imageUrl" | "items">;
  label: string;
  large?: boolean;
  radius?: number;
  className?: string;
}) {
  const shown = pack.items.slice(0, 4);
  const more = pack.items.length - shown.length;
  const font = large ? "clamp(18px,2.4vw,28px)" : "clamp(13px,1.5vw,18px)";

  return (
    <div
      role="img"
      aria-label={label}
      className={`relative aspect-[4/3] overflow-hidden ${className}`}
      style={{ borderRadius: radius, background: FALLBACK_BG }}
    >
      {pack.imageUrl ? (
        <div className="absolute inset-0" style={{ background: `${cssUrl(pack.imageUrl)} center/cover no-repeat` }} />
      ) : (
        <div className="grid h-full w-full grid-cols-2 gap-[3px]" style={{ gridAutoRows: "1fr" }}>
          {shown.map((it, i) => (
            <div
              key={it.productId}
              aria-hidden="true"
              className={`relative flex items-center justify-center overflow-hidden ${shown.length === 1 || (shown.length === 3 && i === 0) ? "col-span-2" : ""}`}
              style={{ background: it.bg ?? FALLBACK_BG }}
            >
              <span className="font-display px-1 text-center font-semibold tracking-[-0.04em] opacity-75" style={{ fontSize: font }}>
                {it.keyword}
              </span>
              {it.imageUrl ? (
                <div className="absolute inset-0" style={{ background: `${cssUrl(it.imageUrl)} center/cover no-repeat` }} />
              ) : null}
              {i === 3 && more > 0 ? (
                <span className="font-display bg-ink/80 text-cream absolute inset-0 flex items-center justify-center text-[18px] font-semibold">
                  +{more}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
