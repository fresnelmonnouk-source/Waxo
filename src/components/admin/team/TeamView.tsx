"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addAdmin, revokeAdmin } from "@/app/admin/(panel)/equipe/actions";
import { ACTION_LABEL, normalizeEmail, type TeamData } from "@/lib/admin/team";
import { borderOf, btnDark, btnLine, cardCls, errCls, fieldCls, labelCls, useToast } from "../settings/ui";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Porto-Novo" });

/** Équipe d'administration : liste des admins, ajout par e-mail (compte existant ou invitation), retrait, historique. */
export function TeamView({ data }: { data: TeamData }) {
  const router = useRouter();
  const { show, node } = useToast();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | undefined>();

  const add = () => {
    const clean = normalizeEmail(email);
    if (!clean) return setErr("Adresse e-mail invalide.");
    setErr(undefined);
    start(async () => {
      const res = await addAdmin(clean);
      if (res.ok) {
        setEmail("");
        show(
          res.invited
            ? `Invitation envoyée à ${clean}. L'accès sera actif dès qu'elle aura choisi son mot de passe.`
            : `${clean} est administrateur. Par sécurité, elle doit choisir un nouveau mot de passe via le lien reçu par e-mail.`,
        );
        router.refresh();
      } else setErr(res.message);
    });
  };

  const revoke = (id: string, who: string) => {
    if (!window.confirm(`Retirer l'accès administrateur de ${who} ? Son compte client est conservé.`)) return;
    start(async () => {
      const res = await revokeAdmin(id);
      show(res.ok ? `Accès administrateur retiré à ${who}.` : res.message);
      if (res.ok) router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {data.source === "error" ? (
        <p role="alert" className="m-0 rounded-2xl border border-[#F2C6A8] bg-[#FDF0E6] p-4 text-sm">
          Impossible de lire l&apos;équipe pour le moment. Rechargez la page dans un instant.
        </p>
      ) : null}

      <form
        className={`${cardCls} max-w-[640px] gap-3`}
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        aria-labelledby="team-add-title"
      >
        <h2 id="team-add-title" className="m-0 text-[17px] font-bold">
          Ajouter un administrateur
        </h2>
        <p className="m-0 text-[13px] text-text">
          Si la personne a déjà un compte sur la boutique, elle devient administratrice et reçoit, par sécurité, un lien pour choisir un nouveau mot
          de passe. Sinon, elle reçoit une invitation par e-mail pour créer son compte. Un administrateur a accès à tout le back-office, et chaque
          ajout ou retrait est signalé par e-mail à toute l&apos;équipe.
        </p>
        <label className={labelCls}>
          Adresse e-mail
          <input
            type="email"
            inputMode="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!err}
            aria-describedby={err ? "team-add-err" : undefined}
            className={`${fieldCls} ${borderOf(err)}`}
            placeholder="prenom@exemple.com"
          />
          {err ? (
            <span id="team-add-err" className={errCls}>
              {err}
            </span>
          ) : null}
        </label>
        <div>
          <button type="submit" disabled={pending || data.source !== "db"} className={`${btnDark} min-h-[46px] px-5`}>
            {pending ? "Patientez…" : "Ajouter"}
          </button>
        </div>
      </form>

      <section className={`${cardCls} gap-1`} aria-labelledby="team-list-title">
        <h2 id="team-list-title" className="m-0 mb-2 text-[17px] font-bold">
          Administrateurs ({data.members.length})
        </h2>
        <ul className="m-0 flex list-none flex-col p-0">
          {data.members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EEE9DE] py-3 first:border-t-0">
              <div className="flex min-w-0 flex-col">
                <strong className="truncate text-[15px]">
                  {m.name}
                  {m.isMe ? <span className="font-normal text-text"> (vous)</span> : null}
                </strong>
                <span className="truncate text-[13px] text-text">{m.email || "e-mail introuvable"}</span>
                <span className="text-[12px] text-text">
                  {m.status === "invited" ? "Invitation envoyée, pas encore acceptée" : m.lastSignInAt ? `Dernière connexion : ${fmtDate(m.lastSignInAt)}` : ""}
                </span>
              </div>
              {m.isMe ? null : (
                <button type="button" disabled={pending} onClick={() => revoke(m.id, m.email || m.name)} className={`${btnLine} min-h-[44px] px-4 text-[14px]`}>
                  Retirer l&apos;accès
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {data.events.length > 0 ? (
        <section className={`${cardCls} gap-1`} aria-labelledby="team-log-title">
          <h2 id="team-log-title" className="m-0 mb-2 text-[17px] font-bold">
            Historique
          </h2>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px]">
            {data.events.map((e, i) => (
              <li key={`${e.at}-${i}`}>
                <span className="text-text">{fmtDate(e.at)} · </span>
                {e.actorEmail} {ACTION_LABEL[e.action]} {e.targetEmail}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {node}
    </div>
  );
}
