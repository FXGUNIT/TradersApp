const MAX_SCREENSHOTS = 4;

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

export async function onScreenshotDrop(event, setScreenshots) {
  event.preventDefault();

  const files = Array.from(
    event?.dataTransfer?.files || event?.target?.files || [],
  ).filter(isImageFile);

  if (!files.length) return;

  const nextAssets = await Promise.all(files.map(imageFileToPayload));
  setScreenshots((current) =>
    [...current, ...nextAssets].slice(0, MAX_SCREENSHOTS),
  );
}

export function makeImgHandler(setter) {
  return async (event) => {
    event.preventDefault();

    const file = Array.from(
      event?.dataTransfer?.files || event?.target?.files || [],
    ).find(isImageFile);

    if (!file) return;

    setter(await imageFileToPayload(file));
  };
}

export function toDataUrl(asset) {
  if (!asset?.b64 || !asset?.type) return "";
  return `data:${asset.type};base64,${asset.b64}`;
}
