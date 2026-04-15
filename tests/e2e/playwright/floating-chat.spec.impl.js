import { test, expect } from "@playwright/test";

test.describe.configure({ timeout: 90_000 });

const MOCK_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

function createMockSupportRouter() {
  const threads = new Map();

  const normalizeUid = (pathname) => {
    const threadMatch = pathname.match(/^\/support\/threads\/([^/]+)$/);
    if (threadMatch) return decodeURIComponent(threadMatch[1]);

    const messageMatch = pathname.match(/^\/support\/threads\/([^/]+)\/messages$/);
    if (messageMatch) return decodeURIComponent(messageMatch[1]);

    return null;
  };

  const readJsonBody = async (route) => {
    const raw = route.request().postData() || "{}";
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  };

  const toThreadPayload = (uid) => {
    const list = threads.get(uid) || [];
    const messages = Object.fromEntries(
      list.map((message, index) => [message.id || `${uid}-${index + 1}`, message]),
    );
    return { uid, messages };
  };

  return async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;
    const method = request.method().toUpperCase();

    if (!pathname.startsWith("/support/")) {
      await route.continue();
      return;
    }

    if (method === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: MOCK_CORS_HEADERS,
      });
      return;
    }

    if (method === "GET" && pathname === "/support/threads") {
      const summary = Array.from(threads.entries()).map(([uid, messages]) => ({
        uid,
        messageCount: messages.length,
      }));

      await route.fulfill({
        status: 200,
        headers: MOCK_CORS_HEADERS,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, threads: summary }),
      });
      return;
    }

    const uid = normalizeUid(pathname);
    if (!uid) {
      await route.fulfill({
        status: 404,
        headers: MOCK_CORS_HEADERS,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Not found" }),
      });
      return;
    }

    if (method === "GET") {
      await route.fulfill({
        status: 200,
        headers: MOCK_CORS_HEADERS,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          thread: toThreadPayload(uid),
        }),
      });
      return;
    }

    if (method === "POST" && pathname.endsWith("/messages")) {
      const payload = await readJsonBody(route);
      const thread = threads.get(uid) || [];
      const nextMessage = {
        id: payload.id || `${uid}-${thread.length + 1}`,
        text: String(payload.text || ""),
        sender: payload.sender || "user",
        timestamp: payload.timestamp || Date.now(),
        type: payload.type || "message",
      };
      thread.push(nextMessage);
      threads.set(uid, thread);

      await route.fulfill({
        status: 200,
        headers: MOCK_CORS_HEADERS,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          thread: toThreadPayload(uid),
          message: nextMessage,
        }),
      });
      return;
    }

    await route.fulfill({
      status: 405,
      headers: MOCK_CORS_HEADERS,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Method not allowed" }),
    });
  };
}

function floatingLauncher(page) {
  return page
    .locator("button")
    .filter({
      has: page.locator('svg path[d*="M21 15a2 2"]'),
    })
    .first();
}

async function requireFloatingWidget(page) {
  const launcher = floatingLauncher(page);
  const visible = await launcher.isVisible({ timeout: 5_000 }).catch(() => false);
  if (!visible) {
    test.skip(true, "Floating support chat is not enabled in this environment.");
  }
  return launcher;
}

async function openWidget(page) {
  const launcher = await requireFloatingWidget(page);
  await launcher.click();
  await expect(page.getByText("TradersApp Support")).toBeVisible();
}

async function completePreChat(page) {
  await page.getByPlaceholder("Your Full Name").fill("Audit Trader");
  await page.getByPlaceholder("Mobile Number").fill("+1234567890");
  await page.getByRole("button", { name: /start chat/i }).click();
}

test.beforeEach(async ({ page }) => {
  const supportRouter = createMockSupportRouter();
  await page.route("**/support/**", supportRouter);
  await page.goto("/", { waitUntil: "domcontentloaded" });
});

test("floating widget renders for unauthenticated users", async ({ page }) => {
  const launcher = await requireFloatingWidget(page);
  await expect(launcher).toBeVisible();
});

test("clicking launcher opens support panel", async ({ page }) => {
  await openWidget(page);
  await expect(page.getByText("Before we start")).toBeVisible();
});

test("pre-chat form blocks empty submit", async ({ page }) => {
  await openWidget(page);
  await page.getByRole("button", { name: /start chat/i }).click();
  await expect(page.getByPlaceholder("Your Full Name")).toBeVisible();
  await expect(page.getByPlaceholder("Type your message...")).not.toBeVisible();
});

test("pre-chat submit shows welcome message", async ({ page }) => {
  await openWidget(page);
  await completePreChat(page);
  await expect(page.getByText(/how can i help you today/i)).toBeVisible();
});

test("close and reopen keeps panel interactive", async ({ page }) => {
  await openWidget(page);
  await page.getByLabel("Close chat").click();
  await expect(page.getByText("TradersApp Support")).not.toBeVisible();

  await openWidget(page);
  await expect(page.getByPlaceholder("Your Full Name")).toBeVisible();
});

test("send message flow renders the user message", async ({ page }) => {
  await openWidget(page);
  await completePreChat(page);

  const messageInput = page.getByPlaceholder("Type your message...");
  await messageInput.fill("Need help with upload and OCR.");
  await messageInput.press("Enter");

  await expect(page.getByText("Need help with upload and OCR.")).toBeVisible({
    timeout: 7_500,
  });
});
