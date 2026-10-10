"use client";

import { useEffect } from "react";

export type NoticeState = { kind: "ok" | "error"; text: string } | null;

/** Message d'action (succès ou erreur), annoncé aux lecteurs d'écran ; le succès disparaît après 4 s. */
export function Notice({ notice, onClear }: { notice: NoticeState; onClear: () => void }) {
  useEffect(() => {
    if (!notice || notice.kind !== "ok") return;
    const t = setTimeout(onClear, 4000);
    return () => clearTimeout(t);
  }, [notice, onClear]);
  if (!notice) return null;
  return (
    <p
      role={notice.kind === "error" ? "alert" : "status"}
      className={`m-0 rounded-xl px-3 py-2 text-[13px] leading-[1.45] ${notice.kind === "error" ? "bg-[#F6E1DA] text-[#9A3412]" : "bg-[#E5EFE7] text-[#1F6B4A]"}`}
    >
      {notice.text}
    </p>
  );
}

/** URL d'image sûre pour un `background-image` inline (https ou chemin du site uniquement). */
export function safeCssUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (!/^(https:\/\/|\/)[^\s"'()\\]+$/.test(url)) return undefined;
  return `url("${url}")`;
}
