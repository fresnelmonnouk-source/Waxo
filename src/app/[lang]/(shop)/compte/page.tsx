import { Suspense, use } from "react";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AccountPage } from "@/components/account/AccountPage";
import { pageTitle } from "@/components/account/page-meta";
import { routing } from "@/i18n/routing";

type Props = { params: Promise<{ lang: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, "Info.meta", "compte");

// Page statique : la session est lue côté client (GET /api/me), jamais ici.
export default function Page({ params }: Props) {
  const { lang } = use(params);
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);

  return (
    <main className="mx-auto min-h-[70vh] max-w-[1100px] px-5 pt-9 pb-[72px]">
      <Suspense fallback={null}>
        <AccountPage />
      </Suspense>
    </main>
  );
}
