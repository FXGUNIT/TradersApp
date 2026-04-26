import React, { useEffect, useState } from "react";
import {
  clearDraftSync,
  readDraftSync,
  writeDraftSync,
} from "../../services/draftVault.js";
import {
  clearPendingGoogleFormData,
  markRedirectInProgress,
} from "../identity/authFlowStorage.js";
import { CSS_VARS } from "../../styles/cssVars.js";
import { useTheme } from "../../hooks/useTheme.jsx";
import { BlogSection } from "../../components/BlogSection.jsx";

function GoogleLogo() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20.64 11.224C20.64 10.416 20.576 9.824 20.432 9.2H10.88V12.944H16.304C16.064 14.192 15.424 15.152 14.432 15.776V17.744H17.792C19.696 16.048 20.64 13.648 20.64 11.224Z"
        fill="#4285F4"
      />
      <path
        d="M10.88 20.288C13.536 20.288 15.744 19.296 17.792 17.744L14.432 15.776C13.536 16.352 12.384 16.736 10.88 16.736C8.128 16.736 5.856 14.976 4.992 12.48H2.48V14.544C4.224 17.888 7.648 20.288 10.88 20.288Z"
        fill="#34A853"
      />
      <path
        d="M4.992 12.48C4.688 11.68 4.528 10.816 4.528 9.92C4.528 9.024 4.688 8.16 4.992 7.36V5.296H2.48C1.696 6.848 1.28 8.608 1.28 10.464C1.28 12.32 1.696 14.08 2.48 15.632L4.992 12.48Z"
        fill="#FBBC05"
      />
      <path
        d="M10.88 4.104C12.384 4.096 13.76 4.64 14.88 5.76L17.888 2.752C15.744 0.96 12.976 0 10.88 0C7.648 0 4.224 2.4 2.48 5.696L4.992 7.36C5.856 4.864 8.128 4.104 10.88 4.104Z"
        fill="#EA4335"
      />
    </svg>
  );
}

const LOGIN_DRAFT_KEY = "traders-auth-login-draft-v2";
const LINKEDIN_URL = "https://linkedin.com/in/singhgunit";

const readDraft = () =>
  readDraftSync(LOGIN_DRAFT_KEY, { email: "", stayLoggedIn: false }) || {
    email: "",
    stayLoggedIn: false,
  };

const isValidGmail = (email) =>
  /^[a-z0-9._%+-]+@gmail\.com$/i.test(String(email || "").trim());

function BrandHero({ themeMode }) {
  const isDark = themeMode === "midnight";
  const isAmber = themeMode === "amber";
  const textCol = isDark ? "#F1F5F9" : isAmber ? "#3D2B1F" : "#0F172A";
  const mutedCol = isDark ? "#94A3B8" : isAmber ? "#7C6A53" : "#64748B";
  const background = isDark
    ? "linear-gradient(180deg, rgba(10,10,15,0.9) 0%, transparent 100%)"
    : isAmber
      ? "linear-gradient(180deg, rgba(244,235,208,0.94) 0%, transparent 100%)"
      : "linear-gradient(180deg, rgba(248,250,252,0.94) 0%, transparent 100%)";

  return (
    <div
      style={{
        textAlign: "center",
        padding: "20px 20px 10px",
        background,
        userSelect: "none",
      }}
    >
      <h1
        style={{
          fontSize: "clamp(30px, 6vw, 48px)",
          fontWeight: 900,
          color: textCol,
          margin: 0,
          letterSpacing: -1.4,
          lineHeight: 0.95,
          textAlign: "center",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
        }}
      >
        TRADERS
      </h1>
      <h1
        style={{
          fontSize: "clamp(30px, 6vw, 48px)",
          fontWeight: 900,
          color: "#D4A520",
          margin: "0 0 14px 0",
          letterSpacing: -1.4,
          lineHeight: 0.95,
          textAlign: "center",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
        }}
      >
        REGIMENT
      </h1>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 48,
            height: 1,
            background: "rgba(212,165,32,0.4)",
          }}
        />
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <rect
            x="1"
            y="1"
            width="8"
            height="8"
            rx="2"
            stroke="#D4A520"
            strokeWidth="1.5"
          />
          <rect x="3.5" y="3.5" width="3" height="3" rx="0.75" fill="#D4A520" />
        </svg>
        <div
          style={{
            width: 48,
            height: 1,
            background: "rgba(212,165,32,0.4)",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        <div
          style={{
            fontSize: "clamp(10px, 1.8vw, 12px)",
            fontWeight: 700,
            color: mutedCol,
            letterSpacing: 2.6,
            textAlign: "center",
            textTransform: "uppercase",
            lineHeight: 1.2,
          }}
        >
          World's Most Advanced
        </div>
        <div
          style={{
            fontSize: "clamp(14px, 2.3vw, 18px)",
            fontWeight: 900,
            color: "#D4A520",
            letterSpacing: 2.2,
            textAlign: "center",
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          Trading AI
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 16,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {[
          { label: "Founder", href: "/blog/founder-story/" },
          { label: "Vision", href: "/blog/product-vision/" },
          { label: "Architecture", href: "/blog/architecture/" },
        ].map(({ label, href }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 8,
              fontWeight: 700,
              color: isDark ? "rgba(212,165,32,0.45)" : "rgba(139,92,24,0.55)",
              textDecoration: "none",
              letterSpacing: 2.2,
              padding: "3px 9px",
              border: "1px solid rgba(212,165,32,0.18)",
              borderRadius: 4,
              textTransform: "uppercase",
            }}
          >
            {label}
          </a>
        ))}
        <a
          href={LINKEDIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 8,
            fontWeight: 700,
            color: isDark ? "rgba(96,165,250,0.55)" : "rgba(2,132,199,0.55)",
            textDecoration: "none",
            letterSpacing: 1.8,
            padding: "3px 9px",
            border: "1px solid rgba(96,165,250,0.18)",
            borderRadius: 4,
            textTransform: "uppercase",
          }}
        >
          LinkedIn
        </a>
      </div>
    </div>
  );
}

