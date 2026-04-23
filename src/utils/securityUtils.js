export const calculatePasswordStrength = (password) => {
  if (!password) return 0;
  let strength = 0;

  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) strength++;

  return Math.min(strength, 3);
};

export const getStrengthLabel = (strength) => {
  if (strength <= 1) return { label: "Weak", color: "#FF453A" };
  if (strength === 2) return { label: "Medium", color: "#FF9500" };
  return { label: "Strong", color: "#34C759" };
};

export const isValidGmailAddress = (email) => {
  const trimmed = email.trim().toLowerCase();
  return trimmed.endsWith("@gmail.com") && trimmed.split("@")[0].length > 0;
};

export const isPasswordExpired = (lastChangedTimestamp) => {
  if (!lastChangedTimestamp) return true;
  const lastChanged = new Date(lastChangedTimestamp);
  const now = new Date();
  const daysDiff = Math.floor((now - lastChanged) / (1000 * 60 * 60 * 24));
  return daysDiff > 120;
};

export const copyToClipboardSecure = async (text, showToast) => {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Data packet delivered. Clipboard stands ready.", "success");

    setTimeout(async () => {
      try {
        await navigator.clipboard.writeText("");
      } catch (error) {
        console.warn("Could not clear clipboard:", error);
      }
    }, 60000);
  } catch (error) {
    console.error("Failed to copy:", error);
    showToast("Copy buffer full. Try again soon.", "error");
  }
};

export const detectGPUSupport = () => {
  try {
    const testEl = document.createElement("div");
    testEl.style.transform = "translateZ(0)";

    const hasTransformZ = testEl.style.transform !== "";
    const hasSupportsRule =
      typeof CSS !== "undefined" &&
      CSS.supports &&
      CSS.supports("transform", "translateZ(0)");

    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl", {
      failIfMajorPerformanceCaveat: false,
    });
    const hasWebGL = !!gl;

    const isGPUAccelerated = hasTransformZ && (hasSupportsRule || hasWebGL);
    const result = {
      supported: isGPUAccelerated,
      hasTransformZ,
      hasSupportsRule,
      hasWebGL,
      agent: navigator.userAgent.split(" ").slice(-1)[0],
    };

    if (isGPUAccelerated) {
      console.log("GPU Acceleration: ENABLED (TransformZ + WebGL)");
    } else {
      console.log("GPU Acceleration: FALLBACK MODE (CPU rendering)");
    }

    return result;
  } catch (error) {
    console.warn("GPU detection error:", error);
    return { supported: false, error: error.message };
  }
};

export const withExponentialBackoff = async (
  fn,
  maxRetries = 3,
  initialDelay = 100,
) => {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        console.error(
          `Operation failed after ${maxRetries + 1} attempts:`,
          error,
        );
        throw error;
      }

      const delayMs = initialDelay * Math.pow(2, attempt);
      console.warn(
        `Attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`,
        error.message,
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
};

export const formatPhoneNumber = (phone = "") =>
  phone.replace(/\D/g, "").slice(0, 10);
