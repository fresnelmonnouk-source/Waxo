import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";

export const alt = "Wá xɔ";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#141210";
const CREAM = "#F4F1EA";
const TERRACOTTA = "#E2552B";
const SUN = "#FFC93C";

/** Image de partage aux couleurs de la charte. Aucune police externe : le « ɔ » (absent de la police par défaut) est dessiné
 *  comme un « c » inversé, ce qui évite tout téléchargement au build. */
export default async function OpengraphImage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = hasLocale(routing.locales, lang) ? lang : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "Seo" });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: CREAM,
          padding: "72px 80px",
          color: INK,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", fontSize: 150, fontWeight: 700, letterSpacing: -6, lineHeight: 1 }}>
          <span>Wá x</span>
          <span style={{ color: TERRACOTTA, display: "flex", transform: "scaleX(-1)" }}>c</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>{t("ogTitle")}</div>
          <div style={{ display: "flex", fontSize: 44, color: "#4A443C" }}>{t("ogSubtitle")}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", width: 22, height: 22, borderRadius: 11, background: SUN }} />
          <div style={{ display: "flex", fontSize: 30, color: "#6B645A" }}>{t("ogFooter")}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
