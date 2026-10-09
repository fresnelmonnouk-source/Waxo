/** Classes Tailwind partagées (module sans directive : utilisable depuis les pages serveur comme depuis les composants client). */

export const BTN_BASE =
  "inline-flex cursor-pointer items-center justify-center rounded-full font-semibold no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-60";
export const BTN_DARK = `${BTN_BASE} border-0 bg-ink text-cream hover:bg-[#2C2823] hover:text-cream`;
export const BTN_SUN = `${BTN_BASE} border-0 bg-sun text-ink hover:bg-sun-hover hover:text-ink`;
export const BTN_OUTLINE = `${BTN_BASE} border border-border-strong bg-transparent font-normal text-ink hover:bg-white hover:text-ink`;
export const EYEBROW = "text-[13px] font-semibold tracking-[.08em] text-terracotta-deep uppercase";
export const H1_DISPLAY = "font-display m-0 font-semibold text-ink";

/** Classe d'un champ de saisie : bordure rouge si erreur (maquette : errB). */
export function inputClass(hasError: boolean, bg: "cream" | "white" = "cream", pad = "py-[13px]") {
  return [
    `w-full min-w-0 rounded-[14px] border px-[14px] ${pad} text-[16px] font-normal text-ink`,
    bg === "cream" ? "bg-[#FAF8F3]" : "bg-white",
    hasError ? "border-terracotta-deep" : "border-border",
  ].join(" ");
}

