import { safeJsonLd, type JsonLdObject } from "./jsonld";

/** Balise JSON-LD (composant serveur, utilisable dans n'importe quelle page). Le contenu est échappé par `safeJsonLd`. */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }} />;
}
