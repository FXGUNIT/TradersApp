import React, { useEffect, useMemo, useState } from "react";
import TermsOfService from "./TermsOfService";
import PrivacyPolicy from "./PrivacyPolicy";
import {
  clearDraftSync,
  readDraftSync,
  writeDraftSync,
} from "../services/draftVault.js";
import { CSS_VARS } from "../styles/cssVars.js";
import { OnboardingProgress } from "./OnboardingProgress.jsx";
import {
  StepWelcome,
  StepOne,
  StepTwo,
} from "./OnboardingSteps.jsx";

const SIGNUP_DRAFT_KEY = "traders-auth-signup-draft-v2";

export const COUNTRY_CITY_OPTIONS = {
  India: [
    "Ahmedabad","Bengaluru","Chandigarh","Chennai","Delhi",
    "Hyderabad","Jaipur","Kolkata","Meerut","Mumbai","Noida","Pune",
  ],
  "United States": [
    "Atlanta","Austin","Chicago","Los Angeles","Miami",
    "New York","San Francisco","Seattle",
  ],
  "United Kingdom": ["Birmingham","Leeds","London","Manchester"],
  Canada: ["Calgary","Montreal","Toronto","Vancouver"],
  Australia: ["Brisbane","Melbourne","Perth","Sydney"],
  Singapore: ["Singapore"],
  "United Arab Emirates": ["Abu Dhabi","Dubai","Sharjah"],
};

export const DEFAULT_FORM = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
  country: "",
  city: "",
  instagram: "",
  linkedin: "",
  proficiency: "",
  agreedToTerms: false,
};

const readDraft = () => ({
  ...DEFAULT_FORM,
  ...(readDraftSync(SIGNUP_DRAFT_KEY, DEFAULT_FORM) || {}),
});

const isValidGmail = (email) =>
  /^[a-z0-9._%+-]+@gmail\.com$/i.test(String(email || "").trim());

