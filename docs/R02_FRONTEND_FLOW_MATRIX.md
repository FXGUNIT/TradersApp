# R02 Frontend Flow Matrix

Status: in progress
Last updated: 2026-04-14

## Purpose

Inventory the real frontend surfaces that must be proven end to end before `R02` can be closed. This document separates what the current UI audit already covers from the flows that still need explicit verification.

## Current Automated Baseline

The existing browser audit in `scripts/ui-audit/run-ui-audit.mjs` already exercises these top-level scenarios:

- `login`
- `signup`
- `waiting`
- `force-password-reset`
- `hub`
- `consciousness`
- `sessions`
- `app`
- `admin`
- footer audit on the hub shell

That is good route coverage, but it is not full flow coverage yet.

The runner code has now also been extended with:

- a dedicated `maintenance` scenario in the audit harness
- an explicit `Board Room` tab assertion inside the admin audit

Those additions still need a full browser rerun after the host Docker/WSL layer is recovered.

## Route Inventory

### 1. Auth Entry and Recovery

- `login`
  - Entry conditions: unauthenticated user or logout.
  - Expected visible states: email/password form, Google auth, forgot-password action, admin unlock entry.
  - Current coverage: credential login, Google login, forgot-password send, admin unlock path.
  - Remaining proof work: invalid credentials, popup failure, blocked popup, partial form validation, cooldown/rate-limit messaging, repeated forgot-password attempts.

- `signup`
  - Entry conditions: user chooses `New User? Apply`.
  - Expected visible states: profile form, consent checkbox, geographic selectors, submit and back actions.
  - Current coverage: happy path to waiting room and back-to-login path.
  - Remaining proof work: empty-state validation, rejected inputs, duplicate email behavior, Google signup path, persisted draft recovery after refresh.

- `waiting`
  - Entry conditions: pending or unapproved user.
  - Expected visible states: approval status message, resend verification, refresh, logout.
  - Current coverage: refresh trigger and logout.
  - Remaining proof work: approval transition after refresh, repeated resend behavior, stale waiting-room state after approval changes.

- `forcePasswordReset`
  - Entry conditions: flagged password-expired user.
  - Expected visible states: new password form, validation messaging, logout action.
  - Current coverage: weak password path, successful reset, logout path.
  - Remaining proof work: mismatched password validation, repeated reset attempts, expired reset token behavior, refresh-after-reset behavior.

- `sessions`
  - Entry conditions: authenticated user opens active sessions view.
  - Expected visible states: current session marker, logout-all-other-devices action, return to dashboard.
  - Current coverage: logout-all-other-devices action and back navigation.
  - Remaining proof work: current-session protection, repeated logout-all behavior, expired session handling, refresh recovery.

### 2. Hub and Navigation Shell

- `hub`
  - Entry conditions: authenticated approved user.
  - Expected visible states: command-center copy, card navigation, training-eligibility message, theme switcher, AI status.
  - Current coverage: open terminal and consciousness flows.
  - Remaining proof work: empty-card or delayed-content behavior, training-eligibility banner variants, theme switching, AI status rendering, mobile layout.

- `consciousness`
  - Entry conditions: entered from hub or terminal.
  - Expected visible states: page content plus return-path preservation.
  - Current coverage: `Back to Hub`.
  - Remaining proof work: return-to-terminal behavior, refresh recovery, theme changes, loading/error/empty states.

- Diamond navigation lattice
  - Entry conditions: any non-splash screen where lattice renders.
  - Expected visible states: directional arrows, restricted back handling, bottom/top movement behavior.
  - Current coverage: indirect only; no dedicated assertions.
  - Remaining proof work: per-screen arrow availability, restricted-back behavior after logout, keyboard/focus behavior, collision/visibility cases.

- Footer and shell overlays
  - Entry conditions: standard shell render.
  - Expected visible states: founder card, tooltip, AI system status, external connect link.
  - Current coverage: founder hover tooltip, AI status visibility, connect popup.
  - Remaining proof work: theme variants, mobile footer layout, failure if popup blocked, shell theme overlay verification.

- Maintenance gate
  - Entry conditions: maintenance mode enabled for non-admin users.
  - Expected visible states: maintenance screen replacing normal content while admin still retains admin access.
  - Current coverage: none.
  - Remaining proof work: non-admin gate, admin bypass, countdown rendering, return-to-normal after maintenance disabled.

- Floating support chat widget
  - Entry conditions: shell render with `floatingSupportChat` enabled.
  - Expected visible states: launcher, pre-chat form, welcome message, send flow, close/reopen behavior.
  - Current coverage: none.
  - Remaining proof work: open/close, form validation, message send failure, scroll behavior, authenticated and anonymous identity handling.

