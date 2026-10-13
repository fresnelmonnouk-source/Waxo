import { notFound } from "next/navigation";

/**
 * Toute URL `/{lang}/…` sans route : 404 de la boutique, localisée et dans la coque, au lieu de la page anglaise de Next
 * sans `lang` (S3). Les routes existantes passent toujours avant ce « attrape-tout ».
 */
export default function UnknownPage() {
  notFound();
}
