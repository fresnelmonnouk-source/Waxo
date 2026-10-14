// Extraction du texte utile d'une page produit d'un autre site (rédacteur IA des fiches). Module PUR, sans dépendance.
// Entrée déjà coupée à 2 Mo par fetch-page.ts, mais HOSTILE possible : coût LINÉAIRE exigé (audit Raphaël 🟡1 / Victor W3 /
// Zoé Z6, 2026-10-14). Règles : une balise se lit `<[^<>]*>` (jamais `[^>]*`, quadratique sur « <<<< » ou « <meta <meta »),
// et un bloc « ouvrant … fermant » dont le fermant peut manquer se cherche par indexOf (jamais une regex relancée à chaque
// ouvrant). Non-régression : 2 Mo hostiles traités en moins d'une seconde (tests/product-writer-fetch.test.ts).
//
// Ordre de priorité (le plus fiable d'abord, car le texte est tronqué) : données produit JSON-LD (schema.org Product),
// titre, méta description et Open Graph, puis le texte visible (sans script, style, noscript, svg, nav, footer).
// Le résultat n'est JAMAIS rendu en HTML ni stocké : il part seulement, balisé PAGE, dans le message envoyé au modèle.

export const PAGE_TEXT_MAX = 12_000;

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ensp: " ", emsp: " ", thinsp: " ", shy: "",
  laquo: "«", raquo: "»", lsquo: "‘", rsquo: "’", sbquo: "‚", ldquo: "“", rdquo: "”", bdquo: "„",
  hellip: "…", ndash: "–", mdash: "—", middot: "·", bull: "•", deg: "°", times: "×", divide: "÷", plusmn: "±",
  frac12: "½", frac14: "¼", frac34: "¾", sup2: "²", sup3: "³", micro: "µ", euro: "€", pound: "£", cent: "¢",
  copy: "©", reg: "®", trade: "™", para: "¶", sect: "§", iexcl: "¡", iquest: "¿",
  agrave: "à", aacute: "á", acirc: "â", atilde: "ã", auml: "ä", aring: "å", aelig: "æ", ccedil: "ç",
  egrave: "è", eacute: "é", ecirc: "ê", euml: "ë", igrave: "ì", iacute: "í", icirc: "î", iuml: "ï",
  ntilde: "ñ", ograve: "ò", oacute: "ó", ocirc: "ô", otilde: "õ", ouml: "ö", oslash: "ø", oelig: "œ",
  ugrave: "ù", uacute: "ú", ucirc: "û", uuml: "ü", yacute: "ý", yuml: "ÿ", szlig: "ß",
  Agrave: "À", Aacute: "Á", Acirc: "Â", Auml: "Ä", Ccedil: "Ç", Egrave: "È", Eacute: "É", Ecirc: "Ê", Euml: "Ë",
  Icirc: "Î", Iuml: "Ï", Ocirc: "Ô", Ouml: "Ö", OElig: "Œ", Ugrave: "Ù", Ucirc: "Û", Uuml: "Ü",
};

/** Décode les entités HTML (nommées courantes, décimales, hexadécimales). Les inconnues restent telles quelles. */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z][a-z0-9]{1,31});/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return " ";
      return code < 32 && code !== 9 && code !== 10 ? " " : String.fromCodePoint(code);
    }
    return NAMED[e] ?? NAMED[e.toLowerCase()] ?? m;
  });
}

/** Espaces compactés ligne par ligne, lignes vides et doublons consécutifs retirés. */
export function compact(s: string): string {
  const out: string[] = [];
  for (const raw of s.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(/[\s ​]+/g, " ").trim();
    if (line && line !== out[out.length - 1]) out.push(line);
  }
  return out.join("\n");
}

/** Texte d'un fragment HTML (balises retirées, entités décodées). */
export function htmlToText(html: string): string {
  const s = html
    .replace(/<!--[\s\S]*?(?:-->|$)/g, " ")
    // Blocs jamais utiles (contenu compris). Bloc non refermé : retiré jusqu'à la fin.
    // Chaque bloc va jusqu'à SON fermant ou jusqu'à la fin : les correspondances ne se recouvrent pas (linéaire).
    .replace(/<(script|style|noscript|svg|template|iframe|object|nav|footer|head)\b[^<>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^<>]*>/gi, "\n- ")
    .replace(/<\/?(?:p|div|section|article|main|header|aside|ul|ol|li|h[1-6]|tr|table|tbody|thead|dl|dt|dd|blockquote|figure|figcaption|form|fieldset|label|option|select|details|summary)\b[^<>]*>/gi, "\n")
    .replace(/<\/t[dh]\s*>/gi, " : ")
    .replace(/<[^<>]*>/g, " ")
    // Après la ligne précédente, tout « < » restant est après le dernier « > » : un seul balayage jusqu'à la fin.
    .replace(/<[^>]*$/, " ");
  return compact(decodeEntities(s)).replace(/ : (?=\n|$)/g, "");
}

