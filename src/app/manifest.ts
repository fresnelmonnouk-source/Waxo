import type { MetadataRoute } from "next";

// Couleurs de la charte : fond crème #F4F1EA, encre #141210.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wá xɔ",
    short_name: "Wá xɔ",
    description: "Les petites choses utiles, livrées demain à Cotonou.",
    start_url: "/fr",
    scope: "/",
    display: "standalone",
    background_color: "#F4F1EA",
    theme_color: "#141210",
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
