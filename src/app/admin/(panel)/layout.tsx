import { requireAdmin } from "@/lib/admin/guard";

// Coque du back-office (barre latérale, en-tête, nav mobile) : STUB posé par le socle, remplacé par l'agent « admin coque ».
// Le garde `requireAdmin()` est OBLIGATOIRE ici ET dans chaque page/server action (le layout seul ne suffit pas : navigation client).
export default async function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return <>{children}</>;
}