### 3. Terminal Workspace

- `app` shell
  - Entry conditions: approved authenticated user enters the trading terminal.
  - Expected visible states: terminal header, ticker, countdown, autosave bar, navigation tabs, logout.
  - Current coverage: app route opens, logout path exercised.
  - Remaining proof work: theme changes, offline banner, session persistence, lattice navigation while inside terminal.

- `premarket` tab
  - Entry conditions: default terminal tab outside audit scenario or manual tab switch.
  - Expected visible states: CSV ingestion, Part 1 inputs, news/premarket/key-level chart zones, error and loading states.
  - Current coverage: effectively none in current audit.
  - Remaining proof work: CSV happy path, invalid CSV, insufficient-history CSV, Part 1 run, AMD phase extraction, error messaging, reset behavior.

- `trade` tab
  - Entry conditions: terminal trade workspace.
  - Expected visible states: screenshot intake, MP/VWAP chart upload, extraction status, trade planner fields, Part 2 output, add-trade flow.
  - Current coverage: screenshot/MP/VWAP upload, screenshot count limit, generic interaction sweep.
  - Remaining proof work: OCR/image extraction failure states, Part 2 analysis, blocked execution state, add P2 trade flow, image replacement/removal, consciousness navigation.

- `journal` tab
  - Entry conditions: user opens journal tab.
  - Expected visible states: form, metrics, history rows, add/remove entry, equity curve state.
  - Current coverage: add manual journal entry and remove action.
  - Remaining proof work: edit flow if supported, metric recomputation, empty state, persistence after refresh, undo/reset actions.

- `account` tab
  - Entry conditions: user opens account tab.
  - Expected visible states: balance inputs, sync status, firm-rule/T&C ingestion, save behavior.
  - Current coverage: numeric field edits and generic sweep.
  - Remaining proof work: T&C upload/parse, save confirmation, invalid numeric input, drawdown warnings, refresh persistence.

- Terminal reset and draft-management flows
  - Entry conditions: autosave bar actions or storage recovery.
  - Expected visible states: undo action, per-tab reset, full reset, journal-history delete, confirm-reset dialog, draft hydration.
  - Current coverage: none.
  - Remaining proof work: reset dialog actions, autosave timestamps, cross-tab storage sync, refresh recovery from saved draft.

### 4. Admin Surface

- `admin` entry
  - Entry conditions: successful admin unlock.
  - Expected visible states: dashboard shell, workspace tabs, admin controls.
  - Current coverage: admin unlock and a generic interaction sweep on the screen.
  - Remaining proof work: stale-session fallback to splash, non-admin denial path, refresh persistence of unlocked state.

- Admin user-control workspace
  - Entry conditions: default admin workspace tab.
  - Expected visible states: user list, filters, search, pagination, mirror panel, docs modal, approve/block actions.
  - Current coverage: generic clicks only.
  - Remaining proof work: deterministic approve/block assertions, search/filter results, pagination behavior, row-density/column-picker state, duplicate-IP indicators, docs modal content.

- Admin Board Room workspace
  - Entry conditions: admin workspace tab switched to `boardRoom`.
  - Expected visible states: Board Room screen and its thread/approval actions.
  - Current coverage: none explicit.
  - Remaining proof work: tab switch assertion, thread list rendering, approval/rejection actions, failure states, return navigation.

- Admin shell utilities
  - Entry conditions: admin dashboard loaded.
  - Expected visible states: notification center, command palette, mega menu, support chat modal, mobile nav, fullscreen toggle, user switcher.
  - Current coverage: indirect at best.
  - Remaining proof work: explicit open/close and action assertions for each utility, especially support chat and command palette.

- Admin maintenance toggle
  - Entry conditions: admin dashboard header.
  - Expected visible states: maintenance toggle reflected in user-facing shell gating.
  - Current coverage: none end to end.
  - Remaining proof work: toggle on, verify non-admin maintenance screen, toggle off, verify return to normal flow.

## Coverage Gaps That Need New Dedicated Scenarios

These are the highest-value missing scenarios to add next:

1. Maintenance gate and admin bypass.
2. Terminal premarket CSV + Part 1 analysis flow.
3. Terminal autosave, reset, and refresh recovery.
4. Terminal T&C upload and parse flow in the account tab.
5. Admin Board Room tab with deterministic assertions.
6. Admin search/filter/pagination/docs modal flows.
7. Floating support chat widget flow.
8. Diamond navigation lattice behavior across hub, terminal, and post-logout states.

## Current Conclusion

The app already has broad route-level UI audit coverage, but `R02` is not complete because several real user flows are only touched generically or not asserted at all. The next step is to convert the gap list above into named deterministic audit scenarios rather than relying on broad click sweeps.
