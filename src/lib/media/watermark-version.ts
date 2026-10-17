// Version du style du filigrane, dans un module SANS dépendance (importable côté navigateur : sharp ne l'est pas).
// Elle fait partie de l'URL `/api/img?...&v=` : la changer invalide d'un coup les caches du CDN et des navigateurs.
// À incrémenter si le style (taille, opacité, logo) change dans watermark.ts.
export const WATERMARK_VERSION = "1";
