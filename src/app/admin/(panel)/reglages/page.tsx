import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { getAllKbDocs, getPaymentAdminView, getSettingsForm } from "@/lib/admin/data/settings";
import { SettingsForm } from "@/components/admin/settings/SettingsForm";
import { KbManager } from "@/components/admin/settings/KbManager";
import { PaymentForm } from "@/components/admin/settings/PaymentForm";
import { PasswordForm } from "@/components/admin/settings/PasswordForm";
import { isProductionRuntime, sandboxAllowed } from "@/lib/payment/mode";

/**
 * Bandeau « ESSAI » (audit Raphaël C1) : la configuration de paiement active est en mode sandbox. En production, elle est
 * refusée (Mobile Money et carte masqués, aucun paiement marqué payé) sauf dérogation ALLOW_SANDBOX_PAYMENTS=1.
 */
function SandboxBanner() {
  const prod = isProductionRuntime();
  const allowed = sandboxAllowed();
  return (
    <div role="status" className="flex flex-wrap items-start gap-3 rounded-[20px] border-[1.5px] border-[#C2410C] bg-white px-5 py-4 text-[14px] leading-normal text-ink">
      <span className="rounded-full bg-[#C2410C] px-2.5 py-1 text-[12px] font-bold tracking-[0.08em] text-white">ESSAI</span>
      <span className="min-w-0 flex-1">
        {!prod
          ? "Les clés de paiement actives sont des clés d'essai (sandbox) : aucun vrai argent n'est encaissé."
          : allowed
            ? "Clés d'essai (sandbox) ACCEPTÉES en production par la dérogation ALLOW_SANDBOX_PAYMENTS=1 : une commande « payée » n'a rapporté aucun argent. Retirez la dérogation après la recette."
            : "Clés d'essai (sandbox) refusées en production : Mobile Money et carte sont masqués dans la boutique et aucun paiement d'essai n'est marqué payé. Posez les clés réelles (sk_live_ et wh_live_) pour encaisser en ligne."}
      </span>
    </div>
  );
}

export const metadata: Metadata = { title: "Réglages" };

export default async function SettingsPage() {
  const admin = await requireAdmin();
  const [{ form, connected }, kb, payment] = await Promise.all([getSettingsForm(), getAllKbDocs(), getPaymentAdminView()]);
  return (
    <div className="flex flex-col gap-5">
      <SettingsForm initial={form} connected={connected} />
      {payment.status.mode === "sandbox" ? <SandboxBanner /> : null}
      <PaymentForm view={payment} />
      <KbManager initial={kb.entries} productDocs={kb.docs.filter((d) => d.kind === "produit")} connected={kb.connected} />
      <PasswordForm email={admin.email} />
    </div>
  );
}
