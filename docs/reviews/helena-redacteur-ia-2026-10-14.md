# Revue conformité Helena : « Rédiger avec l'IA » (fiches produit) : 2026-10-14

Projet Waxo (Wá xɔ), boutique en ligne à Cotonou, site FR/EN. Fonction réservée à l'admin.
Fichiers relus : `src/lib/admin/ai/product-writer-prompt.ts` (prompt validé, NON modifié), `fetch-page.ts`, `page-text.ts`, `product-writer.ts`, `scrub.ts`, `product-writer-gate.ts`, `src/components/admin/products/AiWriterPanel.tsx`, `ProductDrawer.tsx` (LinkHint).

Textes applicables :
- Bénin : loi n° 2007-21 du 16 octobre 2007 portant protection du consommateur (information du consommateur, publicité trompeuse) ; loi n° 2017-20 portant Code du numérique (commerce électronique, données personnelles, transferts) ; loi n° 2005-30 du 5 avril 2006 sur le droit d'auteur ; Accord de Bangui révisé (OAPI) : annexe III (marques), annexe VIII (concurrence déloyale) ; responsabilité civile (art. 1382 du Code civil applicable au Bénin). Numéros d'articles et portée exacte : à faire confirmer par un juriste béninois.
- Référence UE/France (la lecture de la page part de Vercel `dub1`, Dublin, donc depuis l'UE ; clients européens possibles sur la version EN/FR) : CPI L.111-1 (originalité), L.122-5-3 et directive 2019/790 art. 4 (fouille de textes, opposition par robots.txt), directive 96/9 (droit sui generis des bases), Code de la consommation L.121-2 (pratiques trompeuses), art. 1240 C. civ. (parasitisme), CJUE C-30/14 Ryanair (CGU opposables même sans droit sur la base).

Décision globale : **modifications requises, rien de bloquant**. Aucune modification du prompt n'est nécessaire : toutes les corrections ci-dessous portent sur le code ou les textes d'interface.

---

## Ce qui est déjà conforme (à garder)

- Lecture ponctuelle d'UNE page, à la demande d'un humain authentifié, limitée (assertAdmin + limiteur), sans stockage du texte lu ni des images : pas d'extraction substantielle d'une base, pas de collecte de masse.
- Pas de contournement des protections : captcha / « Just a moment » / 403 / 429 détectés et traités comme refus ; User-Agent honnête et identifiable (`WaxoBot/1.0 (+https://www.waxo.boutique)`), pas d'usurpation de navigateur.
- Le prompt écarte prix, avis, promotions, garanties, délais (pas de comparaison de prix ni de reprise d'avis) ; interdit l'invention, les superlatifs invérifiables, les marques, certifications, normes, étanchéité, effets santé sauf NOTES ; impose la reformulation ; NOTES prioritaires sur la PAGE.
- Rien n'est enregistré sans action de l'admin ; pas d'écrasement silencieux ; publication refusée (client ET serveur) tant qu'un « [à confirmer] » reste sur un produit visible.
- Images de la page jamais téléchargées.
- Données : aucune donnée client prévue, masquage e-mails / numéros / secrets avant envoi, journaux sans contenu.

---

## 🟠 O1. Faits d'un article « semblable » publiés comme faits de VOTRE article

- Où : `ProductDrawer.tsx` (LinkHint), `AiWriterPanel.tsx`, `product-writer-gate.ts`.
- Risque : une mesure, une matière, une contenance, une puissance, une autonomie ou un conseil d'entretien (« passe au lave-vaisselle », « va au micro-ondes ») repris d'un autre article et faux pour le vôtre = information inexacte sur une caractéristique essentielle (loi béninoise 2007-21 ; Code du numérique, obligations d'information du commerce électronique ; en référence UE : L.121-2 C. conso). Conséquences réalistes : retours, litiges, plainte, et pour l'entretien ou l'électrique un risque de dommage (objet abîmé, surchauffe).
- Pourquoi le dispositif actuel ne suffit pas tout à fait :
  1. le garde-fou ne bloque que « [à confirmer] » ; une information venue du lien sans ce marqueur se publie en un clic ;
  2. « Vient du lien, à vérifier » n'existe que dans l'état React de la session : après enregistrement ou rechargement, plus aucune trace ;
  3. `fromLink` est DÉCLARÉ par le modèle : il peut oublier un champ ;
  4. aucun rappel dans le panneau sur ce qu'il faut vérifier.
- Correction (code et interface seulement) :
  a. Afficher en permanence dans le panneau, sous l'intro, ce rappel (texte prêt) :

     > Le lien décrit un article semblable, pas forcément le vôtre. Avant d'enregistrer, vérifiez sur VOTRE article chaque information venant du lien : mesures, matières, contenance, puissance, autonomie, entretien (lave-vaisselle, micro-ondes, lavage). Supprimez ce que vous ne pouvez pas vérifier. Ne reprenez ni les photos, ni les avis, ni la marque d'un autre vendeur.

  b. Quand un lien a été utilisé, ne pas se fier qu'à `fromLink` : marquer « Vient du lien, à vérifier » sur TOUS les champs remplis par l'IA (ou au minimum description, specs, materials, color, care et leurs versions EN).
  c. Recommandé (pas obligatoire) : avant d'enregistrer un produit VISIBLE après une proposition faite avec un lien, case à cocher obligatoire dans le tiroir :

     > J'ai vérifié sur mon article les informations venant du lien.

     Sans case cochée, même message que le garde-fou actuel (« ou masquez-le pour le garder en brouillon »).
- Réponse à la question 3 : « à vérifier » + « [à confirmer] » + relecture suffisent sur le principe (la décision de publier reste humaine), à condition d'ajouter le rappel a. et le marquage b. Le c. transforme la relecture en acte tracé ; utile si plusieurs personnes administrent la boutique.

## 🟠 O2. robots.txt et CGU des sites lus

- Où : `fetch-page.ts` (aucune lecture de robots.txt).
- Constat : Amazon (Conditions d'utilisation : interdiction des « robots, data mining or similar data gathering and extraction tools »), et d'autres places de marché, interdisent la collecte automatisée ; l'admin, s'il a un compte, est lié par ces CGU et la requête part pour son compte. En UE, une opposition à la fouille de textes exprimée par robots.txt est opposable (directive 2019/790 art. 4, CPI L.122-5-3), et la requête part de Dublin.
- La lecture ponctuelle à la demande d'un humain change-t-elle le risque ? Oui, nettement : on est plus près d'un navigateur ou d'un aperçu de lien que d'un robot d'aspiration (pas d'extraction substantielle d'une base, pas de stockage, pas de volume). Le risque restant est surtout contractuel et pratique (blocage d'IP, suspension du compte vendeur ou acheteur), pas une amende. Le vrai risque juridique est dans ce qui est PUBLIÉ (O1, J1), pas dans la lecture.
- Faut-il respecter robots.txt ? Juridiquement pas strictement obligatoire pour une lecture déclenchée par un humain (Google ne l'applique pas à ses lectures « déclenchées par l'utilisateur »). Je le recommande quand même : coût minime (une requête de plus, mise en cache courte), preuve de bonne foi, ferme la question de l'opposition à la fouille de textes et évite d'afficher un robot nommé qui ignore les consignes du site.
- Correction : lire `https://<hôte>/robots.txt` (même défenses SSRF, délai court, 500 Ko max) ; si le chemin est interdit pour `WaxoBot` ou pour `*`, renvoyer le code `refused` (message existant). Robots.txt absent, illisible ou en erreur : lecture permise. Garder le refus actuel des captchas : ne jamais ajouter de contournement (rotation d'IP, faux navigateur, service de « déblocage »).

## 🟡 J1. Reformulation : risque de phrases trop proches (droit d'auteur, parasitisme)

- Risque : une description marchande peut être protégée si elle est originale (loi béninoise 2005-30 ; CPI L.111-1). Les faits (mesures, matières, fonctions, contenu de la boîte) et les données JSON-LD en tant que faits ne sont pas protégeables. Le prompt impose la reformulation, mais un modèle à température 0,3 peut garder des tournures entières. Le parasitisme (annexe VIII de Bangui, art. 1382 / 1240 C. civ.) suppose une reprise systématique des investissements d'un concurrent : faible pour des fiches ponctuelles, plus élevé si toutes les fiches viennent d'UN même concurrent local (même marché, Cotonou).
- Correction : contrôle côté serveur après génération : si la description FR ou EN partage avec le texte de la page une suite de 8 mots consécutifs ou plus (texte normalisé, minuscules, sans ponctuation), afficher sous le champ « Phrase très proche du site lu : reformulez-la. » Consigne d'usage pour l'admin : préférer la page du FABRICANT et varier les sources ; ne pas reconstruire son catalogue à partir des fiches d'un concurrent béninois.

## 🟡 J2. Marques : la règle du prompt suffit-elle ?

- Réponse : sur le fond oui (marque seulement si les NOTES la donnent), mais la page fournit explicitement la marque (ligne « Marque : » issue du JSON-LD, titre de page) et un modèle peut la recopier, surtout dans le nom « comme un client le chercherait sur Google ». Cas particuliers : marques devenues usuelles mais encore déposées (Thermos, Tupperware, Velcro, Scotch, Post-it, Frigidaire…) et mentions de compatibilité (« compatible iPhone ») qui ne sont permises que si elles sont exactes et nécessaires (usage référentiel).
- Risque : usage d'une marque d'autrui pour un produit qui n'en est pas = contrefaçon / tromperie sur l'origine (annexe III de Bangui). Faible tant que l'admin relit, d'où un contrôle simple.
- Correction : après génération, si le nom ou la description contient la valeur `brand` extraite du JSON-LD (ou le premier mot du titre de page quand il ressemble à une marque) et que les NOTES ne la contiennent pas, afficher sous le champ : « Contient la marque du site lu : retirez-la, sauf si votre article est bien de cette marque. » Le rappel O1 couvre déjà « ni la marque d'un autre vendeur ».

## 🟡 J3. Message « copiez le texte de la page dans vos notes »

- Où : `COPY_HINT` dans `fetch-page.ts` (texte d'interface, pas le prompt).
- Risque : quand un site refuse la lecture (y compris, demain, par robots.txt), ce message invite à coller la page ENTIÈRE dans les notes : on contourne le refus du site et on envoie à DeepSeek le texte protégé complet, dans le champ que le prompt traite comme fiable (NOTES prioritaires).
- Correction : remplacer `COPY_HINT` par :

  > notez dans vos notes les caractéristiques de votre article (mesures, matières, contenu de la boîte).

## 🟡 J4. Données envoyées à DeepSeek

- Constat : texte de la page + notes + rayon, masqués ; pas de donnée client prévue. Les avis éventuellement présents sur la page peuvent contenir des pseudonymes d'internautes : données publiques, envoi ponctuel, risque très faible, acceptable.
- Le vrai sujet est la confidentialité commerciale : DeepSeek peut réutiliser les données d'API pour l'entraînement ; un admin peut écrire dans ses notes son fournisseur ou son prix d'achat.
- Correction : remplacer l'aide sous « Vos notes » par :

  > Ce que vous savez de VOTRE article (vous l'avez en main). N'y mettez ni données de client, ni informations confidentielles (fournisseur, prix d'achat) : le texte est envoyé à un prestataire d'IA.

- Politique de confidentialité : cette fonction ne traite pas de données personnelles de clients ; aucune mention spécifique n'est requise. La mention déjà prévue (DeepSeek nommé + transferts hors du Bénin, voir B6 / M11 de la revue J1) suffit. Ajouter seulement une ligne au registre des sous-traitants : « DeepSeek : rédaction des fiches produit (admin) : textes produit et notes internes, sans donnée personnelle : Chine ».

## Autres points (question 5)

- Rien de bloquant.
- Transparence IA envers les clients : pas d'obligation identifiée pour des fiches produit relues et validées par un humain (en référence UE, l'art. 50 du règlement IA ne vise pas ce cas) ; aucune mention « rédigé par IA » nécessaire.
- Photos : l'outil ne les reprend pas ; le rappel O1 interdit de les reprendre à la main (les photos d'un autre vendeur sont protégées sans débat).

## Ordre conseillé

1. Rappel O1 a. + aide notes J4 + COPY_HINT J3 (textes seulement, avant le premier usage réel).
2. O1 b. (marquage de tous les champs remplis avec un lien).
3. O2 (robots.txt).
4. J1 et J2 (contrôles après génération), puis O1 c. si plusieurs administrateurs.

Évaluation de risque, pas un conseil juridique formel. Les références au droit béninois et OAPI (articles exacts, portée de la loi 2007-21 et du Code du numérique sur l'information en ligne) sont à faire confirmer par un juriste béninois.
