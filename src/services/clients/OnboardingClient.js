/**
 * Transitional onboarding contract for the Firebase-first migration.
 * Keeps the screen flow stable while giving the app a service-shaped entrypoint.
 */
import {
  createOnboardingApplication,
  fetchOnboardingApplication,
  fetchOnboardingApplicationStatus,
  saveOnboardingConsent,
} from "../gateways/onboardingGateway.js";

export function mapSignupToApplication(formData = {}) {
  return {
    uid: formData.uid || "",
    email: formData.email?.trim().toLowerCase() || "",
    fullName: formData.fullName?.trim() || "",
    country: formData.country?.trim() || "",
    city: formData.city?.trim() || "",
    instagram: formData.instagram?.trim() || "",
    linkedin: formData.linkedin?.trim() || "",
    proficiency: formData.proficiency?.trim() || "",
    authProvider: formData.authProvider || "password",
    emailVerified: Boolean(formData.emailVerified),
    status: formData.status || "PENDING",
    consentState: {
      termsAccepted: Boolean(
        formData.termsAccepted ?? formData.consentState?.termsAccepted,
      ),
      privacyAccepted: Boolean(
        formData.privacyAccepted ?? formData.consentState?.privacyAccepted,
      ),
    },
  };
}

export async function submitApplication(formData = {}) {
  const payload = mapSignupToApplication(formData);
  const response = await createOnboardingApplication(payload);
  return response?.application || payload;
}

export async function loadApplication(uid) {
  const response = await fetchOnboardingApplication(uid);
  return response?.application || null;
}

export async function loadApplicationStatus(uid) {
  const response = await fetchOnboardingApplicationStatus(uid);
  if (!response?.ok) {
    return null;
  }

  return {
    uid: response.uid,
    status: response.status,
    updatedAt: response.updatedAt,
  };
}

export async function persistConsentState(uid, consentState = {}) {
  const response = await saveOnboardingConsent(uid, consentState);
  return response?.application || null;
}

export default {
  loadApplication,
  loadApplicationStatus,
  mapSignupToApplication,
  persistConsentState,
  submitApplication,
};
