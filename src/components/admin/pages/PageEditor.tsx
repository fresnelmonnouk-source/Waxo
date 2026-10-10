"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { savePageAction } from "@/app/admin/(panel)/pages/actions";
import { ARTICLE, DOC_BUTTON, DOC_H1 } from "@/components/account/legal/docStyles";
import { MarkdownBlocks, type AnchorProps } from "@/components/account/legal/MarkdownView";
import type { AdminLocaleState } from "@/lib/admin/data/pages";
import { findMarkers, parseMarkdown } from "@/lib/pages/markdown";
import { MARKER_DOCS, isKnownMarker, makeMarkerResolver, type MarkerGroup, type MarkerShop } from "@/lib/pages/markers";
import { BODY_MAX, PAGE_LOCALES, TITLE_MAX, type LegalSettings, type PageLocale, type PageSlug } from "@/lib/pages/types";

type Draft = { title: string; body: string };
type Saved = Draft & { source: "db" | "default"; updatedAt: string | null };
type Notice = { kind: "ok" | "error"; text: string } | null;

const LANG_LABEL: Record<PageLocale, string> = { fr: "Français", en: "English" };
const GROUPS: MarkerGroup[] = ["Réglages légaux", "Boutique", "Livraison", "Paiement"];

const FIELD = "w-full min-w-0 rounded-[12px] border border-[#E2DCCF] bg-[#FAF8F3] px-3 py-[11px] text-[15px] font-normal text-[#141210]";
const BTN_DARK =
  "inline-flex min-h-[48px] cursor-pointer items-center justify-center rounded-full border-0 bg-[#141210] px-[22px] font-semibold text-[#F4F1EA] hover:bg-[#2C2823] disabled:cursor-not-allowed disabled:opacity-60";
const BTN_LIGHT =
  "inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-full border border-[#D6CFC0] bg-transparent px-[18px] text-[14px] text-[#141210] hover:bg-[#FAF8F3] disabled:cursor-not-allowed disabled:opacity-60";
const TOOL = "inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-[12px] border border-[#E2DCCF] bg-white px-3 text-[14px] text-[#141210] hover:bg-[#FAF8F3]";

/** Lien de l'aperçu : pas de contexte next-intl dans l'admin → on préfixe la langue à la main et on ouvre dans un nouvel onglet. */
function previewAnchor(locale: PageLocale) {
  return function PreviewAnchor({ href, internal, button, children }: AnchorProps) {
    return (
      <a href={internal ? `/${locale}${href}` : href} target="_blank" rel="noopener noreferrer" className={button ? DOC_BUTTON : undefined}>
        {children}
      </a>
    );
  };
}

