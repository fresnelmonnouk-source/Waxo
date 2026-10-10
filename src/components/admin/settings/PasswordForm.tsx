"use client";

import { useState, useTransition } from "react";
import { changePasswordAction } from "@/app/admin/(panel)/reglages/actions";
import { borderOf, cardCls, errCls, fieldCls, labelCls, useToast } from "./ui";

export function PasswordForm({ email }: { email: string }) {
  const { show, node } = useToast();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [errs, setErrs] = useState<{ current?: string; next?: string }>({});

  function submit() {
    const e: { current?: string; next?: string } = {};
    if (!current) e.current = "Mot de passe incorrect.";
    if (next.length < 8) e.next = "8 caractères minimum.";
    if (e.current || e.next) return setErrs(e);
    startTransition(async () => {
      try {
        const res = await changePasswordAction({ current, next });
        if (res.ok) {
          setCurrent("");
          setNext("");
          setErrs({});
          show("Mot de passe modifié.");
        } else {
          setErrs({ current: res.fieldErrors?.current, next: res.fieldErrors?.next });
          show(res.message);
        }
      } catch {
        show("Une erreur est survenue. Réessayez.");
      }
    });
  }

  return (
    <form
      className={`${cardCls} gap-3 max-w-[560px]`}
      aria-labelledby="pw-title"
      onSubmit={(ev) => {
        ev.preventDefault();
        submit();
      }}
      noValidate
    >
      <h2 id="pw-title" className="m-0 text-[17px]">
        Compte administrateur
      </h2>
      <span className="text-[13px] text-text">Connecté en tant que {email}</span>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
        <label className={labelCls}>
          Mot de passe actuel
          <input
            type="password"
            value={current}
            onChange={(e) => {
              setCurrent(e.target.value);
              setErrs({});
            }}
            autoComplete="current-password"
            maxLength={200}
            aria-invalid={errs.current ? true : undefined}
            className={`${fieldCls} ${borderOf(errs.current)}`}
          />
          {errs.current ? <span className={errCls}>{errs.current}</span> : null}
        </label>
        <label className={labelCls}>
          Nouveau mot de passe
          <input
            type="password"
            value={next}
            onChange={(e) => {
              setNext(e.target.value);
              setErrs({});
            }}
            autoComplete="new-password"
            placeholder="8 caractères minimum"
            maxLength={72}
            aria-invalid={errs.next ? true : undefined}
            className={`${fieldCls} ${borderOf(errs.next)}`}
          />
          {errs.next ? <span className={errCls}>{errs.next}</span> : null}
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="self-start border border-ink bg-transparent rounded-full px-[18px] min-h-[44px] font-semibold cursor-pointer hover:bg-cream disabled:opacity-60"
      >
        {pending ? "Modification…" : "Changer le mot de passe"}
      </button>
      {node}
    </form>
  );
}
