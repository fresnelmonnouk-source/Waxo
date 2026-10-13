import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { getProductKbDocs } from "@/lib/admin/data/settings";
import { listKbAdmin } from "@/lib/admin/ai/kb-admin";
import { adminLlmConfigured } from "@/lib/admin/ai/llm";
import { AssistantIaView } from "@/components/admin/ai/AssistantIaView";

export const metadata: Metadata = { title: "Assistant IA" };

/**
 * Durée maximale des server actions de cette page (analyse DeepSeek ≈ 20 à 45 s). 60 s = plafond du plan Hobby de Vercel
 * sans « Fluid compute » ; la génération est coupée à 45 s (`ANALYSIS_CFG.deadlineMs`) et le texte reçu est récupéré.
 */
export const maxDuration = 60;

export default async function AssistantIaPage() {
  await requireAdmin();
  const [kb, productDocs] = await Promise.all([listKbAdmin(), getProductKbDocs()]);
  return <AssistantIaView kb={kb} productDocs={productDocs} llmReady={adminLlmConfigured()} />;
}
