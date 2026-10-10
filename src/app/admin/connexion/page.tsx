import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/shell/LoginForm";
import { getAdmin } from "@/lib/admin/guard";

export const metadata: Metadata = { title: "Connexion" };

// Connexion du back-office (maquette « Connexion admin », lignes 31-47). Déjà administrateur → tableau de bord.
export default async function AdminLoginPage() {
  if (await getAdmin()) redirect("/admin");
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#141210] p-6">
      <div className="flex w-[min(420px,100%)] flex-col gap-4 rounded-[28px] bg-cream p-7">
        <div className="flex items-baseline gap-2.5">
          <span className="font-display text-2xl font-bold tracking-[-0.03em]">
            Wá x<span className="text-terracotta">ɔ</span>
          </span>
          <span className="text-xs font-semibold uppercase tracking-[.08em] text-[#4A443C]">Back office</span>
        </div>
        <h1 className="m-0 text-xl font-bold">Connexion administrateur</h1>
        <LoginForm />
        <Link href="/" className="inline-flex min-h-11 items-center text-sm">
          ← Retour à la boutique
        </Link>
      </div>
    </main>
  );
}
