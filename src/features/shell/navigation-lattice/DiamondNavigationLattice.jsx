import React from "react";
import { SCREEN_IDS } from "../screenIds.js";
import {
  NAV_ARROW_IDS,
  NAV_ARROW_POSITIONS,
} from "./navigationLatticeService.js";
import { useDiamondNavigationLattice } from "./useDiamondNavigationLattice.js";
import "./diamondNavigationLattice.css";

function ArrowGlyph({ direction }) {
  const pathByDirection = {
    left: "M15 5 L7 12 L15 19 M8 12 H21",
    right: "M9 5 L17 12 L9 19 M3 12 H16",
    up: "M5 15 L12 7 L19 15 M12 8 V21",
    down: "M5 9 L12 17 L19 9 M12 3 V16",
  };

  return (
    <svg
      aria-hidden="true"
      className="aura-smart-arrow__glyph"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={pathByDirection[direction] || pathByDirection.right} />
    </svg>
  );
}

export default function DiamondNavigationLattice({
  screen,
  setScreen,
  auth,
  disabled = false,
  onRestrictedBack,
}) {
  const {
    visibleArrows,
    isBottom,
    feedbackMap,
    registerArrowRef,
    getArrowOpacity,
    getArrowTransform,
    hasArrowCollision,
    onArrowActivate,
  } = useDiamondNavigationLattice({
    screen,
    setScreen,
    auth,
    disabled,
    onRestrictedBack,
  });

  const shouldRender = ![
    SCREEN_IDS.LOADING,
    SCREEN_IDS.SPLASH,
  ].includes(screen);

  if (!shouldRender || disabled) {
    return null;
  }

  const directionByArrow = {
    [NAV_ARROW_IDS.ANCHOR]: "left",
    [NAV_ARROW_IDS.ASCENT]: "up",
    [NAV_ARROW_IDS.LATERAL]: "right",
    [NAV_ARROW_IDS.DESCENT]: isBottom ? "up" : "down",
  };

  const labelByArrow = {
    [NAV_ARROW_IDS.ANCHOR]: "Global back",
    [NAV_ARROW_IDS.ASCENT]: "Back to top or primary action",
    [NAV_ARROW_IDS.LATERAL]: "Next step or lateral move",
    [NAV_ARROW_IDS.DESCENT]: isBottom ? "Back to top" : "Jump to bottom",
  };

  return (
    <nav className="aura-smart-lattice" aria-label="Diamond navigation lattice">
      {visibleArrows.map((arrowId) => {
        const feedbackType = feedbackMap[arrowId];
        const opacity = getArrowOpacity(arrowId);
        const transform = getArrowTransform(arrowId);
        const isColliding = hasArrowCollision(arrowId);
        const classNames = [
          "aura-smart-arrow",
          `aura-smart-arrow--${NAV_ARROW_POSITIONS[arrowId]}`,
        ];

        if (feedbackType === "restricted") {
          classNames.push("aura-smart-arrow--restricted");
        }

        return (
          <button
            key={arrowId}
            ref={registerArrowRef(arrowId)}
            type="button"
            className={classNames.join(" ")}
            aria-label={labelByArrow[arrowId]}
            onClick={() => onArrowActivate(arrowId)}
            style={{
              opacity,
              transform,
              pointerEvents: isColliding ? "none" : "auto",
            }}
          >
            <ArrowGlyph direction={directionByArrow[arrowId]} />
            <span aria-hidden="true" className="aura-smart-arrow__spark" />
            <span aria-hidden="true" className="aura-smart-arrow__ripple" />
          </button>
        );
      })}
    </nav>
  );
}
