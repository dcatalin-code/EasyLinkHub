import { cloneElement, isValidElement, useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import AuthPage from "./AuthPage";

function AccessLoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(900px 520px at 12% 10%, rgba(105,168,255,0.14), transparent 60%), radial-gradient(820px 480px at 88% 18%, rgba(185,120,255,0.10), transparent 60%), linear-gradient(160deg, var(--bg), var(--bg))",
      }}
    >
      <div
        style={{
          width: "min(460px, 100%)",
          borderRadius: 28,
          border: "1px solid color-mix(in srgb, var(--stroke) 82%, white 18%)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.035))",
          boxShadow: "0 24px 80px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.06)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          padding: 28,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: "3px solid rgba(255,255,255,0.12)",
            borderTopColor: "rgba(202,54,115,0.92)",
            animation: "authGateSpin 0.9s linear infinite",
          }}
        />
        <div style={{ marginTop: 18, fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em" }}>
          Checking workspace access
        </div>
        <div style={{ marginTop: 8, color: "var(--muted)", lineHeight: 1.65 }}>
          Please wait while we validate your subscription.
        </div>

        <style>{`
          @keyframes authGateSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

function buildFallbackAccess() {
  return {
    status: "expired",
    access: "restricted",
    isRestricted: true,
    expiresAt: null,
    trialEndsAt: null,
    currentPeriodEnd: null,
  };
}

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined);
  const [access, setAccess] = useState(null);
  const [loadingAccess, setLoadingAccess] = useState(true);

  const loadAccess = useCallback(async () => {
    setLoadingAccess(true);

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData?.session?.access_token) {
      setAccess(buildFallbackAccess());
      setLoadingAccess(false);
      return;
    }

    const accessToken = sessionData.session.access_token;

    const { data, error } = await supabase.functions.invoke("check-access", {
      body: {},
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (error || !data) {
      setAccess(buildFallbackAccess());
      setLoadingAccess(false);
      return;
    }

    setAccess(data);
    setLoadingAccess(false);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;

      const nextSession = data.session ?? null;
      setSession(nextSession);

      if (!nextSession?.user?.id) {
        setAccess(null);
        setLoadingAccess(false);
        return;
      }

      loadAccess();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);

      if (!nextSession?.user?.id) {
        setAccess(null);
        setLoadingAccess(false);
        return;
      }

      loadAccess();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadAccess]);

  if (session === undefined || loadingAccess) return <AccessLoadingScreen />;
  if (!session) return <AuthPage />;

  if (isValidElement(children)) {
    return cloneElement(children, { access });
  }

  return children;
}
