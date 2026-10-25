import { User, Chat, Message, StickerPack, CustomSticker } from '../types';
import { DEFAULT_STICKER_PACKS } from '../data/mockData';
import { getSupabaseClient, broadcastStickersUpdated } from './supabase';

export const STICKER_BOT_AVATAR = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%232AABEE"/><stop offset="100%" stop-color="%238b5cf6"/></linearGradient></defs><rect width="128" height="128" rx="64" fill="url(%23bg)"/><text x="50%" y="54%" font-size="64" text-anchor="middle" dominant-baseline="middle">🤖</text></svg>`;

export const STICKER_BOT_USER: User = {
  id: 'user-stickerbot',
  nickname: 'Stickers Bot',
  username: 'stickerbot',
  avatar: STICKER_BOT_AVATAR,
  statusEmoji: '🤖',
  statusText: 'Официальный бот стикеров',
  bio: 'Создавайте свои наборы стикеров из фото и картинок 🤖🎨. Напишите /start или отправьте любое фото!',
  isOnline: true,
  isBot: true,
  lastSeen: 'бот'
};

export const STICKER_BOT_CHAT: Chat = {
  id: 'chat-bot-stickerbot',
  type: 'direct',
  name: 'Stickers Bot',
  avatar: STICKER_BOT_AVATAR,
  statusEmoji: '🤖',
  isPinned: false,
  unreadCount: 0,
  isBot: true,
  isOnline: true,
  lastSeen: 'бот',
  lastMessage: {
    text: '📦 Ваши наборы стикеров (1): 1. «нуя» — 3 шт.',
    createdAt: 'Всегда',
    type: 'text',
    isOutgoing: false
  }
};

export interface StickerBotSession {
  step: 'IDLE' | 'AWAITING_PACK_NAME' | 'AWAITING_STICKER_PHOTO' | 'AWAITING_STICKER_EMOJI';
  activePackId?: string;
  activePackName?: string;
  pendingImageUrl?: string;
}

const STORAGE_KEY_PACKS = 'just_sticker_packs';
const STORAGE_KEY_SESSION = 'just_stickerbot_session';

export function getStoredStickerPacks(): StickerPack[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PACKS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    return DEFAULT_STICKER_PACKS;
  } catch (e) {
    return DEFAULT_STICKER_PACKS;
  }
}

export function saveStoredStickerPacks(packs: StickerPack[]) {
  try {
    localStorage.setItem(STORAGE_KEY_PACKS, JSON.stringify(packs));
    window.dispatchEvent(new Event('just_sticker_packs_updated'));
  } catch (e) {
    console.warn('Failed to save sticker packs to localStorage (quota exceeded?):', e);
  }

  // Live broadcast to all other open devices of this user
  broadcastStickersUpdated(packs);

  // Cloud sync to Supabase profiles
  try {
    const client = getSupabaseClient();
    const rawUser = localStorage.getItem('just_user');
    if (client && rawUser) {
      const user = JSON.parse(rawUser);
      if (user && user.id) {
        client.from('profiles').update({ sticker_packs: packs }).eq('id', user.id).then();
      }
    }
  } catch (e) {}
}

export function getBotSession(): StickerBotSession {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SESSION);
    return raw ? JSON.parse(raw) : { step: 'IDLE' };
  } catch (e) {
    return { step: 'IDLE' };
  }
}

export function saveBotSession(session: StickerBotSession) {
  try {
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
  } catch (e) {
    console.warn('Failed to save bot session to localStorage:', e);
  }
}

/**
 * Main engine processing user input in the @stickerbot chat.
 * Returns the bot's response message.
 */
