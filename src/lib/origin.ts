/**
 * Origine (https://domaine) d'une adresse saisie dans une variable d'environnement. Seule l'origine compte : une valeur saisie
 * avec un chemin ou un slash (`https://site/fr`, `https://site/`) ne doit jamais doubler la langue dans les liens des e-mails,
 * le retour de paiement, le sitemap ou les balises canoniques. Renvoie null si ce n'est pas une adresse http(s).
 */
export function cleanOrigin(value: string | undefined | null): string | null {
  const v = (value ?? "").trim();
  if (!/^https?:\/\/[^\s/]+/i.test(v)) return null;
  try {
    return new URL(v).origin;
  } catch {
    return null;
  }
}
