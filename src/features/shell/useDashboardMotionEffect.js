import { useEffect } from "react";

import { createCardTiltHandler } from "../../utils/uiUtils.js";

export function useDashboardMotionEffect({ screen }) {
  useEffect(() => {
    if (screen !== "app" && screen !== "admin") {
      return undefined;
    }

    const tiltCards = document.querySelectorAll(".card-tilt");
    tiltCards.forEach((card) => {
      createCardTiltHandler(card);
    });

    const pendingButtons = document.querySelectorAll('[data-status="pending"]');
    pendingButtons.forEach((btn) => {
      btn.classList.add("btn-pending-pulse");
    });
  }, [screen]);
}

export default useDashboardMotionEffect;
