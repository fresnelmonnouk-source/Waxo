import { AdminShell } from "@/components/admin/shell/AdminShell";
import { getShellCounts } from "@/lib/admin/data/dashboard";
import { requireAdmin } from "@/lib/admin/guard";

// Toujours rendu à la demande : sans cela, un build fait sans variables Supabase prérend chaque page admin en REDIRECTION
// figée vers la connexion (aucune session au build) et le back-office serait inaccessible en production.
export const dynamic = "force-dynamic";

// Coque du back-office. Le garde `requireAdmin()` est OBLIGATOIRE ici ET dans chaque page/server action/route API admin
// (le layout seul ne suffit pas : la navigation client ne le ré-exécute pas à chaque page).
export default async function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();
  const counts = await getShellCounts();
  return (
    <AdminShell admin={admin} counts={counts}>
      {children}
    </AdminShell>
  );
}