export default function CleanOnboarding({
  onSignupSuccess,
  onGoogleSuccess,
  onBackToLogin,
  googleUser = null,
}) {
  const [form, setForm] = useState(() => readDraft());
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  useEffect(() => { writeDraftSync(SIGNUP_DRAFT_KEY, form); }, [form]);

  useEffect(() => {
    if (!googleUser) return;
    setForm((current) => ({
      ...current,
      fullName: googleUser.fullName || current.fullName,
      email: googleUser.email || current.email,
      password: "",
      confirmPassword: "",
    }));
  }, [googleUser]);

  const cityOptions = useMemo(
    () => COUNTRY_CITY_OPTIONS[form.country] || [],
    [form.country],
  );
  const isGoogleMode = Boolean(googleUser);

  const setField = (key) => (event) => {
    const value =
      event?.target?.type === "checkbox"
        ? event.target.checked
        : event?.target?.value ?? "";
    setForm((current) => {
      if (key === "country") return { ...current, country: value, city: "" };
      return { ...current, [key]: value };
    });
  };

  // ─── Validation ──────────────────────────────────────────────────────────────

  const validateStepOne = (allowGoogle = false) => {
    if (!form.fullName.trim()) return "Full name is required.";
    if (!isValidGmail(form.email)) return "Only Gmail addresses are allowed.";
    if (!allowGoogle && !isGoogleMode && form.password.length < 8)
      return "Password must be at least 8 characters.";
    if (!allowGoogle && !isGoogleMode && form.password !== form.confirmPassword)
      return "Passwords must match.";
    if (!form.country || !form.city) return "Country and city are required.";
    if (!form.agreedToTerms)
      return "Accept the Terms of Service and Privacy Policy to continue.";
    return "";
  };

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleContinue = () => {
    const err = validateStepOne(false);
    if (err) { setError(err); return; }
    setError(""); setStep(2);
  };

  const handleSubmit = async () => {
    const err = validateStepOne(false);
    if (err) { setError(err); setStep(1); return; }
    setLoading(true); setError("");
    try {
      await onSignupSuccess({
        ...form,
        authProvider: isGoogleMode ? "google" : "password",
      });
      clearDraftSync(SIGNUP_DRAFT_KEY);
      setForm(DEFAULT_FORM); setStep(1);
    } catch (err) {
      setError(err.message || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const err = validateStepOne(true);
    if (err) { setError(err); return; }
    setLoading(true); setError("");
    try {
      await onGoogleSuccess({
        ...form,
        fullName: form.fullName.trim(),
        email: String(form.email || "").trim().toLowerCase(),
      });
      clearDraftSync(SIGNUP_DRAFT_KEY);
      setForm(DEFAULT_FORM); setStep(1);
    } catch (err) {
      setError(err.message || "Google signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearDraft = () => {
    clearDraftSync(SIGNUP_DRAFT_KEY);
    setForm({ ...DEFAULT_FORM, fullName: googleUser?.fullName || "", email: googleUser?.email || "" });
    setStep(1); setError("");
  };

  // ─── Shared button styles ────────────────────────────────────────────────────

  const primaryButton = (disabled = false) => ({
    width: "100%", height: 48, borderRadius: 16, border: "none",
    background: disabled ? CSS_VARS.borderSubtle : CSS_VARS.accentPrimary,
    color: "#FFFFFF", fontSize: 14, fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  });

  const secondaryButton = (disabled = false) => ({
    width: "100%", height: 48, borderRadius: 16,
    border: `1px solid ${CSS_VARS.borderSubtle}`,
    background: disabled ? CSS_VARS.baseLayer : CSS_VARS.surfaceElevated,
    color: CSS_VARS.textPrimary, fontSize: 14, fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  });

  // ─── Render ──────────────────────────────────────────────────────────────────

  const surface = {
    background: "linear-gradient(180deg, var(--base-layer, #F8FAFC) 0%, var(--surface-glass, #EEF2FF) 100%)",
    minHeight: "100vh", padding: "48px 20px 64px",
    display: "flex", justifyContent: "center",
    fontFamily: '"Sora", "Segoe UI", sans-serif',
  };

  const card = {
    width: "100%", maxWidth: 520,
    background: CSS_VARS.surfaceElevated,
    border: `1px solid ${CSS_VARS.borderSubtle}`,
    borderRadius: 28,
    boxShadow: "0 30px 80px rgba(15,23,42,0.12)",
    backdropFilter: "blur(18px)",
    padding: "32px 28px",
  };

  return (
    <div style={surface}>
      <div style={card}>
        <StepWelcome />
        <OnboardingProgress step={step} totalSteps={2} />

        {/* Google divider — step 1 only, non-Google */}
        {!isGoogleMode && step === 1 && (
          <>
            <button onClick={handleGoogle} disabled={loading} style={{ ...secondaryButton(loading), marginBottom: 16 }}>
              Continue with Google
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, background: CSS_VARS.borderSubtle }} />
              <span style={{ color: CSS_VARS.textSecondary, fontSize: 11, fontWeight: 700 }}>
                OR APPLY WITH GMAIL + PASSWORD
              </span>
              <div style={{ flex: 1, height: 1, background: CSS_VARS.borderSubtle }} />
            </div>
          </>
        )}

        {/* Google mode banner */}
        {isGoogleMode && (
          <div style={{
            marginBottom: 18, padding: "14px 16px", borderRadius: 18,
            background: "var(--status-success-soft, rgba(34,197,94,0.1))",
            border: "1px solid var(--status-success-border-soft, rgba(34,197,94,0.2))",
            color: "var(--status-success, #166534)", fontSize: 13, lineHeight: 1.6,
          }}>
            Google account connected for {googleUser.email}. Finish the optional profile
            details below to enter the approval queue.
          </div>
        )}

        {/* Step content */}
        {step === 1 ? (
          <StepOne
            form={form} setField={setField} cityOptions={cityOptions}
            showPassword={showPassword} setShowPassword={setShowPassword}
            showConfirmPassword={showConfirmPassword} setShowConfirmPassword={setShowConfirmPassword}
            isGoogleMode={isGoogleMode}
            showTermsModal={showTermsModal} setShowTermsModal={setShowTermsModal}
            showPrivacyModal={showPrivacyModal} setShowPrivacyModal={setShowPrivacyModal}
            COUNTRY_CITY_OPTIONS={COUNTRY_CITY_OPTIONS} loading={loading}
          />
        ) : (
          <StepTwo form={form} setField={setField} loading={loading} />
        )}

        {/* Error */}
        {error && (
          <div style={{
            marginBottom: 16, padding: "12px 14px", borderRadius: 16,
            background: "var(--status-danger-soft, rgba(239,68,68,0.08))",
            border: "1px solid var(--status-danger-border-soft, rgba(239,68,68,0.18))",
            color: "var(--status-danger, #B91C1C)", fontSize: 13, lineHeight: 1.6,
          }}>
            {error}
          </div>
        )}

        {/* Step navigation buttons */}
        {step === 1 ? (
          <button onClick={handleContinue} disabled={loading}
            style={{ ...primaryButton(loading), marginBottom: 12 }}>
            Continue
          </button>
        ) : (
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <button type="button" onClick={() => { setStep(1); setError(""); }}
              style={{ ...secondaryButton(false), flex: 1 }} disabled={loading}>
              Back
            </button>
            <button onClick={handleSubmit} disabled={loading}
              style={{ ...primaryButton(loading), flex: 1 }}>
              {loading ? "Saving application..." : "Submit application"}
            </button>
          </div>
        )}

        <button onClick={handleClearDraft} type="button"
          style={{ ...secondaryButton(false), marginBottom: 12 }} disabled={loading}>
          Clear saved draft
        </button>

        <button onClick={onBackToLogin} type="button"
          style={{ ...secondaryButton(false), color: CSS_VARS.textSecondary }} disabled={loading}>
          Back to login
        </button>
      </div>

      {showTermsModal && <TermsOfService onClose={() => setShowTermsModal(false)} />}
      {showPrivacyModal && <PrivacyPolicy onClose={() => setShowPrivacyModal(false)} />}
    </div>
  );
}
