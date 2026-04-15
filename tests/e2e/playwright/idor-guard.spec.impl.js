import { test, expect } from "@playwright/test";

test.describe.configure({ timeout: 90_000 });

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function ensureBffOrSkip(request) {
  const health = await request.get("/api/health", { timeout: 5_000 }).catch(() => null);
  if (!health) {
    test.skip(true, "BFF is not reachable for IDOR contract checks.");
  }

  if (health.status() >= 500) {
    test.skip(true, "BFF is unavailable (health endpoint returned 5xx).");
  }

  const contentType = String(health.headers()["content-type"] || "").toLowerCase();
  if (contentType.includes("text/html")) {
    test.skip(true, "BFF proxy is not active in this test environment.");
  }
}

test("identity PATCH contract rejects cross-uid writes without valid auth", async ({ request }) => {
  await ensureBffOrSkip(request);

  const response = await request.patch(
    "/api/identity/users/other-user-002/access",
    {
      headers: {
        Authorization: "Bearer invalid-token",
        "Content-Type": "application/json",
      },
      data: {
        role: "ADMIN",
      },
    },
  );

  expect([401, 403]).toContain(response.status());
  const payload = await safeJson(response);
  expect(payload).toMatchObject({ ok: false });
});

test("identity revoke-others contract rejects unauthenticated calls", async ({ request }) => {
  await ensureBffOrSkip(request);

  const response = await request.post(
    "/api/identity/users/other-user-002/sessions/revoke-others",
    {
      headers: {
        Authorization: "Bearer invalid-token",
        "Content-Type": "application/json",
      },
      data: {
        currentSessionId: "session-current",
      },
    },
  );

  expect([401, 403]).toContain(response.status());
  const payload = await safeJson(response);
  expect(payload).toMatchObject({ ok: false });
});

test("optional strict idor mismatch check with provided token stays rejected", async ({ request }) => {
  await ensureBffOrSkip(request);

  const actorUid = String(process.env.PLAYWRIGHT_IDOR_UID || "").trim();
  const actorToken = String(process.env.PLAYWRIGHT_IDOR_TOKEN || "").trim();
  if (!actorUid || !actorToken) {
    test.skip(true, "PLAYWRIGHT_IDOR_UID and PLAYWRIGHT_IDOR_TOKEN are not configured.");
  }

  const targetUid = `${actorUid}-other`;
  const response = await request.patch(
    `/api/identity/users/${encodeURIComponent(targetUid)}/access`,
    {
      headers: {
        Authorization: `Bearer ${actorToken}`,
        "Content-Type": "application/json",
      },
      data: {
        role: "ADMIN",
      },
    },
  );

  expect([401, 403]).toContain(response.status());
  const payload = await safeJson(response);
  expect(payload).toMatchObject({ ok: false });
});
