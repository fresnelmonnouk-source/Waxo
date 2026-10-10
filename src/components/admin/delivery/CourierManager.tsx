"use client";

import { useState } from "react";
import {
  createCourierAction,
  deleteCourierAction,
  setCourierActiveAction,
  updateCourierAction,
} from "@/app/admin/(panel)/livraisons/actions";
import type { CourierCard } from "@/lib/orders/delivery";
import { fmtXof, initials, plural, prettyPhone, ZONE_SHORT } from "@/lib/orders/format";
import type { Zone } from "@/lib/orders/types";
import { btnDark, btnLine, btnLinkText, fieldInput } from "../orders/ui";
import { useAdminAction } from "../orders/useAdminAction";

function CourierItem({ c, connected }: { c: CourierCard; connected: boolean }) {
  const { run, pending, toast } = useAdminAction();
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [form, setForm] = useState({ name: c.name, phone: prettyPhone(c.phone), zone: c.zone as Zone });
  const [err, setErr] = useState("");
  const disabled = pending || !connected;

  function save() {
    setErr("");
    run(
      async () => {
        const res = await updateCourierAction({ courierId: c.id, ...form });
        if (!res.ok) setErr(res.message);
        return res;
      },
      "Livreur modifié.",
      () => setEditing(false),
    );
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-[18px] border border-[#E2DCCF] p-4"
      style={{ opacity: c.active ? 1 : 0.55 }}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex size-[38px] flex-none items-center justify-center rounded-full bg-[#141210] text-[13px] font-bold text-[#FFC93C]">
          {initials(c.name)}
        </span>
        <div className="flex min-w-0 flex-col">
          <strong className="text-sm">{c.name}</strong>
          <span className="text-xs text-[#4A443C]">
            {ZONE_SHORT[c.zone]} · {prettyPhone(c.phone)}
          </span>
        </div>
      </div>
      <span className="text-[13px]">
        {plural(c.inRoad, "en cours", "en cours")} · {plural(c.delivered30, "livrée", "livrées")} sur 30 jours
      </span>
      {c.codDue > 0 ? <span className="text-[13px] font-semibold text-[#8A5A00]">À encaisser : {fmtXof(c.codDue)}</span> : null}

      {editing ? (
        <div className="flex flex-col gap-2">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            aria-label={`Nom de ${c.name}`}
            maxLength={80}
            className={fieldInput}
          />
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            aria-label={`Téléphone de ${c.name}`}
            inputMode="tel"
            maxLength={30}
            className={fieldInput}
          />
          <select
            value={form.zone}
            onChange={(e) => setForm({ ...form, zone: e.target.value as Zone })}
            aria-label={`Zone de ${c.name}`}
            className={fieldInput}
          >
            <option value="cotonou">Cotonou &amp; Calavi</option>
            <option value="autre">Autres villes</option>
          </select>
          {err ? (
            <span role="alert" className="text-[13px] text-[#C2410C]">
              {err}
            </span>
          ) : null}
          <div className="flex gap-2">
            <button type="button" disabled={disabled} onClick={save} className={btnDark}>
              Enregistrer
            </button>
            <button type="button" onClick={() => setEditing(false)} className={btnLine}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {c.routeHref ? (
            <a
              href={c.routeHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-10 items-center rounded-full bg-[#1F6B4A] px-3.5 text-xs font-semibold text-white no-underline hover:bg-[#185A3E] hover:text-white"
            >
              Envoyer la tournée
            </a>
          ) : null}
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              run(() => setCourierActiveAction({ courierId: c.id, active: !c.active }), c.active ? "Livreur mis en pause." : "Livreur réactivé.")
            }
            className={`${btnLine} text-xs`}
          >
            {c.active ? "Mettre en pause" : "Réactiver"}
          </button>
          <button type="button" disabled={!connected} onClick={() => setEditing(true)} className={`${btnLine} text-xs`}>
            Modifier
          </button>
          {confirmDel ? (
            <>
              <button
                type="button"
                disabled={disabled}
                onClick={() => run(() => deleteCourierAction({ courierId: c.id }), "Livreur supprimé.", () => setConfirmDel(false))}
                className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-[#9A3412] px-3.5 text-xs font-semibold text-[#9A3412] hover:bg-[#F6E1DA]"
              >
                Confirmer la suppression
              </button>
              <button type="button" onClick={() => setConfirmDel(false)} className={`${btnLinkText} min-h-10`}>
                Garder
              </button>
            </>
          ) : (
            <button type="button" disabled={!connected} onClick={() => setConfirmDel(true)} className={`${btnLinkText} min-h-10`}>
              Supprimer
            </button>
          )}
        </div>
      )}
      {toast}
    </div>
  );
}

/** Section « Livreurs » (maquette lignes 234-256) : cartes, tournée WhatsApp, pause, modification, ajout. */
export function CourierManager({ couriers, connected }: { couriers: CourierCard[]; connected: boolean }) {
  const { run, pending, toast } = useAdminAction();
  const [f, setF] = useState<{ name: string; phone: string; zone: Zone }>({ name: "", phone: "", zone: "cotonou" });
  const [err, setErr] = useState("");

  function add() {
    setErr("");
    run(
      async () => {
        const res = await createCourierAction(f);
        if (!res.ok) setErr(res.message);
        return res;
      },
      "Livreur ajouté.",
      () => setF({ name: "", phone: "", zone: "cotonou" }),
    );
  }

  return (
    <section className="flex flex-col gap-3.5 rounded-[22px] bg-white p-5" aria-label="Livreurs">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="m-0 text-[17px]">Livreurs</h2>
        <span className="text-[13px] text-[#4A443C]">
          La tournée envoyée sur WhatsApp liste les adresses, téléphones et montants à encaisser.
        </span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3">
        {couriers.map((c) => (
          <CourierItem key={c.id} c={c} connected={connected} />
        ))}
      </div>
      <form
        className="flex flex-wrap items-center gap-2 border-t border-[#F0EBE1] pt-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          value={f.name}
          onChange={(e) => {
            setF({ ...f, name: e.target.value });
            setErr("");
          }}
          aria-label="Nom du livreur"
          placeholder="Nom du livreur"
          maxLength={80}
          className={`${fieldInput} flex-[1_1_180px]`}
        />
        <input
          value={f.phone}
          onChange={(e) => {
            setF({ ...f, phone: e.target.value });
            setErr("");
          }}
          inputMode="tel"
          aria-label="Téléphone du livreur"
          placeholder="Téléphone (01…)"
          maxLength={30}
          className={`${fieldInput} flex-[1_1_150px]`}
        />
        <select
          value={f.zone}
          onChange={(e) => setF({ ...f, zone: e.target.value as Zone })}
          aria-label="Zone"
          className={fieldInput}
        >
          <option value="cotonou">Cotonou &amp; Calavi</option>
          <option value="autre">Autres villes</option>
        </select>
        <button type="submit" disabled={pending || !connected} className={`${btnDark} min-h-[42px]`}>
          Ajouter un livreur
        </button>
      </form>
      {err ? (
        <span role="alert" className="text-[13px] text-[#C2410C]">
          {err}
        </span>
      ) : null}
      {toast}
    </section>
  );
}
