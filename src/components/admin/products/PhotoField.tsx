"use client";

import { useId, useRef, useState } from "react";
import { decodeImageFile } from "@/lib/media/client";
import { PhotoCropper } from "./PhotoCropper";

/** Aperçu 120 px + choix de photo (recadrage carré → envoi). Maquette 627-636. `word` = mot affiché sans photo. */
export function PhotoField({
  imageUrl,
  bg,
  word,
  onChange,
}: {
  imageUrl: string | null;
  bg: string;
  word: string;
  onChange: (url: string | null) => void;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [error, setError] = useState("");

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    const res = await decodeImageFile(file);
    if (res.ok) setBitmap(res.bitmap);
    else setError(res.message);
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div
        className="relative flex h-[120px] w-[120px] flex-none items-center justify-center overflow-hidden rounded-[18px]"
        style={{ background: bg }}
      >
        <span className="font-display text-[15px] font-semibold opacity-75">{word}</span>
        {imageUrl && (
          <div
            role="img"
            aria-label="Aperçu"
            className="absolute inset-0 h-full w-full"
            style={{ background: `url("${imageUrl}") center/cover no-repeat` }}
          />
        )}
      </div>
      <div className="flex flex-col items-start gap-2">
        <label
          htmlFor={inputId}
          className="flex min-h-11 cursor-pointer items-center rounded-full bg-[#141210] px-4 text-[13px] font-semibold text-[#F4F1EA] hover:bg-[#2C2823]"
        >
          {imageUrl ? "Changer la photo" : "Choisir une photo"}
        </label>
        <input
          ref={fileRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            void pick(f);
          }}
        />
        {imageUrl && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="min-h-11 cursor-pointer border-0 bg-transparent p-0 text-[13px] underline underline-offset-[3px]"
          >
            Retirer la photo
          </button>
        )}
        <span className="max-w-[240px] text-xs leading-[1.4] text-[#4A443C]">
          JPG, PNG ou WebP. Vous recadrez en carré, l&apos;image est redimensionnée automatiquement.
        </span>
        {error && (
          <span role="alert" className="text-xs text-[#C2410C]">
            {error}
          </span>
        )}
      </div>
      {bitmap && (
        <PhotoCropper
          bitmap={bitmap}
          onCancel={() => {
            bitmap.close(); // libère la mémoire du décodage (pas dans un effet : StrictMode le rejouerait)
            setBitmap(null);
          }}
          onDone={(url) => {
            bitmap.close();
            setBitmap(null);
            onChange(url);
          }}
        />
      )}
    </div>
  );
}
