// Minimal runtime style payload for shell-thinned interactions.
const STYLE_ID = "traders-regiment-runtime-styles";

if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const styleSheet = document.createElement("style");
  styleSheet.id = STYLE_ID;
  styleSheet.textContent = `
    :root {
      --surface-elevated: var(--aura-surface-elevated, #ffffff);
      --border-subtle: var(--aura-border-subtle, rgba(0, 0, 0, 0.08));
      --accent-primary: var(--aura-accent-primary, #2563eb);
      --status-danger: var(--aura-status-danger, #ef4444);
    }

    @keyframes confetti-fall {
      0% {
        opacity: 1;
        transform: translate3d(0, 0, 0) rotateZ(0deg);
      }
      100% {
        opacity: 0;
        transform: translate3d(0, 400px, 0) rotateZ(720deg);
      }
    }

    @keyframes card-tilt-in {
      0% {
        transform: perspective(1000px) rotateX(0deg) rotateY(0deg);
      }
      100% {
        transform: perspective(1000px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg));
      }
    }

    @keyframes pulse-critical {
      0% {
        box-shadow: 0 0 0 0 color-mix(in srgb, var(--status-danger, #ef4444) 70%, transparent);
      }
      50% {
        box-shadow: 0 0 0 10px color-mix(in srgb, var(--status-danger, #ef4444) 30%, transparent);
      }
      100% {
        box-shadow: 0 0 0 20px color-mix(in srgb, var(--status-danger, #ef4444) 0%, transparent);
      }
    }

    .confetti-piece {
      position: fixed;
      width: 10px;
      height: 10px;
      pointer-events: none;
      z-index: 9999;
      background: var(--accent-primary, #2563eb);
      animation: confetti-fall 2.5s ease-in forwards;
      will-change: transform, opacity;
    }

    .card-tilt {
      perspective: 1000px;
      transition:
        transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
        box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }

    .card-tilt:hover {
      animation: card-tilt-in 0.3s ease-out forwards;
      box-shadow:
        0 12px 32px color-mix(in srgb, var(--border-subtle, rgba(0, 0, 0, 0.08)) 55%, transparent),
        0 0 20px color-mix(in srgb, var(--accent-primary, #2563eb) 18%, transparent);
    }

    .btn-pending-pulse {
      animation: pulse-critical 2s infinite;
    }
  `;
  document.head.appendChild(styleSheet);
}
