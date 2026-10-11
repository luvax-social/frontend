/**
 * Composer rules, all derived from the limits the server publishes.
 *
 * Nothing here holds its own copy of a format list, a size ceiling or a
 * duration ceiling. Every limit arrives as an argument, so a change on the
 * server reaches the interface without a frontend edit.
 */

import type { MediaConstraintsResponse } from '@/types/domain';

const MEGABYTE = 1024 * 1024;

/**
 * The number of items a carousel may hold.
 *
 * This one value is not published by the constraints endpoint, which covers
 * formats, size and duration only. It was established by creating posts
 * against the running server: 1 item is refused, 2 and 10 are accepted, and 11
 * is refused. The upper refusal arrives as a bare "Request validation failed"
 * that names neither the field nor the limit, which is why the composer stops
 * an eleventh item itself rather than letting the server answer.
 */
export const MAX_CAROUSEL_ITEMS = 10;
export const MIN_CAROUSEL_ITEMS = 2;

/**
 * A size in bytes rendered the way a limit should read to a person.
 */
export const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  const megabytes = bytes / MEGABYTE;
  if (megabytes >= 1024) {
    const gigabytes = megabytes / 1024;
    return `${Number.isInteger(gigabytes) ? gigabytes : gigabytes.toFixed(1)}GB`;
  }
  if (megabytes >= 1) return `${Math.round(megabytes)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
};

/**
 * The short label a MIME type reads as in helper text, so that image/jpeg
 * shows as jpeg rather than as its full type.
 */
const subtypeOf = (mimeType: string) => mimeType.split('/')[1] || mimeType;

export const isVideoFile = (file: Pick<File, 'type'> | null | undefined) =>
  Boolean(file?.type?.startsWith('video/'));

/**
 * The post type is a consequence of what is attached, never a mode the person
 * picks first. Two or more items of any mix is a carousel, which the server
 * confirmed it accepts including when images and video are combined.
 */
export const derivePostType = (
  items: { file: Pick<File, 'type'> }[] | null | undefined
): 'TEXT' | 'CAROUSEL' | 'VIDEO' | 'IMAGE' => {
  if (!items || items.length === 0) return 'TEXT';
  if (items.length > 1) return 'CAROUSEL';
  return isVideoFile(items[0].file) ? 'VIDEO' : 'IMAGE';
};

/**
 * The file picker offers exactly what the server accepts and nothing more.
 */
export const buildAcceptAttribute = (constraints: MediaConstraintsResponse | null | undefined) => {
  if (!constraints) return '';
  return [...constraints.acceptedImageMimeTypes, ...constraints.acceptedVideoMimeTypes].join(',');
};

/**
 * The helper line under the drop zone, built from the same values the checks
 * use, so the text cannot describe a rule that is not applied.
 */
export const buildHelperText = (constraints: MediaConstraintsResponse | null | undefined) => {
  if (!constraints) return '';
  const images = constraints.acceptedImageMimeTypes.map(subtypeOf).join(', ');
  const videos = constraints.acceptedVideoMimeTypes.map(subtypeOf).join(', ');
  return `${images} · ${videos} · max ${constraints.maxVideoDurationSeconds}s video · ${formatBytes(constraints.maxFileSizeBytes)}`;
};

/**
 * Checked before a byte is sent.
 *
 * The message names the actual limit, because the server's own refusal for an
 * oversized file says only that the limit was exceeded without saying what it
 * is, and a refusal that does not name the number leaves the person guessing.
 */
export const validateFile = (
  file: Pick<File, 'name' | 'type' | 'size'>,
  constraints: MediaConstraintsResponse | null | undefined
) => {
  if (!constraints) {
    return { ok: false, message: "we can't check that file right now. try again in a moment." };
  }

  const accepted = [...constraints.acceptedImageMimeTypes, ...constraints.acceptedVideoMimeTypes];
  if (!accepted.includes(file.type)) {
    // An empty type is what the browser reports for a file it does not
    // recognise, HEIC among them on most systems, so it is named rather than
    // rendered as a blank.
    const shown = file.type || 'that file type';
    return {
      ok: false,
      message: `${file.name}: ${shown} isn't accepted. accepted types are ${accepted.join(', ')}.`,
    };
  }

  if (file.size > constraints.maxFileSizeBytes) {
    const limit = formatBytes(constraints.maxFileSizeBytes);
    const actual = formatBytes(file.size);
    // A file barely over the ceiling renders at the same rounded size as the
    // ceiling itself, and "100MB is over the 100MB limit" reads as a bug. In
    // that case the size is dropped and only the limit is named.
    return {
      ok: false,
      message:
        actual === limit
          ? `${file.name} is over the ${limit} limit.`
          : `${file.name}: ${actual} is over the ${limit} limit.`,
    };
  }

  return { ok: true };
};

/**
 * Duration is checked here because the server never opens the file.
 *
 * The server bounds the number the client declares and nothing else, which was
 * confirmed by registering a 30 second file declared as 1 second and having it
 * accepted. This check is therefore the only place a genuinely long video is
 * stopped.
 */
export const validateDuration = (
  file: Pick<File, 'name' | 'type'>,
  durationSeconds: number | undefined,
  constraints: MediaConstraintsResponse | null | undefined
) => {
  if (!constraints || !isVideoFile(file)) return { ok: true };
  if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds)) return { ok: true };
  if (durationSeconds > constraints.maxVideoDurationSeconds) {
    return {
      ok: false,
      message: `${file.name}: ${Math.round(durationSeconds)}s is over the ${constraints.maxVideoDurationSeconds}s limit.`,
    };
  }
  return { ok: true };
};

/**
 * Reorder without mutating, since the order shown is the order stored.
 */
export const moveItem = <T>(items: T[], fromIndex: number, toIndex: number) => {
  if (toIndex < 0 || toIndex >= items.length || fromIndex === toIndex) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};
