/**
 * Transitional onboarding contract for the Firebase-first migration.
 * Keeps the screen flow stable while giving the app a service-shaped entrypoint.
 */

export function mapSignupToApplication(formData = {}) {
  return {
    email: formData.email?.trim().toLowerCase() || "",
    password: formData.password || "",
    fullName: formData.fullName?.trim() || "",
    mobile: formData.mobile?.trim() || "",
    consentState: {
      termsAccepted: Boolean(formData.termsAccepted),
      privacyAccepted: Boolean(formData.privacyAccepted),
    },
  };
}

export async function submitApplication(formData = {}) {
  return mapSignupToApplication(formData);
}

export default {
  mapSignupToApplication,
  submitApplication,
};
