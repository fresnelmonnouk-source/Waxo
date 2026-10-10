"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPackActive, setPacksMenuEnabled } from "@/app/admin/(panel)/packs/actions";
import { fmtXof } from "@/lib/money";
import { SourceNotice, useToast } from "../products/ui";
import { packSavings, packStock } from "../products/logic";
import type { AdminPack, PacksData } from "../products/types";
import { PackDrawer } from "./PackDrawer";

/** Liste des packs : contenu, prix, économie vs somme des produits, stock vendable, visibilité. Même langage visuel que les produits. */
export function PacksView({ data }: { data: PacksData }) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ pack: AdminPack | null } | null>(null);
  const [activeOver, setActiveOver] = useState<Record<string, boolean>>({});
  const [, start] = useTransition();
  const [toast, show] = useToast();

  const [menuOn, setMenuOn] = useState(data.menuEnabled);

  const toggleMenu = () => {
    const next = !menuOn;
    setMenuOn(next);
    start(async () => {
      const res = await setPacksMenuEnabled(next);
      if (res.ok) show(next ? "Menu Packs affiché sur la boutique." : "Menu Packs masqué : la page Packs n'est plus accessible.");
      else {
        setMenuOn(!next);
        show(res.message);
      }
    });
  };

  const byId = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products]);

  const toggle = (p: AdminPack) => {
    const on = activeOver[p.id] ?? p.active;
    setActiveOver((s) => ({ ...s, [p.id]: !on }));
    start(async () => {
      const res = await setPackActive(p.id, !on);
      if (res.ok) show(on ? "Pack masqué de la boutique." : "Pack de nouveau en ligne.");
      else {
        setActiveOver((s) => {
          const next = { ...s };
          delete next[p.id];
          return next;
        });
        show(res.message);
      }
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <SourceNotice source={data.source} truncated={data.truncated} noun="packs" />

      <div className="flex flex-col gap-1 rounded-2xl border border-[#E2DCCF] bg-white px-4 py-1.5">
        <button
          type="button"
          role="switch"
          aria-checked={menuOn}
          onClick={toggleMenu}
          className="flex min-h-[52px] w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent p-0 text-left text-sm"
        >
          <span className="flex flex-col gap-0.5">
            <strong>Afficher le menu « Packs » sur la boutique</strong>
            <span className="text-xs text-[#4A443C]">
              {menuOn
                ? "Actif : lien dans le menu, page Packs et fiches visibles, packs achetables."
                : "Désactivé : lien retiré, page Packs introuvable, packs retirés des paniers. Vos packs sont conservés."}
            </span>
          </span>
          <span aria-hidden="true" className="relative h-[26px] w-11 flex-none rounded-full transition-colors duration-200" style={{ background: menuOn ? "#1F6B4A" : "#C9C1B2" }}>
            <span className="absolute top-[3px] h-5 w-5 rounded-full bg-white transition-[left] duration-200" style={{ left: menuOn ? 21 : 3 }} />
          </span>
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="max-w-[560px] text-sm text-[#4A443C]">
          Un pack regroupe plusieurs produits à un prix unique. Le stock d&apos;un pack est celui de son produit le plus limitant.
        </span>
        <button
          type="button"
          onClick={() => setEditing({ pack: null })}
          className="min-h-[46px] cursor-pointer rounded-full border-0 bg-[#141210] px-5 font-semibold text-[#F4F1EA] hover:bg-[#2C2823]"
        >
          + Créer un pack
        </button>
      </div>

      <div className="flex flex-col gap-2" role="list">
        {data.packs.length === 0 && (
          <p className="m-0 rounded-2xl border border-[#E2DCCF] bg-white p-5 text-sm text-[#4A443C]">Aucun pack pour l&apos;instant.</p>
        )}
        {data.packs.map((p) => {
          const active = activeOver[p.id] ?? p.active;
          const sav = packSavings(p.items, p.price, byId);
          const stock = packStock(p.items, byId);
          const contents = p.items
            .map((i) => `${i.qty > 1 ? `${i.qty} × ` : ""}${byId.get(i.productId)?.name ?? "produit introuvable"}`)
            .join(" · ");
          return (
            <div
              key={p.id}
              role="listitem"
              className="flex flex-wrap items-center gap-x-[18px] gap-y-2.5 rounded-2xl border border-[#E2DCCF] bg-white px-3.5 py-2.5"
            >
              <div
                className="relative h-[52px] w-[52px] flex-none overflow-hidden rounded-[12px]"
                style={{ background: "#F3E3A6", opacity: active ? 1 : 0.55 }}
              >
                {p.imageUrl && (
                  <div aria-hidden="true" className="absolute inset-0 h-full w-full" style={{ background: `url("${p.imageUrl}") center/cover no-repeat` }} />
                )}
              </div>
              <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                <strong className="text-sm">{p.fr.name}</strong>
                <span className="text-xs leading-[1.4] text-[#4A443C]">{contents || "Pack vide"}</span>
              </div>
              <div className="flex min-w-[110px] flex-col">
                <strong className="text-sm">{fmtXof(p.price)}</strong>
                <span className="text-xs text-[#4A443C] line-through">{sav.total > 0 ? fmtXof(sav.total) : ""}</span>
              </div>
              <span
                className="rounded-full px-2.5 py-1 text-xs font-semibold"
                style={
                  sav.saving > 0
                    ? { background: "#E5EFE7", color: "#1F6B4A" }
                    : { background: "#F6E1DA", color: "#9A3412" }
                }
              >
                {sav.saving > 0 ? `Économie ${fmtXof(sav.saving)} (${sav.pct} %)` : "Aucune économie"}
              </span>
              <span className="min-w-[84px] text-xs" style={{ color: stock <= 0 ? "#9A3412" : stock <= 5 ? "#C2410C" : "#4A443C" }}>
                {stock <= 0 ? "Indisponible" : `${stock} vendable${stock > 1 ? "s" : ""}`}
              </span>
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
                onClick={() => setEditing({ pack: p })}
                className="min-h-11 cursor-pointer rounded-full border border-[#D6CFC0] bg-transparent px-3.5 text-[13px] hover:bg-[#F4F1EA]"
              >
                Modifier
              </button>
            </div>
          );
        })}
      </div>

      {editing && (
        <PackDrawer
          key={editing.pack?.id ?? "new"}
          pack={editing.pack}
          products={data.products}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            setActiveOver({});
            show(message);
            router.refresh();
          }}
        />
      )}
      {toast}
    </div>
  );
}