export function processStickerBotInput(
  input: { text?: string; mediaUrl?: string },
  currentUser: User
): Message {
  const session = getBotSession();
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const rawText = (input.text || '').trim();
  const textLower = rawText.toLowerCase();

  const makeBotMessage = (
    text: string,
    botButtons?: { label: string; action: string; style?: 'primary' | 'secondary' | 'danger' }[],
    stickerUrl?: string
  ): Message => ({
    id: `msg-bot-${Date.now()}`,
    chatId: STICKER_BOT_CHAT.id,
    senderId: STICKER_BOT_USER.id,
    senderName: STICKER_BOT_USER.nickname,
    senderEmoji: STICKER_BOT_USER.statusEmoji,
    senderAvatar: STICKER_BOT_USER.avatar,
    type: stickerUrl ? 'sticker' : 'text',
    text,
    stickerUrl,
    createdAt: timeStr,
    isOutgoing: false,
    status: 'read',
    botButtons
  });

  // Handle /cancel
  if (textLower === '/cancel' || textLower === 'отмена' || textLower === '❌ отмена') {
    saveBotSession({ step: 'IDLE' });
    return makeBotMessage(
      'Действие отменено ❌\n\nНапишите /newpack, чтобы создать набор стикеров, или /mypacks, чтобы посмотреть существующие.',
      [
        { label: '➕ Создать новый набор', action: '/newpack' },
        { label: '📦 Мои стикеры', action: '/mypacks' }
      ]
    );
  }

  // Handle /start or /help
  if (textLower === '/start' || textLower === '/help' || textLower === 'помощь' || textLower === 'start') {
    saveBotSession({ step: 'IDLE' });
    return makeBotMessage(
      `👋 Привет, ${currentUser.nickname}! Я Stickers Bot 🤖🎨\n\nЯ помогу вам превратить любые фотографии и мемы в стикеры, которыми можно делиться во всех чатах JustChat.\n\n📋 Доступные команды:\n/newpack — создать новый набор стикеров\n/mypacks — список ваших наборов\n/delpack — удалить набор\n/cancel — отменить текущую команду\n\nИли просто нажмите кнопки ниже 👇`,
      [
        { label: '➕ Создать новый набор', action: '/newpack' },
        { label: '📦 Мои стикеры', action: '/mypacks' }
      ]
    );
  }

  // Handle /mypacks
  if (textLower === '/mypacks' || textLower === 'мои стикеры' || textLower === '📦 мои стикеры') {
    const packs = getStoredStickerPacks();
    if (packs.length === 0) {
      return makeBotMessage(
        'У вас пока нет созданных наборов стикеров 📦\n\nНажмите кнопку ниже, чтобы создать свой первый набор:',
        [{ label: '➕ Создать набор (/newpack)', action: '/newpack' }]
      );
    }

    let summary = `📦 Ваши наборы стикеров (${packs.length}):\n\n`;
    packs.forEach((p, idx) => {
      summary += `${idx + 1}. «${p.name}» — ${p.stickers.length} шт.\n`;
    });
    summary += '\nВсе эти стикеры уже доступны в вашей панели стикеров в любом чате!';

    return makeBotMessage(summary, [
      { label: '➕ Создать еще набор', action: '/newpack' },
      { label: '🗑️ Удалить набор', action: '/delpack' }
    ]);
  }

  // Handle /delpack
  if (textLower === '/delpack' || textLower === 'удалить набор') {
    const packs = getStoredStickerPacks();
    if (packs.length === 0) {
      return makeBotMessage('У вас нет наборов для удаления.');
    }
    const buttons = packs.slice(0, 5).map((p) => ({
      label: `🗑️ «${p.name}»`,
      action: `/confirm_del_${p.id}`
    }));
    buttons.push({ label: '❌ Отмена', action: '/cancel' });

    return makeBotMessage('Выберите набор, который хотите удалить:', buttons);
  }

  // Handle confirm delete
  if (textLower.startsWith('/confirm_del_')) {
    const packId = rawText.replace('/confirm_del_', '');
    const packs = getStoredStickerPacks();
    const target = packs.find((p) => p.id === packId);
    if (target) {
      saveStoredStickerPacks(packs.filter((p) => p.id !== packId));
      saveBotSession({ step: 'IDLE' });
      return makeBotMessage(
        `✅ Набор «${target.name}» был успешно удален.`,
        [
          { label: '➕ Создать новый набор', action: '/newpack' },
          { label: '📦 Мои стикеры', action: '/mypacks' }
        ]
      );
    }
  }

  // Handle /newpack
  if (textLower === '/newpack' || textLower === 'новый набор' || textLower === '➕ создать новый набор') {
    saveBotSession({ step: 'AWAITING_PACK_NAME' });
    return makeBotMessage(
      '🏷️ Отлично! Введите название для нового набора стикеров (например: "Мемы с друзьями" или "Любимые котики"):',
      [{ label: '❌ Отмена', action: '/cancel' }]
    );
  }

  // Handle photo sent by user
  if (input.mediaUrl) {
    if (session.step === 'AWAITING_STICKER_PHOTO' && session.activePackId) {
      saveBotSession({
        ...session,
        step: 'AWAITING_STICKER_EMOJI',
        pendingImageUrl: input.mediaUrl
      });
      return makeBotMessage(
        '✨ Отличная картинка получена!\n\nТеперь отправьте эмодзи, который соответствует этому стикеру (например: 🔥, 😂, 😎, ❤️):',
        [
          { label: '🔥 Огонь', action: '🔥' },
          { label: '😂 Ржака', action: '😂' },
          { label: '😎 Крутой', action: '😎' },
          { label: '❤️ Любовь', action: '❤️' },
          { label: '🐱 Кот', action: '🐱' },
          { label: '👍 Класс', action: '👍' }
        ]
      );
    } else {
      // User sent photo in IDLE or other state
      const packs = getStoredStickerPacks();
      if (packs.length > 0) {
        const lastPack = packs[packs.length - 1];
        saveBotSession({
          step: 'AWAITING_STICKER_EMOJI',
          activePackId: lastPack.id,
          activePackName: lastPack.name,
          pendingImageUrl: input.mediaUrl
        });
        return makeBotMessage(
          `📸 Вижу фото для стикера! Добавляем в набор «${lastPack.name}».\n\nОтправьте эмодзи для этого стикера:`,
          [
            { label: '🔥 Огонь', action: '🔥' },
            { label: '😂 Ржака', action: '😂' },
            { label: '😎 Крутой', action: '😎' },
            { label: '❤️ Любовь', action: '❤️' },
            { label: '👍 Класс', action: '👍' }
          ]
        );
      } else {
        // No packs exist yet
        saveBotSession({
          step: 'AWAITING_PACK_NAME',
          pendingImageUrl: input.mediaUrl
        });
        return makeBotMessage(
          '📸 Вижу отличное фото для стикера! У вас еще нет наборов.\n\nПридумайте и напишите название для нового набора стикеров:',
          [{ label: '❌ Отмена', action: '/cancel' }]
        );
      }
    }
  }

  // Handle state: AWAITING_PACK_NAME
  if (session.step === 'AWAITING_PACK_NAME') {
    if (!rawText) {
      return makeBotMessage('Пожалуйста, напишите текстовое название для набора:');
    }

    const packName = rawText;
    const packs = getStoredStickerPacks();
    const newPack: StickerPack = {
      id: `pack-${Date.now()}`,
      name: packName,
      authorId: currentUser.id,
      authorName: currentUser.nickname,
      createdAt: Date.now(),
      stickers: []
    };

    saveStoredStickerPacks([...packs, newPack]);

    // If an image was already waiting
    if (session.pendingImageUrl) {
      saveBotSession({
        step: 'AWAITING_STICKER_EMOJI',
        activePackId: newPack.id,
        activePackName: newPack.name,
        pendingImageUrl: session.pendingImageUrl
      });
      return makeBotMessage(
        `🎉 Набор «${packName}» создан!\n\nТеперь выберите или отправьте эмодзи для загруженной картинки:`,
        [
          { label: '🔥 Огонь', action: '🔥' },
          { label: '😂 Ржака', action: '😂' },
          { label: '😎 Крутой', action: '😎' },
          { label: '❤️ Любовь', action: '❤️' },
          { label: '👍 Класс', action: '👍' }
        ]
      );
    }

    saveBotSession({
      step: 'AWAITING_STICKER_PHOTO',
      activePackId: newPack.id,
      activePackName: newPack.name
    });

    return makeBotMessage(
      `🎉 Набор «${packName}» успешно создан!\n\nТеперь прикрепите и отправьте фотографию (нажмите на скрепку 📎 снизу) для первого стикера:`,
      [{ label: '❌ Отмена', action: '/cancel' }]
    );
  }

  // Handle state: AWAITING_STICKER_EMOJI
  if (session.step === 'AWAITING_STICKER_EMOJI') {
    const emoji = rawText.trim() || '⭐';
    if (!session.pendingImageUrl || !session.activePackId) {
      saveBotSession({ step: 'IDLE' });
      return makeBotMessage('Произошла ошибка сессии. Начните заново с /newpack', [
        { label: '➕ Создать новый набор', action: '/newpack' }
      ]);
    }

    const packs = getStoredStickerPacks();
    const pack = packs.find((p) => p.id === session.activePackId);
    if (!pack) {
      saveBotSession({ step: 'IDLE' });
      return makeBotMessage('Набор не найден. Начните заново с /newpack', [
        { label: '➕ Создать новый набор', action: '/newpack' }
      ]);
    }

    if (!Array.isArray(pack.stickers)) {
      pack.stickers = [];
    }

    const newSticker: CustomSticker = {
      id: `cstk-${Date.now()}`,
      packId: pack.id,
      packName: pack.name,
      emoji: emoji.slice(0, 4), // preserve emoji
      title: `${pack.name} ${emoji}`,
      url: session.pendingImageUrl,
      createdAt: Date.now()
    };

    pack.stickers.push(newSticker);
    saveStoredStickerPacks(packs);

    saveBotSession({
      step: 'AWAITING_STICKER_PHOTO',
      activePackId: pack.id,
      activePackName: pack.name,
      pendingImageUrl: undefined
    });

    return makeBotMessage(
      `🎉 Стикер с эмодзи ${newSticker.emoji} добавлен в набор «${pack.name}» (всего: ${pack.stickers.length} шт.)!\n\nОтправьте следующее фото через 📎 скрепку, чтобы добавить еще, или нажмите «✅ Завершить набор»:`,
      [
        { label: '✅ Завершить набор (/done)', action: '/done', style: 'primary' },
        { label: '📦 Мои стикеры', action: '/mypacks' }
      ]
    );
  }

  // Handle /done
  if (textLower === '/done' || textLower === 'завершить' || textLower === '✅ завершить набор') {
    const packName = session.activePackName || 'Ваш набор';
    saveBotSession({ step: 'IDLE' });
    return makeBotMessage(
      `🚀 Поздравляем! Набор «${packName}» полностью готов и опубликован!\n\nОн уже доступен в панели стикеров во всех чатах. Можете зайти в любой чат и сразу отправить созданный стикер 🐱🎨`,
      [
        { label: '📦 Посмотреть наборы', action: '/mypacks' },
        { label: '➕ Создать еще набор', action: '/newpack' }
      ]
    );
  }

  // Fallback default response
  return makeBotMessage(
    'Я вас не понял 🤔\n\nОтправьте мне фотографию через 📎 скрепку для создания стикера или выберите команду:',
    [
      { label: '➕ Создать новый набор', action: '/newpack' },
      { label: '📦 Мои наборы стикеров', action: '/mypacks' },
      { label: '❓ Помощь', action: '/help' }
    ]
  );
}
