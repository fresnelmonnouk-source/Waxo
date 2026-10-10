"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Comportement commun des tiroirs : fermeture (Échap, croix, fond) en retirant `paramKey` de l'URL, focus sur la croix,
 * focus piégé dans le tiroir, défilement de la page bloqué, focus rendu à l'élément d'origine.
 */
export function useDrawer(paramKey: string, fallbackPath: string) {
  const router = useRouter();
  const pathname = usePathname() ?? fallbackPath;
  const params = useSearchParams();
  const closeRef = useRef<HTMLButtonElement>(null);
  const asideRef = useRef<HTMLElement>(null);

  const p = new URLSearchParams(params.toString());
  p.delete(paramKey);
  const qs = p.toString();
  const href = qs ? `${pathname}?${qs}` : pathname;

  const hrefRef = useRef(href);
  useEffect(() => {
    hrefRef.current = href;
  }, [href]);

  const close = () => router.push(href, { scroll: false });

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        router.push(hrefRef.current, { scroll: false });
        return;
      }
      if (e.key !== "Tab" || !asideRef.current) return;
      const f = Array.from(
        asideRef.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled]),select:not([disabled]),input:not([disabled])"),
      );
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [router]);

  return { close, closeRef, asideRef };
}
