import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSettings } from "@/lib/catalog";

/** Numéro WhatsApp des réglages, chiffres seuls ; vide si non renseigné ou base indisponible (la 404 ne doit jamais échouer). */
async function whatsappNumber(): Promise<string> {
  try {
    return (await getSettings()).brand.waNumber.replace(/\D/g, "");
  } catch {
    return "";
  }
}

const BTN = "flex min-h-[46px] items-center rounded-full px-5 text-[15px] font-semibold no-underline";

/**
 * Contenu de la page 404 (langue de la route, fixée par `setRequestLocale` du layout) : message clair et liens utiles
 * (accueil, catalogue, contact, WhatsApp si le numéro est renseigné). Partagé par `[lang]/not-found` et `(shop)/not-found`.
 * Composant serveur sans lecture de cookies : le statut 404 et le rendu statique sont conservés.
 */
export async function NotFoundBody() {
  const [t, wa] = await Promise.all([getTranslations("NotFound"), whatsappNumber()]);
  return (
    <main data-screen-label="404" className="mx-auto flex min-h-[60vh] max-w-[760px] flex-col items-start justify-center gap-4 px-5 py-16">
      <span className="text-terracotta-deep text-[13px] font-semibold tracking-[0.04em] uppercase">{t("eyebrow")}</span>
      <h1 className="font-display m-0 text-[clamp(30px,4.4vw,48px)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">{t("title")}</h1>
      <p className="text-text m-0 max-w-[560px] text-[17px] leading-[1.6] text-pretty">{t("text")}</p>
      <nav aria-label={t("label")} className="mt-2 flex flex-wrap gap-3">
        <Link href="/" className={`${BTN} bg-ink text-cream! hover:text-cream! hover:bg-[#2C2823]`}>
          {t("home")}
        </Link>
        <Link href="/catalogue" className={`${BTN} border-border-strong text-ink! hover:text-ink! border bg-white`}>
          {t("catalogue")}
        </Link>
        {wa ? (
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className={`${BTN} bg-leaf text-white! hover:text-white! hover:bg-[#185A3E]`}>
            {t("whatsapp")}
          </a>
        ) : (
          <Link href="/contact" className={`${BTN} border-border-strong text-ink! hover:text-ink! border bg-white`}>
            {t("contact")}
          </Link>
        )}
      </nav>
    </main>
  );
}
