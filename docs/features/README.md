# Features Documentation

This directory contains detailed documentation for all major features in the TradersApp project.

## IMPORTANT: READING ORDER FOR NEW TEAM MEMBERS

Before working on any feature, please read the documentation in this order:

1. **[FEATURE_INDEX.md](./FEATURE_INDEX.md)** - Master index of all features and their relationships
2. **[ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md)** - System architecture and data flow
3. **[API_CONTRACTS.md](./API_CONTRACTS.md)** - Backend/frontend contracts and webhook specifications
4. **[DEVELOPMENT_GUIDELINES.md](./DEVELOPMENT_GUIDELINES.md)** - Coding standards, testing procedures, and deployment process
5. Then proceed to specific feature documentation as needed

## Current Documentation

- **[AI_CHAT_HELPLINE_SPEC.md](./AI_CHAT_HELPLINE_SPEC.md)** - Complete specification for the 24x7 AI Chat Helpline feature
- **[CHAT_IMPLEMENTATION_STATUS.md](./CHAT_IMPLEMENTATION_STATUS.md)** - Current implementation status, work completed, and protection notices

## Planned Documentation (to be created)

- [FEATURE_INDEX.md] - Master index of all features
- [ARCHITECTURE_OVERVIEW.md] - System architecture and data flow
- [API_CONTRACTS.md] - Backend/frontend contracts
- [DEVELOPMENT_GUIDELINES.md] - Coding standards and procedures
- [SECURITY_PROTOCOLS.md] - Security guidelines and data protection
- [TESTING_STRATEGY.md] - Testing approaches and test cases
- [DEPLOYMENT_PROCEDURES.md] - Deployment steps and environment setup

## Protection Notices

Several files in this project have active protection notices indicating they should not be modified without proper verification:

- `src/components/FloatingChatWidget.jsx`
- `src/components/ChatHelpline.tsx`
- `src/services/telegramService.js`
- `src/App.jsx` (specific imports/usage)
- `.env` (environment variables)

See `docs/features/CHAT_IMPLEMENTATION_STATUS.md` for complete details on what is protected and why.

## Contributing

When adding new feature documentation:

1. Create a new markdown file in this directory
2. Add it to the FEATURE_INDEX.md
3. Follow the documentation template
4. Include implementation status, known issues, and future work sections
5. Add any relevant diagrams or flowcharts to the /docs/assets/ directory

---

_Last updated: March 25, 2026_
