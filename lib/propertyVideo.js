export const PROPERTY_VIDEO_BUCKET = 'property-videos';
export const MAX_PROPERTY_VIDEO_BYTES = 50 * 1024 * 1024;

const SUPPORTED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);

export function validatePropertyVideo(file) {
  if (!file) return 'Select a video to continue.';

  if (!SUPPORTED_VIDEO_TYPES.has(file.type)) {
    return 'Only MP4 or WebM videos are supported.';
  }

  if (file.size > MAX_PROPERTY_VIDEO_BYTES) {
    return 'The video must be 50 MB or smaller.';
  }

  return '';
}

export function createPropertyVideoPath(userId, file) {
  const extension = file.type === 'video/webm' ? 'webm' : 'mp4';
  const uniqueId =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${userId}/${uniqueId}.${extension}`;
}

export function propertyVideoPathFromPublicUrl(publicUrl) {
  if (!publicUrl) return null;

  try {
    const url = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${PROPERTY_VIDEO_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);

    if (markerIndex === -1) return null;

    return decodeURIComponent(
      url.pathname.slice(markerIndex + marker.length)
    );
  } catch {
    return null;
  }
}
