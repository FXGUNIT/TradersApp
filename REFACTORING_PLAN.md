# TradersApp Refactoring Master Plan

**Document Version:** 1.0
**Date:** 2026-03-25

## 1. Introduction & Goal (The "Why")

The purpose of this refactoring is to restructure the TradosApp codebase from its current state into a modern, scalable, and highly organized architecture.

**The primary goals are:**
*   **Maximize Development Velocity:** Make it faster and easier for developers to find code, understand it, and build new features.
*   **Minimize Errors:** A clean structure reduces the chance of bugs and unintended side effects.
*   **Enhance Performance:** Enable advanced optimization techniques like code-splitting and lazy loading.
*   **Establish a "Golden Path":** Create a clear, documented process for all future development.

This document outlines the exact process, rules, and steps we will take to achieve this with zero errors.

---

## 2. The Master Workflow (NON-NEGOTIABLE)

This is the process we will follow for every single task. It is our constitution.

> 🚨 **THE MASTER WORKFLOW (NON-NEGOTIABLE)**
> Before writing any code, understand your constraints:
>
> **One Thing at a Time:** We do not build three features at once. We build one.
>
> **The Zero-Error Loop:** Add feature → Debug → Toggle → Test → Run. Repeat until 100% flawless.
>
> **The Checkpoint System:** Before moving to the next task on our index, you MUST prompt me to execute a Git backup with a highly descriptive commit message (e.g., git commit -m "feat: AI Watch Tower telemetry fully online").
>
> **Manual Green Light:** Wait for my explicit permission before proceeding to the next step.

---

## 3. The "Zero-Error Loop" - In Detail (The "How")

To ensure each step is "100% flawless," the following checks will be performed after every code change, before I request a green light:

1.  **Static Analysis (`lint`):** Run `npm run lint` to check for code style or syntax errors.
2.  **Build Verification (`build`):** Run `npm run build` to ensure the application still compiles into a production-ready state.
3.  **Application Smoke Test (`run` / `toggle`):**
    *   Start the development server (`npm run dev`).
    *   Confirm the application loads in a browser without crashing.
    *   **From a User's Perspective:** Manually check that core functionality related to the change is still working. For example, if a button component was moved, I will ask you to confirm the button is still visible and clickable.
    *   **From an Admin's Perspective:** I will ask for a manual check of any admin-specific functionality that might be affected.
4.  **Final Confirmation:** Only after all the above checks pass will I request the **Manual Green Light** to proceed.

---

## 4. The "Checkpoint System" - Git Backups (The "When")

After each task is completed and verified, I will provide a precise Git commit message. This creates a safe backup history, allowing us to revert if any future step causes issues.

**The commit message format will be:**

```
<type>: <description>

Refactoring Task ID: [Task Number]
Date Completed: [YYYY-MM-DD HH:MM:SS UTC]
```
*   **`<type>`:** Will be `chore` for structural changes, `refactor` for code improvements, `docs` for documentation, etc.
*   **`<description>`:** A brief summary of what was done.

---

## 5. Architectural Blueprint (The "What" and "Where")

### 5.1. Current (Old) Structure

The root directory is cluttered with a mix of configuration, documentation, application code, test runners, and backend services. This makes navigation and ownership unclear.

```
/ (root)
├── .env
├── .gitignore
├── *.js, *.cjs, *.ps1 (Scripts and Configs)
├── *.md (Documentation)
├── index.html
├── package.json
├── path/to/... (Orphaned source code)
├── public/...
├── src/... (Main app code, but mixed with backups)
├── telegram-bridge/... (Backend service)
└── ... and 50+ other files
```

### 5.2. Proposed (New) Structure

This is our target state. It is organized, modular, and scalable.

```
TradersApp/
├── docs/                 # All project documentation (.md files)
├── public/               # Static assets (index.html, images, fonts)
├── scripts/              # Automation scripts (deployment, data migration)
├── services/             # Backend services (telegram-bridge)
├── src/                  # --> FRONTEND APPLICATION CODE
│   ├── assets/           # Global assets (fonts, icons)
│   ├── components/       # Shared, reusable UI components (Button, Input)
│   ├── config/           # App configuration (Firebase keys, feature flags)
│   ├── features/         # Self-contained feature modules (Auth, Dashboard, etc.)
│   ├── hooks/            # Shared, reusable React hooks
│   ├── lib/              # 3rd-party library setup (e.g., axios instances)
│   ├── providers/        # App-wide context providers
│   ├── routes/           # Centralized routing configuration
│   ├── services/         # Cross-cutting frontend services (API layer)
│   ├── store/            # Global state management (Zustand, Redux)
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Shared utility functions
│   ├── App.jsx           # Main App component with routing
│   └── main.jsx          # Application entry point
├── tests/                # All test files (unit, integration, e2e, performance)
├── .gitignore
├── package.json
└── vite.config.js
```

---

## 6. Detailed Refactoring Plan

This is the ordered list of every task required to complete the refactoring.

### Phase 0: Baseline
*   [COMPLETED] **Task 0.1:** Run `npm install` to ensure all dependencies are present.
*   [COMPLETED] **Task 0.2:** Run `npm run build` to confirm the project is buildable.
*   [COMPLETED] **Task 0.3:** Run `npm run lint` to establish a baseline of current code quality issues.

### Phase 1: Foundation
*   [COMPLETED] **Task 1.1:** Create the four high-level root directories: `docs/`, `scripts/`, `tests/`, and `services/`.
    *   **Git Checkpoint:** `chore: scaffold new high-level directory structure`
*   [PENDING] **Task 1.2:** Create the new directory structure *within* the `src/` folder (`assets`, `components`, `config`, `features`, `hooks`, `lib`, `providers`, `routes`, `services`, `store`, `types`, `utils`).

### Phase 2: Root-Level Relocation
*   [PENDING] **Task 2.1:** Move all Markdown files (`.md`) from the root directory into `docs/`.
*   [PENDING] **Task 2.2:** Move all standalone scripts (`.ps1`, `.cjs`, and root-level `.js` test runners) into `scripts/`.
*   [PENDING] **Task 2.3:** Move all remaining test and audit files into `tests/`.
*   [PENDING] **Task 2.4:** Move the `telegram-bridge/` directory into `services/`.

### Phase 3: `src` Refactoring (Move & Fix Imports)
*   [PENDING] **Task 3.1:** Move utility files from `src/utils/` and fix all broken imports across the codebase.
*   [PENDING] **Task 3.2:** Move service files from `src/services/` and fix all broken imports.
*   [PENDING] **Task 3.3:** Move hook files from `src/hooks/` and fix all broken imports.
*   [PENDING] **Task 3.4:** Move shared component files from `src/components/` and fix all broken imports.
*   [PENDING] **Task 3.5:** Move page files from `src/pages/` into appropriate `src/features/` folders and fix all broken imports.
*   [PENDING] **Task 3.6:** Analyze and merge/relocate files from the orphaned `path/to/` directory.

### Phase 4: Final Cleanup
*   [PENDING] **Task 4.1:** Delete all old, now-empty directories (`path/`, `src/pages`, etc.).
*   [PENDING] **Task 4.2:** Delete all temporary backup files (e.g., `App.jsx.bak`).
*   [PENDING] **Task 4.3:** Perform a final `npm run lint` and `npm run build` to ensure project health.
*   [PENDING] **Task 4.4:** Update the `README.md` to reflect the new project structure.
