"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { ensureMe, useMe } from "@/lib/auth/client";
import { safeInternalPath } from "@/lib/auth/validation";
import { AuthForm } from "./AuthForm";

/** Pages /connexion et /inscription : même formulaire que la fenêtre modale, en pleine page (liens d'e-mail, accès direct). */
export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const t = useTranslations("Auth.page");
  const router = useRouter();
  const params = useSearchParams();
  const { status, user } = useMe();
  const next = safeInternalPath(params.get("next")) ?? "/compte";

  useEffect(() => {
    ensureMe();
  }, []);
  // Déjà connecté : inutile de rester sur la page de connexion.
  useEffect(() => {
    if (status === "ready" && user) router.replace(next);
  }, [status, user, next, router]);

  const login = mode === "login";
  return (
    <div className="flex max-w-[560px] flex-col gap-4 rounded-[28px] bg-white p-8">
      <h1 className="font-display m-0 text-[32px] font-semibold tracking-[-0.03em]">{login ? t("loginTitle") : t("signupTitle")}</h1>
      <p className="m-0 text-[16px] leading-[1.55] text-text">{login ? t("loginIntro") : t("signupIntro")}</p>
      {params.get("error") === "link" ? (
        <div role="alert" className="rounded-[14px] bg-[#FBEFC9] px-[14px] py-3 text-[14px] leading-[1.5]">
          {t("linkError")}
        </div>
      ) : null}
      <AuthForm key={mode} initialMode={mode} variant="page" onSuccess={() => router.push(next)} />
      <span className="text-[14px] text-text">
        {login ? t("noAccount") : t("haveAccount")}{" "}
        <Link href={login ? "/inscription" : "/connexion"} className="font-semibold">
          {login ? t("signupTitle") : t("loginTitle")}
        </Link>
      </span>
    </div>
  );
}
