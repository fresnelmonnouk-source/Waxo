"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustStock, setProductActive, setProductStock } from "@/app/admin/(panel)/produits/actions";
import { fmtXof } from "@/lib/money";
import { ProductDrawer } from "./ProductDrawer";
import { SourceNotice, useToast } from "./ui";
import { STOCK_COLOR, LOW_STOCK, parseAmount, stockTone } from "./logic";
import type { AdminProduct, ProductsData } from "./types";

type Override = { stock?: number; active?: boolean };

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("fr-FR")} ${n > 1 ? many : one}`;

/** Liste des produits (maquette 156-178) : recherche, rayon, stock rapide, visibilité, tiroir d'édition. */
export function ProductsView({ data }: { data: ProductsData }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [editing, setEditing] = useState<{ product: AdminProduct | null } | null>(null);
  const [over, setOver] = useState<Record<string, Override>>({});
  const [, start] = useTransition();
  const [toast, show] = useToast();

  const catLabel = useMemo(() => new Map(data.categories.map((c) => [c.id, c.label])), [data.categories]);
  const view = (p: AdminProduct) => ({ stock: over[p.id]?.stock ?? p.stock, active: over[p.id]?.active ?? p.active });

  const list = useMemo(() => {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    return data.products.filter((p) => {
      if (cat !== "all" && p.categoryId !== cat) return false;
      if (!terms.length) return true;
      const hay = norm(`${p.fr.name} ${p.en?.name ?? ""} ${p.keyword} ${p.fr.slug}`);
      return terms.every((t) => hay.includes(t));
    });
  }, [data.products, q, cat]);

  const patch = (id: string, o: Override | null) =>
    setOver((s) => {
      const next = { ...s };
      if (o) next[id] = { ...next[id], ...o };
      else delete next[id];
      return next;
    });

  const revert = (id: string, key: keyof Override, message: string) => {
    setOver((s) => {
      const next = { ...s };
      const cur = { ...next[id] };
      delete cur[key];
      if (Object.keys(cur).length) next[id] = cur;
      else delete next[id];
      return next;
    });
    show(message);
  };

  const step = (p: AdminProduct, delta: number) => {
    const cur = view(p).stock;
    const next = Math.max(0, cur + delta);
    if (next === cur) return;
    patch(p.id, { stock: next });
    start(async () => {
      const res = await adjustStock(p.id, delta);
      if (res.ok) patch(p.id, { stock: res.stock });
      else revert(p.id, "stock", res.message);
    });
  };

  const setStock = (p: AdminProduct, raw: string) => {
    const n = parseAmount(raw);
    const cur = view(p).stock;
    if (n === null || n > 100_000) {
      show("Stock invalide.");
      patch(p.id, { stock: cur });
      return;
    }
    if (n === cur) return;
    patch(p.id, { stock: n });
    start(async () => {
      const res = await setProductStock(p.id, n);
      if (res.ok) patch(p.id, { stock: res.stock });
      else revert(p.id, "stock", res.message);
    });
  };

  const toggle = (p: AdminProduct) => {
    const on = view(p).active;
    patch(p.id, { active: !on });
    start(async () => {
      const res = await setProductActive(p.id, !on);
      if (res.ok) show(on ? "Produit masqué de la boutique." : "Produit de nouveau en ligne.");
      else revert(p.id, "active", res.message);
    });
  };

  const low = data.products.filter((p) => view(p).stock <= LOW_STOCK).length;

  return (
    <div className="flex flex-col gap-5">
      <SourceNotice source={data.source} truncated={data.truncated} noun="produits" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-[#4A443C]">
          {plural(data.products.length, "produit", "produits")} · {low} en stock faible
        </span>
        <button
          type="button"
          onClick={() => setEditing({ product: null })}
          className="min-h-[46px] cursor-pointer rounded-full border-0 bg-[#141210] px-5 font-semibold text-[#F4F1EA] hover:bg-[#2C2823]"
        >
          + Ajouter un produit
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Rechercher un produit"
          placeholder="Rechercher un produit"
          className="min-h-[42px] min-w-0 flex-[1_1_240px] rounded-full border border-[#D6CFC0] bg-white px-4 text-sm"
        />
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          aria-label="Catégorie"
          className="min-h-[42px] cursor-pointer rounded-full border border-[#D6CFC0] bg-white px-3.5 text-sm"
        >
          <option value="all">Toutes les catégories</option>
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2" role="list">
        {list.length === 0 && (
          <p className="m-0 rounded-2xl border border-[#E2DCCF] bg-white p-5 text-sm text-[#4A443C]">
            {data.products.length === 0 ? "Aucun produit pour l'instant." : "Aucun produit ne correspond à votre recherche."}
          </p>
        )}
        {list.map((p) => {
          const { stock, active } = view(p);
          const tone = stockTone(stock);
          const reviews = p.rating.count ? `${p.rating.average.toFixed(1).replace(".", ",")} (${p.rating.count})` : "aucun avis";
          return (
            <div
              key={p.id}
              role="listitem"
              className="flex flex-wrap items-center gap-x-[18px] gap-y-2.5 rounded-2xl border border-[#E2DCCF] bg-white px-3.5 py-2.5"
            >
              <div
                className="relative h-[52px] w-[52px] flex-none overflow-hidden rounded-[12px]"
                style={{ background: p.bg ?? "#EDE4CF", opacity: active ? 1 : 0.55 }}
              >
                {p.imageUrl && (
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full"
                    style={{ background: `url("${p.imageUrl}") center/cover no-repeat` }}
                  />
                )}
              </div>
              <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
                <strong className="text-sm">{p.fr.name}</strong>
                <span className="text-xs text-[#4A443C]">
                  {catLabel.get(p.categoryId) ?? p.categoryId} · {plural(p.sold, "vendu", "vendus")} · note {reviews}
                </span>
              </div>
              <div className="flex min-w-[100px] flex-col">
                <strong className="text-sm">{fmtXof(p.price)}</strong>
                {p.comparePrice ? <span className="text-xs text-[#4A443C] line-through">{fmtXof(p.comparePrice)}</span> : null}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => step(p, -1)}
                  aria-label={`Retirer une unité de ${p.fr.name}`}
                  className="h-11 w-11 cursor-pointer rounded-full border border-[#D6CFC0] bg-white text-base"
                >
                  −
                </button>
                <input
                  key={`${p.id}-${stock}`}
                  defaultValue={String(stock)}
                  inputMode="numeric"
                  aria-label={`Stock de ${p.fr.name}`}
                  onBlur={(e) => setStock(p, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  className="min-h-11 w-[58px] rounded-[10px] border bg-white px-1 py-2 text-center text-sm font-bold"
                  style={{ borderColor: stock <= LOW_STOCK ? "#C2410C" : "#E2DCCF", color: STOCK_COLOR[tone] }}
                />
                <button
                  type="button"
                  onClick={() => step(p, 1)}
                  aria-label={`Ajouter une unité à ${p.fr.name}`}
                  className="h-11 w-11 cursor-pointer rounded-full border border-[#D6CFC0] bg-white text-base"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={active}
                aria-label={`Visible en boutique : ${p.fr.name}`}
                onClick={() => toggle(p)}
                className="min-h-11 min-w-[84px] cursor-pointer rounded-full border-0 px-3 text-xs font-semibold"
                style={{ background: active ? "#E5EFE7" : "#E2DCCF", color: active ? "#1F6B4A" : "#4A443C" }}
              >
                {active ? "En ligne" : "Masqué"}
              </button>
              <button
                type="button"
                onClick={() => setEditing({ product: p })}
                className="min-h-11 cursor-pointer rounded-full border border-[#D6CFC0] bg-transparent px-3.5 text-[13px] hover:bg-[#F4F1EA]"
              >
                Modifier
              </button>
            </div>
          );
        })}
      </div>

      {editing && (
        <ProductDrawer
          key={editing.product?.id ?? "new"}
          product={editing.product}
          categories={data.categories}
          onClose={() => setEditing(null)}
          onSaved={(message, id) => {
            if (id) patch(id, null);
            setEditing(null);
            show(message);
            router.refresh();
          }}
        />
      )}
      {toast}
    </div>
  );
}
