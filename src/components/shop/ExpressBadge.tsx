// Signature « Livraison Express » (direction Vincent, docs/design/livraison-express-2026-10-11.md §2).
// Composant SANS hook ni état : utilisable côté serveur, côté client, et par l'image OG (constantes exportées).
import type { CSSProperties, ReactNode } from "react";
import { safeCutoff } from "@/lib/delivery/promise";

export const EXPRESS_INK = "#141210";
export const EXPRESS_CREAM = "#F4F1EA";
export const EXPRESS_SUN = "#FFC93C";
export const EXPRESS_TERRACOTTA = "#C2410C";

/** Tracés du picto « horloge 20 h » (aiguilles sur 8 h, trois traits de vitesse), viewBox 24, trait 2. */
export const EXPRESS_PICTO_PATHS = ["M14 8v4l-3 1.75", "M2 9h3M1 12h3M2 15h3"] as const;

/** Picto horloge 20 h. Décoratif (`aria-hidden`) : le sens est porté par le texte. Jamais animé, jamais sous 14 px. */
export function ExpressPicto({ size = 16, color = "currentColor", className }: { size?: number; color?: string; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ flex: "none" }}
    >
      <circle cx="14" cy="12" r="7" />
      <path d={EXPRESS_PICTO_PATHS[0]} />
      <path d={EXPRESS_PICTO_PATHS[1]} />
    </svg>
  );
}

export type ExpressSize = "S" | "M" | "L";
/** `onLight` = sur fond crème/blanc, `onDark` = sur fond encre. */
export type ExpressVariant = "onLight" | "onDark";

/** Gabarits de la pilule (spec §2.2). L est réservé à l'image OG. */
export const EXPRESS_BADGE_SIZES: Record<ExpressSize, { height: number; padding: string; picto: number; gap: number; font: number; tracking: string }> = {
  S: { height: 24, padding: "0 10px 0 7px", picto: 14, gap: 5, font: 11, tracking: "0.01em" },
  M: { height: 28, padding: "0 12px 0 9px", picto: 16, gap: 6, font: 12, tracking: "0.01em" },
  L: { height: 56, padding: "0 26px 0 20px", picto: 30, gap: 12, font: 26, tracking: "0" },
};

/** Couleurs (spec §2.3) : inversion encre/crème, accent jaune ou terracotta uniquement sur le picto. */
export const EXPRESS_BADGE_COLORS: Record<ExpressVariant, { bg: string; fg: string; picto: string }> = {
  onLight: { bg: EXPRESS_INK, fg: EXPRESS_CREAM, picto: EXPRESS_SUN },
  onDark: { bg: EXPRESS_CREAM, fg: EXPRESS_INK, picto: EXPRESS_TERRACOTTA },
};

/** Pilule « Express ». `label` vient des messages (Express.badge). */
export function ExpressBadge({ label, size = "M", variant = "onLight" }: { label: string; size?: ExpressSize; variant?: ExpressVariant }) {
  const s = EXPRESS_BADGE_SIZES[size];
  const c = EXPRESS_BADGE_COLORS[variant];
  const style: CSSProperties = {
    height: s.height,
    padding: s.padding,
    gap: s.gap,
    fontSize: s.font,
    letterSpacing: s.tracking,
    background: c.bg,
    color: c.fg,
  };
  return (
    <span style={style} className="font-display inline-flex flex-none items-center rounded-full leading-none font-semibold whitespace-nowrap">
      <ExpressPicto size={s.picto} color={c.picto} />
      {label}
    </span>
  );
}

/**
 * Variante `inline` : picto + texte qui hérite de la couleur et de la typo du parent (topbar, titre de carte).
 * `tone` choisit la couleur du picto : jaune sur fond encre, terracotta profond sur fond clair.
 */
export function ExpressInline({
  children,
  tone = "dark",
  size = 14,
  className = "",
}: {
  children: ReactNode;
  tone?: "dark" | "light";
  size?: 14 | 16;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-[6px] ${className}`}>
      <ExpressPicto size={size} color={tone === "dark" ? EXPRESS_SUN : EXPRESS_TERRACOTTA} />
      <span>{children}</span>
    </span>
  );
}

/** Heure limite affichable : FR « 20 h » (espace insécable), EN « 8 pm ». */
export function fmtCutoff(cutoff: number, locale: string): string {
  if (locale === "en") {
    const h = cutoff % 12 || 12;
    return `${h} ${cutoff < 12 ? "am" : "pm"}`;
  }
  return `${cutoff} h`;
}

/** Paramètres ICU des messages Express : `{hour}` (FR « 20 h » insécable, EN « 8 pm ») et `{cutoff}` (nombre brut). */
export function cutoffParams(cutoff: unknown, locale: string): { cutoff: number; hour: string } {
  const c = safeCutoff(cutoff);
  return { cutoff: c, hour: fmtCutoff(c, locale) };
}
