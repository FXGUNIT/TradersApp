import React, { useEffect, useMemo, useState } from "react";
import TermsOfService from "./TermsOfService";
import PrivacyPolicy from "./PrivacyPolicy";
import {
  clearDraftSync,
  readDraftSync,
  writeDraftSync,
} from "../services/draftVault.js";
import { CSS_VARS } from "../styles/cssVars.js";

const SIGNUP_DRAFT_KEY = "traders-auth-signup-draft-v2";

const COUNTRY_CITY_OPTIONS = {
  India: [
    "Ahmedabad",
    "Bengaluru",
    "Chandigarh",
    "Chennai",
    "Delhi",
    "Hyderabad",
    "Jaipur",
    "Kolkata",
    "Meerut",
    "Mumbai",
    "Noida",
    "Pune",
  ],
  "United States": [
    "Atlanta",
    "Austin",
    "Chicago",
    "Los Angeles",
    "Miami",
    "New York",
    "San Francisco",
    "Seattle",
  ],
  "United Kingdom": ["Birmingham", "Leeds", "London", "Manchester"],
  Canada: ["Calgary", "Montreal", "Toronto", "Vancouver"],
  Australia: ["Brisbane", "Melbourne", "Perth", "Sydney"],
  Singapore: ["Singapore"],
  "United Arab Emirates": ["Abu Dhabi", "Dubai", "Sharjah"],
};

