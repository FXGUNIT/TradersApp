import React, { useEffect, useState } from "react";
import {
  clearDraftSync,
  readDraftSync,
  writeDraftSync,
} from "../../services/draftVault.js";

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
    background: disabled ? "#CBD5E1" : "#111827",
    color: "#FFFFFF",
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
    border: "1px solid rgba(148,163,184,0.26)",
    background: disabled ? "#F1F5F9" : "#FFFFFF",
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  });

  const label = {
    display: "block",
    marginBottom: 8,
    color: "#0F172A",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.04em",
  };

  const input = {
    width: "100%",
    height: 48,
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.32)",
    background: "rgba(255,255,255,0.94)",
    padding: "0 14px",
    color: "#0F172A",
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
        background:
          "radial-gradient(circle at top, rgba(37,99,235,0.08), transparent 34%), linear-gradient(180deg, #F8FAFC 0%, #EEF2FF 100%)",
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
          background: "rgba(255,255,255,0.92)",
          border: "1px solid rgba(148,163,184,0.22)",
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
              background: "rgba(37,99,235,0.08)",
              color: "#1D4ED8",
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
              color: "#0F172A",
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
              color: "#475569",
              fontSize: 14,
              lineHeight: 1.65,
            }}
          >
            {resetMode
              ? "Enter your Gmail address and we’ll send a recovery link."
              : "Sign in with Google or continue with your Gmail and password. New users stay in review until admin approval."}
          </p>
        </div>

        {message && (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 14px",
              borderRadius: 16,
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.18)",
              color: "#166534",
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
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.18)",
              color: "#B91C1C",
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
                    color: "#2563EB",
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
                    color: "#475569",
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
                color: "#475569",
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
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#FFFFFF",
                  color: "#2563EB",
                  fontSize: 12,
                  fontWeight: 800,
                  border: "1px solid rgba(148,163,184,0.2)",
                }}
              >
                G
              </span>
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
              >
                Clear saved draft
              </button>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                color: "#64748B",
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
                  color: "#475569",
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
