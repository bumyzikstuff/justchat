/**
 * Telegram-style Presence and Last Seen Formatter for JustChat
 */

export function formatLastSeen(dateStrOrTs?: string | number | null, isOnline?: boolean): string {
  if (isOnline) {
    return 'в сети';
  }

  if (!dateStrOrTs) {
    return 'был(а) недавно';
  }

  try {
    const date = new Date(dateStrOrTs);
    if (isNaN(date.getTime())) {
      return 'был(а) недавно';
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    // Less than 1 minute ago or in the future
    if (diffMs < 60 * 1000) {
      return 'был(а) только что';
    }

    const diffMin = Math.floor(diffMs / (60 * 1000));
    if (diffMin < 60) {
      const lastDigit = diffMin % 10;
      const lastTwo = diffMin % 100;
      let minWord = 'минут назад';
      if (lastTwo < 11 || lastTwo > 19) {
        if (lastDigit === 1) minWord = 'минуту назад';
        else if (lastDigit >= 2 && lastDigit <= 4) minWord = 'минуты назад';
      }
      return `был(а) ${diffMin} ${minWord}`;
    }

    const diffHours = Math.floor(diffMs / (3600 * 1000));
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Same calendar day
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return `был(а) сегодня в ${timeStr}`;
    }

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return `был(а) вчера в ${timeStr}`;
    }

    // Same year
    if (date.getFullYear() === now.getFullYear()) {
      const monthNames = [
        'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
        'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
      ];
      return `был(а) ${date.getDate()} ${monthNames[date.getMonth()]} в ${timeStr}`;
    }

    return 'был(а) давно';
  } catch (e) {
    return 'был(а) недавно';
  }
}

/**
 * Determines whether a user is definitively online right now.
 * Strict check: user must be in live Realtime Presence OR have sent a heartbeat within the last 60 seconds.
 */
export function isUserOnline(
  userId: string,
  onlineUserIds: Set<string>,
  updatedAt?: string | null,
  isOnlineFlag?: boolean | null
): boolean {
  if (!userId) return false;

  // 1. Live WebSocket Realtime presence takes top priority
  if (onlineUserIds.has(userId)) {
    return true;
  }

  // 2. Heartbeat check: must have is_online true AND updated_at < 60 seconds ago
  if (isOnlineFlag && updatedAt) {
    const elapsed = Date.now() - new Date(updatedAt).getTime();
    if (elapsed >= 0 && elapsed < 60 * 1000) {
      return true;
    }
  }

  return false;
}
