import { NotFoundBody } from "../_status/NotFoundBody";

/**
 * 404 de la boutique (produit, pack ou campagne inconnus, `notFound()` des pages, URL inconnue via `[...rest]`) :
 * rendue DANS la coque (bandeau, en-tête, pied de page), dans la langue de la route. Next pose le statut 404 et
 * `noindex` tant que le rendu n'a pas commencé à être envoyé (aucun `loading.tsx` dans la boutique).
 */
export default function ShopNotFound() {
  return <NotFoundBody />;
}
