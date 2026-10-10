"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { assistant } from "./store";

/**
 * Points d'entrée vers l'assistant, repris de la maquette « Waxo Boutique » : carte du héro, bouton de l'en-tête,
 * bloc sombre du menu Catalogue, boutons jaunes « Demander à l'assistant » et « Affiner avec l'assistant ».
 * Tous passent par le store du widget, monté dans la coque de la boutique.
 */

const MARK = "font-display inline-flex flex-none items-center justify-center rounded-full font-bold";

/** Bouton jaune « Demander à l'assistant » (FAQ, tiroir mobile, résultats vides…). `text` = message envoyé (vide = ouvre seulement). */
export function AssistantCta({ text = "", label, onBefore, className = "" }: { text?: string; label?: string; onBefore?: () => void; className?: string }) {
  const t = useTranslations("Assistant.entry");
  return (
    <button
      type="button"
      onClick={() => {
        onBefore?.();
        assistant.ask(text);
      }}
      className={`bg-sun text-ink hover:bg-sun-hover min-h-[46px] cursor-pointer rounded-full border-0 px-5 font-semibold ${className}`}
    >
      {label ?? t("ask")}
    </button>
  );
}

/** Carte « Dites à l'assistant ce dont vous avez besoin » du héro (maquette lignes 154-172). */
export function HeroAssistantCard() {
  const t = useTranslations("Assistant");
  const [value, setValue] = useState("");
  const send = () => {
    assistant.ask(value.trim() || t("hero.defaultAsk"));
    setValue("");
  };
  return (
    <div className="bg-cream text-ink flex max-w-[560px] flex-col gap-3 rounded-[22px] p-[14px] shadow-[0_18px_40px_-20px_rgba(0,0,0,0.45)]">
      <div className="text-text flex items-center gap-[10px] px-1 pt-[2px] text-[14px]">
        <span aria-hidden="true" className={`${MARK} bg-ink text-terracotta h-7 w-7 text-[14px]`}>
          ɔ
        </span>
        {t("hero.title")}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={500}
          autoComplete="off"
          aria-label={t("hero.inputLabel")}
          placeholder={t("hero.placeholder")}
          className="border-border min-w-0 flex-1 rounded-[14px] border bg-white px-[14px] py-[13px] text-[15px]"
        />
        <button type="submit" className="bg-ink text-cream min-h-12 cursor-pointer rounded-[14px] border-0 px-[18px] font-semibold hover:bg-[#2C2823]">
          {t("hero.send")}
        </button>
      </form>
      <div className="flex flex-wrap gap-2">
        {(["c1", "c2", "c3"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => assistant.ask(t(`chips.${k}`))}
            className="border-border text-text hover:text-ink min-h-11 cursor-pointer rounded-full border bg-white px-3 py-2 text-[13px] hover:bg-[#FBEFC9]"
          >
            {t(`chips.${k}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Bouton « Assistant » (pastille verte) de l'en-tête, affichage large seulement (maquette ligne 97). */
export function HeaderAssistantButton({ onBefore }: { onBefore?: () => void }) {
  const t = useTranslations("Assistant.entry");
  return (
    <button
      type="button"
      onClick={() => {
        onBefore?.();
        assistant.ask();
      }}
      className="border-border-strong flex h-11 cursor-pointer items-center gap-2 rounded-full border bg-transparent px-4 text-[14px] hover:bg-white max-[979px]:hidden"
    >
      <span aria-hidden="true" className="bg-leaf h-2 w-2 rounded-full" />
      {t("header")}
    </button>
  );
}

/** Bloc sombre « Vous ne savez pas quoi choisir ? » du menu Catalogue (maquette lignes 132-139). */
export function MegaAssistantBlock({ onNavigate }: { onNavigate: () => void }) {
  const t = useTranslations("Assistant.entry");
  return (
    <div className="bg-ink text-cream flex flex-col gap-3 rounded-[20px] p-5">
      <span aria-hidden="true" className={`${MARK} bg-cream text-terracotta h-[38px] w-[38px] text-[18px]`}>
        ɔ
      </span>
      <strong className="text-[17px] leading-[1.3]">{t("megaTitle")}</strong>
      <span className="flex-1 text-[14px] leading-[1.45] text-[#B9B1A4]">{t("megaText")}</span>
      <AssistantCta onBefore={onNavigate} className="px-4 py-3" />
    </div>
  );
}

/** « Affiner avec l'assistant » de la sélection (maquette ligne 256). */
export function RefineButton() {
  const t = useTranslations("Assistant.entry");
  return (
    <button
      type="button"
      onClick={() => assistant.ask(t("refinePrompt"))}
      className="bg-ink text-cream flex min-h-11 cursor-pointer items-center gap-[10px] rounded-full border-0 px-5 py-[13px] text-[15px] font-semibold whitespace-nowrap hover:bg-[#2C2823]"
    >
      <span aria-hidden="true" className={`${MARK} bg-cream text-terracotta h-[22px] w-[22px] text-[12px]`}>
        ɔ
      </span>
      {t("refine")}
    </button>
  );
}
