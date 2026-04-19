const DESKTOP_CHANNEL = "tradersapp-desktop";
const REQUEST_TIMEOUT_MS = 5000;

let listenerAttached = false;
let requestSequence = 0;
const pendingRequests = new Map();
let runtimeContextPromise = null;

function hasWindow() {
  return typeof window !== "undefined";
}

export function isDesktopRuntime() {
  return typeof window !== "undefined" && Boolean(window.chrome?.webview);
}

function getFallbackContext() {
  return {
    available: false,
    platform: "browser",
    appVersion: String(import.meta.env.VITE_APP_VERSION || "0.0.0-dev"),
    installId: null,
    deviceId: null,
  };
}

function ensureListener() {
  if (!isDesktopRuntime() || listenerAttached) {
    return;
  }

  window.chrome.webview.addEventListener("message", (event) => {
    const message = event?.data;
    if (!message || message.channel !== DESKTOP_CHANNEL || !message.id) {
      return;
    }

    const pending = pendingRequests.get(message.id);
    if (!pending) {
      return;
    }

    pendingRequests.delete(message.id);
    clearTimeout(pending.timeoutId);

    if (message.ok === false) {
      pending.reject(new Error(message.error || "Desktop bridge request failed."));
      return;
    }

    pending.resolve(message.result ?? null);
  });

  listenerAttached = true;
}

export async function desktopInvoke(command, payload = {}) {
  if (!isDesktopRuntime()) {
    return null;
  }

  ensureListener();

  const id = `desktop-${Date.now()}-${requestSequence += 1}`;

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Desktop bridge timeout for ${command}`));
    }, REQUEST_TIMEOUT_MS);

    pendingRequests.set(id, { resolve, reject, timeoutId });
    window.chrome.webview.postMessage({
      channel: DESKTOP_CHANNEL,
      command,
      id,
      payload,
    });
  });
}

export async function getDesktopRuntimeContext() {
  if (!hasWindow()) {
    return getFallbackContext();
  }

  if (!isDesktopRuntime()) {
    return getFallbackContext();
  }

  if (!runtimeContextPromise) {
    runtimeContextPromise = desktopInvoke("runtime.getContext")
      .then((context) => ({
        ...getFallbackContext(),
        ...(context || {}),
        available: true,
      }))
      .catch(() => ({
        ...getFallbackContext(),
        available: true,
        platform: "windows",
      }));
  }

  return runtimeContextPromise;
}

export async function getDesktopRequestHeaders() {
  const context = await getDesktopRuntimeContext();
  return {
    "X-TradersApp-Platform": context.platform || "browser",
    "X-TradersApp-Version": context.appVersion || "0.0.0-dev",
    "X-TradersApp-Install-Id": context.installId || "",
    "X-TradersApp-Device-Id": context.deviceId || "",
  };
}

export async function secureStoreGet(key) {
  if (!isDesktopRuntime()) {
    return null;
  }

  return desktopInvoke("storage.get", { key });
}

export async function secureStoreSet(key, value) {
  if (!isDesktopRuntime()) {
    return false;
  }

  await desktopInvoke("storage.set", { key, value });
  return true;
}

export async function secureStoreRemove(key) {
  if (!isDesktopRuntime()) {
    return false;
  }

  await desktopInvoke("storage.remove", { key });
  return true;
}

export async function notifyDesktopPolicy(payload = {}) {
  if (!isDesktopRuntime()) {
    return false;
  }

  await desktopInvoke("policy.notify", payload);
  return true;
}

export async function requestDesktopUpdateCheck(payload = {}) {
  if (!isDesktopRuntime()) {
    return false;
  }

  await desktopInvoke("updates.check", payload);
  return true;
}

export async function requestDesktopRestart(payload = {}) {
  if (!isDesktopRuntime()) {
    return false;
  }

  await desktopInvoke("app.restart", payload);
  return true;
}

export default {
  desktopInvoke,
  getDesktopRequestHeaders,
  getDesktopRuntimeContext,
  isDesktopRuntime,
  notifyDesktopPolicy,
  requestDesktopRestart,
  requestDesktopUpdateCheck,
  secureStoreGet,
  secureStoreRemove,
  secureStoreSet,
};
