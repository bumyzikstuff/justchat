import { Story } from '../types';

export const STORY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Extracts the exact creation timestamp of a story
 */
export function getStoryTimestamp(story: Story): number {
  if (story.createdAtTimestamp && story.createdAtTimestamp > 0) {
    return story.createdAtTimestamp;
  }
  if (story.id && story.id.startsWith('story-')) {
    const fromId = Number(story.id.replace('story-', ''));
    if (!isNaN(fromId) && fromId > 1600000000000) {
      return fromId;
    }
  }
  const parsed = Date.parse(story.createdAt);
  if (!isNaN(parsed) && parsed > 1600000000000) {
    return parsed;
  }
  return Date.now();
}

/**
 * Checks if a story has passed the 24-hour expiration threshold
 */
export function isStoryExpired(story: Story): boolean {
  const timestamp = getStoryTimestamp(story);
  return Date.now() - timestamp >= STORY_TTL_MS;
}

/**
 * Filters out expired stories (older than 24h) and broken blob URLs from previous sessions
 */
export function filterActiveStories(stories: Story[]): Story[] {
  return stories.filter((story) => {
    if (isStoryExpired(story)) return false;
    // Blob URLs cannot survive a page refresh; filter them out
    if (story.mediaUrl && story.mediaUrl.startsWith('blob:')) return false;
    return true;
  });
}

/**
 * Formats a story timestamp into human-readable Russian relative time:
 * - "только что" (< 1 min)
 * - "1 минуту назад", "2 минуты назад", "5 минут назад", "21 минуту назад"
 * - "1 час назад", "2 часа назад", "5 часов назад", "22 часа назад"
 */
export function formatStoryTime(timestampOrDate?: number | string): string {
  if (!timestampOrDate) return 'только что';

  let timeMs: number;
  if (typeof timestampOrDate === 'number') {
    timeMs = timestampOrDate;
  } else {
    const asNum = Number(timestampOrDate);
    if (!isNaN(asNum) && asNum > 1000000000) {
      timeMs = asNum;
    } else {
      const parsed = Date.parse(timestampOrDate);
      if (isNaN(parsed)) return timestampOrDate;
      timeMs = parsed;
    }
  }

  const diffMs = Date.now() - timeMs;
  if (diffMs < 0) return 'только что';

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'только что';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    const mod10 = diffMin % 10;
    const mod100 = diffMin % 100;
    let word = 'минут';
    if (mod100 < 11 || mod100 > 14) {
      if (mod10 === 1) word = 'минуту';
      else if (mod10 >= 2 && mod10 <= 4) word = 'минуты';
    }
    return `${diffMin} ${word} назад`;
  }

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    const mod10 = diffHours % 10;
    const mod100 = diffHours % 100;
    let word = 'часов';
    if (mod100 < 11 || mod100 > 14) {
      if (mod10 === 1) word = 'час';
      else if (mod10 >= 2 && mod10 <= 4) word = 'часа';
    }
    return `${diffHours} ${word} назад`;
  }

  return '24 ч. назад';
}

/**
 * Compresses an image file down to max 1080x1920 with high JPEG quality (0.85).
 * Generates a persistent Data URL that fits in localStorage and never expires or turns black.
 */
export function compressStoryMedia(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // If it's a video, read as Data URL directly
    if (file.type.startsWith('video/')) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 1080;
        const maxHeight = 1920;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, 0.85);
        resolve(dataUrl);
      };
      img.onerror = () => resolve(reader.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses an avatar photo to max 500x500 square JPEG (quality 0.88).
 * Ensures instant sync and zero localStorage quota issues.
 */
export function compressAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxSize = 500;
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      };
      img.onerror = () => resolve(reader.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
