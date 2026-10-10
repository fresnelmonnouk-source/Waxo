import { notFound } from "next/navigation";
import { PageEditor } from "@/components/admin/pages/PageEditor";
import { getAdminPage, getPreviewSettings } from "@/lib/admin/data/pages";
import { requireAdmin } from "@/lib/admin/guard";
import { DEFAULT_PAGES } from "@/lib/pages/defaults";
import { isPageSlug } from "@/lib/pages/types";

type Props = { params: Promise<{ slug: string }> };

export const metadata = { title: "Modifier une page d'infos" };

// Éditeur d'une page d'infos (FR + EN). Garde admin obligatoire en première ligne.
export default async function AdminPageEditorPage({ params }: Props) {
  await requireAdmin();
  const { slug } = await params;
  if (!isPageSlug(slug)) notFound();
  const [{ entry, connected }, preview] = await Promise.all([getAdminPage(slug), getPreviewSettings()]);

  return <PageEditor slug={slug} label={entry.label} states={entry.locales} defaults={DEFAULT_PAGES[slug]} preview={preview} connected={connected} />;
}
