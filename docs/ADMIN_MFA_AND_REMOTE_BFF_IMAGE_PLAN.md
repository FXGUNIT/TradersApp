# Admin MFA and Remote BFF Image Plan

## Purpose

This plan defines the safest and fastest path for two connected problems:

- Rebuild the admin panel authentication flow so admin access uses no password, exposes no authenticator setup in the frontend, and unlocks only after two gates.
- Move BFF image work away from the local Windows laptop and into remote, reproducible automation so builds are faster, safer, and less wasteful.

The local machine should be used for code editing, light checks, and triggering automation. It should not be the normal Docker build machine.

## Current Constraints

- The local Windows system has limited resources and should not be required to run Docker Desktop for normal delivery.
- A VPS exists and should be used for runtime deployment, health checks, rollback, and emergency operations.
- GitHub Actions and GHCR should be the source of truth for built container artifacts.
- Admin authentication must not rely on passwords.
- Admin authenticator enrollment and configuration must be backend-only.
- No secret values should be written to Docker images, repository files, workflow artifacts, screenshots, or audit reports.

## Target Decisions

| Area | Decision | Reason |
| --- | --- | --- |
| Admin password login | Remove/disable | Passwords add phishing and brute-force surface. |
| Admin authenticator setup | Backend-only | Prevents attackers from configuring their own authenticator from the admin UI. |
| Admin baseline gate 1 | Authenticator app TOTP code | Matches the required current plan. |
| Admin researched upgrade | Passkey/FIDO2 security key before or instead of TOTP | Current guidance favors phishing-resistant authentication for high-risk admin access. |
| Admin gate 2 | Three email OTP codes | Adds independent second gate after TOTP/passkey success. |
| BFF build location | GitHub Actions, not local laptop | Remote Linux runners are cleaner and avoid local Docker overhead. |
| BFF deploy location | VPS pulls published GHCR image | VPS should run the artifact, not rebuild it. |
| Image identity | Digest-first deploy | Prevents tag drift and makes rollback exact. |
| Windows VPS | Do not use for this pipeline | Linux containers and BuildKit are the better fit; Windows adds licensing and Docker complexity. |

## Quality Bar

This document is not considered complete until it answers five questions clearly:

1. What exact security state transitions are allowed?
2. Which frontend actions are impossible by design?
3. Which backend endpoints issue a real admin session?
4. Which remote artifact is built, scanned, signed, and deployed?
5. What happens automatically when auth or deploy verification fails?

The sections below are written to make implementation deterministic instead of relying on memory or manual judgment.

## Threat Model

### Assets to Protect

- Admin session token.
- Admin TOTP secret or passkey credential metadata.
- Three admin email OTP codes.
- Runtime secrets from Infisical, GitHub, VPS env, compose, and Kubernetes.
- Published BFF image digest and deployment provenance.
- GHCR package write permissions.
- VPS deploy credentials.

### Expected Attackers

- Someone who can open the public website and inspect frontend code.
- Someone who can replay or relay a manually entered OTP.
- Someone with access to browser devtools on a non-admin client.
- Someone who obtains one email inbox but not all three admin inboxes.
- Someone who tries to trigger stale GitHub Actions workflows or old image tags.
- Someone who can read CI artifacts, screenshots, or logs.

### Security Boundaries

- Frontend is untrusted.
- Browser localStorage/sessionStorage is untrusted.
- GitHub Actions can build and publish artifacts, but should not receive unnecessary long-lived secrets.
- VPS is trusted for runtime, but should pull verified artifacts rather than rebuild source.
- Infisical/env/compose/Kubernetes secrets are runtime-only.

### Non-Goals

- Do not create a public self-service admin enrollment flow.
- Do not make the frontend responsible for deciding whether admin auth is complete.
- Do not rebuild BFF images on the local Windows machine during the normal path.
- Do not make Windows VPS part of the default BFF pipeline.

## Admin Authentication Plan

### Required Baseline Flow

1. User opens the admin panel.
2. Admin unlock modal shows gate 1: authenticator code only.
3. Frontend sends the TOTP code to the backend.
4. Backend verifies the TOTP code.
5. Backend returns a short-lived `mfaChallengeId`, not an admin session.
6. Frontend moves to gate 2: three email OTP verification.
7. User clicks a send button to request email OTPs.
8. Backend sends OTPs to the three backend-configured admin email addresses.
9. Frontend shows three OTP inputs with masked recipient labels only.
10. User submits all three OTPs.
11. Backend verifies all three OTPs and the prior TOTP challenge.
12. Backend creates the admin session only after both gates pass.