export default function CleanLoginScreen({
  onLogin,
  onSignup,
  onAdmin,
  onGoogleAuth,
  onForgotPassword,
}) {
  const { currentTheme } = useTheme();
  const draft = readDraft();
  const [email, setEmail] = useState(draft.email || "");
  const [password, setPassword] = useState("");
  const [stayLoggedIn, setStayLoggedIn] = useState(Boolean(draft.stayLoggedIn));
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isDark = currentTheme === "midnight";
  const isAmber = currentTheme === "amber";

  useEffect(() => {
    writeDraftSync(LOGIN_DRAFT_KEY, {
      email,
      stayLoggedIn,
    });
  }, [email, stayLoggedIn]);

  const cleanEmail = String(email || "").trim().toLowerCase();

  const primaryButton = (disabled = false) => ({
    width: "100%",
    height: 48,
    borderRadius: 16,
    border: "none",
    background: disabled ? CSS_VARS.borderSubtle : CSS_VARS.accentPrimary,
    color: CSS_VARS.text,
    fontSize: 14,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "transform 0.16s ease, box-shadow 0.16s ease",
    boxShadow: disabled ? "none" : "0 14px 28px rgba(15,23,42,0.18)",
  });

  const secondaryButton = (disabled = false) => ({
    width: "100%",
    height: 48,
    borderRadius: 16,
    border: `1px solid ${CSS_VARS.borderSubtle}`,
    background: disabled ? CSS_VARS.baseLayer : CSS_VARS.surfaceElevated,
    color: CSS_VARS.textPrimary,
    fontSize: 14,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  });

  const label = {
    display: "block",
    marginBottom: 8,
    color: CSS_VARS.textPrimary,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.04em",
  };

  const input = {
    width: "100%",
    height: 48,
    borderRadius: 16,
    border: `1px solid ${CSS_VARS.borderSubtle}`,
    background: CSS_VARS.surfaceElevated,
    padding: "0 14px",
    color: CSS_VARS.textPrimary,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  };

  const handleSubmit = async () => {
    if (!cleanEmail || !password) {
      setError("Email and password are required.");
      return;
    }
    if (!isValidGmail(cleanEmail)) {
      setError("Only Gmail addresses are allowed.");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await onLogin(cleanEmail, password, stayLoggedIn);
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      clearPendingGoogleFormData();
      markRedirectInProgress();
      await onGoogleAuth();
    } catch (err) {
      setError(err.message || "Google sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!cleanEmail) {
      setError("Please enter your Gmail address.");
      return;
    }
    if (!isValidGmail(cleanEmail)) {
      setError("Only Gmail addresses are allowed.");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const nextMessage = await onForgotPassword(cleanEmail);
      setMessage(
        nextMessage || "Password reset email sent. Check your Gmail inbox.",
      );
    } catch (err) {
      setError(err.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearDraft = () => {
    clearDraftSync(LOGIN_DRAFT_KEY);
    setEmail("");
    setPassword("");
    setStayLoggedIn(false);
    setError("");
    setMessage("");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: isDark
          ? "radial-gradient(circle at top, rgba(184,134,11,0.14), transparent 28%), #0A0A0F"
          : isAmber
            ? "radial-gradient(circle at top, rgba(217,119,6,0.12), transparent 30%), #F4EBD0"
            : "radial-gradient(circle at top, rgba(37,99,235,0.08), transparent 30%), #F8FAFC",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        fontFamily: '"Sora", "Segoe UI", sans-serif',
        padding: "44px 20px 56px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <BrandHero themeMode={currentTheme} />

        <div
          style={{
            width: "100%",
            maxWidth: 540,
            marginInline: "auto",
            background: CSS_VARS.surfaceElevated,
            border: `1px solid ${CSS_VARS.borderSubtle}`,
            borderRadius: 26,
            boxShadow: "0 30px 80px rgba(15,23,42,0.12)",
            backdropFilter: "blur(18px)",
            padding: "32px 26px",
          }}
        >
          <div style={{ marginBottom: 28 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 999,
                background: CSS_VARS.accentGlow,
                color: CSS_VARS.accentPrimary,
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 18,
              }}
            >
              Gmail Only
            </div>
            <h2
              style={{
                margin: 0,
                color: CSS_VARS.textPrimary,
                fontSize: 26,
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: -0.4,
              }}
            >
              {resetMode ? "Reset your password" : "Welcome back"}
            </h2>
            <p
              style={{
                margin: "10px 0 0",
                color: CSS_VARS.textSecondary,
                fontSize: 13,
                lineHeight: 1.65,
              }}
            >
              {resetMode
                ? "Enter your Gmail address and we'll send a recovery link."
                : "Sign in with Google or continue with your Gmail and password. New users stay in review until admin approval."}
            </p>
          </div>

          {message && (
            <div
              style={{
                marginBottom: 16,
                padding: "12px 14px",
                borderRadius: 16,
                background: "var(--status-success-soft, rgba(34,197,94,0.08))",
                border:
                  "1px solid var(--status-success-border-soft, rgba(34,197,94,0.18))",
                color: "var(--status-success, #166534)",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {message}
            </div>
          )}

          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: "12px 14px",
                borderRadius: 16,
                background: "var(--status-danger-soft, rgba(239,68,68,0.08))",
                border:
                  "1px solid var(--status-danger-border-soft, rgba(239,68,68,0.18))",
                color: "var(--status-danger, #B91C1C)",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginBottom: resetMode ? 18 : 14 }}>
            <label style={label}>Gmail Address</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@gmail.com"
              autoFocus
              autoComplete="email"
              style={input}
            />
          </div>

          {!resetMode ? (
            <>
              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <label style={{ ...label, marginBottom: 0 }}>Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetMode(true);
                      setError("");
                      setMessage("");
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: CSS_VARS.accentPrimary,
                      cursor: "pointer",
                      padding: 0,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="current-password"
                    style={{ ...input, paddingRight: 72 }}
                    onKeyDown={(event) =>
                      event.key === "Enter" && handleSubmit()
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    style={{
                      position: "absolute",
                      top: "50%",
                      right: 12,
                      transform: "translateY(-50%)",
                      border: "none",
                      background: "transparent",
                      color: CSS_VARS.textSecondary,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {showPassword ? "HIDE" : "SHOW"}
                  </button>
                </div>
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 18,
                  color: CSS_VARS.textSecondary,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={stayLoggedIn}
                  onChange={(event) => setStayLoggedIn(event.target.checked)}
                  style={{ margin: 0 }}
                />
                <span>Keep me signed in on this device</span>
              </label>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !cleanEmail || !password}
                style={{
                  ...primaryButton(loading || !cleanEmail || !password),
                  marginBottom: 12,
                }}
              >
                {loading ? "Signing in..." : "Continue"}
              </button>

              <button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                style={{
                  ...secondaryButton(loading),
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                }}
              >
                <GoogleLogo />
                {loading ? "Connecting..." : "Continue with Google"}
              </button>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 12,
                }}
              >
                <button
                  onClick={onSignup}
                  type="button"
                  style={{ ...secondaryButton(false), flex: 1, minWidth: 180 }}
                  disabled={loading}
                >
                  New user? Apply
                </button>
                <button
                  onClick={handleClearDraft}
                  type="button"
                  style={{ ...secondaryButton(false), flex: 1, minWidth: 180 }}
                  disabled={loading}
                  title="Clear saved email from this device"
                >
                  Clear saved email
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: 12,
                  color: CSS_VARS.textSecondary,
                  fontSize: 12,
                }}
              >
                <button
                  onClick={onAdmin}
                  type="button"
                  style={{
                    border: "none",
                    background: "transparent",
                    color: CSS_VARS.textSecondary,
                    cursor: "pointer",
                    padding: 0,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                  disabled={loading}
                >
                  Admin panel
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={handleReset}
                type="button"
                disabled={loading || !cleanEmail}
                style={{
                  ...primaryButton(loading || !cleanEmail),
                  marginBottom: 12,
                }}
              >
                {loading ? "Sending link..." : "Send recovery link"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setResetMode(false);
                  setError("");
                  setMessage("");
                }}
                style={secondaryButton(false)}
                disabled={loading}
              >
                Back to sign in
              </button>
            </>
          )}
        </div>

        <BlogSection
          style={{ maxWidth: 540, marginInline: "auto" }}
        />
      </div>
    </div>
  );
}