// ───────────────────────── Métadonnées ─────────────────────────

/** Balise lue au plus (au-delà, ignorée : une balise <meta> légitime fait quelques centaines de caractères). */
const TAG_MAX = 4000;

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  // Nom d'attribut en DÉBUT de mot seulement (lookbehind) et sans retour arrière (groupe atomique émulé) : linéaire.
  const re = /(?<![-a-zA-Z0-9_:.])(?=([a-zA-Z_:][-a-zA-Z0-9_:.]*))\1\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  return out;
}

export type PageMeta = { title: string; description: string; ogTitle: string; ogDescription: string };

export function extractMeta(html: string): PageMeta {
  const meta: PageMeta = { title: "", description: "", ogTitle: "", ogDescription: "" };
  // Premier <title> : son contenu jusqu'au fermant (cherché une seule fois), 2 000 caractères au plus.
  const t = /<title\b[^<>]*>/i.exec(html);
  if (t) {
    const start = t.index + t[0].length;
    const end = html.slice(start, start + 2100).toLowerCase().indexOf("</title");
    if (end >= 0 && end <= 2000) meta.title = compact(decodeEntities(html.slice(start, start + end).replace(/<[^<>]*>/g, " ")));
  }
  const re = /<meta\b[^<>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[0].length > TAG_MAX) continue;
    const a = attrs(m[0]);
    const key = (a.property || a.name || "").toLowerCase();
    const content = compact(decodeEntities(a.content ?? "")).slice(0, 1000);
    if (!content) continue;
    if (key === "description" && !meta.description) meta.description = content;
    else if (key === "og:title" && !meta.ogTitle) meta.ogTitle = content;
    else if (key === "og:description" && !meta.ogDescription) meta.ogDescription = content;
  }
  return meta;
}

// ───────────────────────── JSON-LD schema.org Product ─────────────────────────

type Json = unknown;
const isObj = (x: Json): x is Record<string, Json> => !!x && typeof x === "object" && !Array.isArray(x);

