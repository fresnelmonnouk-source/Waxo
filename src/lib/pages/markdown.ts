// Mini-rendu markdown SÛR pour les pages d'infos. Module pur (client + serveur).
//
// Principes de sécurité :
//  - le texte n'est JAMAIS interprété comme du HTML : le parseur produit un arbre (AST) ; React échappe tout ce qu'il rend ;
//  - les liens n'acceptent que http(s)://, mailto: et les chemins internes `/…` (pas de `//`, pas de `javascript:`, pas d'espace/guillemet) ;
//  - `escapeHtml` / `toHtml` existent pour les sorties en chaîne (tests, e-mails) et échappent aussi `"` et `'` (injection par attribut).
//
// Syntaxe prise en charge : `#`/`##`/`###` titres, paragraphes (un saut de ligne simple = retour à la ligne), listes `-` et `1.`,
// tableaux `| a | b |` (ligne séparatrice `|---|---|`), **gras**, *italique*, [texte](lien), [texte](lien){button} (lien en bouton),
// marqueurs {{clé}} (réglages) et {{todo:Texte}} (« à compléter » éditorial).

export type Inline =
  | { t: "text"; v: string }
  | { t: "br" }
  | { t: "strong"; c: Inline[] }
  | { t: "em"; c: Inline[] }
  | { t: "link"; href: string; internal: boolean; button: boolean; c: Inline[] }
  | { t: "tbc"; label: string };

export type Block =
  | { t: "h"; level: 1 | 2 | 3; c: Inline[] }
  | { t: "p"; c: Inline[] }
  | { t: "ul" | "ol"; items: Inline[][] }
  | { t: "table"; head: Inline[][]; rows: Inline[][][] };

export type MarkerResult = { status: "ok"; text: string } | { status: "empty"; label: string } | { status: "unknown" };
export type MarkerResolver = (key: string) => MarkerResult;
export type ParseOptions = { resolve?: MarkerResolver };

const MAX_INPUT = 100_000;
const MAX_DEPTH = 5;
const NO_MARKERS: MarkerResolver = () => ({ status: "unknown" });
const MISSING = String.fromCharCode(0); // sentinelle : marqueur d'URL sans valeur

