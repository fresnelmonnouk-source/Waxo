import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EYEBROW } from "@/components/account/styles";
import { Link } from "@/i18n/navigation";
import { getMarkerContext, getPage } from "@/lib/pages";
import { makeMarkerResolver } from "@/lib/pages/markers";
import { parseMarkdown, type Block } from "@/lib/pages/markdown";
import type { PageLocale, PageSlug } from "@/lib/pages/types";
import { ARTICLE, DOC_BUTTON, DOC_H1 } from "./docStyles";
import { LegalShell, type LegalId } from "./LegalShell";
import { InlineView, MarkdownBlocks, type AnchorProps } from "./MarkdownView";

/** Lien rendu sur le site : `Link` i18n pour les chemins internes (préfixe de langue), `<a>` sûr pour http(s)/mailto. */
function PublicAnchor({ href, internal, button, children }: AnchorProps) {
  const className = button ? DOC_BUTTON : undefined;
  if (internal) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  const external = !href.startsWith("mailto:");
  return (
    <a href={href} className={className} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {children}
    </a>
  );
}

const SHELL_ID: Record<Exclude<PageSlug, "a-propos">, LegalId> = {
  cgv: "cgv",
  cgu: "cgu",
  "mentions-legales": "mentions",
  confidentialite: "privacy",
  "livraison-retours": "shipping",
};
/** Pages qui affichent une date (version applicable). Les mentions légales et la page livraison n'en ont pas (comme la maquette). */
const DATED: PageSlug[] = ["cgv", "cgu", "confidentialite"];

/** Titre de page pour `generateMetadata` (base si éditée, sinon texte par défaut). */
export async function infoPageMetadata(slug: PageSlug, lang: string): Promise<Metadata> {
  const page = await getPage(slug, lang === "en" ? "en" : "fr");
  return { title: page.title };
}

async function load(slug: PageSlug, lang: PageLocale) {
  const [page, ctx] = await Promise.all([getPage(slug, lang), getMarkerContext(lang)]);
  return { page, blocks: parseMarkdown(page.body, { resolve: makeMarkerResolver(ctx) }) };
}

function formatDate(iso: string, lang: PageLocale): string {
  try {
    return new Intl.DateTimeFormat(lang, { dateStyle: "long", timeZone: "Africa/Porto-Novo" }).format(new Date(iso));
  } catch {
    return "";
  }
}

/** Page d'infos lue en base (repli : texte par défaut), pour cgv, cgu, confidentialité, mentions légales, livraison et retours, à propos. */
export async function InfoPage({ slug, lang }: { slug: PageSlug; lang: PageLocale }) {
  const { page, blocks } = await load(slug, lang);
  if (slug === "a-propos") return <AboutView title={page.title} blocks={blocks} lang={lang} />;

  const tLegal = await getTranslations({ locale: lang, namespace: "Legal" });
  const tPages = await getTranslations({ locale: lang, namespace: "InfoPages" });
  let dateLine: string | null = null;
  if (DATED.includes(slug)) {
    const date = page.source === "db" && page.updatedAt ? formatDate(page.updatedAt, lang) : "";
    dateLine = date ? tPages("updated", { date }) : tLegal("effective");
  }

  return (
    <LegalShell current={SHELL_ID[slug as Exclude<PageSlug, "a-propos">]}>
      <article className={ARTICLE}>
        <h1 className={DOC_H1}>{page.title}</h1>
        {dateLine ? <span className="text-[14px] text-muted">{dateLine}</span> : null}
        <MarkdownBlocks blocks={blocks} Anchor={PublicAnchor} />
      </article>
    </LegalShell>
  );
}

const CARD = "flex flex-col gap-[10px] rounded-[24px] bg-white p-6";
const NUM = "font-display text-[28px] font-bold text-terracotta";

/** Découpe le markdown de « À propos » : blocs avant le 1er titre = texte du héro ; chaque titre `##` + son contenu = une carte numérotée. */
export function splitAbout(blocks: Block[]) {
  const intro: Block[] = [];
  const cards: { title: Extract<Block, { t: "h" }>["c"]; body: Block[] }[] = [];
  for (const b of blocks) {
    if (b.t === "h") cards.push({ title: b.c, body: [] });
    else if (cards.length) cards[cards.length - 1].body.push(b);
    else intro.push(b);
  }
  return { intro, cards };
}

async function AboutView({ title, blocks, lang }: { title: string; blocks: Block[]; lang: PageLocale }) {
  const t = await getTranslations({ locale: lang, namespace: "InfoPages" });
  const { intro, cards } = splitAbout(blocks);
  return (
    <main className="min-h-[70vh]">
      <section className="mx-auto grid max-w-[1100px] grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-center gap-10 px-5 pt-12 pb-10">
        <div className="flex flex-col gap-5">
          <span className={EYEBROW}>{t("aboutEyebrow")}</span>
          <h1 className="font-display m-0 text-[clamp(30px,4vw,48px)] leading-[1.06] font-semibold tracking-[-0.035em] text-balance">{title}</h1>
          {intro.map((b, i) =>
            b.t === "p" ? (
              <p key={i} className="m-0 text-[17px] leading-[1.6] text-pretty text-text">
                <InlineView nodes={b.c} Anchor={PublicAnchor} />
              </p>
            ) : (
              <MarkdownBlocks key={i} blocks={[b]} Anchor={PublicAnchor} />
            ),
          )}
        </div>
        <div className="flex aspect-[4/5] items-end rounded-[28px] bg-[#E9E2D3] p-[18px]">
          <span className="rounded-full bg-white/80 px-3 py-[6px] text-[13px] text-text">{t("aboutPhoto")}</span>
        </div>
      </section>

      {cards.length ? (
        <section className="mx-auto max-w-[1100px] px-5 pt-4 pb-14">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-4">
            {cards.map((c, i) => (
              <div key={i} className={CARD}>
                <span className={NUM}>{String(i + 1).padStart(2, "0")}</span>
                <strong className="text-[18px]">
                  <InlineView nodes={c.title} Anchor={PublicAnchor} />
                </strong>
                <div className="flex flex-col gap-2 leading-[1.55] text-text">
                  <MarkdownBlocks blocks={c.body} Anchor={PublicAnchor} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="bg-ink text-cream">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-6 px-5 py-14">
          <h2 className="font-display m-0 text-[clamp(24px,3vw,34px)] leading-[1.1] font-semibold tracking-[-0.03em]">{t("aboutCtaTitle")}</h2>
          <div className="flex flex-wrap gap-[10px]">
            <Link
              href="/catalogue"
              className="rounded-full bg-sun px-[22px] py-[14px] font-semibold text-ink no-underline transition-colors hover:bg-sun-hover hover:text-ink"
            >
              {t("aboutCtaCatalog")}
            </Link>
            <Link
              href="/contact"
              className="rounded-full border border-muted px-[22px] py-[14px] font-semibold text-cream no-underline transition-colors hover:border-cream hover:text-cream"
            >
              {t("aboutCtaContact")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