### Backend API Contract

The exact route names can follow existing repository conventions, but the behavior must match this contract.

| Endpoint | Input | Output | Must Not Do |
| --- | --- | --- | --- |
| `POST /auth/admin/mfa/totp/verify` | TOTP code | `mfaChallengeId`, expiry, next step | Must not issue admin token. |
| `POST /auth/admin/mfa/email/start` | `mfaChallengeId` | email challenge ID, masked recipients, expiry | Must not accept raw recipient emails from frontend. |
| `POST /auth/admin/mfa/email/verify` | `mfaChallengeId`, email challenge ID, three OTP codes | admin session only if both gates pass | Must not verify email OTPs without prior gate 1 success. |
| `GET /auth/admin/totp/setup` | none | production `404` or `410` | Must not expose secret, QR, or otpauth URI to browser. |
| Legacy password routes | any | `410 Gone` when password login disabled | Must not silently create admin sessions. |

### MFA State and Data Model

Admin MFA challenge records should be server-side only.

| Field | Requirement |
| --- | --- |
| `mfaChallengeId` | Random, unguessable, short-lived, single-use. |
| `gate1Type` | `totp` initially, later `passkey` or `totp`. |
| `gate1VerifiedAt` | Required before email OTP start. |
| `emailChallengeId` | Separate random ID for email OTP stage. |
| `emailOtpHashes` | Store hashes only, never raw OTPs. |
| `attemptCount` | Enforce limits for TOTP and email OTP verification. |
| `clientBinding` | Bind to same browser/session fingerprint where practical. |
| `expiresAt` | Expire quickly; suggested 5 minutes for TOTP challenge and 10 minutes for email OTP challenge. |
| `consumedAt` | Set when admin session is issued or challenge is invalidated. |

### Failure and Abuse Handling

- TOTP failures should return a generic failure message and increment rate limits.
- Email OTP failures should not reveal which of the three codes was wrong.
- Email resend should be throttled and should invalidate previous email OTPs unless the implementation intentionally supports one active challenge.
- Reused challenges should fail and trigger a security log event.
- Expired challenges should require restarting from gate 1.
- Admin session creation should rotate any temporary MFA state.
- Security logs should include event type, time, route, request ID, and masked actor context only.
- Security logs should exclude raw OTPs, TOTP secrets, passkey private material, full email addresses, cookies, and authorization headers.

### Researched Stronger Flow

The stronger long-term flow is:

1. Gate 1 primary: passkey/FIDO2 security key.
2. Gate 1 fallback: authenticator app TOTP code.
3. Gate 2: three email OTP codes.
4. Admin session only after both gates pass.

This is safer because passkeys and FIDO2 security keys are phishing-resistant, while manually entered OTP codes can be relayed by an attacker. The baseline TOTP flow should still be implemented first if passkey support would slow delivery.

### Backend-Only Enrollment

Authenticator and passkey enrollment must be owner-controlled from backend tooling.

Required backend commands:

- `admin:mfa:totp:generate`
  - creates a new TOTP secret;
  - prints one-time setup data only to terminal;
  - writes no secret to repository files;
  - provides exact Infisical/GitHub/VPS variable names to update.
- `admin:mfa:totp:verify-setup`
  - verifies that the owner scanned the secret correctly;
  - activates the secret only after a valid code is supplied.
- `admin:mfa:totp:rotate`
  - generates a replacement secret;
  - keeps rollback only until the new secret is verified;
  - invalidates old challenges.
- Future `admin:mfa:passkey:register`
  - owner-initiated registration only;
  - stores public credential metadata backend-side;
  - never exposes a general admin self-registration page.

### Backend Requirements

- Add an explicit MFA state machine:
  - `totp_required`
  - `totp_verified`
  - `email_otp_required`
  - `email_otp_sent`
  - `email_otp_verified`
  - `admin_session_issued`
- TOTP verification must never issue an admin token by itself.
- Email OTP verification must never issue an admin token unless the same request chain already passed gate 1.
- Challenge IDs must be random, short-lived, single-use, and bound to client/session context.
- Rate-limit TOTP attempts, email send attempts, and email OTP verification attempts.
- Log security events without logging secrets or OTP values.
- Keep password endpoints disabled or return `410 Gone`.
- Remove or lock browser access to any TOTP setup endpoint.
- Add a backend-only TOTP setup command:
  - generate or rotate admin TOTP secret;
  - print one-time setup URI only in the terminal;
  - store the secret through Infisical/GitHub/VPS runtime env;
  - never expose QR codes, otpauth URIs, or raw secrets to frontend routes.