export function PageEditor({
  slug,
  label,
  states,
  defaults,
  preview,
  connected,
}: {
  slug: PageSlug;
  label: string;
  states: Record<PageLocale, AdminLocaleState>;
  defaults: Record<PageLocale, Draft>;
  preview: { shop: MarkerShop; legal: LegalSettings };
  connected: boolean;
}) {
  const [locale, setLocale] = useState<PageLocale>("fr");
  const [saved, setSaved] = useState<Record<PageLocale, Saved>>(() => ({ fr: { ...states.fr }, en: { ...states.en } }));
  const [drafts, setDrafts] = useState<Record<PageLocale, Draft>>(() => ({
    fr: { title: states.fr.title, body: states.fr.body },
    en: { title: states.en.title, body: states.en.body },
  }));
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, startTransition] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const draft = drafts[locale];
  const isDirty = (l: PageLocale) => drafts[l].title !== saved[l].title || drafts[l].body !== saved[l].body;
  const dirty = isDirty(locale);
  const anyDirty = PAGE_LOCALES.some(isDirty);

  // Garde-fou : on ne perd pas un texte non enregistré en fermant l'onglet.
  useEffect(() => {
    if (!anyDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [anyDirty]);

  const blocks = useMemo(
    () => parseMarkdown(draft.body, { resolve: makeMarkerResolver({ locale, shop: preview.shop, legal: preview.legal }) }),
    [draft.body, locale, preview],
  );
  const Anchor = useMemo(() => previewAnchor(locale), [locale]);
  const unknown = useMemo(() => findMarkers(draft.body).filter((k) => !isKnownMarker(k)), [draft.body]);

  const setField = (field: keyof Draft, value: string) => {
    setDrafts((d) => ({ ...d, [locale]: { ...d[locale], [field]: value } }));
    setNotice(null);
  };

  /** Remplace la sélection du texte par `make(sélection)` puis replace le curseur. */
  const edit = (make: (sel: string) => { text: string; select?: [number, number] }) => {
    const ta = bodyRef.current;
    if (!ta) return;
    const { selectionStart: a, selectionEnd: b, value } = ta;
    const out = make(value.slice(a, b));
    const next = value.slice(0, a) + out.text + value.slice(b);
    if (next.length > BODY_MAX) return;
    setField("body", next);
    const [s, e] = out.select ?? [out.text.length, out.text.length];
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(a + s, a + e);
    });
  };

  const insertMarker = (key: string) => edit(() => ({ text: `{{${key}}}` }));
  const wrap = (before: string, after: string, placeholder: string) =>
    edit((sel) => {
      const inner = sel || placeholder;
      return { text: `${before}${inner}${after}`, select: [before.length, before.length + inner.length] };
    });
  const prefixLines = (prefix: string) =>
    edit((sel) => {
      const text = (sel || "Texte").split("\n").map((l) => `${prefix}${l}`).join("\n");
      return { text, select: [0, text.length] };
    });
  const insertLink = () =>
    edit((sel) => {
      const linkText = sel || "texte du lien";
      return { text: `[${linkText}](https://)`, select: [linkText.length + 3, linkText.length + 11] };
    });

  const save = () => {
    const l = locale;
    setNotice(null);
    startTransition(async () => {
      const res = await savePageAction({ slug, locale: l, title: drafts[l].title, body: drafts[l].body, baseUpdatedAt: saved[l].updatedAt });
      if (!res.ok) {
        setNotice({ kind: "error", text: res.message });
        return;
      }
      const clean = { title: drafts[l].title.trim(), body: drafts[l].body.trim() };
      setDrafts((d) => ({ ...d, [l]: clean }));
      setSaved((s) => ({ ...s, [l]: { ...clean, source: "db", updatedAt: res.updatedAt } }));
      setNotice({ kind: "ok", text: `Version ${LANG_LABEL[l]} enregistrée. La page du site est mise à jour.` });
    });
  };

  const restoreDefault = () => {
    setDrafts((d) => ({ ...d, [locale]: { ...defaults[locale] } }));
    setNotice({ kind: "ok", text: "Texte par défaut chargé dans l'éditeur. Cliquez sur « Enregistrer » pour l'appliquer au site." });
  };

  const isAbout = slug === "a-propos";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/pages" className="inline-flex min-h-[44px] items-center text-[14px] text-[#141210] underline">
          ← Pages d&apos;infos
        </Link>
        <a href={`/${locale}/${slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-[14px] text-[#141210] underline">
          Voir la page sur le site ({LANG_LABEL[locale]})<span className="sr-only"> (nouvel onglet)</span>
        </a>
      </div>

      {!connected ? (
        <div role="note" className="rounded-[14px] bg-[#FBEFC9] px-3.5 py-2.5 text-[13px] leading-[1.45] text-[#4A443C]">
          Base non connectée (mode démo) : vous pouvez modifier et prévisualiser, mais l&apos;enregistrement est impossible.
        </div>
      ) : null}

      <div role="group" aria-label="Langue de la page" className="flex flex-wrap gap-2">
        {PAGE_LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={locale === l}
            onClick={() => {
              setLocale(l);
              setNotice(null);
            }}
            className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border px-5 text-[14px] font-medium ${
              locale === l ? "border-[#141210] bg-[#141210] text-[#F4F1EA]" : "border-[#D6CFC0] bg-transparent text-[#141210]"
            }`}
          >
            {LANG_LABEL[l]}
            {isDirty(l) ? <span aria-label="modifications non enregistrées" title="Modifications non enregistrées" className="h-2 w-2 rounded-full bg-[#F5B800]" /> : null}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] items-start gap-5">
        <section aria-label={`Édition de ${label}`} className="flex flex-col gap-3.5 rounded-[22px] bg-white p-5">
          <h2 className="m-0 text-[17px]">{label}</h2>
          <label className="flex flex-col gap-1.5 text-[14px] font-medium">
            Titre ({LANG_LABEL[locale]})
            <input value={draft.title} maxLength={TITLE_MAX} onChange={(e) => setField("title", e.target.value)} className={FIELD} />
          </label>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="page-body" className="text-[14px] font-medium">
              Texte (markdown)
            </label>
            <div role="toolbar" aria-label="Mise en forme" className="flex flex-wrap gap-1.5">
              <button type="button" className={TOOL} onClick={() => prefixLines("## ")} aria-label="Titre de section">
                Titre
              </button>
              <button type="button" className={`${TOOL} font-bold`} onClick={() => wrap("**", "**", "texte")} aria-label="Gras">
                G
              </button>
              <button type="button" className={`${TOOL} italic`} onClick={() => wrap("*", "*", "texte")} aria-label="Italique">
                I
              </button>
              <button type="button" className={TOOL} onClick={() => prefixLines("- ")} aria-label="Liste à puces">
                Liste
              </button>
              <button type="button" className={TOOL} onClick={insertLink} aria-label="Lien">
                Lien
              </button>
            </div>
            <textarea
              id="page-body"
              ref={bodyRef}
              value={draft.body}
              maxLength={BODY_MAX}
              onChange={(e) => setField("body", e.target.value)}
              spellCheck
              rows={22}
              aria-describedby="page-body-help"
              className={`${FIELD} min-h-[420px] resize-y font-mono text-[14px] leading-[1.55]`}
            />
            <span id="page-body-help" className="text-[12px] text-[#4A443C]">
              {draft.body.length.toLocaleString("fr-FR")} / {BODY_MAX.toLocaleString("fr-FR")} caractères
            </span>
          </div>

          {unknown.length ? (
            <div role="alert" className="rounded-[14px] bg-[#F6E1DA] px-3.5 py-2.5 text-[13px] leading-[1.45] text-[#9A3412]">
              Marqueur{unknown.length > 1 ? "s" : ""} inconnu{unknown.length > 1 ? "s" : ""} (affiché{unknown.length > 1 ? "s" : ""} tel quel sur le site) : {unknown.map((k) => `{{${k}}}`).join(", ")}
            </div>
          ) : null}

          <details className="rounded-[14px] bg-[#FAF8F3] p-3.5">
            <summary className="min-h-[44px] cursor-pointer text-[14px] font-semibold leading-[44px]">Insérer une valeur des réglages</summary>
            <p className="m-0 mb-3 text-[13px] leading-[1.5] text-[#4A443C]">
              Ces marqueurs sont remplacés sur le site par les valeurs de Réglages. Un réglage légal vide s&apos;affiche en jaune «&nbsp;[à compléter]&nbsp;».
            </p>
            {GROUPS.map((g) => (
              <fieldset key={g} className="m-0 mb-3 min-w-0 border-0 p-0">
                <legend className="mb-1.5 text-[12px] font-semibold tracking-[.06em] text-[#4A443C] uppercase">{g}</legend>
                <div className="flex flex-wrap gap-1.5">
                  {MARKER_DOCS.filter((m) => m.group === g).map((m) => (
                    <button key={m.key} type="button" className={`${TOOL} text-[13px]`} onClick={() => insertMarker(m.key)} title={`{{${m.key}}}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
            <p className="m-0 text-[13px] leading-[1.5] text-[#4A443C]">
              Note à compléter à la main : <code>{"{{todo:Texte à préciser}}"}</code> affiche «&nbsp;[Texte à préciser]&nbsp;» en jaune.
            </p>
          </details>

          <details className="rounded-[14px] bg-[#FAF8F3] p-3.5">
            <summary className="min-h-[44px] cursor-pointer text-[14px] font-semibold leading-[44px]">Aide-mémoire markdown</summary>
            <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[13px] leading-[1.5] text-[#4A443C]">
              <li>
                <code>## Titre</code> : titre de section (<code>###</code> : sous-titre)
              </li>
              <li>
                <code>**gras**</code>, <code>*italique*</code>, une ligne vide sépare les paragraphes
              </li>
              <li>
                <code>- élément</code> : liste à puces ; <code>1. élément</code> : liste numérotée
              </li>
              <li>
                <code>[texte](https://…)</code>, <code>[texte](mailto:…)</code>, <code>[texte](/cgv)</code> (page du site)
              </li>
              <li>
                <code>[texte](/contact){"{button}"}</code> : lien présenté en bouton
              </li>
              <li>
                Tableau : <code>| Zone | Délai |</code>, puis <code>|---|---|</code>, puis une ligne par ligne
              </li>
              {isAbout ? <li>À propos : le texte avant le premier titre ouvre la page ; chaque <code>##</code> devient une carte numérotée.</li> : null}
              <li>Le HTML n&apos;est pas interprété : il s&apos;affiche comme du texte.</li>
            </ul>
          </details>

          <div className="flex flex-wrap items-center gap-2.5">
            <button type="button" className={BTN_DARK} onClick={save} disabled={pending || !dirty}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button type="button" className={BTN_LIGHT} onClick={restoreDefault} disabled={pending || (draft.title === defaults[locale].title && draft.body === defaults[locale].body)}>
              Restaurer le texte par défaut
            </button>
            {dirty ? <span className="text-[13px] text-[#8A5A00]">Modifications non enregistrées</span> : null}
          </div>
          <p role="status" aria-live="polite" className={`m-0 min-h-[20px] text-[13px] ${notice?.kind === "error" ? "text-[#9A3412]" : "text-[#1F6B4A]"}`}>
            {notice?.text}
          </p>
          <span className="text-[12px] text-[#4A443C]">
            {saved[locale].source === "db" ? "Version enregistrée en base." : "Aucune version enregistrée : le site affiche le texte par défaut."}
          </span>
        </section>

        <section aria-label="Aperçu" className="flex flex-col gap-3 rounded-[22px] bg-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="m-0 text-[17px]">Aperçu</h2>
            <span className="text-[12px] text-[#4A443C]">
              {isAbout ? "La page À propos affiche le texte en héro et en cartes numérotées." : "Rendu des textes avec les réglages actuels."}
            </span>
          </div>
          <div className="rounded-[16px] bg-[#F4F1EA] p-4">
            {isAbout ? null : (
            <div className="mb-4 rounded-[12px] bg-[#FBEFC9] px-3 py-2 text-[12px] leading-[1.5]">
              {locale === "fr"
                ? "Modèle rédigé pour la maquette. Les éléments entre crochets sont à compléter et l'ensemble doit être validé par un juriste avant la mise en ligne."
                : "Template drafted for the mockup. Items in square brackets are to be completed and the whole must be reviewed by a lawyer before going live."}
            </div>
            )}
            <article className={ARTICLE}>
              <div className={DOC_H1}>{draft.title || "Sans titre"}</div>
              <MarkdownBlocks blocks={blocks} Anchor={Anchor} />
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}
