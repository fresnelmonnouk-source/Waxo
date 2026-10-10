import { tokens } from "./text";

export type Doc = { id: string; title: string; text: string; keywords?: string };
export type Hit<D extends Doc = Doc> = D & { score: number };

/** BM25 simplifié sur des racines de 6 lettres (port fidèle de `retrieve` de docs/maquettes/waxo-data.js). */
export function retrieve<D extends Doc>(q: string, docs: D[], k = 4): Hit<D>[] {
  const qt = [...new Set(tokens(q))];
  if (!qt.length || !docs.length) return [];
  const toks = docs.map((d) => tokens(`${d.title} ${d.title} ${d.keywords ?? ""} ${d.text}`));
  const N = docs.length;
  const avg = toks.reduce((a, t) => a + t.length, 0) / N || 1;
  const df: Record<string, number> = {};
  qt.forEach((t) => {
    df[t] = toks.filter((ts) => ts.includes(t)).length;
  });
  return docs
    .map((d, i) => {
      const ts = toks[i];
      let sc = 0;
      qt.forEach((t) => {
        const f = ts.filter((x) => x === t).length;
        if (!f) return;
        const idf = Math.log(1 + (N - df[t] + 0.5) / (df[t] + 0.5));
        sc += (idf * f * 2.2) / (f + 1.2 * (0.25 + (0.75 * ts.length) / avg));
      });
      return { ...d, score: sc };
    })
    .filter((d) => d.score > 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
