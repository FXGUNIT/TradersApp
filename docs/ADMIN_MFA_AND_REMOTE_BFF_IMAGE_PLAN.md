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

### Researched Stronger Flow

The stronger long-term flow is:

1. Gate 1 primary: passkey/FIDO2 security key.
2. Gate 1 fallback: authenticator app TOTP code.
3. Gate 2: three email OTP codes.
4. Admin session only after both gates pass.

This is safer because passkeys and FIDO2 security keys are phishing-resistant, while manually entered OTP codes can be relayed by an attacker. The baseline TOTP flow should still be implemented first if passkey support would slow delivery.

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

### Phase 2 - Remote-Only BFF Image Pipeline

- Keep one canonical BFF Dockerfile.
- Keep local command for hash only.
- Build/reuse BFF image in GitHub Actions.
- Push SHA and context-hash tags.
- Generate manifest artifact.
- Make Contabo/OVH/Kubernetes pull the SHA/digest image instead of rebuilding.
- Make Trivy scan the exact published image.

### Phase 3 - Attestation, SBOM, Signing, and Rollback

- Generate SBOM for BFF image.
- Generate provenance attestation.
- Sign or attest image by digest.
- Verify image before VPS deploy.
- Add digest-based deploy record.
- Add automatic rollback on failed health check.

### Phase 4 - Passkey/FIDO2 Admin Upgrade

- Add backend WebAuthn/passkey registration command for owner-controlled setup.
- Store passkey credential metadata backend-side only.
- Add passkey verification as gate 1 primary.
- Keep TOTP as fallback if needed.
- Keep three email OTPs as gate 2.

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

