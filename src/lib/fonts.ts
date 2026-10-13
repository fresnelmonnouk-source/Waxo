import { Onest, Unbounded } from "next/font/google";

// Préchargement réduit au sous-ensemble latin (2 fichiers ≈ 85 Ko au lieu de 4 fichiers ≈ 231 Ko, audit perf E3).
// `subsets` ne règle QUE le préchargement : next/font garde dans la CSS toutes les @font-face de Google, chacune avec
// son unicode-range, sous le même nom de famille. Le latin-ext (U+0100-02BA) reste donc servi, mais seulement à la
// première rencontre d'un de ses caractères, sans priorité haute : le « ɔ » (U+0254) de « Wá xɔ » reste en Unbounded.
// Repli métrique ajusté (adjustFontFallback) : pas de décalage (CLS) pendant le `swap`.

// Titres, prix forts, logo : Unbounded 500/600/700 (comme la maquette). Pas d'axe opsz sur cette police.
export const unbounded = Unbounded({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-unbounded",
  display: "swap",
  adjustFontFallback: true,
});

// Texte et interface : Onest 400/500/600/700.
export const onest = Onest({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-onest",
  display: "swap",
  adjustFontFallback: true,
});

export const fontClassNames = `${unbounded.variable} ${onest.variable}`;
