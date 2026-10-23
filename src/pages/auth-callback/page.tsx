import { useEffect, useRef, useState } from "react";
import { subjectOf } from "@/lib/session-subject.ts";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LocaleSwitcher from "@/components/ui/locale-switcher.tsx";
import { useProfile } from "@/contexts/profile-context.tsx";
import { setLocalUserId } from "@/lib/local-user.ts";
import { routeAfterIdentity } from "@/lib/post-auth-routing.ts";
import { supabase } from "@/lib/supabase-client.ts";
import { listUserRolesForUser, upsertSupabaseUser as callUpsertSupabaseUser } from "@/lib/backend.ts";

type Status = "checking" | "error";

// Shared landing page for every Supabase redirect flow — OAuth
// (signInWithOAuth), magic link, and Enterprise SSO all bounce back here.
// signInWithOAuth's "provider not configured" failure in particular can only
// ever be observed here (Supabase's server responds after the browser has
// already left the app), not in the button click handler that started it.
export default function AuthCallback() {
  const { t } = useTranslation("common");
  const { lng = "en" } = useParams<{ lng?: string }>();
  const base = `/${lng}`;
  const navigate = useNavigate();
  const { setProfile } = useProfile();
  const [status, setStatus] = useState<Status>("checking");
  const settledRef = useRef(false);

  useEffect(() => {
    // Failures come back as a query param for most flows, but some GoTrue
    // error paths still use the hash fragment — check both before waiting on
    // anything.
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errorDescription =
      params.get("error_description") || hashParams.get("error_description") ||
      params.get("error") || hashParams.get("error");
    if (errorDescription) {
      setStatus("error");
      return;
    }

    const finish = async (userId: string, name: string) => {
      if (settledRef.current) return;
      settledRef.current = true;
      setLocalUserId(userId);
      const roles = await listUserRolesForUser(userId);
      routeAfterIdentity({ userId, roles, navigate, base, setProfile, displayName: name });
    };

    const resolveFromSession = async (
      session: { user: { id: string; email?: string; user_metadata?: Record<string, unknown> } } | null,
    ) => {
      if (!session?.user?.email || settledRef.current) return;
      const meta = session.user.user_metadata ?? {};
      // Provider-supplied name fields vary: Google/Facebook use "name" or
      // "full_name" depending on flow, GitHub uses "user_name"/"full_name".
      // Apple only ever supplies a name on the very first authorization.
      const name =
        (typeof meta.full_name === "string" && meta.full_name) ||
        (typeof meta.name === "string" && meta.name) ||
        undefined;
      const { userId, name: resolvedName } = await callUpsertSupabaseUser({
        supabaseUserId: subjectOf(session) ?? "",
        email: session.user.email,
        name,
      });
      await finish(userId, resolvedName);
    };

    // getSession() is safe to await immediately: the client's init promise
    // (which does the URL/PKCE session detection) resolves first internally.
    // onAuthStateChange is the reactive backstop for the same event — the
    // settledRef guard keeps a double-fire from double-routing.
    void supabase.auth.getSession().then(({ data }) => resolveFromSession(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") void resolveFromSession(session);
    });

    const timeout = setTimeout(() => {
      if (!settledRef.current) setStatus("error");
    }, 8000);

    return () => {
      subscription.subscription.unsubscribe();
      clearTimeout(timeout);
    };
    // Intentionally runs once on mount — this page exists only to process
    // the single redirect that landed on it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="min-h-screen relative flex flex-col items-center justify-center gap-6 px-8"
      style={{ backgroundColor: "#F7FAF8" }}
    >
      <div className="absolute top-5 right-6">
        <LocaleSwitcher />
      </div>
      {status === "checking" ? (
        <>
          <div className="w-10 h-10 rounded-full border-4 border-[#E4EAF0] border-t-[#0E7FB0] animate-spin" />
          <p className="text-[13.5px] text-[#66798F]">{t("authCallback.checking")}</p>
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <h1 className="font-bold text-[20px] text-[#0A2F5C]" style={{ fontFamily: "'Sora', sans-serif" }}>
            {t("authCallback.errorHeadline")}
          </h1>
          <p className="text-[13.5px] leading-relaxed text-[#66798F]">
            {t("authCallback.errorSubtitle")}
          </p>
          <button
            type="button"
            onClick={() => navigate(`${base}/signin`)}
            className="rounded-2xl text-white font-bold text-[14px] text-center px-6 py-3 cursor-pointer"
            style={{
              background: "linear-gradient(90deg,#78B72E 0%,#17927E 55%,#0E7FB0 100%)",
              fontFamily: "'Sora', sans-serif",
            }}
          >
            {t("register.backToSignin")}
          </button>
        </div>
      )}
    </div>
  );
}
