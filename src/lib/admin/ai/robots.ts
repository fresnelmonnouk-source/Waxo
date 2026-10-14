// Lecture SIMPLE de robots.txt pour le rédacteur IA des fiches (Helena O2, 2026-10-14). Module PUR, sans dépendance.
//
// Sous-ensemble de la RFC 9309 :
//  - groupes « User-agent » (lignes User-agent consécutives = un groupe), règles Allow / Disallow ;
//  - le groupe qui nomme notre robot (jeton « waxobot », casse ignorée) l'emporte ; sinon les groupes « * » ; sinon tout
//    est permis ;
//  - la règle au motif le plus long l'emporte, Allow gagne à égalité ; « Disallow: » vide = rien d'interdit ;
//  - motifs : `*` (toute suite de caractères) et `$` final (fin d'adresse) ; sinon correspondance de préfixe.
// Coût borné : 2 000 règles par groupe, motifs coupés à 512 caractères, correspondance sans expression régulière.

export type RobotsRule = { allow: boolean; pattern: string };

const MAX_RULES = 2000;
const MAX_PATTERN = 512;

/** Caractères non ASCII d'un motif encodés comme dans une URL (`/é` → `/%C3%A9`), pour comparer à `URL.pathname`. */
const encodeNonAscii = (s: string) => s.replace(/[^\x00-\x7f]+/g, (m) => encodeURIComponent(m));

/** Jeton de produit d'une valeur User-agent : « WaxoBot/1.0 (+https://…) » → « waxobot ». */
const productToken = (v: string) => v.trim().toLowerCase().split(/[/\s]/)[0] ?? "";

/** Règles qui s'appliquent à `agent` (jeton en minuscules) : son groupe s'il existe, sinon `*`, sinon aucune. */
export function robotsRulesFor(text: string, agent: string): RobotsRule[] {
  const groups: { agents: string[]; rules: RobotsRule[] }[] = [];
  let cur: { agents: string[]; rules: RobotsRule[] } | null = null;
  let inAgents = false;
  for (const raw of text.split(/\r\n|\r|\n/)) {
    const hash = raw.indexOf("#");
    const line = (hash >= 0 ? raw.slice(0, hash) : raw).trim();
    const colon = line.indexOf(":");
    if (!line || colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === "user-agent") {
      if (!cur || !inAgents) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(productToken(value));
      inAgents = true;
    } else if (key === "allow" || key === "disallow") {
      inAgents = false;
      if (!cur || !value || cur.rules.length >= MAX_RULES) continue; // règle hors groupe ou vide : ignorée
      cur.rules.push({ allow: key === "allow", pattern: encodeNonAscii(value.slice(0, MAX_PATTERN)) });
    }
  }
  const mine = groups.filter((g) => g.agents.includes(agent));
  const chosen = mine.length ? mine : groups.filter((g) => g.agents.includes("*"));
  return chosen.flatMap((g) => g.rules);
}

/** Le motif robots.txt couvre-t-il `path` (chemin + requête) ? `*` joker, `$` final = fin exacte. Sans regex. */
export function robotsPatternMatches(pattern: string, path: string): boolean {
  let p = pattern;
  const anchored = p.endsWith("$");
  if (anchored) p = p.slice(0, -1);
  if (!p.includes("*")) return anchored ? path === p : path.startsWith(p);
  if (!anchored) p += "*";
  // Correspondance à jokers classique (retour au dernier `*`) : O(longueur du chemin × longueur du motif) au pire.
  let i = 0;
  let j = 0;
  let star = -1;
  let mark = 0;
  while (i < path.length) {
    if (j < p.length && p[j] !== "*" && p[j] === path[i]) {
      i++;
      j++;
    } else if (j < p.length && p[j] === "*") {
      star = j++;
      mark = i;
    } else if (star >= 0) {
      j = star + 1;
      i = ++mark;
    } else return false;
  }
  while (j < p.length && p[j] === "*") j++;
  return j === p.length;
}

/** true = lecture permise de `path` (chemin + requête, ex. `/produit/gourde?x=1`) pour `agent`. */
export function robotsAllows(text: string, agent: string, path: string): boolean {
  let best: RobotsRule | null = null;
  for (const r of robotsRulesFor(text, agent.toLowerCase())) {
    if (!robotsPatternMatches(r.pattern, path)) continue;
    if (!best || r.pattern.length > best.pattern.length || (r.pattern.length === best.pattern.length && r.allow)) best = r;
  }
  return best ? best.allow : true;
}
