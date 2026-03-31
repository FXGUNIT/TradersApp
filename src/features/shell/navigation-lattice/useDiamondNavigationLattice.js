import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_VISIBLE_ARROWS,
  MOBILE_VISIBLE_ARROWS,
  NAV_ARROW_IDS,
  NEXT_SCREEN_BY_CONTEXT,
  computeCursorDistance,
  computeDistanceOpacity,
  detectInteractiveCollision,
  getArrowCenter,
  getCircadianOpacityFactor,
  getCollisionOffset,
  isArrowSuppressed,
  isPageBottomReached,
  readLearningProfile,
  recordArrowClicked,
  recordArrowIgnored,
  writeLearningProfile,
} from "./navigationLatticeService.js";

const IGNORE_SAMPLE_MS = 12000;
const WAKE_WINDOW_MS = 2200;
const IDLE_READING_MS = 9000;
const SUPPRESSED_OPACITY = 0.05;

export function useDiamondNavigationLattice({
  screen,
  setScreen,
  auth,
  disabled = false,
  onRestrictedBack,
}) {
  const arrowRefs = useRef({});
  const historyRef = useRef([]);
  const wakeUntilRef = useRef(0);
  const lastInteractionRef = useRef(0);
  const ignoreTimersRef = useRef({});
  const collisionFrameRef = useRef(null);
  const profileRef = useRef({});

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 768 : false,
  );
  const [isBottom, setIsBottom] = useState(
    typeof window !== "undefined" ? isPageBottomReached() : false,
  );
  const [isSleeping, setIsSleeping] = useState(false);
  const [cursor, setCursor] = useState({ x: Infinity, y: Infinity });
  const [collisionMap, setCollisionMap] = useState({});
  const [feedbackMap, setFeedbackMap] = useState({});
  const [, forceRerender] = useState(0);

  const visibleArrows = useMemo(
    () => (isMobile ? MOBILE_VISIBLE_ARROWS : DEFAULT_VISIBLE_ARROWS),
    [isMobile],
  );

  const userId = auth?.uid || "guest";
  const isAuthenticated = Boolean(auth?.uid);

  useEffect(() => {
    lastInteractionRef.current = Date.now();
    profileRef.current = readLearningProfile();
  }, []);

  const resetFeedback = useCallback((arrowId) => {
    window.setTimeout(() => {
      setFeedbackMap((previous) => ({
        ...previous,
        [arrowId]: null,
      }));
    }, 220);
  }, []);

  const triggerFeedback = useCallback(
    (arrowId, feedbackType) => {
      setFeedbackMap((previous) => ({
        ...previous,
        [arrowId]: feedbackType,
      }));
      resetFeedback(arrowId);
    },
    [resetFeedback],
  );

  const registerArrowRef = useCallback((arrowId) => {
    return (node) => {
      if (!node) {
        delete arrowRefs.current[arrowId];
        return;
      }
      arrowRefs.current[arrowId] = node;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      historyRef.current = [];
      return;
    }
    const history = historyRef.current;
    if (!history.length) {
      history.push(screen);
      return;
    }
    if (history[history.length - 1] !== screen) {
      history.push(screen);
      if (history.length > 25) {
        history.shift();
      }
    }
  }, [screen, isAuthenticated]);

  useEffect(() => {
    if (!visibleArrows.length) {
      return undefined;
    }
    const clearTimers = () => {
      Object.values(ignoreTimersRef.current).forEach((timerId) => {
        if (timerId) {
          window.clearTimeout(timerId);
        }
      });
      ignoreTimersRef.current = {};
    };
    clearTimers();

    visibleArrows.forEach((arrowId) => {
      ignoreTimersRef.current[arrowId] = window.setTimeout(() => {
        profileRef.current = recordArrowIgnored(
          profileRef.current,
          screen,
          arrowId,
          userId,
        );
        writeLearningProfile(profileRef.current);
        forceRerender((value) => value + 1);
      }, IGNORE_SAMPLE_MS);
    });

    return clearTimers;
  }, [screen, userId, visibleArrows]);

  useEffect(() => {
    const updateViewportState = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsBottom(isPageBottomReached());
    };

    const markInteraction = (event) => {
      if (event?.type === "pointermove") {
        setCursor({ x: event.clientX, y: event.clientY });
      }
      lastInteractionRef.current = Date.now();
      wakeUntilRef.current = lastInteractionRef.current + WAKE_WINDOW_MS;
      setIsSleeping(false);
    };

    updateViewportState();
    window.addEventListener("resize", updateViewportState);
    window.addEventListener("scroll", updateViewportState, { passive: true });
    window.addEventListener("pointermove", markInteraction, { passive: true });
    window.addEventListener("touchstart", markInteraction, { passive: true });
    window.addEventListener("keydown", markInteraction, { passive: true });

    return () => {
      window.removeEventListener("resize", updateViewportState);
      window.removeEventListener("scroll", updateViewportState);
      window.removeEventListener("pointermove", markInteraction);
      window.removeEventListener("touchstart", markInteraction);
      window.removeEventListener("keydown", markInteraction);
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const inactiveForMs = now - lastInteractionRef.current;
      const hasPlayingVideo = Array.from(document.querySelectorAll("video")).some(
        (video) => !video.paused && !video.ended && video.readyState >= 2,
      );
      const isReadingIdle =
        inactiveForMs > IDLE_READING_MS &&
        window.scrollY > window.innerHeight * 0.3;
      const sleepingBecauseVideo = hasPlayingVideo && now > wakeUntilRef.current;
      setIsSleeping(sleepingBecauseVideo || isReadingIdle);
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const recomputeCollisions = useCallback(() => {
    if (collisionFrameRef.current) {
      cancelAnimationFrame(collisionFrameRef.current);
    }
    collisionFrameRef.current = requestAnimationFrame(() => {
      const nextCollisionMap = {};
      visibleArrows.forEach((arrowId) => {
        const node = arrowRefs.current[arrowId];
        nextCollisionMap[arrowId] = detectInteractiveCollision(node);
      });
      setCollisionMap(nextCollisionMap);
    });
  }, [visibleArrows]);

  useEffect(() => {
    recomputeCollisions();
    window.addEventListener("scroll", recomputeCollisions, { passive: true });
    window.addEventListener("resize", recomputeCollisions);
    return () => {
      window.removeEventListener("scroll", recomputeCollisions);
      window.removeEventListener("resize", recomputeCollisions);
      if (collisionFrameRef.current) {
        cancelAnimationFrame(collisionFrameRef.current);
      }
    };
  }, [recomputeCollisions]);

  const getArrowOpacity = useCallback(
    (arrowId) => {
      if (disabled || isSleeping) {
        return 0;
      }

      const suppressed = isArrowSuppressed(
        profileRef.current,
        screen,
        arrowId,
        userId,
      );
      if (suppressed) {
        return SUPPRESSED_OPACITY;
      }
      if (collisionMap[arrowId]) {
        return SUPPRESSED_OPACITY;
      }

      const node = arrowRefs.current[arrowId];
      const centerPoint = getArrowCenter(node);
      const distance = computeCursorDistance(cursor, centerPoint);
      const distanceOpacity = computeDistanceOpacity(distance);
      if (distance <= 100) {
        return 1;
      }
      return Number((distanceOpacity * getCircadianOpacityFactor()).toFixed(3));
    },
    [collisionMap, cursor, disabled, isSleeping, screen, userId],
  );

  const getArrowTransform = useCallback(
    (arrowId) => {
      if (collisionMap[arrowId]) {
        return getCollisionOffset(arrowId);
      }
      return "translate3d(0, 0, 0)";
    },
    [collisionMap],
  );

  const runBackNavigation = useCallback(() => {
    if (!isAuthenticated) {
      triggerFeedback(NAV_ARROW_IDS.ANCHOR, "restricted");
      if (onRestrictedBack) {
        onRestrictedBack();
      }
      return;
    }
    const history = historyRef.current;
    if (history.length <= 1) {
      triggerFeedback(NAV_ARROW_IDS.ANCHOR, "restricted");
      return;
    }
    history.pop();
    const previousScreen = history[history.length - 1];
    if (previousScreen) {
      setScreen(previousScreen);
    }
  }, [isAuthenticated, onRestrictedBack, setScreen, triggerFeedback]);

  const runAscent = useCallback(() => {
    const mappedScreen = NEXT_SCREEN_BY_CONTEXT[screen];
    if (window.scrollY > 30) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (mappedScreen) {
      setScreen(mappedScreen);
    }
  }, [screen, setScreen]);

  const runLateral = useCallback(() => {
    const activeScroller = document.querySelector(
      "[data-horizontal-scroll='true'], .horizontal-scroll",
    );
    if (activeScroller && "scrollBy" in activeScroller) {
      activeScroller.scrollBy({ left: 280, behavior: "smooth" });
      return;
    }
    window.scrollBy({ left: 260, top: 0, behavior: "smooth" });
  }, []);

  const runDescent = useCallback(() => {
    if (isBottom) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const pageHeight = Math.max(
      document.body?.scrollHeight || 0,
      document.documentElement?.scrollHeight || 0,
    );
    window.scrollTo({ top: pageHeight, behavior: "smooth" });
  }, [isBottom]);

  const onArrowActivate = useCallback(
    (arrowId) => {
      profileRef.current = recordArrowClicked(profileRef.current, screen, arrowId, userId);
      writeLearningProfile(profileRef.current);

      switch (arrowId) {
        case NAV_ARROW_IDS.ANCHOR:
          runBackNavigation();
          break;
        case NAV_ARROW_IDS.ASCENT:
          runAscent();
          break;
        case NAV_ARROW_IDS.LATERAL:
          runLateral();
          break;
        case NAV_ARROW_IDS.DESCENT:
          runDescent();
          break;
        default:
          break;
      }
    },
    [runAscent, runBackNavigation, runDescent, runLateral, screen, userId],
  );

  return {
    visibleArrows,
    isBottom,
    isMobile,
    isSleeping,
    feedbackMap,
    registerArrowRef,
    getArrowOpacity,
    getArrowTransform,
    onArrowActivate,
  };
}

export default useDiamondNavigationLattice;
