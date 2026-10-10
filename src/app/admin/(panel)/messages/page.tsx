import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { getAdminMessages } from "@/lib/admin/data/messages";
import { getAllKbDocs, getSettingsForm } from "@/lib/admin/data/settings";
import { buildDraft, type Draft } from "@/lib/settings/kb-search";
import { MessagesBoard } from "@/components/admin/messages/MessagesBoard";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  await requireAdmin();
  const [{ rows, connected, truncated }, { form }] = await Promise.all([getAdminMessages(), getSettingsForm()]);
  // Réglage « Préparer une réponse aux nouveaux messages » : brouillon (modèle automatique) pour chaque message à traiter.
  // Rien n'est envoyé sans l'administrateur.
  const initialDrafts: Record<string, Draft> = {};
  if (form.autoDraft) {
    const { docs } = await getAllKbDocs();
    for (const m of rows.filter((r) => !r.done)) {
      initialDrafts[m.id] = buildDraft(
        { name: m.name, contact: m.contact, subject: m.subject, text: m.body, orderNumber: m.orderNumber, orderStatusLabel: m.orderStatusLabel, aiSign: form.aiSign },
        docs,
      );
    }
  }
  return <MessagesBoard rows={rows} initialDrafts={initialDrafts} shopName={form.shopName} connected={connected} truncated={truncated} />;
}
