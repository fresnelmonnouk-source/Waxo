import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { getAdminProducts } from "@/lib/admin/data/products";
import { adminLlmConfigured } from "@/lib/admin/ai/llm";
import { ProductsView } from "@/components/admin/products/ProductsView";

export const metadata: Metadata = { title: "Produits" };

/**
 * Durée maximale des server actions de cette page : le rédacteur IA des fiches lit un lien (8 s max) puis attend DeepSeek
 * (40 s max, `WRITER_CFG.deadlineMs`). 60 s = plafond du plan Hobby de Vercel sans « Fluid compute ».
 */
export const maxDuration = 60;

export default async function ProductsPage() {
  await requireAdmin();
  const data = await getAdminProducts();
  return <ProductsView data={data} aiReady={adminLlmConfigured()} />;
}
