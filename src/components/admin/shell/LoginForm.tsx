"use client";

import { useEffect, useId, useState } from "react";
import { api, errorCode } from "@/lib/auth/client";

const ERRORS: Record<string, string> = {
  invalidCredentials: "Identifiants incorrects ou compte sans accès administrateur.",
  invalid: "Renseignez votre identifiant et votre mot de passe.",
  rateLimited: "Trop de tentatives. Réessayez dans quelques minutes.",
  unavailable: "Service momentanément indisponible. Réessayez dans un instant.",
  emailNotConfirmed: "Cette adresse e-mail n'est pas encore confirmée.",
  network: "Connexion impossible : vérifiez votre réseau.",
  generic: "Connexion impossible pour le moment. Réessayez.",
};

type Me = { role?: string; firstName?: string } | null;

async function readMe(): Promise<Me> {
  const res = await api("/api/me", "GET");
  const user = res.data?.user;
  return user && typeof user === "object" ? (user as Me) : null;
}

const fieldClass = "rounded-[14px] border border-[#E2DCCF] bg-white px-3.5 py-[13px] text-base font-normal";

/** Connexion administrateur : POST /api/auth/login (e-mail OU téléphone + mot de passe), puis contrôle du rôle via GET /api/me. */
export function LoginForm() {
  const uid = useId();
  const [id, setId] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notAdmin, setNotAdmin] = useState<string | null>(null);

  // Connecté avec un compte client (ex. depuis la boutique) : on l'explique au lieu de rester muet.
  useEffect(() => {
    let alive = true;
    void readMe().then((me) => {
      if (alive && me && me.role !== "admin") setNotAdmin(me.firstName ?? "");
    });
    return () => {
      alive = false;
    };
  }, []);

  async function submit() {
    if (busy) return;
    setError("");
    setBusy(true);
    const res = await api("/api/auth/login", "POST", { id, password: pass, website: "" });
    if (res.status !== 200 || res.data?.ok !== true) {
      setBusy(false);
      setError(ERRORS[errorCode(res)] ?? ERRORS.generic);
      return;
    }
    const me = await readMe();
    if (me?.role === "admin") {
      // Navigation complète voulue : le cookie de session vient d'être posé, le serveur doit relire la session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/admin");
      return;
    }
    setBusy(false);
    setPass("");
    setNotAdmin(me?.firstName ?? "");
  }

  async function signOutClient() {
    await api("/api/auth/logout", "POST");
    setNotAdmin(null);
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      {notAdmin !== null && (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-xl bg-[#FBEFC9] px-3 py-2.5 text-sm leading-[1.45]">
          <span>
            {notAdmin ? `Vous êtes connecté avec le compte client de ${notAdmin}.` : "Vous êtes connecté avec un compte client."} Connectez-vous avec un compte
            administrateur.
          </span>
          <button type="button" onClick={signOutClient} className="min-h-11 cursor-pointer border-0 bg-transparent p-0 text-sm underline underline-offset-[3px]">
            Se déconnecter du compte client
          </button>
        </div>
      )}
      <label htmlFor={`${uid}-id`} className="flex flex-col gap-1.5 text-sm font-medium">
        E-mail ou téléphone
        <input id={`${uid}-id`} value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" className={fieldClass} />
      </label>
      <label htmlFor={`${uid}-pw`} className="flex flex-col gap-1.5 text-sm font-medium">
        Mot de passe
        <input
          id={`${uid}-pw`}
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          autoComplete="current-password"
          className={fieldClass}
        />
      </label>
      {/* Champ piège anti-robots (la route d'authentification le contrôle). */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" defaultValue="" />
      {error && (
        <span role="alert" className="text-sm font-medium text-[#C2410C]">
          {error}
        </span>
      )}
      <button
        type="submit"
        disabled={busy}
        className="h-[52px] cursor-pointer rounded-full border-0 bg-[#141210] text-base font-semibold text-[#F4F1EA] hover:bg-[#2C2823] disabled:cursor-wait disabled:opacity-70"
      >
        {busy ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
