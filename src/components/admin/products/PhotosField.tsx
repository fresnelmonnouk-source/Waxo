"use client";

/* eslint-disable @next/next/no-img-element -- aperçus du back-office : URL publiques du bucket, pas d'optimiseur Vercel */
import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { decodeImageFile } from "@/lib/media/client";
import { MAX_PRODUCT_IMAGES, appendImages, makeCover, moveImage, remainingSlots, removeImageAt } from "@/lib/media/product-images";
import { PhotoCropper } from "./PhotoCropper";

type Crop = { bitmap: ImageBitmap; pos: number; total: number; key: number };
type Focus = { url: string | null; action: "left" | "right" | "remove" | "cover" | "add" };

const ADD_CLASS =
  "flex min-h-11 cursor-pointer items-center rounded-full bg-[#141210] px-4 text-[13px] font-semibold text-[#F4F1EA] hover:bg-[#2C2823] peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#141210]";

function IconButton({
  label,
  action,
  disabled,
  onClick,
  children,
}: {
  label: string;
  action: Focus["action"];
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-action={action}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-full border border-[#D6CFC0] bg-white p-0 text-[15px] leading-none text-[#141210] hover:bg-[#F4F1EA] disabled:cursor-default disabled:opacity-35"
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}

/**
 * Photos d'un produit (jusqu'à 8, migration 0024). Ajout de plusieurs fichiers d'un coup : chaque photo passe par le
 * recadrage carré existant (PhotoCropper), l'une après l'autre. Ordre modifiable par les flèches ← → (clavier) ou en
 * glissant une vignette (souris). La PREMIÈRE photo est la photo principale (cartes, panier, partage).
 * `word` = mot affiché sans photo. `max` = 1 tant que la colonne `images` n'existe pas.
 */
export function PhotosField({
  images,
  bg,
  word,
  max = MAX_PRODUCT_IMAGES,
  error,
  onChange,
}: {
  images: string[];
  bg: string;
  word: string;
  max?: number;
  error?: string;
  onChange: (images: string[]) => void;
}) {
  const inputId = useId();
  const helpId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const focusAfter = useRef<Focus | null>(null);
  const dragFrom = useRef<number | null>(null);
  const cropKey = useRef(0);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [queue, setQueue] = useState<File[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [live, setLive] = useState("");
  const [dragging, setDragging] = useState<number | null>(null);

  const slots = remainingSlots(images, max);
  const n = images.length;

  // Après un déplacement ou un retrait : le focus reste sur la même photo (ou sur le bouton d'ajout).
  useEffect(() => {
    const f = focusAfter.current;
    if (!f) return;
    focusAfter.current = null;
    if (f.action === "add" || !f.url) {
      inputRef.current?.focus();
      return;
    }
    const item = Array.from(listRef.current?.querySelectorAll<HTMLElement>("li[data-url]") ?? []).find((li) => li.dataset.url === f.url);
    const target =
      item?.querySelector<HTMLButtonElement>(`button[data-action="${f.action}"]:not(:disabled)`) ??
      item?.querySelector<HTMLButtonElement>("button[data-action]:not(:disabled)");
    target?.focus();
  }, [images]);

  /** Décode les fichiers un par un et ouvre le recadrage du premier lisible ; les illisibles sont signalés et passés. */
  const openNext = async (files: File[], total: number) => {
    let rest = files;
    while (rest.length) {
      const [file, ...others] = rest;
      const res = await decodeImageFile(file);
      if (res.ok) {
        cropKey.current += 1;
        setCrop({ bitmap: res.bitmap, pos: total - others.length, total, key: cropKey.current });
        setQueue(others);
        return;
      }
      setNotes((list) => [...list, `« ${file.name} » : ${res.message}`]);
      rest = others;
    }
    setCrop(null);
    setQueue([]);
  };

  const pick = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    const msgs: string[] = [];
    if (slots === 0) {
      setNotes([`${max} photo${max > 1 ? "s" : ""} au maximum : retirez-en une pour en ajouter.`]);
      return;
    }
    const taken = files.slice(0, slots);
    if (files.length > slots) {
      const skipped = files.length - slots;
      msgs.push(`${skipped} photo${skipped > 1 ? "s" : ""} non ajoutée${skipped > 1 ? "s" : ""} : ${max} au maximum.`);
    }
    setNotes(msgs);
    void openNext(taken, taken.length);
  };

  const closeCrop = () => {
    crop?.bitmap.close(); // libère la mémoire du décodage (pas dans un effet : StrictMode le rejouerait)
    setCrop(null);
  };

  const apply = (next: string[], message: string, focus: Focus | null) => {
    focusAfter.current = focus;
    setLive(message);
    onChange(next);
  };

  const move = (from: number, to: number, action: Focus["action"]) => {
    if (to < 0 || to >= n || from === to) return;
    apply(moveImage(images, from, to), `Photo déplacée en position ${to + 1} sur ${n}.${to === 0 ? " C'est la photo principale." : ""}`, {
      url: images[from],
      action,
    });
  };

  const remove = (i: number) => {
    const next = removeImageAt(images, i);
    const neighbour = next[Math.min(i, next.length - 1)] ?? null;
    apply(next, `Photo ${i + 1} retirée.${i === 0 && next.length ? " La suivante devient la photo principale." : ""}`, {
      url: neighbour,
      action: neighbour ? "remove" : "add",
    });
  };

  const onDrop = (e: DragEvent<HTMLLIElement>, to: number) => {
    e.preventDefault();
    const from = dragFrom.current;
    dragFrom.current = null;
    setDragging(null);
    if (from === null || from === to) return;
    apply(moveImage(images, from, to), `Photo déplacée en position ${to + 1} sur ${n}.${to === 0 ? " C'est la photo principale." : ""}`, null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2 text-sm font-medium">
        <span id={`${helpId}-title`}>Photos</span>
        <span className="text-xs font-normal text-[#4A443C]">
          {n} / {max}
        </span>
      </div>

      {n === 0 ? (
        <div
          className="relative flex h-[120px] w-[120px] flex-none items-center justify-center overflow-hidden rounded-[18px]"
          style={{ background: bg }}
          aria-hidden="true"
        >
          <span className="font-display text-[15px] font-semibold opacity-75">{word}</span>
        </div>
      ) : (
        <ul ref={listRef} aria-labelledby={`${helpId}-title`} className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2.5 p-0">
          {images.map((url, i) => (
            <li
              key={url}
              data-url={url}
              draggable={n > 1}
              onDragStart={(e) => {
                dragFrom.current = i;
                setDragging(i);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(i));
              }}
              onDragOver={(e) => {
                if (dragFrom.current === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => onDrop(e, i)}
              onDragEnd={() => {
                dragFrom.current = null;
                setDragging(null);
              }}
              className="flex flex-col gap-1.5 rounded-[14px] border border-[#E2DCCF] bg-white p-1.5"
              style={{ opacity: dragging === i ? 0.45 : 1, cursor: n > 1 ? "grab" : undefined }}
            >
              <div className="relative aspect-square overflow-hidden rounded-[10px]" style={{ background: bg }}>
                <img
                  src={url}
                  alt={`Photo ${i + 1} sur ${n}${i === 0 ? ", photo principale" : ""}`}
                  width={120}
                  height={120}
                  draggable={false}
                  className="h-full w-full object-cover"
                />
                {i === 0 ? (
                  <span aria-hidden="true" className="absolute top-1.5 left-1.5 rounded-full bg-[#141210] px-2 py-0.5 text-[11px] font-semibold text-[#F4F1EA]">
                    Principale
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-1">
                <IconButton label={`Déplacer la photo ${i + 1} vers la gauche`} action="left" disabled={i === 0} onClick={() => move(i, i - 1, "left")}>
                  ←
                </IconButton>
                <IconButton label={`Retirer la photo ${i + 1}`} action="remove" onClick={() => remove(i)}>
                  ✕
                </IconButton>
                <IconButton label={`Déplacer la photo ${i + 1} vers la droite`} action="right" disabled={i === n - 1} onClick={() => move(i, i + 1, "right")}>
                  →
                </IconButton>
              </div>
              {i > 0 ? (
                <button
                  type="button"
                  data-action="cover"
                  onClick={() => apply(makeCover(images, i), `Photo ${i + 1} devenue la photo principale.`, { url, action: "left" })}
                  className="min-h-8 cursor-pointer rounded-full border-0 bg-transparent px-1 text-[12px] underline underline-offset-[3px]"
                >
                  Mettre en principale
                </button>
              ) : (
                <span className="flex min-h-8 items-center justify-center text-[12px] text-[#4A443C]">Photo principale</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col items-start gap-2">
        <div className="flex items-center">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple={slots > 1}
            disabled={slots === 0 || crop !== null}
            aria-describedby={helpId}
            className="peer sr-only"
            onChange={(e) => {
              const files = e.target.files;
              pick(files);
              e.target.value = "";
            }}
          />
          <label htmlFor={inputId} className={`${ADD_CLASS} ${slots === 0 ? "pointer-events-none opacity-50" : ""}`}>
            {slots === 0 ? `${max} photo${max > 1 ? "s" : ""} au maximum` : n ? "Ajouter des photos" : max > 1 ? "Choisir des photos" : "Choisir une photo"}
          </label>
        </div>
        <span id={helpId} className="max-w-[420px] text-xs leading-[1.4] text-[#4A443C]">
          JPG, PNG ou WebP{max > 1 ? `, ${max} photos au maximum (plusieurs à la fois possible)` : ""}. Chaque photo est recadrée en carré et
          redimensionnée automatiquement.{max > 1 ? " La première est la photo principale (cartes, panier, partage) ; changez l'ordre avec les flèches ou en glissant une photo." : ""}
        </span>
        {max < MAX_PRODUCT_IMAGES ? (
          <span className="max-w-[420px] text-xs leading-[1.4] text-[#4A443C]">
            Une seule photo pour l&apos;instant : la migration 0024 permet d&apos;en mettre jusqu&apos;à {MAX_PRODUCT_IMAGES}.
          </span>
        ) : null}
        {notes.map((m) => (
          <span key={m} role="alert" className="text-xs text-[#C2410C]">
            {m}
          </span>
        ))}
        {error ? (
          <span role="alert" className="text-xs text-[#C2410C]">
            {error}
          </span>
        ) : null}
        <span className="sr-only" aria-live="polite">
          {live}
        </span>
      </div>

      {crop && (
        <PhotoCropper
          key={crop.key}
          bitmap={crop.bitmap}
          title={crop.total > 1 ? `Recadrer la photo ${crop.pos} sur ${crop.total}` : "Recadrer la photo"}
          cancelLabel={queue.length ? "Passer cette photo" : "Annuler"}
          onCancel={() => {
            const rest = queue;
            closeCrop();
            if (rest.length) void openNext(rest, crop.total);
          }}
          onDone={(url) => {
            const rest = queue;
            closeCrop();
            const { list, dropped } = appendImages(images, [url], max);
            if (dropped) setNotes((m) => [...m, `${max} photos au maximum : cette photo n'a pas été ajoutée.`]);
            else apply(list, `Photo ajoutée : ${list.length} sur ${max}.`, null);
            if (rest.length) void openNext(rest, crop.total);
          }}
        />
      )}
    </div>
  );
}
