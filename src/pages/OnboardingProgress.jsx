import React from "react";
import { CSS_VARS } from "../styles/cssVars.js";

/**
 * OnboardingProgress — renders the step progress bar (line 341-360 pattern).
 * Shows N segments, each filled when step >= segment index.
 */
export function OnboardingProgress({ step, totalSteps = 2 }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${totalSteps}, minmax(0, 1fr))`,
        gap: 10,
        marginBottom: 20,
      }}
    >
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((stepId) => (
        <div
          key={stepId}
          style={{
            height: 8,
            borderRadius: 999,
            background:
              step >= stepId ? CSS_VARS.accentPrimary : CSS_VARS.borderSubtle,
            transition: "background 0.18s ease",
          }}
        />
      ))}
    </div>
  );
}

export default OnboardingProgress;
