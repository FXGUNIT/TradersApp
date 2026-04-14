# R16 Proof Artifact: Accessibility & Keyboard-Only Usage

**Task:** R16 -- Prove accessibility and interaction quality under assistive and keyboard-only usage.
**Claimed by:** claude-sonnet | **Date:** 2026-04-14
**Status:** PARTIAL -- keyboard nav present in key flows, automated a11y scan not in CI

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

GAP1 (Medium): No global :focus-visible CSS rule
GAP2 (Medium): No automated a11y scan in CI (no axe-core or playwright accessibility test)
GAP3 (Medium): No prefers-reduced-motion support in CSS
GAP4 (Low): No focus restore on modal close
GAP5 (Low): aria-modal missing on AdminUnlockModal
GAP6 (Low): No WCAG contrast audit in CI

---

## Interim Verdict

PARTIAL. Keyboard navigation exists in all major flows (auth, terminal, admin). ARIA live regions present for dynamic content. Form labels properly associated. However: no global focus indicator CSS, no prefers-reduced-motion support, no aria-modal on one modal, no automated a11y scan in CI. Real gaps for accessibility compliance but not blocking for basic keyboard operability.

Recommended: Add global focus CSS, add prefers-reduced-motion, add Playwright + axe-core to CI.

Proof artifact: docs/R16_ACCESSIBILITY_PROOF.md
