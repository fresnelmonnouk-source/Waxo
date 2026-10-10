import type { ComponentType, ReactNode } from "react";
import type { Block, Inline } from "@/lib/pages/markdown";
import { DOC_BUTTON, DOC_H2, DOC_H3, TBC_MARK } from "./docStyles";

export type AnchorProps = { href: string; internal: boolean; button: boolean; children: ReactNode };
/** Composant de lien injecté : `Link` i18n sur le site, `<a>` simple dans l'aperçu de l'admin (qui n'a pas de contexte next-intl). */
export type AnchorComponent = ComponentType<AnchorProps>;

/** Rend des inlines de l'arbre markdown (React échappe tout le texte : aucun HTML brut n'est jamais injecté). */
export function InlineView({ nodes, Anchor }: { nodes: Inline[]; Anchor: AnchorComponent }): ReactNode {
  return nodes.map((n, i) => {
    switch (n.t) {
      case "text":
        return n.v;
      case "br":
        return <br key={i} />;
      case "strong":
        return (
          <strong key={i}>
            <InlineView nodes={n.c} Anchor={Anchor} />
          </strong>
        );
      case "em":
        return (
          <em key={i}>
            <InlineView nodes={n.c} Anchor={Anchor} />
          </em>
        );
      case "tbc":
        return (
          <mark key={i} className={TBC_MARK}>
            {n.label}
          </mark>
        );
      case "link":
        return (
          <Anchor key={i} href={n.href} internal={n.internal} button={n.button}>
            <InlineView nodes={n.c} Anchor={Anchor} />
          </Anchor>
        );
    }
  });
}

/** Rend un arbre de blocs markdown avec le style des documents d'infos (maquette 629-750). */
export function MarkdownBlocks({ blocks, Anchor }: { blocks: Block[]; Anchor: AnchorComponent }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h":
            return b.level === 3 ? (
              <h3 key={i} className={DOC_H3}>
                <InlineView nodes={b.c} Anchor={Anchor} />
              </h3>
            ) : (
              <h2 key={i} className={DOC_H2}>
                <InlineView nodes={b.c} Anchor={Anchor} />
              </h2>
            );
          case "p":
            return (
              <p key={i} className="m-0">
                <InlineView nodes={b.c} Anchor={Anchor} />
              </p>
            );
          case "ul":
          case "ol": {
            const Tag = b.t;
            return (
              <Tag key={i} className={`m-0 flex flex-col gap-2 pl-[22px] ${b.t === "ul" ? "list-disc" : "list-decimal"}`}>
                {b.items.map((it, j) => (
                  <li key={j}>
                    <InlineView nodes={it} Anchor={Anchor} />
                  </li>
                ))}
              </Tag>
            );
          }
          case "table":
            return (
              <div key={i} className="mt-2 overflow-x-auto rounded-[18px] border border-border bg-white">
                <table className="w-full min-w-[520px] border-collapse text-left">
                  <thead>
                    <tr className="bg-[#FAF8F3] text-[13px] font-semibold text-text">
                      {b.head.map((c, j) => (
                        <th key={j} scope="col" className="px-4 py-3 font-semibold">
                          <InlineView nodes={c} Anchor={Anchor} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j} className="border-t border-border text-[15px]">
                        {r.map((c, k) => (
                          <td key={k} className={`px-4 py-[14px] align-top ${k === 0 ? "font-bold" : ""}`}>
                            <InlineView nodes={c} Anchor={Anchor} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </>
  );
}

/** Lien « bouton » (markdown `[texte](/chemin){button}`) : style pilule sombre, cible 44 px. */
export const buttonClass = DOC_BUTTON;
