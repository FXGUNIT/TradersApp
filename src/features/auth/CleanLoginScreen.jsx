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

// Google "G" SVG logo — official brand mark
function GoogleLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.64 11.224C20.64 10.416 20.576 9.824 20.432 9.2H10.88V12.944H16.304C16.064 14.192 15.424 15.152 14.432 15.776V17.744H17.792C19.696 16.048 20.64 13.648 20.64 11.224Z" fill="#4285F4"/>
      <path d="M10.88 20.288C13.536 20.288 15.744 19.296 17.792 17.744L14.432 15.776C13.536 16.352 12.384 16.736 10.88 16.736C8.128 16.736 5.856 14.976 4.992 12.48H2.48V14.544C4.224 17.888 7.648 20.288 10.88 20.288Z" fill="#34A853"/>
      <path d="M4.992 12.48C4.688 11.68 4.528 10.816 4.528 9.92C4.528 9.024 4.688 8.16 4.992 7.36V5.296H2.48C1.696 6.848 1.28 8.608 1.28 10.464C1.28 12.32 1.696 14.08 2.48 15.632L4.992 12.48Z" fill="#FBBC05"/>
      <path d="M10.88 4.104C12.384 4.096 13.76 4.64 14.88 5.76L17.888 2.752C15.744 0.96 12.976 0 10.88 0C7.648 0 4.224 2.4 2.48 5.696L4.992 7.36C5.856 4.864 8.128 4.104 10.88 4.104Z" fill="#EA4335"/>
    </svg>
  );
}

const LOGIN_DRAFT_KEY = "traders-auth-login-draft-v2";

const readDraft = () =>
  readDraftSync(LOGIN_DRAFT_KEY, { email: "", stayLoggedIn: false }) || {
    email: "",
    stayLoggedIn: false,
  };

const isValidGmail = (email) =>
  /^[a-z0-9._%+-]+@gmail\.com$/i.test(String(email || "").trim());

export default function CleanLoginScreen({
  onLogin,
  onSignup,
  onAdmin,
  onGoogleAuth,
  onForgotPassword,
}) {
  const draft = readDraft();
  const [email, setEmail] = useState(draft.email || "");
  const [password, setPassword] = useState("");
  const [stayLoggedIn, setStayLoggedIn] = useState(
    Boolean(draft.stayLoggedIn),
  );
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
      // Login-page Google auth is not a completed application. Let the
      // redirect result route new users to the signup form instead.
      clearPendingGoogleFormData();
      markRedirectInProgress();
      await onGoogleAuth();
      // signInWithRedirect has already navigated away — this won't run
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
        background:
          "linear-gradient(180deg, var(--base-layer, #F8FAFC) 0%, var(--surface-glass, #EEF2FF) 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: '"Sora", "Segoe UI", sans-serif',
        padding: "48px 20px 64px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: CSS_VARS.surfaceElevated,
          border: `1px solid ${CSS_VARS.borderSubtle}`,
          borderRadius: 28,
          boxShadow: "0 30px 80px rgba(15,23,42,0.12)",
          backdropFilter: "blur(18px)",
          padding: "32px 28px",
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
          <h1
            style={{
              margin: 0,
              color: CSS_VARS.textPrimary,
              fontSize: 30,
              fontWeight: 800,
              lineHeight: 1.1,
            }}
          >
            {resetMode ? "Reset your password" : "Welcome back"}
          </h1>
          <p
            style={{
              margin: "12px 0 0",
              color: CSS_VARS.textSecondary,
              fontSize: 14,
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
              border: "1px solid var(--status-success-border-soft, rgba(34,197,94,0.18))",
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
              border: "1px solid var(--status-danger-border-soft, rgba(239,68,68,0.18))",
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
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                color: CSS_VARS.textSecondary,
                fontSize: 12,
              }}
            >
              <span>Admin access stays on the current protected flow.</span>
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
    </div>
  );
}
