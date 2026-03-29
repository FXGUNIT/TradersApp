import { bffFetch } from "./base.js";

export async function createOnboardingApplication(payload) {
  return bffFetch("/onboarding/applications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload || {}),
  });
}

export async function fetchOnboardingApplication(uid) {
  if (!uid) {
    return null;
  }

  return bffFetch(`/onboarding/applications/${encodeURIComponent(uid)}`);
}

export async function fetchOnboardingApplicationStatus(uid) {
  if (!uid) {
    return null;
  }

  return bffFetch(
    `/onboarding/applications/${encodeURIComponent(uid)}/status`,
  );
}

export async function saveOnboardingConsent(uid, consentState) {
  if (!uid) {
    return null;
  }

  return bffFetch(
    `/onboarding/applications/${encodeURIComponent(uid)}/consents`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ consentState: consentState || {} }),
    },
  );
}

export default {
  createOnboardingApplication,
  fetchOnboardingApplication,
  fetchOnboardingApplicationStatus,
  saveOnboardingConsent,
};
