import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getSettings } from "@/lib/catalog";
import {
  EXPRESS_BADGE_COLORS,
  EXPRESS_BADGE_SIZES,
  EXPRESS_PICTO_PATHS,
  cutoffParams,
} from "@/components/shop/ExpressBadge";

export const alt = "Wá xɔ";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#141210";
const CREAM = "#F4F1EA";
const TERRACOTTA = "#E2552B";
const SUN = "#FFC93C";

/**
 * Image de partage « Livraison Express » (direction Vincent, docs/design/livraison-express-2026-10-11.md §7) : fond encre,
 * badge L, slogan de marque + sa preuve, chiffre-signature de l'heure limite (réglage) coupé par le bord droit.
 * Aucune police externe (pas de téléchargement au build) : le « ɔ », absent de la police par défaut, est un « c » inversé.
 */
export default async function OpengraphImage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = hasLocale(routing.locales, lang) ? lang : routing.defaultLocale;
  const [t, tx, settings] = await Promise.all([
    getTranslations({ locale, namespace: "Seo" }),
    getTranslations({ locale, namespace: "Express" }),
    getSettings(),
  ]);
  const hour = cutoffParams(settings.shipping.cutoff, locale);
  const b = EXPRESS_BADGE_SIZES.L;
  const bc = EXPRESS_BADGE_COLORS.onDark;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: INK,
          color: CREAM,
          overflow: "hidden",
        }}
      >
        {/* Chiffre-signature : ferré en bas à droite, ~15 % hors cadre. */}
        <div
          style={{
            position: "absolute",
            right: -90,
            bottom: -62,
            display: "flex",
            fontSize: 300,
            fontWeight: 700,
            letterSpacing: -14,
            lineHeight: 1,
            color: SUN,
            whiteSpace: "nowrap",
          }}
        >
          {locale === "en" ? hour.hour.replace(" ", " ") : `${hour.cutoff} h`}
        </div>

        <div style={{ position: "absolute", left: 72, top: 64, display: "flex", alignItems: "baseline", fontSize: 46, fontWeight: 700, letterSpacing: -2, lineHeight: 1 }}>
          <span>Wá x</span>
          <span style={{ color: TERRACOTTA, display: "flex", transform: "scaleX(-1)" }}>c</span>
        </div>

        <div style={{ position: "absolute", left: 72, top: 168, width: 640, display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              alignItems: "center",
              height: b.height,
              padding: b.padding,
              gap: b.gap,
              borderRadius: 999,
              background: bc.bg,
              color: bc.fg,
              fontSize: b.font,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            <svg width={b.picto} height={b.picto} viewBox="0 0 24 24" fill="none" stroke={bc.picto} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="14" cy="12" r="7" />
              <path d={EXPRESS_PICTO_PATHS[0]} />
              <path d={EXPRESS_PICTO_PATHS[1]} />
            </svg>
            <span>{tx("badge")}</span>
          </div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 54, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1.5 }}>{t("ogTitle")}</div>
          <div style={{ display: "flex", marginTop: 20, fontSize: 26, color: "rgba(244,241,234,0.8)" }}>{t("ogSubtitle", hour)}</div>
        </div>

        <div style={{ position: "absolute", left: 72, bottom: 64, display: "flex", fontSize: 20, color: "rgba(244,241,234,0.6)" }}>{t("ogFooter")}</div>
      </div>
    ),
    { ...size },
  );
}
