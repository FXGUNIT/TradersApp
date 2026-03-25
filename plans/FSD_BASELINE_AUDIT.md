# FSD BASELINE AUDIT
## Feature-Sliced Design Preparation for TradersApp
**Audit Date:** 2026-03-25  
**Current Git Commit:** `6758d6a` (AURA Engine Implementation Complete)

---

## 1. CURRENT STATE ASSESSMENT

### ✅ **Security Baseline (SECURED)**
- [x] All hardcoded secrets moved to `.env`
- [x] Firebase API keys secured via environment variables
- [x] Telegram token secured via environment variable
- [x] MASTER_SALT configurable via environment variable
- [x] Admin credentials secured
- [x] Build passes without security warnings

### ✅ **Visual Foundation (AURA ENGINE)**
- [x] CSS Variables System: 56 AURA design tokens
- [x] Zero-FOUC Theme Detection implemented
- [x] All key components migrated to CSS variables
- [x] ThemeSwitcher updated for AURA states
- [x] Backward compatibility maintained

### ✅ **Build & Deployment**
- [x] `npm run build` succeeds (1.39s)
- [x] Dev server running with HMR
- [x] No TypeScript errors (except ChatHelpline.tsx)
- [x] ESLint configured and passing

---

## 2. FSD DIRECTORY STRUCTURE AUDIT

### **✅ Existing FSD Structure**
```
src/
├── app/                    # App initialization, routing, providers
├── pages/                  # Page components (7 files)
│   ├── CleanOnboarding.jsx
│   ├── CollectiveConsciousness.jsx
│   ├── PrivacyPolicy.jsx
│   ├── RegimentEULA.jsx
│   ├── RegimentHub.jsx
│   ├── TermsOfService.jsx
│   └── WaitingRoom.jsx
├── widgets/               # Composition layer (EMPTY - needs migration)
├── features/              # Business features
│   └── terminal/         # Trading terminal feature
│       ├── MainTerminal.jsx
│       ├── journalMetrics.js
│       └── terminalUploadUtils.js
├── entities/              # Business entities (EMPTY - needs migration)
├── shared/                # Reusable infrastructure
│   ├── api/              # API clients (EMPTY)
│   ├── lib/              # Libraries (EMPTY)
│   ├── ui/               # UI components (EMPTY)
│   └── utils/            # Utilities (EMPTY)
└── components/           # Legacy components (27 files - needs migration)
```

### **⚠️ Migration Priority Assessment**
1. **HIGH PRIORITY**: Move `components/` to `shared/ui/`
2. **HIGH PRIORITY**: Move `utils/` to `shared/utils/`
3. **MEDIUM PRIORITY**: Extract entities from App.jsx
4. **MEDIUM PRIORITY**: Extract features from App.jsx
5. **LOW PRIORITY**: Create `shared/api/` and `shared/lib/`

---

## 3. MONOLITH ANALYSIS (App.jsx - 15,047 lines)

### **Code Distribution in App.jsx**
| Section | Lines | Description | FSD Target |
|---------|-------|-------------|------------|
| Firebase & Infrastructure | ~200 | Firebase config, auth, database | `shared/api/firebase` |
| Session & Security Utilities | ~300 | Security functions, forensic data | `shared/lib/security` |
| Cache & Search Utilities | ~200 | Caching, fuzzy search, highlighting | `shared/lib/search` |
| UI Utilities | ~200 | Confetti, tilt handlers, loading | `shared/ui/` |
| IST Clock & Time Utilities | ~200 | Time functions, greetings | `shared/lib/time` |
| Complex UI Components | ~1,100 | MegaMenu, CommandPalette, etc. | `widgets/` |
| Theme System | ~200 | createTheme, ACCENT_COLORS | `shared/ui/theme` |
| Global Constants | ~200 | AMD_PHASES, OFFICERS_BRIEFING | `shared/constants/` |
| AI System Prompts | ~300 | AI prompts, council logic | `features/ai/` |
| Auth UI Primitives | ~200 | Form styles, buttons, inputs | `shared/ui/auth` |
| Core UI Primitives | ~400 | LED, Tag, SHead, Field, Loader | `shared/ui/primitives` |
| Auth Screens | ~1,000 | Login, Signup, OTP, PasswordReset | `features/auth/` |
| Context | ~200 | UserListProvider, useUserList | `app/providers/` |
| Support | ~300 | SupportChatModal | `features/support/` |
| Utility Screens | ~200 | MaintenanceScreen, DebugOverlay | `widgets/` |
| AdminDashboard | ~2,900 | Complete admin interface | `features/admin/` |
| SessionsManagementScreen | ~200 | Session management | `features/auth/sessions` |
| MainTerminal | ~1,900 | Trading terminal | `features/terminal/` (ALREADY MOVED) |
| Root Component & Router | ~100 | Main App component | `app/` |
| Global Styles | ~600 | Inline styles | `shared/ui/styles` |

