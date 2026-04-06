# ADR-015: Keycloak for Zero-Trust SSO

**ADR ID:** ADR-015
**Title:** Keycloak for Zero-Trust SSO
**Status:** Accepted
**Date:** 2026-04-06
**Author:** Claude

## Context

The TradersApp system requires enterprise-grade authentication and authorization for:
- **Traders** — Access to trading dashboard, consensus signals, admin features (limited)
- **Mentors** — Access to teaching tools, trade log analysis, extended features
- **Admins** — Full access to all features, system configuration, user management
- **Service accounts** — Machine-to-machine auth for BFF, ML Engine, Telegram Bridge

Security requirements:
- **Zero-trust architecture** — No implicit trust, every request authenticated
- **MFA enforcement** — Admin accounts require multi-factor authentication
- **Session management** — Idle timeout, max session lifetime, single logout
- **Audit logging** — All authentication events logged and traceable
- **Compliance** — Support for regulated domains (SOC 2, GDPR considerations)

## Decision

We will use **Keycloak** (self-hosted) for identity and access management.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Keycloak Cluster                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Keycloak Server (3 pods for HA)                      │   │
│  │  ├── Realm: tradersapp                               │   │
│  │  ├── User Federation: Internal + LDAP (optional)     │   │
│  │  ├── Authentication: Password + OTP + WebAuthn        │   │
│  │  └── Authorization: Role-based + Policy-based        │   │
│  └──────────────────────────────────────────────────────┘   │
│                         │                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  PostgreSQL Backend (HA)                            │   │
│  │  └── User data, sessions, roles, client configs      │   │
│  └──────────────────────────────────────────────────────┘   │
│                         │                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Redis (External session store)                      │   │
│  │  └── Infinispan for distributed session cache       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Service Clients                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Frontend │  │   BFF    │  │  Telegram│  │  ML      │   │
│  │  (SPA)   │  │(BFF-OIDC)│  │  Bridge  │  │  Engine  │   │
│  │   PKCE   │  │  Client  │  │  Client  │  │  Client  │   │
│  │  Flow    │  │ Credentials│ │ Credentials│ │ Credentials│ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Realm Configuration

```json
{
  "realm": "tradersapp",
  "enabled": true,
  "registrationAllowed": false,
  "loginWithEmailAllowed": true,
  "duplicateEmailsAllowed": false,
  "bruteForceProtected": true,
  "bruteForceMaxLoginFailures": 5,
  "bruteForceLockoutDuration": 1800,
  "passwordPolicy": "length(12) and specialChars(1) and digits(1) and upperCase(1) and notUsername",
  "accessTokenLifespan": 3600,
  "ssoSessionIdleTimeout": 1800,
  "ssoSessionMaxLifespan": 28800,
  "offlineSessionIdleTimeout": 2592000
}
```

### Client Configuration

#### 1. Frontend (Public Client + PKCE)
```json
{
  "clientId": "tradersapp-frontend",
  "clientAuthenticatorType": "client-secret",
  "enabled": true,
  "publicClient": true,
  "protocol": "openid-connect",
  "redirectUris": [
    "http://localhost:5173/*",
    "https://tradersapp.com/*"
  ],
  "webOrigins": ["https://tradersapp.com"],
  "standardFlowEnabled": true,
  "implicitFlowEnabled": false,
  "directAccessGrantsEnabled": false,
  "serviceAccountsEnabled": false,
  "frontchannelLogout": true,
  "attributes": {
    "pkce.code.challenge.method": "S256"
  }
}
```

#### 2. BFF (Confidential Client)
```json
{
  "clientId": "tradersapp-bff",
  "clientSecret": "${KEYCLOAK_BFF_SECRET}",
  "enabled": true,
  "clientAuthenticatorType": "client-secret",
  "protocol": "openid-connect",
  "redirectUris": [],
  "standardFlowEnabled": false,
  "implicitFlowEnabled": false,
  "directAccessGrantsEnabled": false,
  "serviceAccountsEnabled": true,
  "authorizationServicesEnabled": true
}
```

#### 3. ML Engine (Confidential Client + Service Account)
```json
{
  "clientId": "tradersapp-ml-engine",
  "clientSecret": "${KEYCLOAK_ML_SECRET}",
  "enabled": true,
  "serviceAccountsEnabled": true,
  "protocol": "openid-connect",
  "authenticationFlowBindingOverrides": {
    "client": "service-account-auth"
  }
}
```

