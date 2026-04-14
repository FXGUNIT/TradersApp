const MAX_SCREENSHOTS = 4;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB — prevent memory pressure from huge pastes

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(String(event?.target?.result || ""));
    reader.onerror = () =>
      reject(reader.error || new Error("Failed to read dropped file."));
    reader.readAsDataURL(file);
  });
}

function isImageFile(file) {
  return Boolean(file?.type?.startsWith("image/"));
}

async function imageFileToPayload(file) {
  const dataUrl = await readFileAsDataUrl(file);
  const [, b64 = ""] = dataUrl.split(",", 2);

  return {
    name: file?.name || "image",
    type: file?.type || "image/png",
    b64,
  };
}

export async function onScreenshotDrop(event, setScreenshots, showToast) {
  event.preventDefault();

  const rawFiles = Array.from(
    event?.dataTransfer?.files || event?.target?.files || [],
  );

  const oversized = rawFiles.filter(
    (f) => isImageFile(f) && f.size > MAX_FILE_BYTES,
  );
  if (oversized.length) {
    showToast?.(
      `Screenshot too large — max ${MAX_FILE_BYTES / 1024 / 1024}MB`,
      "error",
    );
  }

  const files = rawFiles.filter(
    (f) => isImageFile(f) && f.size <= MAX_FILE_BYTES,
  );
  if (!files.length) return;

  const nextAssets = await Promise.all(files.map(imageFileToPayload));
  setScreenshots((current) =>
    [...current, ...nextAssets].slice(0, MAX_SCREENSHOTS),
  );
}

export function makeImgHandler(setter, showToast) {
  return async (event) => {
    event.preventDefault();

    const file = Array.from(
      event?.dataTransfer?.files || event?.target?.files || [],
    ).find((f) => isImageFile(f) && f.size <= MAX_FILE_BYTES);

    if (!file) {
      // Check if there was an oversized image that was filtered
      const rawFile = Array.from(
        event?.dataTransfer?.files || event?.target?.files || [],
      ).find((f) => isImageFile(f) && f.size > MAX_FILE_BYTES);
      if (rawFile) {
        showToast?.(
          `Image too large — max ${MAX_FILE_BYTES / 1024 / 1024}MB`,
          "error",
        );
      }
      return;
    }

    if (!file) return;

    setter(await imageFileToPayload(file));
  };
}

export function toDataUrl(asset) {
  if (!asset?.b64 || !asset?.type) return "";
  return `data:${asset.type};base64,${asset.b64}`;
}
