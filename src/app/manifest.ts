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
    icons: [{ src: "/favicon.ico", sizes: "48x48", type: "image/x-icon" }],
  };
}