const typeIs = (o: Record<string, Json>, names: string[]) => {
  const t = o["@type"];
  const list = Array.isArray(t) ? t : [t];
  return list.some((x) => typeof x === "string" && names.includes(x.replace(/^https?:\/\/schema\.org\//, "")));
};

/** Valeur lisible : texte, nombre, { name }, { value, unitText|unitCode }, liste. */
function show(x: Json, depth = 0): string {
  if (depth > 3 || x === null || x === undefined) return "";
  if (typeof x === "string") return htmlToText(x).replace(/\n+/g, " ").slice(0, 1500);
  if (typeof x === "number" || typeof x === "boolean") return String(x);
  if (Array.isArray(x)) return x.slice(0, 12).map((i) => show(i, depth + 1)).filter(Boolean).join(", ");
  if (isObj(x)) {
    if ("value" in x || "minValue" in x) {
      const v = show(x.value ?? [x.minValue, x.maxValue].filter((y) => y !== undefined).join(" à "), depth + 1);
      const unit = show(x.unitText ?? x.unitCode, depth + 1);
      return [v, unit].filter(Boolean).join(" ");
    }
    if ("name" in x) return show(x.name, depth + 1);
  }
  return "";
}

const PRODUCT_FIELDS: [string, string][] = [
  ["name", "Nom"],
  ["description", "Description"],
  ["brand", "Marque"],
  ["model", "Modèle"],
  ["category", "Catégorie"],
  ["color", "Couleur"],
  ["material", "Matière"],
  ["size", "Taille"],
  ["pattern", "Motif"],
  ["weight", "Poids"],
  ["width", "Largeur"],
  ["height", "Hauteur"],
  ["depth", "Profondeur"],
];

function productLines(p: Record<string, Json>): string[] {
  const lines: string[] = [];
  for (const [k, label] of PRODUCT_FIELDS) {
    const v = show(p[k]);
    if (v) lines.push(`${label} : ${v}`);
  }
  const props = Array.isArray(p.additionalProperty) ? p.additionalProperty : isObj(p.additionalProperty) ? [p.additionalProperty] : [];
  for (const prop of props.slice(0, 40)) {
    if (!isObj(prop)) continue;
    const name = show(prop.name);
    const value = show({ value: prop.value, unitText: prop.unitText, unitCode: prop.unitCode });
    if (name && value) lines.push(`${name} : ${value}`);
  }
  const variants = Array.isArray(p.hasVariant) ? p.hasVariant : [];
  const vNames = variants.slice(0, 15).map((v) => (isObj(v) ? show(v.name) : "")).filter(Boolean);
  if (vNames.length) lines.push(`Variantes : ${vNames.join(" ; ")}`);
  const varies = show(p.variesBy);
  if (varies) lines.push(`Variantes selon : ${varies.replace(/https?:\/\/schema\.org\//g, "")}`);
  return lines;
}

/** Contenus des blocs `<script type="application/ld+json">` (20 au plus) ; fermant cherché par indexOf : linéaire. */
function jsonLdBlocks(html: string): string[] {
  const out: string[] = [];
  const lower = html.toLowerCase();
  const open = /<script\b[^<>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = open.exec(html)) && out.length < 20) {
    const start = m.index + m[0].length;
    const end = lower.indexOf("</script", start);
    if (end < 0) break; // aucun fermant plus loin : aucun bloc suivant ne peut être complet
    if (m[0].length <= TAG_MAX && /\btype\s*=\s*["']?application\/ld\+json/i.test(m[0])) out.push(html.slice(start, end));
    open.lastIndex = end;
  }
  return out;
}

/** Fiches schema.org Product / ProductGroup trouvées dans les blocs JSON-LD (y compris dans @graph). */
export function extractJsonLdProducts(html: string): string[][] {
  return scanJsonLd(html).products;
}

/** Fiches produit + marques déclarées (`brand`) pour le contrôle « marque du site lu » (Helena J2). */
function scanJsonLd(html: string): { products: string[][]; brands: string[] } {
  const out: string[][] = [];
  const brands = new Set<string>();
  for (const block of jsonLdBlocks(html)) {
    let data: Json;
    try {
      data = JSON.parse(block.replace(/^\s*(?:<!\[CDATA\[|<!--)/, "").replace(/(?:\]\]>|-->)\s*$/, ""));
    } catch {
      continue;
    }
    // Parcours borné (profondeur, nombre de nœuds) : un JSON-LD géant ne bloque pas la requête.
    const stack: { node: Json; depth: number }[] = [{ node: data, depth: 0 }];
    let seen = 0;
    while (stack.length && seen++ < 500 && out.length < 3) {
      const { node, depth } = stack.pop()!;
      if (depth > 8) continue;
      if (Array.isArray(node)) {
        for (const n of node) stack.push({ node: n, depth: depth + 1 });
      } else if (isObj(node)) {
        if (typeIs(node, ["Product", "ProductGroup", "IndividualProduct", "ProductModel"])) {
          const lines = productLines(node);
          if (lines.length) out.push(lines);
          const brand = show(node.brand).slice(0, 80).trim();
          if (brand) brands.add(brand);
          continue;
        }
        for (const k of ["@graph", "mainEntity", "itemOffered", "about"]) if (k in node) stack.push({ node: node[k], depth: depth + 1 });
      }
    }
  }
  return { products: out, brands: [...brands].slice(0, 5) };
}

// ───────────────────────── Assemblage ─────────────────────────

export type PageText = {
  text: string;
  /** Longueur du texte visible (hors métadonnées) : quasi nul = page rendue en JavaScript ou protégée. */
  bodyChars: number;
  hasProductData: boolean;
  truncated: boolean;
  /** Page de vérification anti-robot (captcha, « Just a moment… »). */
  challenge: boolean;
  /** Marques déclarées par les données produit (JSON-LD `brand`) : contrôle après génération (Helena J2). */
  brands: string[];
};

const CHALLENGE_RE =
  /captcha|cf-chl|just a moment|attention required|access denied|acc[eè]s refus[eé]|verify you are (?:a )?human|are you a robot|v[ée]rifi(?:ez|cation) que vous [eê]tes (?:un )?humain|enable javascript|activ(?:ez|er) javascript|please enable cookies/i;

export function extractPageText(html: string, max = PAGE_TEXT_MAX): PageText {
  const meta = extractMeta(html);
  const { products, brands } = scanJsonLd(html);
  const bodyOpen = /<body\b[^<>]*>/i.exec(html);
  const body = htmlToText(bodyOpen ? html.slice(bodyOpen.index + bodyOpen[0].length) : html);

  const parts: string[] = [];
  if (meta.title) parts.push(`Titre de la page : ${meta.title}`);
  if (meta.ogTitle && meta.ogTitle !== meta.title) parts.push(`Titre (Open Graph) : ${meta.ogTitle}`);
  if (meta.description) parts.push(`Description (méta) : ${meta.description}`);
  if (meta.ogDescription && meta.ogDescription !== meta.description) parts.push(`Description (Open Graph) : ${meta.ogDescription}`);
  for (const p of products) parts.push(`Données produit structurées :\n${p.join("\n")}`);
  if (body) parts.push(`Texte de la page :\n${body}`);

  const full = parts.join("\n\n");
  const truncated = full.length > max;
  const text = truncated ? full.slice(0, max).replace(/\s+\S*$/, "") : full;
  const sample = `${meta.title}\n${body.slice(0, 3000)}`;
  return {
    text,
    bodyChars: body.length,
    hasProductData: products.length > 0,
    truncated,
    challenge: body.length < 1500 && CHALLENGE_RE.test(sample),
    brands,
  };
}
