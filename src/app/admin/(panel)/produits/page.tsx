import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { getAdminProducts } from "@/lib/admin/data/products";
import { ProductsView } from "@/components/admin/products/ProductsView";

export const metadata: Metadata = { title: "Produits" };

export default async function ProductsPage() {
  await requireAdmin();
  const data = await getAdminProducts();
  return <ProductsView data={data} />;
}
