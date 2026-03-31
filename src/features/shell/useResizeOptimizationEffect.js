import { useEffect } from "react";

export function useResizeOptimizationEffect() {
  useEffect(() => {
    let resizeTimer = null;

    const handleResizeDebounced = () => {
      if (resizeTimer) clearTimeout(resizeTimer);

      resizeTimer = setTimeout(() => {
        const event = new CustomEvent("layoutOptimized", {
          detail: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
        });
        window.dispatchEvent(event);
      }, 150);
    };

    window.addEventListener("resize", handleResizeDebounced, { passive: true });

    return () => {
      window.removeEventListener("resize", handleResizeDebounced);
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, []);
}

export default useResizeOptimizationEffect;
