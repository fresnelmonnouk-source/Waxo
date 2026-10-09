import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { fontClassNames } from "@/lib/fonts";
import { routing } from "@/i18n/routing";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((lang) => ({ lang }));
}

export const metadata: Metadata = {
  title: { default: "Wá xɔ", template: "%s · Wá xɔ" },
  description: "Les petites choses utiles, livrées demain à Cotonou.",
};

export default async function LangLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);

  return (
    <html lang={lang} className={fontClassNames}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
