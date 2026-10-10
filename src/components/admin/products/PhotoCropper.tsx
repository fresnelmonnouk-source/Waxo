"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { clampPan, computeCropRect, MAX_ZOOM, MIN_ZOOM, type CropState } from "@/lib/media/crop";
import { cropToBlob, uploadProductImage } from "@/lib/media/client";
import { useDialogA11y } from "./ui";

const VIEW = 280; // côté de la fenêtre de recadrage (px écran)

/**
 * Recadrage carré d'une photo : on glisse pour cadrer, le curseur zoome, puis l'image est recadrée (canvas),
 * réduite à 1200 px max, encodée en WebP (repli JPEG) et envoyée. Aucune URL blob : le bitmap est dessiné directement.
 */
export function PhotoCropper({
  bitmap,
  onCancel,
  onDone,
}: {
  bitmap: ImageBitmap;
  onCancel: () => void;
  onDone: (url: string) => void;
}) {
  const [state, setState] = useState<CropState>({ zoom: 1, panX: 0, panY: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const dialogRef = useDialogA11y<HTMLDivElement>(onCancel);

  // Dessin de l'aperçu (net sur écrans haute densité).
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = VIEW * dpr;
    canvas.height = VIEW * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#EDE4CF";
    ctx.fillRect(0, 0, VIEW, VIEW);
    const rect = computeCropRect(bitmap.width, bitmap.height, VIEW, state);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, rect.sx, rect.sy, rect.side, rect.side, 0, 0, VIEW, VIEW);
    // Repères des tiers
    ctx.strokeStyle = "rgba(255,255,255,.7)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const k of [VIEW / 3, (2 * VIEW) / 3]) {
      ctx.moveTo(k, 0);
      ctx.lineTo(k, VIEW);
      ctx.moveTo(0, k);
      ctx.lineTo(VIEW, k);
    }
    ctx.stroke();
  }, [bitmap, state]);

  const move = (dx: number, dy: number) =>
    setState((s) => clampPan(bitmap.width, bitmap.height, VIEW, { ...s, panX: s.panX + dx, panY: s.panY + dy }));
  const setZoom = (zoom: number) => setState((s) => clampPan(bitmap.width, bitmap.height, VIEW, { ...s, zoom }));

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, panX: state.panX, panY: state.panY };
  };
  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d) return;
    // Le glisser déplace l'image : le décalage du centre suit le doigt.
    setState((s) => clampPan(bitmap.width, bitmap.height, VIEW, { ...s, panX: d.panX + (e.clientX - d.x), panY: d.panY + (e.clientY - d.y) }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const step = 12;
    const map: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const m = map[e.key];
    if (m) {
      e.preventDefault();
      move(m[0], m[1]);
    } else if (e.key === "+" || e.key === "=") setZoom(Math.min(MAX_ZOOM, state.zoom + 0.1));
    else if (e.key === "-") setZoom(Math.max(MIN_ZOOM, state.zoom - 0.1));
  };

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      const blob = await cropToBlob(bitmap, VIEW, state);
      const res = await uploadProductImage(blob);
      if (res.ok) onDone(res.url);
      else setError(res.message);
    } catch (e) {
      setError(e instanceof Error && e.message === "too_large" ? "Image trop lourde après recadrage." : "Impossible de traiter cette image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5" style={{ background: "rgba(20,18,16,.5)" }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Recadrer la photo"
        className="flex w-[min(360px,100%)] flex-col gap-3.5 rounded-3xl bg-[#F4F1EA] p-5"
      >
        <strong className="font-display text-[17px] font-semibold">Recadrer la photo</strong>
        <canvas
          ref={canvasRef}
          tabIndex={0}
          role="img"
          aria-label="Zone de recadrage. Glissez ou utilisez les flèches pour déplacer l'image, plus et moins pour zoomer."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          className="mx-auto cursor-grab rounded-[14px] border border-[#E2DCCF] active:cursor-grabbing"
          style={{ width: VIEW, height: VIEW, touchAction: "none", maxWidth: "100%" }}
        />
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Zoom
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={state.zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="min-h-6 w-full accent-[#141210]"
          />
        </label>
        <span className="text-xs leading-[1.4] text-[#4A443C]">
          Carré, 1 200 px maximum, converti en WebP. Les JPG, PNG et WebP sont acceptés.
        </span>
        {error && (
          <span role="alert" className="text-[13px] font-medium text-[#C2410C]">
            {error}
          </span>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="min-h-11 cursor-pointer rounded-full border-0 bg-[#141210] px-[18px] font-semibold text-[#F4F1EA] hover:bg-[#2C2823] disabled:opacity-60"
          >
            {busy ? "Envoi…" : "Utiliser cette photo"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-11 cursor-pointer rounded-full border border-[#D6CFC0] bg-transparent px-[18px]"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
