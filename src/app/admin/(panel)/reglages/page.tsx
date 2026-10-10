import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { getAllKbDocs, getSettingsForm } from "@/lib/admin/data/settings";
import { SettingsForm } from "@/components/admin/settings/SettingsForm";
import { KbManager } from "@/components/admin/settings/KbManager";
import { PasswordForm } from "@/components/admin/settings/PasswordForm";

export const metadata: Metadata = { title: "Réglages" };

export default async function SettingsPage() {
  const admin = await requireAdmin();
  const [{ form, connected }, kb] = await Promise.all([getSettingsForm(), getAllKbDocs()]);
  return (
    <div className="flex flex-col gap-5">
      <SettingsForm initial={form} connected={connected} />
      <KbManager initial={kb.entries} productDocs={kb.docs.filter((d) => d.kind === "produit")} connected={kb.connected} />
      <PasswordForm email={admin.email} />
    </div>
  );
}
