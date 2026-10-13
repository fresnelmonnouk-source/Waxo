import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { EYEBROW } from "@/components/account/styles";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getSettings } from "@/lib/catalog";
import { conversationIdFromToken, loadPublicThread, markCustomerRead } from "@/lib/conversations/store";
import { isTokenShape } from "@/lib/conversations/token";
import type { PublicThread } from "@/lib/conversations/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReplyBox } from "../_components/ReplyBox";
import { ThreadMessages, ThreadMeta } from "../_components/ThreadView";

type Props = { params: Promise<{ lang: string; token: string }> };

/**
 * Fil d'une demande, ouvert par le LIEN PRIVÉ reçu par e-mail. Jamais indexé, jamais mis en cache, aucun référent
 * transmis (le jeton est dans l'URL). Jeton mal formé ou inconnu : 404 neutre (même page que n'importe quelle URL
 * inexistante). Aucune note interne ni coordonnée n'est lue pour cette page.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const locale = hasLocale(routing.locales, lang) ? lang : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "Conversations" });
  return {
    title: t("page.metaTitle"),
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    referrer: "no-referrer",
  };
}

/** Jeton → fil public, ou null. Base non configurée = introuvable ; base en panne = erreur (page d'erreur, pas un 404). */
async function threadFromToken(token: string): Promise<PublicThread | null> {
  if (!isTokenShape(token)) return null;
  let sb: ReturnType<typeof createAdminClient>;
  try {
    sb = createAdminClient();
  } catch {
    return null;
  }
  const id = await conversationIdFromToken(sb, token);
  if (!id) return null;
  const thread = await loadPublicThread(sb, id);
  if (thread) await markCustomerRead(sb, id);
  return thread;
}

async function shopInfo(): Promise<{ shopName: string; wa: string }> {
  try {
    const { brand } = await getSettings();
    return { shopName: brand.shopName || "Wá xɔ", wa: brand.waNumber.replace(/\D/g, "") };
  } catch {
    return { shopName: "Wá xɔ", wa: "" };
  }
}

export default async function Page({ params }: Props) {
  await connection(); // rendu à chaque requête : jamais prérendu ni mis en cache
  const { lang, token } = await params;
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);
  const thread = await threadFromToken(token);
  if (!thread) notFound();
  const [t, shop] = await Promise.all([getTranslations({ locale: lang, namespace: "Conversations" }), shopInfo()]);

  return (
    <main className="mx-auto min-h-[70vh] max-w-[820px] px-5 pt-10 pb-[72px]">
      <div className="mb-6 flex flex-col gap-3">
        <span className={EYEBROW}>{t("page.eyebrow")}</span>
        <h1 className="font-display m-0 text-[clamp(26px,3.6vw,38px)] leading-[1.1] font-semibold tracking-[-0.03em] break-words">
          {thread.subject || t("page.untitled")}
        </h1>
        <ThreadMeta thread={thread} />
      </div>
      <div className="flex flex-col gap-6">
        <ThreadMessages thread={thread} shopName={shop.shopName} />
        <ReplyBox target={{ kind: "token", token }} resolved={thread.status === "resolu"} />
        <div className="flex flex-col gap-2 text-[13px] leading-[1.5] text-muted">
          <p className="m-0">{t("page.personal")}</p>
          {shop.wa ? (
            <p className="m-0">
              <a href={`https://wa.me/${shop.wa}`} target="_blank" rel="noopener noreferrer">
                {t("page.help")}
              </a>
            </p>
          ) : null}
          <p className="m-0">{t.rich("page.privacy", { privacy: (c) => <Link href="/confidentialite">{c}</Link> })}</p>
        </div>
      </div>
    </main>
  );
}
