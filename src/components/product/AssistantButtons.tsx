"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { askAssistant } from "./assistant";

/** « Une question sur ce produit ? Demandez à l'assistant » (pastille « ɔ » + texte). */
export function AskAssistantButton({ question }: { question: string }) {
  const t = useTranslations("Product");
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (!askAssistant(question)) router.push("/contact");
      }}
      className="flex min-h-12 cursor-pointer items-center gap-2.5 self-start rounded-[14px] border-0 bg-card px-3.5 py-3 text-left text-[14px] hover:bg-[#FFF4D6]"
    >
      <span className="font-display inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-ink text-[14px] font-bold text-terracotta">
        ɔ
      </span>
      {t("askAssistant")}
    </button>
  );
}

/** « Proposer une alternative » (produit épuisé). */
export function SuggestAlternativeButton({ question }: { question: string }) {
  const t = useTranslations("Product");
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (!askAssistant(question)) router.push("/contact");
      }}
      className="min-h-11 cursor-pointer self-start rounded-full border-0 bg-sun px-[18px] font-semibold"
    >
      {t("suggestAlternative")}
    </button>
  );
}
