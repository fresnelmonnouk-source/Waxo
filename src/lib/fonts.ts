import { Onest, Unbounded } from "next/font/google";

// Titres, prix forts, logo : Unbounded 500/600/700 (comme la maquette). Pas d'axe opsz sur cette police.
export const unbounded = Unbounded({
  subsets: ["latin", "latin-ext"], // latin-ext : le « ɔ » (U+0254) de la marque
  weight: ["500", "600", "700"],
  variable: "--font-unbounded",
  display: "swap",
});

// Texte et interface : Onest 400/500/600/700.
export const onest = Onest({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-onest",
  display: "swap",
});

export const fontClassNames = `${unbounded.variable} ${onest.variable}`;
