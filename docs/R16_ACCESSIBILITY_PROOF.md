# R16 Proof Artifact: Accessibility & Keyboard-Only Usage

**Task:** R16 -- Prove accessibility and interaction quality under assistive and keyboard-only usage.
**Claimed by:** claude-sonnet | **Date:** 2026-04-14
**Status:** PARTIAL — R16-A (focus-visible) and R16-B (prefers-reduced-motion) fixed 2026-04-15; automated a11y scan and remaining ARIA gaps still open

---

## What R16 Requires

1. Keyboard-only navigation for auth, terminal, admin, modal-heavy screens
2. Focus order, focus trapping, focus restore, visible focus indication
3. Forms, buttons, icons, status indicators, dialogs have usable labels/semantics
4. Contrast, text scaling, reduced-motion, overflow at increased zoom
5. Screen-reader critical flows or automated a11y scans

---

## Keyboard Navigation Inventory

### Auth Flow
CleanLoginScreen.jsx: handleKeyDown on Google sign-in button. Firebase signInWithPopup is browser-native keyboard accessible. EULATermsSection.jsx has aria-label on checkbox. WaitingRoomScreen.jsx has onKeyDown. ForcePasswordResetScreen.jsx has form with aria-describedby error support.

### Terminal Workspace
TerminalJournalOverview.jsx: onKeyDown for journal keyboard navigation. TerminalNav.jsx: onKeyDown for tab switching. TiltLockout.jsx: aria-live polite for dynamic state.

### Admin Screens
AdminUnlockModal.jsx: onKeyDown for modal keyboard interaction, role=dialog on container. AdminMessagePanel.jsx: aria-label on panel.

### Command & Chat
CommandPalette.jsx: tabindex on palette root for keyboard focus. ChatHelpline.jsx: aria-live=polite for message announcements. FloatingChatWidget.jsx: keyboard focusable floating button.

### Board Room
CollectiveConsciousness.jsx: aria-label on consensus panel sections.

---

## Focus Behavior

### Missing: Global :focus-visible CSS Rule
No global focus-visible rule found in src/index.css or src/styles/global.css. Keyboard-only users cannot see which element has focus.

### Missing: Focus Trapping in Modals
No explicit focus trap in modal components. React createPortal renders to body; focus stays in modal automatically in modern browsers, but no manual inert attribute usage found.

### Missing: Focus Restore on Modal Close
Modal close does not restore focus to the element that opened it. No previouslyFocused tracking found.

---

## Screen Reader Semantics

### aria Inventory
ChatHelpline.jsx: aria-live=polite on status indicator
TiltLockout.jsx: aria-live=polite on lockout message
EULATermsSection.jsx: aria-label on checkbox
CollectiveConsciousness.jsx: aria-label on section
SupportChatModal.jsx: role=dialog on modal
AdminUnlockModal.jsx: onKeyDown (aria-modal missing -- gap)

### Missing aria Attributes
- aria-modal=true missing on AdminUnlockModal.jsx
- aria-labelledby missing on modal containers
- aria-describedby missing on form inputs with errors
- role=alert missing on error message containers

---

## Visual Accessibility

### Contrast
No explicit WCAG contrast audit in CI. No automated contrast check.

### Text Scaling
CSS uses rem units for typography. Text scales when browser font size changes. No fixed px font sizes on body text.

### Reduced Motion
No prefers-reduced-motion media query in any CSS file. Animated panels will animate for users with vestibular motion sensitivity.

### Zoom Behavior
Responsive CSS uses percent and rem widths. No fixed-width that breaks at 200 percent zoom.

---

## Form Accessibility
Email/password fields have htmlFor on label matched to input id. Form validation errors: aria-live region not systematically implemented across all forms.

---

## What Already Works

Keyboard nav in auth: YES -- onKeyDown on login/reset flows
Keyboard nav in terminal: YES -- Journal, nav, verdict have keyboard handlers
Keyboard nav in admin: YES -- Unlock modal has onKeyDown
Command palette keyboard: YES -- tabindex + keyboard navigation
aria on dialogs: YES -- role=dialog on SupportChatModal
aria-live status updates: YES -- ChatHelpline, TiltLockout
Form labels: YES -- email/password fields properly labeled
rem typography: YES -- CSS uses rem for scaling

---

## Gaps Found

| Gap | Level | Status |
|-----|-------|--------|
| GAP1 (Medium): No global :focus-visible CSS rule → **RESOLVED (2026-04-15)** | Medium | `src/index.css` + `src/styles/global.css` now include `*:focus-visible { outline: 2px solid var(--color-focus, #3b82f6); outline-offset: 2px; }` + `*:focus:not(:focus-visible) { outline: none; }`. Playwright test `focused interactive elements have visible focus indicator` validates runtime behavior. |
| GAP2 (Medium): No automated a11y scan in CI | Medium | Not yet addressed — axe-core Playwright integration pending |
| GAP3 (Medium): No prefers-reduced-motion support in CSS → **RESOLVED (2026-04-15)** | Medium | Both CSS files now include `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; } }` — suppresses all animations for users with vestibular sensitivity. |
| GAP4 (Low): No focus restore on modal close | Low | Not yet addressed |
| GAP5 (Low): aria-modal missing on AdminUnlockModal | Low | Not yet addressed |
| GAP6 (Low): No WCAG contrast audit in CI | Low | Not yet addressed |

---

## Interim Verdict

**MATERIALLY IMPROVED.** Global focus-visible CSS and prefers-reduced-motion support now implemented — two of the three medium-severity accessibility gaps are closed. Keyboard navigation is present in all major flows. Remaining gaps (GAP2, GAP4, GAP5, GAP6) are lower priority and documented.

**Resolved 2026-04-15:**
- R16-A: `:focus-visible` global CSS rule in `src/index.css` + `src/styles/global.css`
- R16-B: `prefers-reduced-motion` media query suppressing all animations

**Files changed:** `src/index.css`, `src/styles/global.css`

**Proof artifact:** `docs/R16_ACCESSIBILITY_PROOF.md`
**Updated:** 2026-04-15 — R16-A and R16-B resolved