### Frontend UI/UX Requirements

- Replace the current mixed admin unlock UI with a clear two-step modal.
- Step 1:
  - title: Authenticator Verification
  - one code input
  - one verify button
  - no password field
  - no setup/reset/configuration link
- Step 2:
  - title: Email Verification
  - send OTP button appears after gate 1 succeeds
  - three OTP inputs
  - masked email recipient hints only
  - verify button disabled until all required codes are present
- Use compact, serious admin-security styling.
- Do not show full email addresses in the browser.
- Do not include visible setup instructions for authenticator enrollment.
- If remember-device exists, show it only after both gates pass or as part of the final verification action.
- Error messages should be specific enough to help the owner, but not reveal which factor was valid to an attacker.

### UI Quality Requirements

- The modal should feel like an operations security surface, not a marketing screen.
- Use a two-step progress indicator with stable dimensions.
- Code inputs should support paste, auto-advance, backspace, and clear error recovery.
- Loading states must not resize buttons or fields.
- Mobile layout must keep every input and button visible without horizontal scrolling.
- Failed verification should keep the user in the current gate and preserve non-sensitive entered state only where safe.
- Success should be explicit and short, then close or unlock without adding extra choices.

### Admin Tests and Audit

- Unit tests:
  - TOTP success returns challenge only.
  - TOTP alone cannot create admin session.
  - Email OTP alone cannot create admin session.
  - Both gates create admin session.
  - Expired, reused, or mismatched challenges fail.
- Browser audit:
  - admin modal starts at authenticator gate.
  - no password field exists.
  - no frontend TOTP setup/QR/secret appears.
  - TOTP success moves to email gate.
  - email OTP success unlocks admin.
- Security audit:
  - no OTP/TOTP secret in logs, screenshots, localStorage, artifacts, or HTML.

### Admin Migration Plan

1. Add backend MFA challenge model and tests while keeping the current UI behind existing behavior.
2. Change TOTP verification so it returns a challenge instead of an admin session.
3. Change email OTP verification so it requires the prior TOTP challenge.
4. Replace frontend modal with two-step flow.
5. Remove frontend setup calls and password UI.
6. Update audit scenarios.
7. Enable the new flow for audit/dev.
8. Enable in production after backend TOTP secret is confirmed through backend-only setup.
9. Remove or hard-disable any remaining password/session shortcut paths.

### Admin Rollback Plan

- Keep a temporary backend feature flag for old admin unlock only during implementation.
- The flag must default off in production once the new flow is verified.
- Any rollback path must still avoid exposing TOTP setup in frontend.
- Password login must remain disabled unless explicitly reintroduced by a separate security decision.

## Remote BFF Image Plan

### Core Rule

The laptop should not build BFF Docker images during normal development or deployment.

Normal flow:

1. Edit code locally.
2. Push or trigger GitHub workflow.
3. GitHub Actions builds or reuses the BFF image.
4. GHCR stores the immutable image.
5. VPS pulls the exact image digest.
6. VPS starts it, health-checks it, and rolls back if needed.

### Remote Execution Options

| Option | Speed | Safety | Recommended Use |
| --- | --- | --- | --- |
| GitHub-hosted runner with BuildKit cache | High after cache warms | Strong isolation | Default build path. |
| VPS self-hosted runner on protected branch only | High | Medium if locked down | Optional emergency/manual deploy path only. |
| Remote BuildKit daemon on VPS | High | Medium; requires TLS and hardening | Later optimization if GitHub cache is not enough. |
| Local Windows Docker | Low on this machine | Low operational reliability | Avoid for normal path. |
| Windows VPS | Medium at best | Adds licensing and Docker complexity | Not recommended. |

### Runner and Workflow Safety

- Do not run untrusted pull request code on a VPS self-hosted runner.
- PR checks should use GitHub-hosted isolated runners.
- Protected branch deploys may use VPS runner only if branch protection and required checks are enabled.
- Workflow permissions should be least privilege:
  - `contents: read`
  - `packages: write` only in image publishing jobs
  - `id-token: write` only when generating attestations/signatures
  - no broad default write permissions
- Pin third-party GitHub Actions to stable versions or immutable SHAs where practical.
- Store deploy secrets in GitHub environments with required reviewers for production if available.

### Context Hash Strategy

Compute a deterministic context hash from only BFF runtime inputs:

- `bff/**` runtime source files
- `proto/**`
- `bff/Dockerfile`
- `bff/package.json`
- `bff/package-lock.json`
- `.dockerignore`