/** Échappe `& < > " '` : sûr dans un contenu ET dans une valeur d'attribut. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Valide une cible de lien. Retourne null si elle n'est pas dans la liste blanche. */
export function safeHref(raw: string): { href: string; internal: boolean } | null {
  const url = raw.trim();
  if (!url || url.length > 2000) return null;
  // Aucun espace, contrôle, guillemet, chevron, accent grave ni antislash (évite `javascript:` camouflé, `/\evil`, rupture d'attribut).
  if (/[\s\u0000-\u001f\u007f<>"'`\\]/.test(url)) return null;
  if (/^https?:\/\//i.test(url)) {
    try {
      const u = new URL(url);
      return (u.protocol === "https:" || u.protocol === "http:") && u.hostname ? { href: url, internal: false } : null;
    } catch {
      return null;
    }
  }
  if (/^mailto:[^@/]+@[^@/]+\.[^@/]+$/i.test(url)) return { href: url, internal: false };
  if (/^\/(?![/\\])[A-Za-z0-9\-._~/?#=&%]*$/.test(url)) return { href: url, internal: true };
  return null;
}

const MARKER_RE = /\{\{\s*([^{}]{1,300}?)\s*\}\}/y;
const LINK_RE = /\[([^[\]\n]+)\]\(([^()\s]+)\)(\{button\})?/y;
const MARKER_GLOBAL = /\{\{\s*([^{}]{1,300}?)\s*\}\}/g;

/** Liste des marqueurs `{{clé}}` (hors `todo:`) présents dans un texte — pour l'avertissement « marqueur inconnu » de l'éditeur. */
export function findMarkers(md: string): string[] {
  const out = new Set<string>();
  for (const m of md.slice(0, MAX_INPUT).matchAll(MARKER_GLOBAL)) {
    if (!m[1].startsWith("todo:")) out.add(m[1]);
  }
  return [...out];
}

function parseInline(src: string, resolve: MarkerResolver, depth: number): Inline[] {
  const out: Inline[] = [];
  let buf = "";
  const flush = () => {
    if (buf) {
      out.push({ t: "text", v: buf });
      buf = "";
    }
  };
  let i = 0;
  while (i < src.length) {
    const ch = src[i];

    if (ch === "\\" && i + 1 < src.length && /[\\`*_{}[\]()#+\-.!|]/.test(src[i + 1])) {
      buf += src[i + 1];
      i += 2;
      continue;
    }
    if (ch === "\n") {
      flush();
      out.push({ t: "br" });
      i += 1;
      continue;
    }
    if (ch === "{" && src[i + 1] === "{") {
      MARKER_RE.lastIndex = i;
      const m = MARKER_RE.exec(src);
      if (m) {
        const key = m[1];
        i = MARKER_RE.lastIndex;
        if (key.startsWith("todo:")) {
          flush();
          out.push({ t: "tbc", label: `[${key.slice(5).trim().slice(0, 200)}]` });
        } else {
          const r = resolve(key);
          if (r.status === "ok") buf += r.text;
          else if (r.status === "empty") {
            flush();
            out.push({ t: "tbc", label: r.label });
          } else buf += `{{${key}}}`; // inconnu : visible tel quel (faute de frappe repérable)
        }
        continue;
      }
    }
    if (depth < MAX_DEPTH) {
      if (ch === "*" && src[i + 1] === "*") {
        const end = src.indexOf("**", i + 2);
        if (end > i + 2) {
          flush();
          out.push({ t: "strong", c: parseInline(src.slice(i + 2, end), resolve, depth + 1) });
          i = end + 2;
          continue;
        }
      } else if (ch === "*" && src[i + 1] !== " " && src[i + 1] !== "*" && i + 1 < src.length) {
        let j = i + 1;
        let end = -1;
        while (j < src.length) {
          if (src[j] === "*" && src[j + 1] !== "*" && src[j - 1] !== " " && src[j - 1] !== "*") {
            end = j;
            break;
          }
          j += 1;
        }
        if (end > i + 1) {
          flush();
          out.push({ t: "em", c: parseInline(src.slice(i + 1, end), resolve, depth + 1) });
          i = end + 1;
          continue;
        }
      } else if (ch === "[") {
        LINK_RE.lastIndex = i;
        const m = LINK_RE.exec(src);
        if (m) {
          i = LINK_RE.lastIndex;
          const children = parseInline(m[1], resolve, depth + 1);
          // Les marqueurs de l'URL sont résolus d'abord ; une valeur manquante/inconnue supprime le lien (le texte reste).
          const url = m[2].replace(MARKER_GLOBAL, (_all, key: string) => {
            const r = resolve(key);
            return r.status === "ok" ? r.text : MISSING;
          });
          const safe = url.includes(MISSING) ? null : safeHref(url);
          flush();
          if (safe) out.push({ t: "link", href: safe.href, internal: safe.internal, button: Boolean(m[3]), c: children });
          else out.push(...children);
          continue;
        }
      }
    }
    buf += ch;
    i += 1;
  }
  flush();
  return out;
}

const SEP_RE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
const HEAD_RE = /^(#{1,3})\s+(.+?)\s*#*\s*$/;
const UL_RE = /^\s*[-*+]\s+(.*)$/;
const OL_RE = /^\s*\d{1,3}[.)]\s+(.*)$/;

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = "";
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] === "\\" && s[i + 1] === "|") {
      cur += "|";
      i += 1;
    } else if (s[i] === "|") {
      cells.push(cur.trim());
      cur = "";
    } else cur += s[i];
  }
  cells.push(cur.trim());
  return cells;
}

const isTableStart = (lines: string[], i: number) =>
  lines[i].trim().startsWith("|") && i + 1 < lines.length && SEP_RE.test(lines[i + 1]) && lines[i + 1].includes("-");

/** Markdown → arbre de blocs. Ne lève jamais d'exception. */
export function parseMarkdown(md: string, opts: ParseOptions = {}): Block[] {
  const resolve = opts.resolve ?? NO_MARKERS;
  const inline = (s: string) => parseInline(s, resolve, 0);
  const lines = md.slice(0, MAX_INPUT).replace(/\r\n?/g, "\n").split(MISSING).join("").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const h = HEAD_RE.exec(line);
    if (h) {
      blocks.push({ t: "h", level: h[1].length as 1 | 2 | 3, c: inline(h[2]) });
      i += 1;
      continue;
    }
    if (isTableStart(lines, i)) {
      const head = splitRow(lines[i]).map(inline);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitRow(lines[i]).map(inline));
        i += 1;
      }
      blocks.push({ t: "table", head, rows });
      continue;
    }
    const ulMatch = UL_RE.exec(line);
    const olMatch = ulMatch ? null : OL_RE.exec(line);
    if (ulMatch || olMatch) {
      const re = ulMatch ? UL_RE : OL_RE;
      const raw: string[] = [];
      while (i < lines.length) {
        const m = re.exec(lines[i]);
        if (m) {
          raw.push(m[1]);
          i += 1;
        } else if (raw.length && /^\s{2,}\S/.test(lines[i])) {
          raw[raw.length - 1] += ` ${lines[i].trim()}`;
          i += 1;
        } else break;
      }
      blocks.push({ t: ulMatch ? "ul" : "ol", items: raw.map(inline) });
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !HEAD_RE.test(lines[i]) &&
      !UL_RE.test(lines[i]) &&
      !OL_RE.test(lines[i]) &&
      !isTableStart(lines, i)
    ) {
      para.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ t: "p", c: inline(para.join("\n")) });
  }
  return blocks;
}

// ───────────────────────── Sorties en chaîne ─────────────────────────

function inlineHtml(nodes: Inline[]): string {
  return nodes
    .map((n) => {
      switch (n.t) {
        case "text":
          return escapeHtml(n.v);
        case "br":
          return "<br>";
        case "strong":
          return `<strong>${inlineHtml(n.c)}</strong>`;
        case "em":
          return `<em>${inlineHtml(n.c)}</em>`;
        case "tbc":
          return `<mark>${escapeHtml(n.label)}</mark>`;
        case "link":
          return `<a href="${escapeHtml(n.href)}"${n.internal ? "" : ' rel="noopener noreferrer" target="_blank"'}>${inlineHtml(n.c)}</a>`;
      }
    })
    .join("");
}

/** Arbre → HTML (chaîne), tout échappé. Utilisé par les tests et pour d'éventuelles sorties hors React. */
export function toHtml(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.t) {
        case "h":
          return `<h${b.level}>${inlineHtml(b.c)}</h${b.level}>`;
        case "p":
          return `<p>${inlineHtml(b.c)}</p>`;
        case "ul":
        case "ol":
          return `<${b.t}>${b.items.map((it) => `<li>${inlineHtml(it)}</li>`).join("")}</${b.t}>`;
        case "table":
          return `<table><thead><tr>${b.head.map((c) => `<th>${inlineHtml(c)}</th>`).join("")}</tr></thead><tbody>${b.rows
            .map((r) => `<tr>${r.map((c) => `<td>${inlineHtml(c)}</td>`).join("")}</tr>`)
            .join("")}</tbody></table>`;
      }
    })
    .join("\n");
}

/** Texte brut d'une suite d'inlines (comparaisons, aperçus). */
export function inlineText(nodes: Inline[]): string {
  return nodes
    .map((n) => (n.t === "text" ? n.v : n.t === "br" ? "\n" : n.t === "tbc" ? n.label : inlineText(n.c)))
    .join("");
}
