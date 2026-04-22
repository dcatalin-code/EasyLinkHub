import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

function AuthOrb({ size = 420, top = 0, left = 0, opacity = 1, blur = 0, color = "rgba(202,54,115,0.18)" }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        width: size,
        height: size,
        top,
        left,
        borderRadius: "50%",
        background: color,
        filter: `blur(${blur}px)`,
        opacity,
        pointerEvents: "none",
      }}
    />
  );
}

function EyeIcon({ open = false }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 12s3.5-6 9-6c2.1 0 3.92.67 5.42 1.63M21 12s-3.5 6-9 6c-2.1 0-3.92-.67-5.42-1.63"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const isLogin = mode === "login";

  const title = useMemo(() => {
    return isLogin ? "Welcome back" : "Create your account";
  }, [isLogin]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;
        setMessage("Account created. Check your email if confirmation is enabled.");
      }
    } catch (err) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        .authShell {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 28px;
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(900px 520px at 12% 10%, rgba(105, 168, 255, 0.20), transparent 60%),
            radial-gradient(820px 480px at 88% 18%, rgba(185, 120, 255, 0.14), transparent 60%),
            radial-gradient(920px 560px at 50% 100%, rgba(100, 255, 214, 0.08), transparent 55%),
            linear-gradient(160deg, var(--bg), var(--bg));
        }

        .authGrid {
          width: min(1120px, 100%);
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(380px, 420px);
          gap: 18px;
          align-items: stretch;
          position: relative;
          z-index: 1;
        }

        .authPanel,
        .authCard {
          position: relative;
          overflow: hidden;
          border-radius: 28px;
          border: 1px solid color-mix(in srgb, var(--stroke) 82%, white 18%);
          background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.035));
          box-shadow:
            0 24px 80px rgba(0,0,0,0.28),
            inset 0 1px 0 rgba(255,255,255,0.06);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }

        .authPanel {
          min-height: 680px;
          padding: 34px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .authCard {
          padding: 28px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .authEyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          width: fit-content;
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.05);
          color: var(--muted);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .authHeroTitle {
          margin: 18px 0 0;
          font-size: clamp(36px, 5vw, 58px);
          line-height: 0.98;
          letter-spacing: -0.04em;
        }

        .authHeroText {
          margin: 18px 0 0;
          max-width: 560px;
          color: var(--muted);
          font-size: 16px;
          line-height: 1.7;
        }

        .authFeatureGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-top: 28px;
        }

        .authFeature {
          padding: 16px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
        }

        .authFeatureValue {
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .authFeatureLabel {
          margin-top: 6px;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.5;
        }

        .authQuote {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 26px;
          padding: 18px;
          border-radius: 22px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
        }

        .authQuoteText {
          margin: 0;
          font-size: 15px;
          line-height: 1.7;
          color: rgba(255,255,255,0.88);
        }

        .authQuoteMeta {
          color: var(--muted);
          font-size: 12px;
        }

        .authLogo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 46px;
          height: 46px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.10);
          background: linear-gradient(135deg, rgba(122,31,128,0.32), rgba(202,54,115,0.22));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.10);
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.04em;
        }

        .authTopRow {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .authBrandText {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .authBrandName {
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .authBrandSub {
          color: var(--muted);
          font-size: 12px;
        }

        .authCardTitle {
          margin: 0;
          font-size: 34px;
          line-height: 1.04;
          letter-spacing: -0.04em;
        }

        .authCardText {
          margin: 10px 0 0;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.6;
        }

        .authModeWrap {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          padding: 6px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          margin-top: 24px;
        }

        .authModeBtn {
          height: 42px;
          border-radius: 12px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--muted);
          font-weight: 700;
          cursor: pointer;
          transition: all 160ms ease;
        }

        .authModeBtnActive {
          color: var(--text);
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.10);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
        }

        .authForm {
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin-top: 22px;
        }

        .authField {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .authLabel {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--muted);
        }

        .authInput,
        .authPasswordWrap {
          width: 100%;
          min-height: 52px;
          border-radius: 16px;
          border: 1px solid color-mix(in srgb, var(--stroke) 82%, white 18%);
          background: rgba(255,255,255,0.04);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
          transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
        }

        .authInput {
          padding: 0 16px;
          color: var(--text);
          outline: none;
        }

        .authInput::placeholder,
        .authPasswordInput::placeholder {
          color: var(--muted);
        }

        .authInput:focus,
        .authPasswordWrap:focus-within {
          border-color: rgba(202,54,115,0.34);
          box-shadow: 0 0 0 3px rgba(202,54,115,0.12), inset 0 1px 0 rgba(255,255,255,0.05);
          background: rgba(255,255,255,0.05);
        }

        .authPasswordWrap {
          display: flex;
          align-items: center;
          overflow: hidden;
          padding: 0 8px 0 0;
        }

        .authPasswordInput {
          flex: 1;
          min-width: 0;
          height: 50px;
          border: 0;
          outline: 0;
          background: transparent;
          padding: 0 16px;
          color: var(--text);
        }

        .authToggleBtn {
          height: 36px;
          min-width: 36px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.08);
          background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04));
          color: var(--text);
          cursor: pointer;
          transition: background 160ms ease, border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          flex: 0 0 auto;
          white-space: nowrap;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
        }

        .authToggleBtn:hover {
          background: linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06));
          border-color: rgba(255,255,255,0.14);
          transform: translateY(-1px);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.08),
            0 8px 18px rgba(0,0,0,0.12);
        }

        .authToggleBtn:active {
          transform: translateY(0);
        }

        .authToggleText {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.01em;
        }

        .authAlert {
          padding: 13px 14px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.55;
          border: 1px solid transparent;
        }

        .authAlertError {
          color: #fecaca;
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.18);
        }

        .authAlertSuccess {
          color: #bbf7d0;
          background: rgba(34,197,94,0.12);
          border-color: rgba(34,197,94,0.18);
        }

        .authSubmit {
          height: 54px;
          border: 1px solid rgba(202,54,115,0.34);
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(122,31,128,0.95), rgba(202,54,115,0.92));
          color: white;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -0.01em;
          cursor: pointer;
          box-shadow: 0 20px 34px rgba(122,31,128,0.22);
          transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
        }

        .authSubmit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 24px 42px rgba(122,31,128,0.28);
        }

        .authSubmit:disabled {
          opacity: 0.72;
          cursor: not-allowed;
        }

        .authFooterNote {
          margin-top: 16px;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.6;
          text-align: center;
        }

        @media (max-width: 980px) {
          .authGrid {
            grid-template-columns: 1fr;
          }

          .authPanel {
            min-height: auto;
            padding: 24px;
          }

          .authFeatureGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .authShell {
            padding: 16px;
          }

          .authCard,
          .authPanel {
            border-radius: 24px;
          }

          .authCard {
            padding: 22px;
          }

          .authPanel {
            padding: 22px;
          }

          .authToggleText {
            display: none;
          }

          .authToggleBtn {
            min-width: 40px;
            padding: 0;
          }
        }
      `}</style>

      <div className="authShell">
        <AuthOrb size={440} top={-130} left={-120} blur={22} color="rgba(96,165,250,0.14)" />
        <AuthOrb size={360} top={120} left={"72%"} blur={26} color="rgba(202,54,115,0.14)" />
        <AuthOrb size={320} top={"74%"} left={"18%"} blur={28} color="rgba(16,185,129,0.10)" />

        <div className="authGrid">
          <section className="authPanel">
            <div>
              <div className="authTopRow">
                <div className="authLogo">C</div>
                <div className="authBrandText">
                  <div className="authBrandName">CRM Pro</div>
                  <div className="authBrandSub">Client operations, deals, planning</div>
                </div>
              </div>

              <div className="authEyebrow" style={{ marginTop: 26 }}>
                Production workspace
              </div>

              <h1 className="authHeroTitle">Run your client pipeline from one polished workspace.</h1>

              <p className="authHeroText">
                Manage clients, tasks, budgets, invoices, goals, calendar work, and notes in a single secure CRM environment with a clean premium interface.
              </p>

              <div className="authFeatureGrid">
                <div className="authFeature">
                  <div className="authFeatureValue">All-in-one</div>
                  <div className="authFeatureLabel">Clients, tasks, invoices, budget, calendar, and notes together.</div>
                </div>
                <div className="authFeature">
                  <div className="authFeatureValue">Secure access</div>
                  <div className="authFeatureLabel">Protected sign-in flow with persistent authenticated sessions.</div>
                </div>
                <div className="authFeature">
                  <div className="authFeatureValue">Fast workflow</div>
                  <div className="authFeatureLabel">Built for daily execution without clutter or visual noise.</div>
                </div>
              </div>
            </div>

            <div className="authQuote">
              <p className="authQuoteText">
                “A professional control center for client work. Clear structure, strong focus, and no wasted motion.”
              </p>
              <div className="authQuoteMeta">Designed for modern CRM operations</div>
            </div>
          </section>

          <section className="authCard">
            <div>
              <h2 className="authCardTitle">{title}</h2>
              <p className="authCardText">
                {isLogin
                  ? "Sign in to access your CRM workspace and continue where you left off."
                  : "Create a secure account to start using your CRM workspace."}
              </p>
            </div>

            <div className="authModeWrap">
              <button
                type="button"
                className={`authModeBtn ${isLogin ? "authModeBtnActive" : ""}`}
                onClick={() => {
                  setMode("login");
                  setError("");
                  setMessage("");
                }}
              >
                Login
              </button>
              <button
                type="button"
                className={`authModeBtn ${!isLogin ? "authModeBtnActive" : ""}`}
                onClick={() => {
                  setMode("signup");
                  setError("");
                  setMessage("");
                }}
              >
                Sign up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="authForm">
              <label className="authField">
                <span className="authLabel">Email</span>
                <input
                  className="authInput"
                  type="email"
                  placeholder="name@company.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>

              <label className="authField">
                <span className="authLabel">Password</span>
                <div className="authPasswordWrap">
                  <input
                    className="authPasswordInput"
                    type={showPassword ? "text" : "password"}
                    placeholder={isLogin ? "Enter your password" : "Create a secure password"}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="authToggleBtn"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    <EyeIcon open={showPassword} />
                    <span className="authToggleText">{showPassword ? "Hide" : "Show"}</span>
                  </button>
                </div>
              </label>

              {error ? <div className="authAlert authAlertError">{error}</div> : null}
              {message ? <div className="authAlert authAlertSuccess">{message}</div> : null}

              <button type="submit" className="authSubmit" disabled={loading}>
                {loading ? "Please wait..." : isLogin ? "Login to workspace" : "Create account"}
              </button>
            </form>

            <div className="authFooterNote">
              {isLogin
                ? "Use your registered account credentials to access the CRM securely."
                : "After signup, email confirmation may be required depending on your project settings."}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}