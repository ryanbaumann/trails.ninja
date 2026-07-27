// Client-side image helpers. Photos from a modern phone are 5–12 MB, which
// base64-encodes ~33% larger and can blow past the server's body limit while
// adding cost/latency for no quality benefit. We validate and downscale before
// anything is uploaded or sent to the model.

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // reject absurd files up front
const DEFAULT_MAX_EDGE = 1280; // px — plenty for identity-preserving generation
const DEFAULT_QUALITY = 0.85;

export class ImageValidationError extends Error {}

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new ImageValidationError('Could not read that file.'));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImageValidationError('That file is not a readable image.'));
    img.src = src;
  });

/**
 * Downscale a data URL to a maximum edge length and re-encode as JPEG.
 * Returns the original string unchanged if it is already within bounds or if
 * canvas processing is unavailable.
 */
export const downscaleDataUrl = async (
  dataUrl: string,
  maxEdge: number = DEFAULT_MAX_EDGE,
  quality: number = DEFAULT_QUALITY
): Promise<string> => {
  try {
    const img = await loadImage(dataUrl);
    const largestEdge = Math.max(img.width, img.height);
    if (largestEdge <= maxEdge) return dataUrl;

    const scale = maxEdge / largestEdge;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    // If anything goes wrong, fall back to the original data URL.
    return dataUrl;
  }
};

/**
 * Validate a picked File is an image of a sane size, then return a downscaled
 * JPEG data URL suitable for upload. Throws ImageValidationError on bad input.
 */
export const processImageFile = async (
  file: File,
  maxEdge: number = DEFAULT_MAX_EDGE
): Promise<string> => {
  if (!file.type.startsWith('image/')) {
    throw new ImageValidationError('Please choose an image file (JPG or PNG).');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ImageValidationError('That image is too large. Please pick one under 15 MB.');
  }
  const dataUrl = await readFileAsDataUrl(file);
  return downscaleDataUrl(dataUrl, maxEdge);
};
