# `is-a.dev` Resubmission Plan

**Last updated:** 2026-04-22

The first `tradergunit.is-a.dev` request was closed because it was submitted as
an app root instead of a developer/personal root and because the PR template was
incomplete. The corrected structure is:

- `tradergunit.is-a.dev` for the developer root and portfolio surface
- `traders.tradergunit.is-a.dev` for the TradersApp frontend
- `bff.traders.tradergunit.is-a.dev` for the BFF
- `api.traders.tradergunit.is-a.dev` for the API

## Root Submission Checklist

Fill every required `is-a.dev` checkbox before opening the PR:

- the root is a completed dev/personal site
- the root is not the product/app itself
- the root page has a public preview link
- the PR body includes contact info
- the PR body includes a screenshot

Recommended preview proof for the root request:

- live route: `https://173.249.18.14.sslip.io/developer`
- screenshot target: the same route after the Contabo deploy refresh

## Root JSON

Create `domains/tradergunit.json` in the `is-a-dev/register` fork:

```json
{
  "owner": {
    "username": "FXGUNIT",
    "email": "fxgunit@users.noreply.github.com"
  },
  "record": {
    "A": ["173.249.18.14"]
  }
}
```

## Root PR Title

```text
Add tradergunit.is-a.dev
```

## Root PR Body Template

```text
## Requirements
- [x] The website is in some way related to software development
- [x] The website is a personal/portfolio/developer root, not the app production hostname itself
- [x] The website is complete and already has public preview proof
- [x] I have read and followed the documentation
- [x] I am not using the domain for URL shorteners, storage, piracy, or abuse

## Website
- Website URL: `https://173.249.18.14.sslip.io/developer`
- Website purpose: developer root / portfolio for FXGUNIT's software systems and self-hosted trading infrastructure work
- Preview: `https://173.249.18.14.sslip.io/developer`

## Contact
- GitHub: `https://github.com/FXGUNIT`
- Email: `fxgunit@users.noreply.github.com`

## Notes
- The root host will remain developer-facing.
- The actual product hosts will live under nested subdomains after approval:
  - `traders.tradergunit.is-a.dev`
  - `bff.traders.tradergunit.is-a.dev`
  - `api.traders.tradergunit.is-a.dev`

## Screenshot
![developer-root-preview](<PUBLIC_SCREENSHOT_URL>)
```

Replace `<PUBLIC_SCREENSHOT_URL>` with the uploaded screenshot URL before
submitting.

## Nested Follow-On Requests

Open these only after the root request is merged.

### `traders.tradergunit.is-a.dev`

```text
Title: Add traders.tradergunit.is-a.dev

Body:
## Summary
- request `traders.tradergunit.is-a.dev` for the TradersApp frontend
- point the subdomain to the self-hosted Contabo VPS
- keep the root domain developer-facing

## DNS
- `A 173.249.18.14`

## Notes
- root domain request already merged: `tradergunit.is-a.dev`
```

### `bff.traders.tradergunit.is-a.dev`

```text
Title: Add bff.traders.tradergunit.is-a.dev

Body:
## Summary
- request `bff.traders.tradergunit.is-a.dev` for the TradersApp backend-for-frontend host
- point the subdomain to the self-hosted Contabo VPS
- keep the root domain developer-facing

## DNS
- `A 173.249.18.14`

## Notes
- root domain request already merged: `tradergunit.is-a.dev`
```

### `api.traders.tradergunit.is-a.dev`

```text
Title: Add api.traders.tradergunit.is-a.dev

Body:
## Summary
- request `api.traders.tradergunit.is-a.dev` for the TradersApp API host
- point the subdomain to the self-hosted Contabo VPS
- keep the root domain developer-facing

## DNS
- `A 173.249.18.14`

## Notes
- root domain request already merged: `tradergunit.is-a.dev`
```