Exclude local-only and non-runtime inputs:

- `.env*`
- reports
- screenshots
- Playwright artifacts
- local caches
- tests unless they are intentionally part of the runtime image
- old/duplicate Dockerfiles
- generated build outputs

### Build Once, Reuse Everywhere

1. GitHub Actions computes `contextHash`.
2. Check whether `ghcr.io/<owner>/bff:context-<contextHash>` exists.
3. If it exists:
   - skip rebuild;
   - create or confirm `ghcr.io/<owner>/bff:<commitSha>` as an alias;
   - record `built=false`.
4. If it does not exist:
   - build with BuildKit;
   - use GitHub Actions cache;
   - push:
     - `ghcr.io/<owner>/bff:<commitSha>`
     - `ghcr.io/<owner>/bff:context-<contextHash>`
   - record `built=true`.
5. Upload `bff-image-manifest.json`:
   - commit SHA
   - context hash
   - image ref
   - image digest
   - built vs reused
   - Dockerfile path
   - workflow run URL

### Image Promotion Gates

An image can be promoted to VPS only if all required gates pass:

1. Context hash was computed successfully.
2. Image was built or reused from the matching context hash.
3. Image digest is known.
4. BFF smoke test passes against the image.
5. Image config/history secret check passes.
6. Trivy scan completes and does not exceed the configured severity policy.
7. SBOM is generated or attached.
8. Provenance/signature/attestation is generated.
9. Deploy job verifies the digest it is about to pull.

### Supply-Chain Safety

For each production image:

- Generate SBOM.
- Generate provenance attestation.
- Sign or attest the image by digest.
- Run Trivy against the published image.
- Verify no known secret values appear in image config/history.
- Deploy only the digest that passed checks.

No BFF secrets should be passed as Docker build args:

- no AI provider keys
- no market data keys
- no admin password hashes
- no salts
- no email secrets
- no Infisical tokens

Secrets remain runtime-only through Infisical/env/compose/Kubernetes secrets.

### Artifact Contract

Each successful BFF image workflow should upload or publish:

- `bff-image-manifest.json`
- `bff-sbom.spdx.json` or `bff-sbom.cyclonedx.json`
- `trivy-bff-image.sarif` or JSON equivalent
- build provenance or GitHub artifact attestation
- image digest in job summary
- deploy target and health result in deploy summary

Artifact files must not contain secret values.

### VPS Deployment Flow

1. Workflow receives image digest.
2. VPS logs in to GHCR using least-privilege credentials.
3. VPS pulls the digest.
4. VPS starts a replacement BFF container.
5. Run `/health`.
6. Optionally run one lightweight admin/auth smoke check.
7. If healthy, switch/restart service.
8. If unhealthy, keep or restore the previous digest.
9. Write a deploy record:
   - previous digest
   - new digest
   - health result
   - timestamp
   - workflow run URL

### VPS Hardening Requirements

- GHCR token should have pull-only package scope where possible.
- Runtime env should come from Infisical/env files/Kubernetes secrets, not image build args.
- Deploy user should not be the root login account where avoidable.
- Keep previous known-good image digest on disk or in deployment metadata.
- Health check should test the real BFF port and expected `/health` payload.
- Restart policy should be explicit.
- Logs should redact authorization headers, cookies, OTPs, and provider keys.

### One-Command Operator Experience

The desired operator command is:

```bash
npm run deploy:bff:remote
```

Expected behavior:

1. Calculate or request the context hash.
2. Trigger the GitHub Actions BFF image workflow.
3. Wait for workflow completion.
4. Print image digest.
5. Trigger deploy or report the deploy workflow URL.
6. Print VPS health result.

This command should not run local Docker.

### Why Not Windows VPS

Windows VPS is not recommended for this specific problem.

- Linux containers are the natural target for this BFF service.
- GitHub Actions Ubuntu runners and Linux VPS Docker are simpler for BuildKit.
- Windows Server evaluation is time-limited and not a clean production answer.
- Windows container BuildKit support is not the mainline path for this app.
- It would add licensing, GUI, and Docker complexity without solving the core bottleneck.

## Implementation Phases

### Phase 1 - Admin Baseline MFA

- Remove password UI from admin unlock.
- Remove frontend TOTP setup behavior.
- Add backend MFA challenge state machine.
- Make TOTP verification return challenge only.
- Make three-email OTP verification require prior TOTP challenge.
- Issue admin session only after both gates.
- Add tests and audit scenario.

Exit criteria:

- No admin session is issued after TOTP alone.
- No admin session is issued after email OTP alone.
- Browser UI contains no password or authenticator setup path.
- Admin audit passes.

### Phase 2 - Remote-Only BFF Image Pipeline

- Keep one canonical BFF Dockerfile.
- Keep local command for hash only.
- Build/reuse BFF image in GitHub Actions.
- Push SHA and context-hash tags.
- Generate manifest artifact.
- Make Contabo/OVH/Kubernetes pull the SHA/digest image instead of rebuilding.
- Make Trivy scan the exact published image.

Exit criteria:

- Local Docker is not required for the normal BFF flow.
- Repeated run with unchanged BFF context reuses the existing context image.
- VPS pulls the published SHA/digest image.

### Phase 3 - Attestation, SBOM, Signing, and Rollback

- Generate SBOM for BFF image.
- Generate provenance attestation.
- Sign or attest image by digest.
- Verify image before VPS deploy.
- Add digest-based deploy record.
- Add automatic rollback on failed health check.

Exit criteria:

- Production deploy has manifest, SBOM, scan result, and provenance/signature or attestation.
- Failed health check blocks promotion or rolls back automatically.

### Phase 4 - Passkey/FIDO2 Admin Upgrade

- Add backend WebAuthn/passkey registration command for owner-controlled setup.
- Store passkey credential metadata backend-side only.
- Add passkey verification as gate 1 primary.
- Keep TOTP as fallback if needed.
- Keep three email OTPs as gate 2.

Exit criteria:

- Passkey/security key can satisfy gate 1.
- Passkey enrollment remains backend/owner controlled.
- Three email OTPs still remain required as gate 2.

## Acceptance Criteria

Admin MFA is accepted when:

- Admin panel has no password field.
- Admin panel has no authenticator setup UI.
- TOTP/passkey gate alone cannot unlock admin.
- Email OTP gate alone cannot unlock admin.
- Both gates are required for admin session creation.
- Three email OTP recipients are backend-controlled.
- No raw admin email list, OTP values, TOTP secrets, or QR setup secrets appear in frontend artifacts.

BFF pipeline is accepted when:

- Normal workflow does not require local Docker.
- Same BFF context hash reuses the same image.
- VPS deploy pulls a GHCR image instead of rebuilding.
- Deploy uses the exact tested digest.
- SBOM/provenance/signature or attestation exists for production image.
- Trivy scans the deployed image.
- Health-check failure rolls back or blocks promotion.
- No build-time secrets appear in image history/config.

## Open Decisions Before Implementation

These are the only decisions that should be confirmed or discovered from the repo before coding:

- Whether the first implementation should be TOTP-only baseline or passkey-first.
- Where server-side MFA challenges should be stored in production: in-memory, Redis, database, or existing session store.
- Exact names of the three backend-configured admin email env vars.
- Whether production deploys use Docker Compose, Kubernetes, or both as first priority.
- Whether GitHub artifact attestations are available for the current repository plan, or whether Sigstore Cosign should be used directly.

## Research Basis

- NIST SP 800-63B-4: phishing-resistant authenticators are preferred for higher assurance; manually entered OTPs are not phishing-resistant.
  - https://pages.nist.gov/800-63-4/sp800-63b.html
- CISA phishing-resistant MFA guidance: FIDO/passkeys reduce credential phishing and legacy MFA bypass risk.
  - https://www.cisa.gov/resources-tools/resources/phishing-resistant-multi-factor-authentication-mfa-success-story-usdas-fast-identity-online-fido
- NCSC passkey guidance: passkeys are recommended over passwords where available and are faster and more phishing-resistant.
  - https://www.ncsc.gov.uk/passkeys
- OWASP MFA guidance: MFA flows need careful enrollment, recovery, and factor-change controls.
  - https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html
- Docker BuildKit: BuildKit improves build performance, cache precision, and parallelism.
  - https://docs.docker.com/build/buildkit/
- Docker GitHub Actions cache: GitHub Actions cache supports remote BuildKit caching with `cache-from` and `cache-to`.
  - https://docs.docker.com/build/cache/backends/gha/
- SLSA build requirements: provenance, isolated builds, and controlled build platforms improve supply-chain trust.
  - https://slsa.dev/spec/v1.2/build-requirements
- GitHub artifact attestations: GitHub Actions can generate signed attestations and verify container image provenance.
  - https://docs.github.com/actions/security-guides/using-artifact-attestations-to-establish-provenance-for-builds
- CISA SBOM guidance: SBOMs support software transparency and vulnerability response.
  - https://www.cisa.gov/sbom
