"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { fmtXof } from "@/lib/money";
import { cssUrl, norm, searchSuggestions, type SearchEntry } from "./logic";

/** Recherche de l'en-tête avec suggestions (maquette lignes 44-66). Entrée / « Rechercher » ouvre le catalogue filtré. */
export function HeaderSearch({ entries }: { entries: SearchEntry[] }) {
  const t = useTranslations("Shell.search");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);

  const suggestions = useMemo(() => searchSuggestions(entries, q), [entries, q]);
  const open = focus && norm(q.trim()).length >= 2;

  function submit() {
    const v = q.trim();
    setFocus(false);
    inputRef.current?.blur();
    router.push(v ? `/catalogue?q=${encodeURIComponent(v)}` : "/catalogue");
  }

  return (
    <div
      className="relative min-w-0 max-[979px]:order-3 max-[979px]:basis-full min-[980px]:flex-[1_1_300px]"
      onFocus={() => setFocus(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setFocus(false);
      }}
    >
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="border-border focus-within:outline-ink flex items-center gap-[10px] rounded-full border bg-white py-1 pr-[5px] pl-4 focus-within:outline-2 focus-within:outline-offset-1"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B645A" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={100}
          autoComplete="off"
          aria-label={t("label")}
          placeholder={t("placeholder")}
          className="min-w-0 flex-1 border-0 bg-transparent py-[9px] text-[15px]"
          style={{ outline: "none" }}
        />
        <button
          type="submit"
          className="bg-sun text-ink hover:bg-sun-hover relative cursor-pointer rounded-full border-0 px-[14px] py-[9px] text-[13px] font-semibold whitespace-nowrap after:absolute after:-inset-[3px] after:content-['']"
        >
          {t("submit")}
        </button>
      </form>
      {open ? (
        <div className="border-border absolute top-[calc(100%+8px)] right-0 left-0 z-[5] flex flex-col gap-[2px] rounded-[20px] border bg-white p-2 shadow-[0_18px_40px_-20px_rgba(20,18,16,0.45)]">
          {suggestions.slice(0, 5).map((g) => (
            <Link
              key={g.slug}
              href={`/produit/${g.slug}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQ("");
                setFocus(false);
              }}
              className="text-ink! hover:text-ink! hover:bg-cream flex items-center gap-3 rounded-[12px] p-2 no-underline"
            >
              <span className="h-11 w-11 flex-none overflow-hidden rounded-[10px]" style={{ background: g.bg ?? "#E9E2D3" }}>
                {g.imageUrl ? (
                  <span aria-hidden="true" className="block h-full w-full" style={{ background: `${cssUrl(g.imageUrl)} center/cover no-repeat` }} />
                ) : null}
              </span>
              <span className="flex-1 text-[14px] leading-[1.3]">{g.name}</span>
              <strong className="text-[14px] whitespace-nowrap">{fmtXof(g.price)}</strong>
            </Link>
          ))}
          {!suggestions.length ? <span className="text-muted p-[10px] text-[14px]">{t("none")}</span> : null}
          {suggestions.length ? (
            <div className="border-border mt-1 flex flex-wrap gap-2 border-t px-1 pt-[10px] pb-1">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={submit}
                className="bg-ink text-cream min-h-11 cursor-pointer rounded-full border-0 px-[14px] py-[10px] text-[13px] font-semibold"
              >
                {t("all", { count: suggestions.length })}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
