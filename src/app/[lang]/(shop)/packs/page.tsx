import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { PackCard } from "@/components/packs/PackCard";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getPacks, getPacksEnabled } from "@/lib/catalog/packs";

// Page statique (ISR) : aucun cookies()/headers(). Le stock des packs se rafraîchit toutes les 2 minutes.
export const revalidate = 120;

// Type local : PageProps<"/[lang]/packs"> n'existe qu'après la génération des types de routes par Next.
type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(routing.locales, lang)) return {};
  const t = await getTranslations({ locale: lang, namespace: "Packs" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function PacksPage({ params }: Props) {
  const { lang } = await params;
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);
  // Packs désactivés depuis l'admin : la page n'existe plus (404), comme le lien du menu.
  if (!(await getPacksEnabled())) notFound();
  const [t, packs] = await Promise.all([getTranslations({ locale: lang, namespace: "Packs" }), getPacks(lang)]);

  const benefits = [
    { title: t("benefits.saveTitle"), text: t("benefits.saveText") },
    { title: t("benefits.pickedTitle"), text: t("benefits.pickedText") },
    { title: t("benefits.oneTitle"), text: t("benefits.oneText") },
  ];

  return (
    <main data-screen-label="Packs" className="mx-auto min-h-[70vh] max-w-[1280px] px-5 pt-6 pb-[72px]">
      <nav aria-label={t("crumb")} className="text-muted mb-[14px] flex gap-2 text-[13px]">
        <Link href="/" className="text-muted! hover:text-muted! underline">
          {t("home")}
        </Link>
        <span aria-hidden="true">/</span>
        <span>{t("title")}</span>
      </nav>

      <header className="mb-8 flex max-w-[720px] flex-col gap-3">
        <span className="text-terracotta-deep text-[13px] font-semibold tracking-[0.04em] uppercase">{t("eyebrow")}</span>
        <h1 className="font-display m-0 text-[clamp(28px,3.6vw,44px)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">
          {t("heading")}
        </h1>
        <p className="text-text m-0 text-[16px] leading-[1.6] text-pretty">{t("lead")}</p>
        {packs.length > 0 ? <span className="text-muted text-[14px]">{t("count", { count: packs.length })}</span> : null}
      </header>

      {packs.length > 0 ? (
        <section aria-label={t("listLabel")} className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-x-5 gap-y-9">
          {packs.map((pack) => (
            <PackCard key={pack.id} pack={pack} animate />
          ))}
        </section>
      ) : (
        <div className="bg-card rounded-card flex max-w-[560px] flex-col items-start gap-3 p-6">
          <strong className="font-display text-[20px] tracking-[-0.02em]">{t("empty.title")}</strong>
          <span className="text-text text-[15px] leading-[1.6]">{t("empty.text")}</span>
          <Link
            href="/catalogue"
            className="bg-ink text-cream! hover:text-cream! inline-flex h-11 items-center rounded-full px-6 text-[15px] font-semibold no-underline hover:bg-[#2C2823]"
          >
            {t("empty.cta")}
          </Link>
        </div>
      )}

      <ul className="m-0 mt-14 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3 p-0">
        {benefits.map((b) => (
          <li key={b.title} className="bg-card rounded-card flex flex-col gap-2 p-5">
            <strong className="text-[16px]">{b.title}</strong>
            <span className="text-text text-[14px] leading-[1.55]">{b.text}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