const DEFAULT_FORM = {
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

  useEffect(() => {
    writeDraftSync(SIGNUP_DRAFT_KEY, form);
  }, [form]);

  useEffect(() => {
    if (!googleUser) {
      return;
    }

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
      if (key === "country") {
        return {
          ...current,
          country: value,
          city: "",
        };
      }

      return {
        ...current,
        [key]: value,
      };
    });
  };

  const validateStepOne = (allowGoogle = false) => {
    if (!form.fullName.trim()) {
      return "Full name is required.";
    }

    if (!isValidGmail(form.email)) {
      return "Only Gmail addresses are allowed.";
    }

    if (!allowGoogle && !isGoogleMode && form.password.length < 8) {
      return "Password must be at least 8 characters.";
    }

    if (!allowGoogle && !isGoogleMode && form.password !== form.confirmPassword) {
      return "Passwords must match.";
    }

    if (!form.country || !form.city) {
      return "Country and city are required.";
    }

    if (!form.agreedToTerms) {
      return "Accept the Terms of Service and Privacy Policy to continue.";
    }

    return "";
  };

  const handleContinue = () => {
    const nextError = validateStepOne(false);
    if (nextError) {
      setError(nextError);
      return;
    }

    setError("");
    setStep(2);
  };

  const handleSubmit = async () => {
    const stepOneError = validateStepOne(false);
    if (stepOneError) {
      setError(stepOneError);
      setStep(1);
      return;
    }

    setLoading(true);
    setError("");

    try {
      await onSignupSuccess({
        ...form,
        authProvider: isGoogleMode ? "google" : "password",
      });
      clearDraftSync(SIGNUP_DRAFT_KEY);
      setForm(DEFAULT_FORM);
      setStep(1);
    } catch (err) {
      setError(err.message || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const nextError = validateStepOne(true);
    if (nextError) {
      setError(nextError);
      return;
    }

    setLoading(true);
    setError("");

    try {
      await onGoogleSuccess({
        ...form,
        fullName: form.fullName.trim(),
        email: String(form.email || "").trim().toLowerCase(),
      });
      clearDraftSync(SIGNUP_DRAFT_KEY);
      setForm(DEFAULT_FORM);
      setStep(1);
    } catch (err) {
      setError(err.message || "Google signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearDraft = () => {
    clearDraftSync(SIGNUP_DRAFT_KEY);
    setForm({
      ...DEFAULT_FORM,
      fullName: googleUser?.fullName || "",
      email: googleUser?.email || "",
    });
    setStep(1);
    setError("");
  };

  const surface = {
    background:
      "linear-gradient(180deg, var(--base-layer, #F8FAFC) 0%, var(--surface-glass, #EEF2FF) 100%)",
    minHeight: "100vh",
    padding: "48px 20px 64px",
    display: "flex",
    justifyContent: "center",
    fontFamily: '"Sora", "Segoe UI", sans-serif',
  };

  const card = {
    width: "100%",
    maxWidth: 520,
    background: CSS_VARS.surfaceElevated,
    border: `1px solid ${CSS_VARS.borderSubtle}`,
    borderRadius: 28,
    boxShadow: "0 30px 80px rgba(15,23,42,0.12)",
    backdropFilter: "blur(18px)",
    padding: "32px 28px",
  };

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

  const primaryButton = (disabled = false) => ({
    width: "100%",
    height: 48,
    borderRadius: 16,
    border: "none",
    background: disabled ? CSS_VARS.borderSubtle : CSS_VARS.accentPrimary,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
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

  return (
    <div style={surface}>
      <div style={card}>
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
            Apply to join Traders Regiment
          </h1>
          <p
            style={{
              margin: "12px 0 0",
              color: CSS_VARS.textSecondary,
              fontSize: 14,
              lineHeight: 1.65,
            }}
          >
            Step {step} of 2. New Gmail applicants are queued for admin approval
            before terminal access is granted.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 10,
            marginBottom: 20,
          }}
        >
          {[1, 2].map((stepId) => (
            <div
              key={stepId}
              style={{
                height: 8,
                borderRadius: 999,
                background: step >= stepId ? CSS_VARS.accentPrimary : CSS_VARS.borderSubtle,
                transition: "background 0.18s ease",
              }}
            />
          ))}
        </div>

        {!isGoogleMode && step === 1 && (
          <>
            <button
              onClick={handleGoogle}
              disabled={loading}
              style={{ ...secondaryButton(loading), marginBottom: 16 }}
            >
              Continue with Google
            </button>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div style={{ flex: 1, height: 1, background: CSS_VARS.borderSubtle }} />
              <span style={{ color: CSS_VARS.textSecondary, fontSize: 11, fontWeight: 700 }}>
                OR APPLY WITH GMAIL + PASSWORD
              </span>
              <div style={{ flex: 1, height: 1, background: CSS_VARS.borderSubtle }} />
            </div>
          </>
        )}

        {isGoogleMode && (
          <div
            style={{
              marginBottom: 18,
              padding: "14px 16px",
              borderRadius: 18,
              background: "var(--status-success-soft, rgba(34,197,94,0.1))",
              border: "1px solid var(--status-success-border-soft, rgba(34,197,94,0.2))",
              color: "var(--status-success, #166534)",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            Google account connected for {googleUser.email}. Finish the
            optional profile details below to enter the approval queue.
          </div>
        )}

        {step === 1 ? (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Full Name</label>
              <input
                type="text"
                value={form.fullName}
                onChange={setField("fullName")}
                placeholder="Your full name"
                style={input}
                disabled={loading}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={label}>Gmail Address</label>
              <input
                type="email"
                value={form.email}
                onChange={setField("email")}
                placeholder="you@gmail.com"
                style={input}
                disabled={loading || isGoogleMode}
              />
            </div>

            {!isGoogleMode && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={label}>Password</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={setField("password")}
                      placeholder="At least 8 characters"
                      style={{ ...input, paddingRight: 72 }}
                      disabled={loading}
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

                <div style={{ marginBottom: 14 }}>
                  <label style={label}>Confirm Password</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={form.confirmPassword}
                      onChange={setField("confirmPassword")}
                      placeholder="Repeat password"
                      style={{ ...input, paddingRight: 72 }}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword((value) => !value)
                      }
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
                      {showConfirmPassword ? "HIDE" : "SHOW"}
                    </button>
                  </div>
                </div>
              </>
            )}

            <div
              style={{
                display: "grid",
                gap: 14,
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                marginBottom: 14,
              }}
            >
              <div>
                <label style={label}>Country</label>
                <select
                  value={form.country}
                  onChange={setField("country")}
                  style={input}
                  disabled={loading}
                >
                  <option value="">Select country</option>
                  {Object.keys(COUNTRY_CITY_OPTIONS).map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={label}>City</label>
                <select
                  value={form.city}
                  onChange={setField("city")}
                  style={input}
                  disabled={loading || !form.country}
                >
                  <option value="">
                    {form.country ? "Select city" : "Choose country first"}
                  </option>
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                marginBottom: 18,
                color: CSS_VARS.textSecondary,
                fontSize: 13,
                lineHeight: 1.7,
              }}
            >
              <input
                type="checkbox"
                checked={form.agreedToTerms}
                onChange={setField("agreedToTerms")}
                disabled={loading}
                style={{ marginTop: 4 }}
              />
              <span>
                I agree to the{" "}
                <button
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: CSS_VARS.accentPrimary,
                    cursor: "pointer",
                    padding: 0,
                    fontWeight: 700,
                  }}
                >
                  Terms of Service
                </button>{" "}
                and{" "}
                <button
                  type="button"
                  onClick={() => setShowPrivacyModal(true)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: CSS_VARS.accentPrimary,
                    cursor: "pointer",
                    padding: 0,
                    fontWeight: 700,
                  }}
                >
                  Privacy Policy
                </button>
                .
              </span>
            </label>
          </>
        ) : (
          <>
            <div
              style={{
                marginBottom: 16,
                padding: "14px 16px",
                borderRadius: 18,
                background: CSS_VARS.accentGlow,
                border: "1px solid var(--accent-glow, rgba(37,99,235,0.16))",
                color: CSS_VARS.textSecondary,
                fontSize: 13,
                lineHeight: 1.7,
              }}
            >
              <strong style={{ color: CSS_VARS.accentPrimary }}>
                Improve your approval chances
              </strong>
              <br />
              Profiles submitted with correct details had a 78.6% higher
              approval rate than profiles that did not.
            </div>

            <div
              style={{
                display: "grid",
                gap: 14,
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                marginBottom: 14,
              }}
            >
              <div>
                <label style={label}>Instagram</label>
                <input
                  type="text"
                  value={form.instagram}
                  onChange={setField("instagram")}
                  placeholder="@username"
                  style={input}
                  disabled={loading}
                />
              </div>

              <div>
                <label style={label}>LinkedIn</label>
                <input
                  type="text"
                  value={form.linkedin}
                  onChange={setField("linkedin")}
                  placeholder="linkedin.com/in/name"
                  style={input}
                  disabled={loading}
                />
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={label}>Trading Proficiency</label>
              <select
                value={form.proficiency}
                onChange={setField("proficiency")}
                style={input}
                disabled={loading}
              >
                <option value="">Select trading experience</option>
                <option value="beginner">Beginner — New to trading, under 1 year</option>
                <option value="intermediate">Intermediate — Active trader, 1 to 3 years</option>
                <option value="advanced">Advanced — Experienced, 3 to 5 years</option>
                <option value="expert">Expert — 5+ years or prop firm trader</option>
              </select>
            </div>
          </>
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

        {step === 1 ? (
          <button
            onClick={handleContinue}
            disabled={loading}
            style={{ ...primaryButton(loading), marginBottom: 12 }}
          >
            Continue
          </button>
        ) : (
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <button
              onClick={() => {
                setStep(1);
                setError("");
              }}
              type="button"
              style={{ ...secondaryButton(false), flex: 1 }}
              disabled={loading}
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{ ...primaryButton(loading), flex: 1 }}
            >
              {loading ? "Saving application..." : "Submit application"}
            </button>
          </div>
        )}

        <button
          onClick={handleClearDraft}
          type="button"
          style={{ ...secondaryButton(false), marginBottom: 12 }}
          disabled={loading}
        >
          Clear saved draft
        </button>

        <button
          onClick={onBackToLogin}
          type="button"
          style={{ ...secondaryButton(false), color: CSS_VARS.textSecondary }}
          disabled={loading}
        >
          Back to login
        </button>
      </div>

      {showTermsModal && (
        <TermsOfService onClose={() => setShowTermsModal(false)} />
      )}
      {showPrivacyModal && (
        <PrivacyPolicy onClose={() => setShowPrivacyModal(false)} />
      )}
    </div>
  );
}
