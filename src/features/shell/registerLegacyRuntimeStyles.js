// Legacy runtime style payload extracted from App shell for orchestrator thinning.
const styleSheet = document.createElement("style");
styleSheet.innerText = `
  @keyframes bar { from { height: 4px; opacity: 0.3; } to { opacity: 1; } }
  @keyframes bar { from { height: 4px; opacity: 0.3; } to { opacity: 1; } }
  @keyframes led-pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.9); } 100% { opacity: 1; transform: scale(1); } }
  @keyframes fadein { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 0.3; } 100% { opacity: 0.6; } }
  @keyframes shimmer { 0% { background-position: -1000px 0; } 100% { background-position: 1000px 0; } }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
  @keyframes fadeInDashboard { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideInToast { from { opacity: 0; transform: translateX(400px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes glowBorder { 0% { box-shadow: 0 0 10px rgba(0,122,255,0.3); } 50% { box-shadow: 0 0 20px rgba(0,122,255,0.5); } 100% { box-shadow: 0 0 10px rgba(0,122,255,0.3); } }
  
  /* MODULE 5: Motion & Interaction (#123, #125, #143, #144, #145, #147) */
  
  /* RULE #123: Confetti Success Animation - Celebration bursts */
  @keyframes confetti-fall { 
    0% { opacity: 1; transform: translateY(0) rotateZ(0deg); } 
    100% { opacity: 0; transform: translateY(400px) rotateZ(720deg); } 
  }
  @keyframes confetti-rotate { 
    0% { transform: rotateX(0deg) rotateY(0deg); } 
    100% { transform: rotateX(360deg) rotateY(360deg); } 
  }
  
  .confetti-piece {
    position: fixed;
    width: 10px;
    height: 10px;
    animation: confetti-fall 2.5s ease-in forwards;
    pointer-events: none;
    z-index: 9999;
  }
  
  /* RULE #125: Card Tilt Effect - 3D perspective on hover */
  @keyframes tilt-in { 
    0% { transform: perspective(1000px) rotateX(0deg) rotateY(0deg); } 
    100% { transform: perspective(1000px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg)); } 
  }
  
  .card-tilt {
    perspective: 1000px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .card-tilt:hover {
    animation: tilt-in 0.3s ease-out forwards;
  }
  
  /* RULE #125: Enhanced Pulse Effect - Critical pending buttons */
  @keyframes pulse-critical { 
    0% { box-shadow: 0 0 0 0 rgba(255,69,58,0.7); } 
    50% { box-shadow: 0 0 0 10px rgba(255,69,58,0.3); } 
    70% { box-shadow: 0 0 0 15px rgba(255,69,58,0.1); } 
    100% { box-shadow: 0 0 0 20px rgba(255,69,58,0); } 
  }
  
  @keyframes pulse-attention { 
    0% { transform: scale(1); box-shadow: 0 0 8px rgba(255,214,10,0.5); } 
    50% { transform: scale(1.05); box-shadow: 0 0 16px rgba(255,214,10,0.8); } 
    100% { transform: scale(1); box-shadow: 0 0 8px rgba(255,214,10,0.5); } 
  }
  
  /* RULE #143-#145: Button & Card Motion Effects */
  .btn-pending-pulse {
    animation: pulse-critical 2s infinite;
  }
  
  .btn-attention-pulse {
    animation: pulse-attention 1.5s ease-in-out infinite;
  }
  
  .card-pulse-entry {
    animation: fadeInDashboard 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  
  /* RULE #147: Micro-interactions - Smooth state transitions */
  .hover-lift {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .hover-lift:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0,0,0,0.15);
  }
  
  /* Bounce effect for confirmations */
  @keyframes bounce-in {
    0% { transform: scale(0.95); opacity: 0; }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); opacity: 1; }
  }
  
  .bounce-in {
    animation: bounce-in 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  }
  
  /* Shake effect for validation errors */
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
  }
  
  .shake-error {
    animation: shake 0.4s ease-in-out;
  }
  
  /* Slide in effects */
  @keyframes slide-in-left {
    from { opacity: 0; transform: translateX(-40px); }
    to { opacity: 1; transform: translateX(0); }
  }
  
  @keyframes slide-in-right {
    from { opacity: 0; transform: translateX(40px); }
    to { opacity: 1; transform: translateX(0); }
  }
  
  .slide-in-left { animation: slide-in-left 0.4s ease-out; }
  .slide-in-right { animation: slide-in-right 0.4s ease-out; }
  
  /* MODULE 8: Visual Polish & Experience - Glassmorphism (#126, #134, #137, #138) */
  /* RULE #126: Glassmorphism - Premium institutional aesthetic */
  html { 
    scroll-behavior: smooth;
    background: #FFFFFF;
  }
  body { 
    scroll-behavior: smooth;
    background: #FFFFFF;
    color: #000000;
    color: #F2F2F7;
  }
  * { 
    scroll-behavior: smooth;
    box-sizing: border-box;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  }
  
  /* RULE #129: Smooth Transitions - All interactive elements */
  button, input, textarea, select, a, [role="button"] {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  /* Custom scrollbars */
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { 
    background: rgba(0,122,255,0.3); 
    border-radius: 8px;
    backdrop-filter: blur(4px);
  }
  ::-webkit-scrollbar-thumb:hover { 
    background: rgba(0,122,255,0.6); 
    box-shadow: 0 0 10px rgba(0,122,255,0.3);
  }
  
  /* Firefox scrollbar styling */
  * { 
    scrollbar-color: rgba(0,122,255,0.3) transparent; 
    scrollbar-width: thin; 
  }
  
  /* Aspect ratio lock */
  .aspect-ratio-1-1 { aspect-ratio: 1/1; object-fit: cover; }
  .aspect-ratio-4-3 { aspect-ratio: 4/3; object-fit: cover; }
  .aspect-ratio-16-9 { aspect-ratio: 16/9; object-fit: cover; }
  .aspect-ratio-3-2 { aspect-ratio: 3/2; object-fit: cover; }
  
  /* Mobile responsive */
  @media (max-width: 768px) {
    body { padding-bottom: 68px; }
  }
  
  /* RULE #134: Glass Panel - Core glassmorphic component */
  .glass-panel { 
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 8px 32px rgba(0,0,0,0.1);
  }
  
  .glass-panel:hover { 
    border-color: rgba(255,255,255,0.15) !important;
    box-shadow: 0 12px 48px rgba(0,0,0,0.15), 0 0 20px rgba(0,122,255,0.05) !important;
    background: rgba(255,255,255,0.08);
  }
  
  /* GLASSMORPHIC CARDS */
  .glassmorphic-card {
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 20px 24px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .glassmorphic-card:hover {
    background: rgba(255,255,255,0.08);
    border-color: rgba(255,255,255,0.15);
    box-shadow: 0 8px 32px rgba(0,0,0,0.15);
  }
  
  /* GLASSMORPHIC SIDEBAR */
  .glassmorphic-sidebar {
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 0 16px 16px 0;
  }
  
  /* GLASSMORPHIC MODAL */
  .glassmorphic-modal {
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    background: rgba(20,24,50,0.45);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  }
  
  /* RULE #137: Glass Button - Interactive glassmorphic buttons */
  .btn-glass {
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 8px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
  }
  
  .btn-glass:hover {
    background: rgba(255,255,255,0.12);
    border-color: rgba(255,255,255,0.25);
    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
    transform: translateY(-2px);
  }
  
  .btn-glass:active { 
    transform: scale(0.97) translateY(0);
    box-shadow: inset 0 0 10px rgba(255,255,255,0.1);
  }
  
  /* RULE #138: Glass Input - Glassmorphic form inputs */
  .input-glass {
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    color: #F2F2F7;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .input-glass:focus { 
    background: rgba(255,255,255,0.1) !important;
    border-color: rgba(255,255,255,0.3) !important; 
    box-shadow: 0 0 20px rgba(0,122,255,0.2), inset 0 0 10px rgba(0,122,255,0.05) !important;
    outline: none;
  }
  
  .input-glass::placeholder {
    color: rgba(242,242,247,0.4);
  }
  
  /* GLASSMORPHIC TABLE */
  .glassmorphic-table {
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
  }
  
  .glassmorphic-table tr:hover {
    background: rgba(255,255,255,0.08);
  }
  
  /* GLASSMORPHIC SECTION */
  .glassmorphic-section {
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    padding: 24px;
  }
  
  /* GLASSMORPHIC CONTAINER */
  .glassmorphic-container {
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    background: rgba(255,255,255,0.05);
    border-radius: 16px;
  }
  
  /* GLASSMORPHIC DROPDOWN */
  .glassmorphic-dropdown {
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
  }
  
  .glassmorphic-dropdown:hover {
    background: rgba(255,255,255,0.12);
    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  }
  
  /* Premium text styling */
  .gemini-gradient-text { 
    background: linear-gradient(90deg, #fff, #a1a1a6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  /* Glassmorphic modal backdrop */
  .modal-glass {
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    background: rgba(0,0,0,0.6);
  }
  
  /* Glow effect for active elements */
  .glow-active {
    animation: glowBorder 2s ease-in-out infinite;
  }
  
  /* NEON BORDER GLOW - ACTIVE TRADE CARDS & BUTTONS */
  @keyframes neonGlow { 
    0% { box-shadow: 0 0 5px currentColor, 0 0 10px currentColor, inset 0 0 5px currentColor; } 
    50% { box-shadow: 0 0 10px currentColor, 0 0 20px currentColor, inset 0 0 10px currentColor; } 
    100% { box-shadow: 0 0 5px currentColor, 0 0 10px currentColor, inset 0 0 5px currentColor; } 
  }
  
  @keyframes subtleGlow { 
    0% { box-shadow: 0 0 8px rgba(10,132,255,0.4); } 
    50% { box-shadow: 0 0 16px rgba(10,132,255,0.6); } 
    100% { box-shadow: 0 0 8px rgba(10,132,255,0.4); } 
  }
  
  /* ACTIVE ELEMENT GLOW EFFECT */
  .active-glow {
    box-shadow: 0 0 12px rgba(0,122,255,0.6), inset 0 0 8px rgba(0,122,255,0.2);
    border-color: rgba(0,122,255,0.8);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .active-glow.glow-green { box-shadow: 0 0 12px rgba(48,209,88,0.6), inset 0 0 8px rgba(48,209,88,0.2); border-color: rgba(48,209,88,0.8); }
  .active-glow.glow-gold { box-shadow: 0 0 12px rgba(255,214,10,0.6), inset 0 0 8px rgba(255,214,10,0.2); border-color: rgba(255,214,10,0.8); }
  .active-glow.glow-purple { box-shadow: 0 0 12px rgba(191,90,242,0.6), inset 0 0 8px rgba(191,90,242,0.2); border-color: rgba(191,90,242,0.8); }
  .active-glow.glow-cyan { box-shadow: 0 0 12px rgba(100,210,255,0.6), inset 0 0 8px rgba(100,210,255,0.2); border-color: rgba(100,210,255,0.8); }
  .active-glow.glow-pink { box-shadow: 0 0 12px rgba(255,55,95,0.6), inset 0 0 8px rgba(255,55,95,0.2); border-color: rgba(255,55,95,0.8); }
  
  /* TRADE CARD ACTIVE STATE */
  .trade-card-active {
    border: 1px solid rgba(0,122,255,0.8);
    box-shadow: 0 0 15px rgba(0,122,255,0.5), inset 0 0 10px rgba(0,122,255,0.1);
    animation: subtleGlow 2s ease-in-out infinite;
  }
  
  /* BUTTON GLOW - ACTIVE STATE */
  .btn-glow {
    position: relative;
    overflow: visible;
  }
  
  .btn-glow:active,
  .btn-glow.active {
    box-shadow: 0 0 12px rgba(0,122,255,0.6), inset 0 0 6px rgba(0,122,255,0.3);
    transform: scale(0.98);
  }
  
  .btn-glow:focus {
    outline: none;
    box-shadow: 0 0 8px rgba(0,122,255,0.4);
  }
  
  /* TYPOGRAPHY HIERARCHY (#129, #133) */
  /* H1: Page Title - Primary heading */
  h1, .h1 {
    font-size: 32px;
    font-weight: 800;
    line-height: 1.2;
    letter-spacing: -0.5px;
    margin: 0 0 24px 0;
    color: #F2F2F7;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  /* H2: Section Header - Secondary heading */
  h2, .h2 {
    font-size: 24px;
    font-weight: 700;
    line-height: 1.15;
    letter-spacing: -0.3px;
    margin: 28px 0 16px 0;
    color: #F2F2F7;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    padding-bottom: 12px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  /* H3: Subsection Header - Tertiary heading */
  h3, .h3 {
    font-size: 18px;
    font-weight: 600;
    line-height: 1.1;
    letter-spacing: 0px;
    margin: 18px 0 10px 0;
    color: #E8E8ED;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  /* Body Text - Standard paragraph text */
  p, .body-text {
    font-size: 14px;
    font-weight: 400;
    line-height: 1.6;
    letter-spacing: 0.3px;
    margin: 0 0 12px 0;
    color: #D1D1D6;
  }
  
  /* Small Text - annotations, secondary info */
  small, .text-sm {
    font-size: 12px;
    font-weight: 400;
    line-height: 1.4;
    letter-spacing: 0.2px;
    color: #A1A1A6;
  }
  
  /* Label Text - form labels, metadata */
  label, .label {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: 0.5px;
    color: #B0B0B5;
    text-transform: uppercase;
  }
  
  /* ICON CONSISTENCY (#139, #140, #141) */
  /* Standardized icon sizes with consistent styling */
  .icon, [class*="icon-"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    line-height: 1;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  /* Extra Small Icon (16px) - Inline annotations */
  .icon-xs {
    font-size: 16px;
    width: 16px;
    height: 16px;
    margin: 0 4px;
  }
  
  /* Small Icon (18px) - Menu items, sidebar items */
  .icon-sm {
    font-size: 18px;
    width: 18px;
    height: 18px;
    margin: 0 6px;
  }
  
  /* Medium Icon (20px) - Buttons, form elements */
  .icon-md {
    font-size: 20px;
    width: 20px;
    height: 20px;
    margin: 0 8px;
  }
  
  /* Large Icon (24px) - Headers, section titles */
  .icon-lg {
    font-size: 24px;
    width: 24px;
    height: 24px;
    margin: 0 10px;
  }
  
  /* Extra Large Icon (32px) - Page headers, splash screens */
  .icon-xl {
    font-size: 32px;
    width: 32px;
    height: 32px;
    margin: 0 12px;
  }
  
  /* Icon color variants - Inherit from text or apply specific colors */
  .icon-primary { color: #F2F2F7; }
  .icon-accent { color: #007AFF; }
  .icon-success { color: #30D158; }
  .icon-warning { color: #FFD60A; }
  .icon-danger { color: #FF453A; }
  .icon-muted { color: #A1A1A6; }
  
  /* Icon animation states */
  .icon-spin {
    animation: spin 2s linear infinite;
  }
  
  .icon-pulse {
    animation: pulse-icon 2s ease-in-out infinite;
  }
  
  .icon-bounce {
    animation: bounce-icon 0.6s ease-in-out;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  @keyframes pulse-icon {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  
  @keyframes bounce-icon {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }
  
  /* Icon in buttons - Proper alignment and spacing */
  button .icon, .btn-glass .icon, [role="button"] .icon {
    margin-right: 6px;
  }
  
  /* Icon in text - Proper baseline alignment */
  span .icon, p .icon, label .icon {
    vertical-align: -0.125em;
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  /* RULE #127: CUSTOM CURSOR FOR DATA CHARTS */
  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  /* Crosshair cursor on interactive chart/data elements for precision */
  .chart-container,
  .heatmap,
  .bar-chart,
  [data-chart],
  canvas,
  svg[data-interactive="true"],
  .hourly-heatmap {
    cursor: crosshair !important;
  }
  
  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  /* RULE #133: ICON CONSISTENCY - Stroke width & style uniformity */
  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  /* SVG icon consistency - 2px stroke width, rounded joins */
  svg.feather,
  svg[class*="icon"],
  [role="img"] svg {
    stroke: currentColor;
    stroke-width: 2 !important;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    vertical-align: -0.125em;
  }
  
  /* Emoji icon consistency - proper spacing and alignment */
  .emoji-icon,
  [class*="icon-emoji"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 0 4px;
    line-height: 1;
    font-size: 1em;
  }
  
  /* Icon button consistency */
  .icon-button,
  [class*="btn"] [class*="icon"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 8px;
    border-radius: 6px;
    transition: all 0.2s ease;
    font-size: 18px;
    line-height: 1;
  }
  
  .icon-button:hover {
    background: rgba(255, 255, 255, 0.08) !important;
    transform: scale(1.05);
  }
  
  /* RULE #180: Hardware Acceleration - GPU-accelerated animations for high-motion elements */
  
  /* Feature detection: GPU-accelerated transforms */
  @supports (transform: translateZ(0)) {
    /* HIGH-MOTION ELEMENTS WITH GPU ACCELERATION */
    
    /* Spinner animations - frequent motion */
    @keyframes spin-gpu {
      from { transform: translateZ(0) rotate(0deg); }
      to { transform: translateZ(0) rotate(360deg); }
    }
    
    /* Float/hover animations */
    @keyframes float-gpu {
      0%, 100% { transform: translateZ(0) translateY(0px); }
      50% { transform: translateZ(0) translateY(-8px); }
    }
    
    /* Fade with translation - dashboard entry */
    @keyframes fadeInDashboard-gpu {
      from { opacity: 0; transform: translateZ(0) translateY(-5px); }
      to { opacity: 1; transform: translateZ(0) translateY(0); }
    }
    
    /* Toast slide animation */
    @keyframes slideInToast-gpu {
      from { opacity: 0; transform: translateZ(0) translateX(400px); }
      to { opacity: 1; transform: translateZ(0) translateX(0); }
    }
    
    /* Confetti falls with Z depth */
    @keyframes confetti-fall-gpu {
      0% { opacity: 1; transform: translateZ(0) translateY(0) rotateZ(0deg); }
      100% { opacity: 0; transform: translateZ(0) translateY(400px) rotateZ(720deg); }
    }
    
    /* Pulse effects with GPU */
    @keyframes pulse-critical-gpu {
      0% { box-shadow: 0 0 0 0 rgba(255,69,58,0.7); transform: translateZ(0); }
      50% { box-shadow: 0 0 0 10px rgba(255,69,58,0.3); transform: translateZ(0); }
      100% { box-shadow: 0 0 0 20px rgba(255,69,58,0); transform: translateZ(0); }
    }
    
    @keyframes pulse-attention-gpu {
      0% { transform: translateZ(0) scale(1); box-shadow: 0 0 8px rgba(255,214,10,0.5); }
      50% { transform: translateZ(0) scale(1.05); box-shadow: 0 0 16px rgba(255,214,10,0.8); }
      100% { transform: translateZ(0) scale(1); box-shadow: 0 0 8px rgba(255,214,10,0.5); }
    }
    
    /* Bounce effect for confirmations */
    @keyframes bounce-in-gpu {
      0% { transform: translateZ(0) scale(0.95); opacity: 0; }
      50% { transform: translateZ(0) scale(1.05); }
      100% { transform: translateZ(0) scale(1); opacity: 1; }
    }
    
    /* Shake effect with GPU */
    @keyframes shake-gpu {
      0%, 100% { transform: translateZ(0) translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateZ(0) translateX(-5px); }
      20%, 40%, 60%, 80% { transform: translateZ(0) translateX(5px); }
    }
    
    /* Slide animations */
    @keyframes slide-in-left-gpu {
      from { opacity: 0; transform: translateZ(0) translateX(-40px); }
      to { opacity: 1; transform: translateZ(0) translateX(0); }
    }
    
    @keyframes slide-in-right-gpu {
      from { opacity: 0; transform: translateZ(0) translateX(40px); }
      to { opacity: 1; transform: translateZ(0) translateX(0); }
    }
    
    /* LED pulse with GPU */
    @keyframes led-pulse-gpu {
      0% { opacity: 1; transform: translateZ(0) scale(1); }
      50% { opacity: 0.4; transform: translateZ(0) scale(0.9); }
      100% { opacity: 1; transform: translateZ(0) scale(1); }
    }
    
    /* Apply GPU animations to high-motion elements */
    
    /* Animated spinners */
    [class*="spinner"],
    [class*="loader"],
    .loading-indicator {
      animation: spin-gpu 1s linear infinite !important;
      will-change: transform;
    }
    
    /* Floating/hover elements */
    [class*="float"],
    .floating-element,
    .animated-icon {
      will-change: transform;
    }
    
    /* Dashboard & card animations */
    [class*="fadeIn"],
    .card-pulse-entry,
    [class*="fade-in"],
    .dashboard-entry {
      animation: fadeInDashboard-gpu 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
      will-change: opacity, transform;
    }
    
    /* Toast notifications */
    [class*="toast"],
    [class*="notification"],
    .slide-in-toast {
      animation: slideInToast-gpu 0.3s ease-out !important;
      will-change: opacity, transform;
    }
    
    /* Success animations (confetti) */
    .confetti-piece,
    [class*="confetti"] {
      animation: confetti-fall-gpu 2.5s ease-in forwards !important;
      will-change: opacity, transform;
    }
    
    /* Pulse animations */
    .btn-pending-pulse {
      animation: pulse-critical-gpu 2s infinite !important;
      will-change: box-shadow, transform;
    }
    
    .btn-attention-pulse {
      animation: pulse-attention-gpu 1.5s ease-in-out infinite !important;
      will-change: transform, box-shadow;
    }
    
    /* Action animations */
    .bounce-in {
      animation: bounce-in-gpu 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) !important;
      will-change: transform, opacity;
    }
    
    .shake-error {
      animation: shake-gpu 0.4s ease-in-out !important;
      will-change: transform;
    }
    
    /* Slide animations */
    .slide-in-left {
      animation: slide-in-left-gpu 0.4s ease-out !important;
      will-change: opacity, transform;
    }
    
    .slide-in-right {
      animation: slide-in-right-gpu 0.4s ease-out !important;
      will-change: opacity, transform;
    }
    
    /* LED indicators */
    .led-pulse-indicator,
    [class*="led-pulse"] {
      animation: led-pulse-gpu 1.5s ease-in-out infinite !important;
      will-change: opacity, transform;
    }
    
    /* Scrollable areas with GPU acceleration */
    [class*="sidebar"],
    [class*="scroll"],
    [class*="overflow"],
    .scrollable-area {
      will-change: scroll-position;
      transform: translateZ(0);
    }
    
    /* P&L tracker and financial displays */
    [class*="pnl"],
    [class*="tracker"],
    [class*="balance"],
    [class*="account-state"],
    .financial-display,
    .variance-display {
      will-change: opacity, transform;
      transform: translateZ(0);
      backface-visibility: hidden;
      perspective: 1000px;
    }
  }
  
  /* FALLBACK: CPU-ONLY RENDERING for unsupported browsers */
  @supports not (transform: translateZ(0)) {
    /* Fallback animations without 3D transforms */
    
    /* Standard spinner animation */
    @keyframes spin-cpu {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    /* Float effect - 2D only */
    @keyframes float-cpu {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-8px); }
    }
    
    /* Dashboard fade - no 3D */
    @keyframes fadeInDashboard-cpu {
      from { opacity: 0; transform: translateY(-5px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    /* Toast slide - 2D translation */
    @keyframes slideInToast-cpu {
      from { opacity: 0; transform: translateX(400px); }
      to { opacity: 1; transform: translateX(0); }
    }
    
    /* Confetti without 3D depth */
    @keyframes confetti-fall-cpu {
      0% { opacity: 1; transform: translateY(0) rotateZ(0deg); }
      100% { opacity: 0; transform: translateY(400px) rotateZ(720deg); }
    }
    
    /* Pulse without Z-depth */
    @keyframes pulse-critical-cpu {
      0% { box-shadow: 0 0 0 0 rgba(255,69,58,0.7); }
      50% { box-shadow: 0 0 0 10px rgba(255,69,58,0.3); }
      100% { box-shadow: 0 0 0 20px rgba(255,69,58,0); }
    }
    
    @keyframes pulse-attention-cpu {
      0% { transform: scale(1); box-shadow: 0 0 8px rgba(255,214,10,0.5); }
      50% { transform: scale(1.05); box-shadow: 0 0 16px rgba(255,214,10,0.8); }
      100% { transform: scale(1); box-shadow: 0 0 8px rgba(255,214,10,0.5); }
    }
    
    /* Bounce - standard transforms */
    @keyframes bounce-in-cpu {
      0% { transform: scale(0.95); opacity: 0; }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); opacity: 1; }
    }
    
    /* Shake - 2D movement */
    @keyframes shake-cpu {
      0%, 100% { transform: translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
      20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
    
    /* Slides */
    @keyframes slide-in-left-cpu {
      from { opacity: 0; transform: translateX(-40px); }
      to { opacity: 1; transform: translateX(0); }
    }
    
    @keyframes slide-in-right-cpu {
      from { opacity: 0; transform: translateX(40px); }
      to { opacity: 1; transform: translateX(0); }
    }
    
    /* LED pulse - 2D only */
    @keyframes led-pulse-cpu {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.9); }
      100% { opacity: 1; transform: scale(1); }
    }
    
    /* Apply CPU animations to high-motion elements */
    
    [class*="spinner"],
    [class*="loader"],
    .loading-indicator {
      animation: spin-cpu 1s linear infinite !important;
    }
    
    [class*="float"],
    .floating-element,
    .animated-icon {
      /* Reduced animation for CPU fallback */
      animation: float-cpu 3s ease-in-out infinite !important;
    }
    
    [class*="fadeIn"],
    .card-pulse-entry,
    [class*="fade-in"],
    .dashboard-entry {
      animation: fadeInDashboard-cpu 0.5s ease-out !important;
    }
    
    [class*="toast"],
    [class*="notification"],
    .slide-in-toast {
      animation: slideInToast-cpu 0.3s ease-out !important;
    }
    
    .confetti-piece,
    [class*="confetti"] {
      animation: confetti-fall-cpu 2.5s ease-in forwards !important;
    }
    
    .btn-pending-pulse {
      animation: pulse-critical-cpu 2s infinite !important;
    }
    
    .btn-attention-pulse {
      animation: pulse-attention-cpu 1.5s ease-in-out infinite !important;
    }
    
    .bounce-in {
      animation: bounce-in-cpu 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) !important;
    }
    
    .shake-error {
      animation: shake-cpu 0.4s ease-in-out !important;
    }
    
    .slide-in-left {
      animation: slide-in-left-cpu 0.4s ease-out !important;
    }
    
    .slide-in-right {
      animation: slide-in-right-cpu 0.4s ease-out !important;
    }
    
    .led-pulse-indicator,
    [class*="led-pulse"] {
      animation: led-pulse-cpu 1.5s ease-in-out infinite !important;
    }
    
    /* Disable will-change for CPU fallback */
    [class*="sidebar"],
    [class*="scroll"],
    [class*="overflow"],
    .scrollable-area,
    [class*="pnl"],
    [class*="tracker"],
    [class*="balance"],
    [class*="account-state"],
    .financial-display,
    .variance-display {
      will-change: auto;
      backface-visibility: visible;
      perspective: none;
    }
  }
  
  .status-icon,
  [class*="status"] [class*="icon"] {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    vertical-align: middle;
    margin-right: 6px;
  }

  /* TACTICAL HUD INPUT STYLING - Scorched Earth Operation */
  input.input-glass:focus,
  textarea.input-glass:focus {
    border-color: #2563EB !important;
    box-shadow: 0 0 12px rgba(37, 99, 235, 0.4), inset 0 0 8px rgba(37, 99, 235, 0.1) !important;
    outline: none;
  }

  input.input-glass,
  textarea.input-glass {
    background-color: #F1F5F9 !important;
    border-color: #CBD5E1 !important;
    transition: all 0.2s ease !important;
  }
`;
document.head.appendChild(styleSheet);



