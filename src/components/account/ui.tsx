"use client";

import { useId, useSyncExternalStore, type InputHTMLAttributes, type ReactNode } from "react";

/** Primitives visuelles des écrans compte / contact / suivi (valeurs reprises à l'identique de la maquette). */

export { BTN_BASE, BTN_DARK, BTN_SUN, BTN_OUTLINE, EYEBROW, H1_DISPLAY, inputClass } from "./styles";
import { inputClass } from "./styles";

export function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "onChange" | "value"> & {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  bg?: "cream" | "white";
};

/** Libellé + champ + message d'erreur (l'emplacement du message est toujours présent, comme dans la maquette). */
export function TextField({ label, value, onChange, error, bg = "cream", ...rest }: TextFieldProps) {
  const errId = useId();
  return (
    <label className="flex min-w-0 flex-col gap-[6px] text-[14px] font-medium">
      {label}
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={errId}
        className={inputClass(!!error, bg)}
      />
      <span id={errId} aria-live="polite" className="text-[13px] font-normal text-terracotta-deep">
        {error}
      </span>
    </label>
  );
}

/** Champ mot de passe avec bouton Afficher/Masquer. */
export function PasswordField({
  label,
  value,
  onChange,
  error,
  show,
  onToggle,
  showLabel,
  hideLabel,
  bg = "cream",
  ...rest
}: Omit<TextFieldProps, "type"> & { show: boolean; onToggle: () => void; showLabel: string; hideLabel: string }) {
  const errId = useId();
  return (
    <label className="flex min-w-0 flex-col gap-[6px] text-[14px] font-medium">
      {label}
      <div
        className={`flex overflow-hidden rounded-[14px] border ${bg === "cream" ? "bg-[#FAF8F3]" : "bg-white"} ${error ? "border-terracotta-deep" : "border-border"}`}
      >
        <input
          {...rest}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={errId}
          className="min-w-0 flex-1 border-0 bg-transparent px-[14px] py-[13px] text-[16px] font-normal text-ink outline-none"
        />
        <button
          type="button"
          onClick={onToggle}
          className="min-w-11 cursor-pointer border-0 bg-transparent px-[14px] text-[13px] font-medium text-text"
        >
          {show ? hideLabel : showLabel}
        </button>
      </div>
      <span id={errId} aria-live="polite" className="text-[13px] font-normal text-terracotta-deep">
        {error}
      </span>
    </label>
  );
}

/** Case à cocher 24 px de la maquette (rôle checkbox, opérable au clavier car c'est un vrai bouton). */
export function Checkbox({
  checked,
  onChange,
  children,
  align = "center",
  small = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  align?: "center" | "start";
  small?: boolean;
}) {
  return (
    <div className={`flex gap-3 ${align === "start" ? "items-start" : "items-center"} ${small ? "text-[14px]" : "text-[15px]"} min-h-11`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`flex h-11 w-11 flex-none cursor-pointer items-center justify-center border-0 bg-transparent p-0 ${align === "start" ? "-mt-[10px]" : ""} -mr-[10px] -ml-[10px]`}
      >
        <span
          aria-hidden="true"
          className={`flex h-6 w-6 items-center justify-center rounded-[7px] border-2 border-ink text-[14px] font-bold text-sun ${checked ? "bg-ink" : "bg-transparent"}`}
        >
          {checked ? "✓" : ""}
        </span>
      </button>
      <span
        className={`${small ? "leading-[1.45]" : ""} min-w-0 cursor-pointer`}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) return; // un clic sur un lien ne coche pas la case
          onChange(!checked);
        }}
      >
        {children}
      </span>
    </div>
  );
}

/** Champ piège anti-robot : invisible, hors tabulation, jamais rempli par un humain. */
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>
        Website
        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}
