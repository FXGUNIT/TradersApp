import { isFeatureEnabled } from "../config/features.js";

export default function FeatureGuard({
  feature,
  children,
  fallback = null,
}) {
  if (!feature) {
    return fallback;
  }

  return isFeatureEnabled(feature) ? children : fallback;
}
