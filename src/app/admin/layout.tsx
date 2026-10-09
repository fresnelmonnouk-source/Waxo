import type { Metadata } from "next";
import { fontClassNames } from "@/lib/fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: "Back-office", template: "%s · Back-office Wá xɔ" },
  robots: { index: false, follow: false },
};

// Back-office : français uniquement, hors préfixe de langue. L'accès admin est contrôlé au jalon J2 (RLS + garde serveur).
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="fr" className={fontClassNames}>
      <body>{children}</body>
    </html>
  );
}
