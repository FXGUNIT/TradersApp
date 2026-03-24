/**
 * ═══════════════════════════════════════════════════════════════════
 * CONFETTI CELEBRATION - Phase 3
 * ═══════════════════════════════════════════════════════════════════
 *
 * Component: ConfettiCelebration
 * Purpose: A visual effect to celebrate user approval.
 *
 * Task: 3.7
 */

import React, { useMemo } from "react";

// Helper function to generate random confetti (outside component for purity)
const generateConfetti = () =>
  Array.from({ length: 150 }).map((_, i) => ({
    id: i,
    style: {
      left: `${Math.random() * 100}%`,
      animationDuration: `${Math.random() * 3 + 2}s`,
      animationDelay: `${Math.random() * 2}s`,
      backgroundColor: `hsl(${Math.random() * 360}, 100%, 50%)`,
    },
  }));

const ConfettiCelebration = () => {
  const confetti = useMemo(() => generateConfetti(), []);

  return (
    <div className="confetti-container">
      {confetti.map((c) => (
        <div key={c.id} className="confetti" style={c.style}></div>
      ))}
      <style>{`
        .confetti-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          overflow: hidden;
          z-index: 9999;
        }

        .confetti {
          position: absolute;
          width: 10px;
          height: 10px;
          opacity: 0;
          animation-name: fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        @keyframes fall {
          0% {
            transform: translateY(-10vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default ConfettiCelebration;