**TOTAL LINES TO EXTRACT:** ~10,500 (70% of App.jsx)

---

## 4. RISK ASSESSMENT

### **Low Risk (Safe to Extract First)**
- `shared/utils/` - Pure utility functions
- `shared/constants/` - Global constants
- `shared/ui/primitives` - Basic UI components
- `shared/lib/time` - Time utilities

### **Medium Risk (Requires Testing)**
- `shared/ui/theme` - Theme system (AURA Engine)
- `shared/ui/auth` - Auth UI primitives
- `features/auth/` - Auth screens
- `widgets/` - Composite components

### **High Risk (Complex Dependencies)**
- `features/admin/` - AdminDashboard with complex state
- `features/terminal/` - Trading terminal (already extracted)
- `app/providers/` - Context providers
- `shared/api/firebase` - Firebase integration

---

## 5. EXTRACTION STRATEGY

### **Phase 0: Secure the Baseline** (CURRENT)
1. ✅ Verify build passes
2. ✅ Create Git restore point
3. ✅ Document current state
4. Create extraction plan

### **Phase 1: Scaffolding**
1. Create missing FSD directories
2. Set up import aliases in vite.config.js
3. Create index files for each layer
4. Update ESLint for FSD imports

### **Phase 2: Shared Extraction (Low Risk)**
1. Move `utils/` → `shared/utils/`
2. Move `components/` → `shared/ui/`
3. Extract constants to `shared/constants/`
4. Extract time utilities to `shared/lib/time`

### **Phase 3: Features Extraction (Medium Risk)**
1. Extract auth screens to `features/auth/`
2. Extract admin dashboard to `features/admin/`
3. Extract support features to `features/support/`
4. Extract AI features to `features/ai/`

### **Phase 4: Widgets & Pages Assembly**
1. Move composite components to `widgets/`
2. Update page imports
3. Verify routing works
4. Test all user flows

### **Phase 5: The Final Cut**
1. Remove extracted code from App.jsx
2. Clean up dead code
3. Final build verification
4. Create final Git restore point

---

## 6. TECHNICAL DEPENDENCIES

### **Import Aliases Needed**
```javascript
// vite.config.js
resolve: {
  alias: {
    '@app': '/src/app',
    '@pages': '/src/pages',
    '@widgets': '/src/widgets',
    '@features': '/src/features',
    '@entities': '/src/entities',
    '@shared': '/src/shared',
  }
}
```

### **ESLint Configuration**
- Need FSD import rules
- Layer dependency validation
- Public API boundaries

### **TypeScript Configuration** (Future)
- Path aliases in tsconfig.json
- Strict null checks
- Interface definitions

---

## 7. SUCCESS CRITERIA

### **Functional Requirements**
- [ ] Zero breaking changes to user experience
- [ ] All features work as before
- [ ] Build time remains under 2 seconds
- [ ] Bundle size doesn't increase

### **Architectural Requirements**
- [ ] App.jsx reduced to < 5,000 lines (67% reduction)
- [ ] Clear layer boundaries
- [ ] No circular dependencies
- [ ] All imports follow FSD conventions

### **Development Experience**
- [ ] Easier to locate code
- [ ] Better separation of concerns
- [ ] Improved testability
- [ ] Faster onboarding for new developers

---

## 8. IMMEDIATE NEXT STEPS

1. **Create Git checkpoint for FSD migration**
2. **Update vite.config.js with FSD aliases**
3. **Create directory structure with index files**
4. **Begin Phase 2: Shared Extraction**

---

**AUDIT COMPLETE** - Ready for FSD migration with minimal risk.