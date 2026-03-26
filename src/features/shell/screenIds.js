export const SCREEN_IDS = Object.freeze({
  LOADING: "loading",
  LOGIN: "login",
  SIGNUP: "signup",
  WAITING: "waiting",
  OTP: "otp",
  FORCE_PASSWORD_RESET: "forcePasswordReset",
  SESSIONS: "sessions",
  HUB: "hub",
  CONSCIOUSNESS: "consciousness",
  ADMIN: "admin",
  APP: "app",
  SPLASH: "splash",
});

export const SCREEN_SEQUENCE = Object.freeze(Object.values(SCREEN_IDS));

export function isValidScreenId(value) {
  return SCREEN_SEQUENCE.includes(value);
}
