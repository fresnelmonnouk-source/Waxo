// Règle « défaut ou erreur : qui paie » (validée par le propriétaire le 2026-10-17) : textes de repli, réponse de l'assistant
// et pages par défaut cohérents entre eux, sans l'ancienne promesse « retour à nos frais ».
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_PAGES } from "@/lib/pages/defaults";

type Json = Record<string, Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
const load = (lang: string, file: string) =>
  JSON.parse(readFileSync(new URL(`../src/messages/${lang}/${file}.json`, import.meta.url), "utf8")) as Json;

describe.each(["fr", "en"] as const)("règle défaut ou erreur (%s)", (lang) => {
  const account = load(lang, "account");
  const assistant = load(lang, "assistant");
  const shipping = account.Legal.shipping;
  const cgv8: string = account.Legal.cgv.s8.p;
  const returns: string = assistant.Assistant.reply.returns;
  const pages = DEFAULT_PAGES["livraison-retours"][lang].body;
  const cgv = DEFAULT_PAGES.cgv[lang].body;

  it("l'assistant ne promet plus le retour à nos frais et explique les 3 cas + le défaut causé par le client", () => {
    expect(returns).not.toMatch(/à nos frais|we pay it/i);
    expect(returns).toMatch(lang === "fr" ? /livreur/ : /courier/);
    expect(returns).toMatch(lang === "fr" ? /48 h/ : /48 hours/);
    expect(returns).toMatch(lang === "fr" ? /causé par le client/ : /caused by the customer/);
  });

  it("le repli de la page Livraison et retours a toutes les clés, sans marqueur à compléter ni retour gratuit", () => {
    for (const k of ["dayCheck", "condP", "defH", "def1", "def2", "def3", "defCause", "defLaw"]) expect(typeof shipping[k], k).toBe("string");
    expect(shipping.condP).not.toContain("<tbc>");
    expect(shipping.condP).not.toMatch(/retour est gratuit|return is free/i);
    expect(shipping.def1).toMatch(lang === "fr" ? /frais de livraison payés compris/ : /delivery fees you paid included/);
    expect(shipping.def2).toMatch(lang === "fr" ? /restent à votre charge/ : /remain at your charge/);
    expect(shipping.defLaw).toMatch(lang === "fr" ? /droits que la loi/ : /rights the law/);
  });

  it("le repli CGV art. 8 : devant le livreur, 48 h, à l'usage, produit vérifié, clause de sauvegarde", () => {
    expect(cgv8).toMatch(lang === "fr" ? /devant le livreur/ : /in front of the courier/);
    expect(cgv8).toMatch(lang === "fr" ? /vérifie chaque produit/ : /checks every product/);
    expect(cgv8).toMatch(lang === "fr" ? /ne limitent pas les droits/ : /do not limit the rights/);
    expect(cgv8).not.toMatch(/prend en charge les frais de retour|covers the return costs/);
  });

  it("pages par défaut : section « défaut ou erreur », phrase de sauvegarde, plus de « retour gratuit » ni de date codée en dur", () => {
    expect(pages).toMatch(lang === "fr" ? /## Un défaut ou une erreur\s\?/ : /## A defect or a mistake\?/);
    expect(pages).not.toMatch(/retour est gratuit|return is free/i);
    expect(cgv).toMatch(lang === "fr" ? /vérifions chaque produit avant de l'expédier/ : /check every product before shipping it/);
    expect(cgv).toMatch(lang === "fr" ? /Ces règles ne limitent pas les droits/ : /These rules do not limit the rights/);
    expect(cgv).not.toMatch(/à partir du \d{1,2} (octobre|novembre) 2026|from (October|November) \d{1,2}, 2026/i);
    expect(cgv).not.toMatch(lang === "fr" ? /les frais de retour sont à notre charge/ : /we cover the return costs/);
  });
});
