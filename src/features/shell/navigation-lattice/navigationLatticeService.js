import { SCREEN_IDS } from "../screenIds.js";

const LEARNING_STORAGE_KEY = "aura_diamond_navigation_learning_v1";
const IGNORE_THRESHOLD = 3;
const GHOST_OPACITY = 0.15;
const SUPPRESSED_OPACITY = 0.05;
const ACTIVE_DISTANCE = 100;
const GHOST_DISTANCE = 300;

export const NAV_ARROW_IDS = Object.freeze({
  ANCHOR: "anchor",
  ASCENT: "ascent",
  LATERAL: "lateral",
  DESCENT: "descent",
});

export const NAV_ARROW_POSITIONS = Object.freeze({
  [NAV_ARROW_IDS.ANCHOR]: "top-left",
  [NAV_ARROW_IDS.ASCENT]: "top-right",
  [NAV_ARROW_IDS.LATERAL]: "bottom-right",
  [NAV_ARROW_IDS.DESCENT]: "bottom-center",
});

export const DEFAULT_VISIBLE_ARROWS = Object.freeze([
  NAV_ARROW_IDS.ANCHOR,
  NAV_ARROW_IDS.ASCENT,
  NAV_ARROW_IDS.LATERAL,
  NAV_ARROW_IDS.DESCENT,
]);

export const MOBILE_VISIBLE_ARROWS = Object.freeze([
  NAV_ARROW_IDS.ANCHOR,
  NAV_ARROW_IDS.DESCENT,
]);

export const NEXT_SCREEN_BY_CONTEXT = Object.freeze({
  [SCREEN_IDS.LOGIN]: SCREEN_IDS.SIGNUP,
  [SCREEN_IDS.SIGNUP]: SCREEN_IDS.LOGIN,
  [SCREEN_IDS.HUB]: SCREEN_IDS.APP,
  [SCREEN_IDS.APP]: SCREEN_IDS.CONSCIOUSNESS,
  [SCREEN_IDS.CONSCIOUSNESS]: SCREEN_IDS.HUB,
  [SCREEN_IDS.SESSIONS]: SCREEN_IDS.APP,
});

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function getCircadianOpacityFactor(now = new Date()) {
  const hour = now.getHours();
  if (hour >= 23 || hour < 5) {
    return 0.72;
  }
  if (hour >= 19) {
    return 0.86;
  }
  return 1;
}

export function isPageBottomReached(threshold = 16) {
  const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
  const viewport = window.innerHeight || 0;
  const pageHeight = Math.max(
    document.body?.scrollHeight || 0,
    document.documentElement?.scrollHeight || 0,
  );
  return scrollTop + viewport >= pageHeight - threshold;
}

export function computeDistanceOpacity(distance) {
  if (!Number.isFinite(distance)) {
    return GHOST_OPACITY;
  }
  if (distance <= ACTIVE_DISTANCE) {
    return 1;
  }
  if (distance >= GHOST_DISTANCE) {
    return GHOST_OPACITY;
  }
  const progress = (distance - ACTIVE_DISTANCE) / (GHOST_DISTANCE - ACTIVE_DISTANCE);
  return clamp(1 - progress * (1 - GHOST_OPACITY), GHOST_OPACITY, 1);
}

export function computeCursorDistance(pointA, pointB) {
  if (!pointA || !pointB) {
    return Infinity;
  }
  const deltaX = pointA.x - pointB.x;
  const deltaY = pointA.y - pointB.y;
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

export function getArrowCenter(node) {
  if (!node) {
    return null;
  }
  const rect = node.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function isInteractiveNode(node) {
  if (!node || !(node instanceof Element)) {
    return false;
  }
  return Boolean(
    node.closest(
      "button, a[href], input, select, textarea, [role='button'], [role='link'], [data-interactive='true'], [tabindex]:not([tabindex='-1'])",
    ),
  );
}

export function detectInteractiveCollision(node) {
  if (!node || typeof document.elementsFromPoint !== "function") {
    return false;
  }
  const rect = node.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const elements = document.elementsFromPoint(x, y);
  return elements.some(
    (element) =>
      !node.contains(element) &&
      !element.classList?.contains("aura-smart-arrow") &&
      isInteractiveNode(element),
  );
}

export function getCollisionOffset(arrowId) {
  switch (arrowId) {
    case NAV_ARROW_IDS.ANCHOR:
      return "translate3d(40px, 0, 0)";
    case NAV_ARROW_IDS.ASCENT:
      return "translate3d(-40px, 0, 0)";
    case NAV_ARROW_IDS.LATERAL:
      return "translate3d(-40px, 0, 0)";
    case NAV_ARROW_IDS.DESCENT:
      return "translate3d(0, -40px, 0)";
    default:
      return "translate3d(0, 0, 0)";
  }
}

function safeParseLearning(rawValue) {
  if (!rawValue) {
    return {};
  }
  try {
    return JSON.parse(rawValue) || {};
  } catch {
    return {};
  }
}

export function readLearningProfile() {
  try {
    const stored = localStorage.getItem(LEARNING_STORAGE_KEY);
    return safeParseLearning(stored);
  } catch {
    return {};
  }
}

export function writeLearningProfile(profile) {
  try {
    localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // no-op in restricted storage mode
  }
}

function getLearningKey(screen, arrowId, userId) {
  return `${userId || "guest"}::${screen || "unknown"}::${arrowId}`;
}

export function isArrowSuppressed(profile, screen, arrowId, userId) {
  const key = getLearningKey(screen, arrowId, userId);
  const record = profile?.[key];
  if (!record) {
    return false;
  }
  return Boolean(record.suppressed);
}

export function recordArrowIgnored(profile, screen, arrowId, userId) {
  const key = getLearningKey(screen, arrowId, userId);
  const currentRecord = profile[key] || { ignored: 0, clicks: 0, suppressed: false };
  const nextRecord = {
    ...currentRecord,
    ignored: currentRecord.ignored + 1,
  };
  nextRecord.suppressed =
    nextRecord.ignored >= IGNORE_THRESHOLD && nextRecord.clicks === 0;
  return {
    ...profile,
    [key]: nextRecord,
  };
}

export function recordArrowClicked(profile, screen, arrowId, userId) {
  const key = getLearningKey(screen, arrowId, userId);
  const currentRecord = profile[key] || { ignored: 0, clicks: 0, suppressed: false };
  const nextRecord = {
    ...currentRecord,
    clicks: currentRecord.clicks + 1,
    suppressed: false,
  };
  return {
    ...profile,
    [key]: nextRecord,
  };
}
