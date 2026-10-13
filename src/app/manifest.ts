import type { MetadataRoute } from "next";

// Couleurs de la charte : fond crème #F4F1EA (même couleur que `viewport.themeColor` du layout), encre #141210.
// Description : même promesse que `Seo.description` (texte validé), Livraison Express le jour même (T4).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wá xɔ",
    short_name: "Wá xɔ",
    description: "Les petites choses utiles du quotidien, à petit prix. Livraison Express 7 j/7 à Cotonou & Calavi.",
    start_url: "/fr",
    scope: "/",
    display: "standalone",
    background_color: "#F4F1EA",
    theme_color: "#F4F1EA",
    lang: "fr",
    // Pastille « ɔ » de la charte : terre cuite sur encre. `maskable` = version avec marge pour les icônes rondes d'Android.
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
