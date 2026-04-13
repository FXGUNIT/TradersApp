import React from "react";
import { CSS_VARS } from "../styles/cssVars.js";

// ─── Shared input style factory (avoid inline repetition) ──────────────────────

export const onboardingInput = {
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

export const onboardingLabel = {
  display: "block",
  marginBottom: 8,
  color: CSS_VARS.textPrimary,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.04em",
};

// ─── StepWelcome ──────────────────────────────────────────────────────────────

export function StepWelcome() {
  return (
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
        New Gmail applicants are queued for admin approval before terminal
        access is granted.
      </p>
    </div>
  );
}

// ─── StepOne ─────────────────────────────────────────────────────────────────

export function StepOne({
  form,
  setField,
  cityOptions,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  isGoogleMode,
  showTermsModal: _showTermsModal,
  setShowTermsModal,
  showPrivacyModal: _showPrivacyModal,
  setShowPrivacyModal,
  COUNTRY_CITY_OPTIONS,
  loading,
}) {
  return (
    <>
      {/* Full Name */}
      <div style={{ marginBottom: 14 }}>
        <label style={onboardingLabel}>Full Name</label>
        <input
          type="text"
          value={form.fullName}
          onChange={setField("fullName")}
          placeholder="Your full name"
          style={onboardingInput}
          disabled={loading}
        />
      </div>

      {/* Gmail Address */}
      <div style={{ marginBottom: 14 }}>
        <label style={onboardingLabel}>Gmail Address</label>
        <input
          type="email"
          value={form.email}
          onChange={setField("email")}
          placeholder="you@gmail.com"
          style={onboardingInput}
          disabled={loading || isGoogleMode}
        />
      </div>

      {/* Password + Confirm Password (non-Google only) */}
      {!isGoogleMode && (
        <>
          <div style={{ marginBottom: 14 }}>
            <label style={onboardingLabel}>Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={setField("password")}
                placeholder="At least 8 characters"
                style={{ ...onboardingInput, paddingRight: 72 }}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
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
            <label style={onboardingLabel}>Confirm Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={form.confirmPassword}
                onChange={setField("confirmPassword")}
                placeholder="Repeat password"
                style={{ ...onboardingInput, paddingRight: 72 }}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() =>
                  setShowConfirmPassword((v) => !v)
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

      {/* Country + City */}
      <div
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          marginBottom: 14,
        }}
      >
        <div>
          <label style={onboardingLabel}>Country</label>
          <select
            value={form.country}
            onChange={setField("country")}
            style={onboardingInput}
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
          <label style={onboardingLabel}>City</label>
          <select
            value={form.city}
            onChange={setField("city")}
            style={onboardingInput}
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

      {/* Terms checkbox */}
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
  );
}

// ─── StepTwo ─────────────────────────────────────────────────────────────────

export function StepTwo({ form, setField, loading }) {
  return (
    <>
      {/* Approval tip banner */}
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
        Profiles submitted with correct details had a 78.6% higher approval
        rate than profiles that did not.
      </div>

      {/* Instagram + LinkedIn */}
      <div
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          marginBottom: 14,
        }}
      >
        <div>
          <label style={onboardingLabel}>Instagram</label>
          <input
            type="text"
            value={form.instagram}
            onChange={setField("instagram")}
            placeholder="@username"
            style={onboardingInput}
            disabled={loading}
          />
        </div>

        <div>
          <label style={onboardingLabel}>LinkedIn</label>
          <input
            type="text"
            value={form.linkedin}
            onChange={setField("linkedin")}
            placeholder="linkedin.com/in/name"
            style={onboardingInput}
            disabled={loading}
          />
        </div>
      </div>

      {/* Trading Proficiency */}
      <div style={{ marginBottom: 18 }}>
        <label style={onboardingLabel}>Trading Proficiency</label>
        <select
          value={form.proficiency}
          onChange={setField("proficiency")}
          style={onboardingInput}
          disabled={loading}
        >
          <option value="">Select trading experience</option>
          <option value="beginner">Beginner — New to trading, under 1 year</option>
          <option value="intermediate">
            Intermediate — Active trader, 1 to 3 years
          </option>
          <option value="advanced">
            Advanced — Experienced, 3 to 5 years
          </option>
          <option value="expert">Expert — 5+ years or prop firm trader</option>
        </select>
      </div>
    </>
  );
}

export default { StepWelcome, StepOne, StepTwo };
