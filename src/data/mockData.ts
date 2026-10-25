import { User, Story, Chat, Message, CatSticker, StickerPack } from '../types';

export const CURRENT_USER_DEFAULT: User = {
  id: 'user-me',
  nickname: 'Бублик',
  username: 'bulat',
  avatar: '/avatar-bublik.jpg',
  statusEmoji: '🎧',
  statusText: 'Йоу йоу',
  bio: 'Основатель и главный архитектор JustChat ⚡',
  isOnline: true,
  isVip: true,
  hideLastSeen: true
};

export const DEFAULT_STICKER_PACKS: StickerPack[] = [
  {
    id: 'pack-nuya',
    name: 'нуя',
    authorId: 'user-me',
    authorName: 'Бублик',
    createdAt: Date.now(),
    stickers: [
      { id: 'stk-nuya-1', packId: 'pack-nuya', packName: 'нуя', emoji: '😏', title: 'нуя 1', url: '/stickers/nuya-1.jpg', createdAt: Date.now() },
      { id: 'stk-nuya-2', packId: 'pack-nuya', packName: 'нуя', emoji: '😐', title: 'нуя 2', url: '/stickers/nuya-2.jpg', createdAt: Date.now() },
      { id: 'stk-nuya-3', packId: 'pack-nuya', packName: 'нуя', emoji: '🤡', title: 'нуя 3', url: '/stickers/nuya-3.png', createdAt: Date.now() }
    ]
  }
];

export const AVAILABLE_EMOJIS = [
  '👑', '🐱', '🔥', '⚡', '💎', '🎧', '🚀', '🍕', 
  '👾', '💀', '👻', '😎', '☕', '🥊', '🎯', '💸',
  '🌙', '⭐', '🌈', '🌪️', '🧸', '🎮', '🏎️', '🦄'
];

export const CAT_STICKERS: CatSticker[] = [
  {
    id: 'cat-1',
    title: 'Чилл Кот',
    category: 'chill',
    url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=240&auto=format&fit=crop&q=80'
  },
  {
    id: 'cat-2',
    title: 'Шок Кот',
    category: 'funny',
    url: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=240&auto=format&fit=crop&q=80'
  },
  {
    id: 'cat-3',
    title: 'Кот в коробке',
    category: 'funny',
    url: 'https://images.unsplash.com/photo-1543852786-1cf6624b9987?w=240&auto=format&fit=crop&q=80'
  },
  {
    id: 'cat-4',
    title: 'Милый спящий',
    category: 'chill',
    url: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=240&auto=format&fit=crop&q=80'
  },
  {
    id: 'cat-5',
    title: 'Любимый кот',
    category: 'love',
    url: 'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=240&auto=format&fit=crop&q=80'
  },
  {
    id: 'cat-6',
    title: 'Дерзкий кот',
    category: 'rage',
    url: 'https://images.unsplash.com/photo-1561948955-570b270e7c36?w=240&auto=format&fit=crop&q=80'
  }
];

export const SAVED_MESSAGES_CHAT: Chat = {
  id: 'chat-saved',
  type: 'direct',
  name: 'Избранное',
  avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
  statusEmoji: '⭐',
  isPinned: true,
  unreadCount: 0,
  isSavedMessages: true,
  lastMessage: {
    text: 'Личное хранилище заметок, кружочков и файлов 🔖',
    createdAt: 'Всегда',
    type: 'text',
    isOutgoing: true
  }
};

export const INITIAL_FRIENDS: User[] = [];

export const INITIAL_STORIES: Story[] = [];

export const INITIAL_CHATS: Chat[] = [SAVED_MESSAGES_CHAT];

export const INITIAL_MESSAGES: Record<string, Message[]> = {
  'chat-saved': [
    {
      id: 'saved-msg-welcome',
      chatId: 'chat-saved',
      senderId: 'user-me',
      senderName: 'Избранное',
      type: 'text',
      text: 'Добро пожаловать в ваше личное «Избранное»! 🔖\n\nЗдесь вы можете:\n• Записывать мысли и заметки\n• Отправлять себе ссылки и файлы\n• Сохранять любимые кружочки и треки',
      createdAt: 'Только что',
      isOutgoing: true,
      status: 'read'
    }
  ]
};
