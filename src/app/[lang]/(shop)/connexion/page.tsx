import { Suspense, use } from "react";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthPage } from "@/components/account/AuthPage";
import { pageTitle } from "@/components/account/page-meta";
import { routing } from "@/i18n/routing";

type Props = { params: Promise<{ lang: string }> };

export const generateMetadata = ({ params }: Props) => pageTitle(params, "Info.meta", "connexion");

export default function Page({ params }: Props) {
  const { lang } = use(params);
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);

  return (
    <main className="mx-auto min-h-[70vh] max-w-[1100px] px-5 pt-9 pb-[72px]">
      <Suspense fallback={null}>
        <AuthPage mode="login" />
      </Suspense>
    </main>
  );
}