### Role Hierarchy

```
ADMIN
├── MENTOR
│   └── TRADER
│       └── VIEWER
└── SYSTEM_ADMIN
    ├── USER_ADMIN
    └── AUDITOR
```

### Authentication Flows

#### Standard User Flow (Password + MFA for Admins)
```
Login → Username/Password → [if admin] TOTP → Success
```

#### Service Account Flow (Client Credentials)
```
Service → Client ID + Secret → Access Token → API Call
```

### Integration with BFF

```javascript
// bff/services/keycloak.service.mjs
import Keycloak from 'keycloak-connect';
import redisStore from 'connect-redis';

const keycloak = new Keycloak(
  { scope: 'openid email profile roles' },
  {
    realm: process.env.KEYCLOAK_REALM,
    'auth-server-url': process.env.KEYCLOAK_URL,
    clientId: process.env.KEYCLOAK_BFF_CLIENT_ID,
    clientSecret: process.env.KEYCLOAK_BFF_SECRET,
    credentialId: process.env.KEYCLOAK_CREDENTIAL_ID,
  }
);

// Redis session store for distributed sessions
keycloak.stores = [new redisStore({ client: redisClient })];

// Protect routes
app.get('/api/admin/*', keycloak.protect('realm:ADMIN'), adminHandler);
app.get('/api/consensus', keycloak.protect('realm:TRADER'), consensusHandler);

// Token introspection middleware
export async function validateToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return next();

  try {
    const introspection = await keycloak.grantManager.introspect(token);
    if (introspection.active) {
      req.user = {
        id: introspection.sub,
        email: introspection.email,
        roles: introspection.realm_access?.roles || [],
      };
    }
  } catch (error) {
    logger.warn('Token introspection failed', { error: error.message });
  }
  next();
}
```

### MFA Configuration

```json
{
  "id": "OTP Flow",
  "alias": "otp-flow",
  "description": "OTP authentication for admin users",
  "authenticationExecutions": [
    {
      "authenticator": "auth-cookie",
      "requirement": "REQUIRED"
    },
    {
      "authenticator": "auth-password",
      "requirement": "REQUIRED"
    },
    {
      "authenticator": "otp-totp",
      "requirement": "REQUIRED",
      "condition": {
        "type": "role-required",
        "role": "ADMIN"
      }
    }
  ]
}
```

## Consequences

### Positive
- **Zero-trust security:** Every request validated, no implicit trust
- **Single sign-on:** One login across all services
- **MFA support:** Strong authentication for privileged accounts
- **Role-based access:** Fine-grained permissions per role
- **Audit trail:** All auth events logged
- **Standards compliant:** OIDC/OAuth2 compliant
- **Self-hosted:** Full control, no vendor dependency

### Negative
- **Operational complexity:** Keycloak cluster requires dedicated运维
- **Performance overhead:** Token validation adds ~5ms latency
- **Session management complexity:** Distributed sessions need Redis
- **Migration effort:** Need to migrate existing auth to Keycloak

### Neutral
- Keycloak is Java-based, requires JVM tuning
- PostgreSQL backend adds dependency
- Updates require careful rollout

## Alternatives Considered

### Auth0 / Okta
- Pros: Fully managed, enterprise features
- Cons: Vendor lock-in, per-user pricing, data residency concerns
- **Rejected** because we need self-hosted for data control and cost

### Supabase Auth
- Pros: Simple setup, works with Supabase DB
- Cons: Limited enterprise features, less control
- **Rejected** because we need full OIDC compliance and role hierarchy

### JWT-only (no IdP)
- Pros: Simple, no external dependency
- Cons: No MFA, no SSO, no session management, security risks
- **Rejected** because we need enterprise-grade auth features

### OAuth2orize (homegrown)
- Pros: Full control, custom implementation
- Cons: Significant development effort, security risks
- **Rejected** because building auth is high-risk, use established solution

## References

- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [Keycloak on Kubernetes](https://www.keycloak.org/2021/06/04/using-keycloak-to-secure-your-front-end.html)
- [OIDC Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- Related ADRs: [ADR-009 Secrets](ADR-009-secrets-infisical.md) (Keycloak credentials in Infisical)
