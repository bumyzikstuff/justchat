import React, { useState, useEffect, useRef } from 'react';
import { User, Chat, Message, Story, CatSticker, TrackInfo, StoryViewer, StoryLike } from './types';
import {
  CURRENT_USER_DEFAULT,
  DEFAULT_STICKER_PACKS,
  INITIAL_CHATS,
  SAVED_MESSAGES_CHAT,
  INITIAL_MESSAGES,
  INITIAL_STORIES,
  INITIAL_FRIENDS
} from './data/mockData';
import { Header } from './components/Header';
import { StoriesBar } from './components/StoriesBar';
import { StoryViewerModal } from './components/StoryViewerModal';
import { ChatList } from './components/ChatList';
import { ChatRoom } from './components/ChatRoom';
import { VideoNoteRecorderModal } from './components/VideoNoteRecorderModal';
import { VoiceNoteRecorderModal } from './components/VoiceNoteRecorderModal';
import { ProfileSettingsModal } from './components/ProfileSettingsModal';
import { PwaInstallModal } from './components/PwaInstallModal';
import { AuthModal } from './components/AuthModal';
import { MusicPlayerBar } from './components/MusicPlayerBar';
import { FullMusicPlayerModal } from './components/FullMusicPlayerModal';
import { VideoNoteViewerModal } from './components/VideoNoteViewerModal';
import { UserProfileModal } from './components/UserProfileModal';
import { CreateChatModal } from './components/CreateChatModal';
import { AudioHelper } from './utils/audio';
import { encryptText, decryptText } from './utils/crypto';
import { compressStoryMedia, compressAvatar, filterActiveStories, getStoryTimestamp, formatStoryTime } from './utils/storyHelper';
import { formatLastSeen, isUserOnline } from './utils/presence';
import { STICKER_BOT_USER, STICKER_BOT_CHAT, processStickerBotInput, getBotSession } from './services/stickerBot';
import {
  getSupabaseConfig,
  getSupabaseClient,
  subscribeToJustChat,
  broadcastNewMessage,
  broadcastReaction,
  broadcastTyping,
  broadcastDeleteMessage,
  broadcastEditMessage,
  broadcastDeleteChat,
  broadcastProfileUpdated,
  broadcastNewStory,
  broadcastDeleteStory,
  broadcastStoryLike,
  saveMessageToCloud,
  fetchMessagesFromCloud,
  deleteMessageInCloud,
  editMessageInCloud,
  updateReactionsInCloud,
  saveStoryToCloud,
  fetchStoriesFromCloud,
  deleteStoryFromCloud,
  updateStoryLikesInCloud,
  updateOnlineStatusInCloud,
  fetchCloudProfiles,
  uploadMediaToSupabase,
  blobToDataUrl,
  broadcastForceRelogin
} from './services/supabase';

export const CURRENT_AUTH_EPOCH = 'epoch_justchat_reset_2026_10_25_v4';

const GUEST_PENDING_USER: User = {
  id: 'user-pending',
  nickname: 'Новый пользователь',
  username: 'user',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  statusEmoji: '👋',
  statusText: 'на связи 🤙',
  bio: 'Пользователь JustChat',
  isOnline: true
};

// Deterministic 1-on-1 direct chat ID with double underscore delimiter '__'
export const makeDirectChatId = (userId1: string, userId2: string): string => {
  const sorted = [userId1, userId2].sort();
  return `chat-dm_${sorted[0]}__${sorted[1]}`;
};

// Helper to parse participants of a direct chat ID (both modern 'chat-dm_...' and legacy 'chat-...')
export const parseDirectChatParticipants = (chatId: string): [string, string] | null => {
  if (!chatId) return null;
  // Modern format: chat-dm_{userA}__{userB}
  if (chatId.startsWith('chat-dm_')) {
    const raw = chatId.replace('chat-dm_', '');
    const parts = raw.split('__');
    if (parts.length === 2 && parts[0] && parts[1]) {
      return [parts[0], parts[1]];
    }
  }
  // Legacy format: chat-{userA}-{userB}
  if (chatId.startsWith('chat-') && !chatId.startsWith('chat-saved') && chatId !== 'chat-general' && !chatId.startsWith('chat-bot-')) {
    const raw = chatId.replace(/^chat-/, '');
    if (raw.startsWith('user-me-')) {
      const other = raw.replace(/^user-me-/, '');
      if (other) return ['user-me', other];
    } else if (raw.endsWith('-user-me')) {
      const other = raw.replace(/-user-me$/, '');
      if (other) return [other, 'user-me'];
    }
  }
  return null;
};

// Strict check: Is this chat intended for myId? (STRICT SECURITY & ZERO CROSS-CONTAMINATION)
export const isChatForMe = (chatId: string, myId: string): boolean => {
  if (!chatId || !myId || myId === 'user-pending') return false;

  // Personal saved messages: STRICTLY user's own!
  if (chatId.startsWith('chat-saved')) {
    return chatId === `chat-saved-${myId}`;
  }

  // Official Sticker Bot
  if (chatId === 'chat-bot-stickerbot') {
    return true;
  }

  // Public general group chat
  if (chatId === 'chat-general') {
    return true;
  }

  // Modern direct chat: chat-dm_{id1}__{id2}
  if (chatId.startsWith('chat-dm_')) {
    const raw = chatId.replace('chat-dm_', '');
    const parts = raw.split('__');
    return parts.includes(myId);
  }

  // Legacy direct chat
  const participants = parseDirectChatParticipants(chatId);
  if (participants) {
    return participants.includes(myId);
  }

  // Direct ID check: if chatId contains myId and is a private chat
  if (chatId.startsWith('chat-') && chatId.includes(myId)) {
    return true;
  }

  // STRICT SECURITY DEFAULT: DO NOT LEAK ANY CHAT NOT ADDRESSED TO ME!
  return false;
};

// Helper to extract the other participant's user ID in a direct chat
export const getChatPartnerId = (chat: Chat, myId: string): string | null => {
  if (chat.type !== 'direct' || chat.isSavedMessages || chat.id.startsWith('chat-saved') || chat.isBot) {
    return null;
  }
  if (chat.partnerId && chat.partnerId !== myId) return chat.partnerId;

  if (chat.id.startsWith('chat-dm_')) {
    const raw = chat.id.replace('chat-dm_', '');
    const parts = raw.split('__');
    if (parts.length === 2) {
      return parts[0] === myId ? parts[1] : parts[0];
    }
  }

  const participants = parseDirectChatParticipants(chat.id);
  if (participants) {
    return participants[0] === myId ? participants[1] : participants[0];
  }

  if (chat.partnerId) return chat.partnerId;
  return null;
};

export function App() {
  // Global Session Purge: If stored epoch doesn't match, force logout everyone immediately!
  if (typeof window !== 'undefined') {
    const currentEpoch = localStorage.getItem('just_auth_epoch');
    if (currentEpoch !== CURRENT_AUTH_EPOCH) {
      localStorage.removeItem('just_user');
      localStorage.removeItem('bro_user');
      localStorage.removeItem('just_chats');
      localStorage.removeItem('just_messages');
      localStorage.removeItem('just_friends');
      localStorage.setItem('just_auth_epoch', CURRENT_AUTH_EPOCH);
    }
  }

  // Current user state (with local storage persistence & device sync)
  const [currentUser, setCurrentUser] = useState<User>(() => {
    // Check if logging in via QR code / session link (?auth_session=...)
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const sessionToken = params.get('auth_session');
        if (sessionToken) {
          const jsonStr = decodeURIComponent(escape(atob(sessionToken)));
          const parsed = JSON.parse(jsonStr);
          if (parsed && (parsed.id || parsed.nickname)) {
            const fullUser: User = {
              ...CURRENT_USER_DEFAULT,
              ...parsed,
              isVip: parsed.isVip !== undefined ? parsed.isVip : true
            };
            localStorage.setItem('just_user', JSON.stringify(fullUser));
            localStorage.setItem('bro_user', JSON.stringify(fullUser));
            window.history.replaceState({}, document.title, window.location.pathname);
            return fullUser;
          }
        }
      } catch (e) {
        console.error('Failed to parse auth_session', e);
      }
    }

    const saved = localStorage.getItem('just_user') || localStorage.getItem('bro_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Automatically purge any stale legacy "Булат" or Unsplash girl photo
        if (parsed.id === 'user-me' && (parsed.nickname === 'Булат' || !parsed.avatar || parsed.avatar.includes('photo-1534528741775'))) {
          localStorage.setItem('just_user', JSON.stringify(CURRENT_USER_DEFAULT));
          localStorage.setItem('bro_user', JSON.stringify(CURRENT_USER_DEFAULT));
          return CURRENT_USER_DEFAULT;
        }
        return {
          ...parsed,
          isVip: parsed.isVip !== undefined ? parsed.isVip : (parsed.id === 'user-me' || parsed.username === 'bulat' || parsed.username === 'bublik')
        };
      } catch (e) {
        return GUEST_PENDING_USER;
      }
    }
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      return CURRENT_USER_DEFAULT;
    }
    return GUEST_PENDING_USER;
  });

  // Friends & Contacts state (SCOPED TO CURRENT USER)
  const [friends, setFriends] = useState<User[]>(() => {
    if (!currentUser.id || currentUser.id === 'user-pending') return [];
    const userFriendsKey = `just_friends_${currentUser.id}`;
    let saved = localStorage.getItem(userFriendsKey);
    if (!saved && currentUser.id === 'user-me') {
      saved = localStorage.getItem('just_friends');
      if (saved) localStorage.removeItem('just_friends');
    }
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.filter((f: User) => 
          f.id !== currentUser.id &&
          !['max_fit', 'artem_beats', 'dasha_meow', 'nikita_pro'].includes(f.username) &&
          !f.username.toLowerCase().includes('stickerbotв') &&
          !f.id.includes('stickerbotв') &&
          !(f.username.toLowerCase().includes('stickerbot') && f.id !== 'user-stickerbot')
        );
      } catch (e) {
        return [];
      }
    }
    return INITIAL_FRIENDS;
  });

  // Profile Viewing state
  const [viewingProfileChat, setViewingProfileChat] = useState<Chat | null>(null);
  const [isViewingOwnProfile, setIsViewingOwnProfile] = useState<boolean>(false);
  const [isCreateChatOpen, setIsCreateChatOpen] = useState(false);

  // Message Editing state
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  // Invite code state
  const [inviteCode, setInviteCode] = useState<string>(() => {
    return localStorage.getItem('just_invite_code') || localStorage.getItem('bro_invite_code') || 'JUST2026';
  });

  // Check if first-time user (suppress if session token in URL)
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('auth_session') || params.get('device_sync')) return false;
    }
    return !localStorage.getItem('just_user') && !localStorage.getItem('bro_user');
  });

  // Chats state (SCOPED TO CURRENT USER, STRICTLY FILTERED)
  const [chats, setChats] = useState<Chat[]>(() => {
    if (!currentUser.id || currentUser.id === 'user-pending') return [];
    const userChatsKey = `just_chats_${currentUser.id}`;
    let saved = localStorage.getItem(userChatsKey);
    if (!saved && currentUser.id === 'user-me') {
      saved = localStorage.getItem('just_chats');
      if (saved) localStorage.removeItem('just_chats');
    }
    let loaded: Chat[] = saved ? JSON.parse(saved) : [];
    // Strict isolation filter: never keep foreign chats
    loaded = loaded.filter(c => isChatForMe(c.id, currentUser.id));
    loaded = loaded.filter(c => 
      !c.name.toLowerCase().includes('stickerbotв') && 
      !c.id.includes('stickerbotв') &&
      !(c.name.toLowerCase().includes('stickerbot') && c.id !== 'chat-bot-stickerbot')
    );

    const userSavedId = `chat-saved-${currentUser.id}`;
    const userSavedChat: Chat = {
      ...SAVED_MESSAGES_CHAT,
      id: userSavedId,
      unreadCount: 0,
      lastMessage: {
        text: 'Личное хранилище заметок, кружочков и файлов 🔖',
        createdAt: 'Всегда',
        type: 'text',
        isOutgoing: true
      }
    };
    loaded = loaded.filter(c => !c.id.startsWith('chat-saved') && !c.isSavedMessages);
    loaded = [userSavedChat, ...loaded];

    if (!loaded.some((c: Chat) => c.id === 'chat-bot-stickerbot' || c.isBot)) {
      loaded = [...loaded, STICKER_BOT_CHAT];
    }

    // For friends (non-creators), automatically include direct chat with Bublik creator
    if (currentUser.id !== 'user-me') {
      const creatorChatId = makeDirectChatId('user-me', currentUser.id);
      const legacyCreatorChatId = `chat-${['user-me', currentUser.id].sort().join('-')}`;
      if (!loaded.some((c: Chat) => c.id === creatorChatId || c.id === legacyCreatorChatId || c.partnerId === 'user-me' || c.name === 'Бублик')) {
        const creatorChat: Chat = {
          id: creatorChatId,
          type: 'direct',
          name: 'Бублик',
          avatar: '/avatar-bublik.jpg',
          statusEmoji: '🎧',
          isPinned: true,
          unreadCount: 0,
          partnerId: 'user-me',
          isOnline: false,
          lastSeen: 'был(а) недавно',
          lastMessage: {
            text: 'Привет! Добро пожаловать в JustChat 🤙',
            createdAt: 'Только что',
            type: 'text',
            isOutgoing: false
          }
        };
        loaded = [creatorChat, ...loaded];
      }
    }
    return loaded;
  });

  const [selectedChatId, setSelectedChatId] = useState<string | null>(() => {
    const userSavedId = `chat-saved-${currentUser.id || 'user-me'}`;
    if (!currentUser.id || currentUser.id === 'user-pending') return userSavedId;
    const userChatsKey = `just_chats_${currentUser.id}`;
    const saved = localStorage.getItem(userChatsKey);
    const parsed: Chat[] = saved ? JSON.parse(saved) : [];
    if (parsed.length > 0 && isChatForMe(parsed[0].id, currentUser.id)) return parsed[0].id;
    return userSavedId;
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Messages state (SCOPED TO CURRENT USER, STRICTLY FILTERED)
  const [messages, setMessages] = useState<Record<string, Message[]>>(() => {
    try {
      const userSavedId = `chat-saved-${currentUser.id || 'user-me'}`;
      const defaultSavedWelcome: Message = {
        id: `saved-msg-welcome-${currentUser.id || 'me'}`,
        chatId: userSavedId,
        senderId: currentUser.id || 'user-me',
        senderName: 'Избранное',
        type: 'text',
        text: 'Добро пожаловать в ваше личное «Избранное»! 🔖\n\nЗдесь вы можете:\n• Записывать мысли и заметки\n• Отправлять себе ссылки и файлы\n• Сохранять любимые кружочки и треки',
        createdAt: 'Только что',
        isOutgoing: true,
        status: 'read'
      };

      const stickerBotWelcome: Message = {
        id: 'msg-bot-welcome',
        chatId: 'chat-bot-stickerbot',
        senderId: STICKER_BOT_USER.id,
        senderName: STICKER_BOT_USER.nickname,
        senderEmoji: STICKER_BOT_USER.statusEmoji,
        senderAvatar: STICKER_BOT_USER.avatar,
        type: 'text',
        text: 'Привет! Я официальный бот для создания стикеров в JustChat 🤖🎨\n\nЯ помогу вам превратить любые картинки и мемы в стикеры для чатов.\n\nКоманды:\n/newpack — создать новый набор стикеров\n/mypacks — список ваших наборов\n/help — помощь',
        createdAt: 'Только что',
        isOutgoing: false,
        status: 'read',
        botButtons: [
          { label: '➕ Создать новый набор (/newpack)', action: '/newpack' },
          { label: '📦 Мои стикеры (/mypacks)', action: '/mypacks' }
        ]
      };

      if (!currentUser.id || currentUser.id === 'user-pending') {
        return {
          [userSavedId]: [defaultSavedWelcome],
          'chat-bot-stickerbot': [stickerBotWelcome]
        };
      }

      const userMsgsKey = `just_messages_${currentUser.id}`;
      let saved = localStorage.getItem(userMsgsKey);
      if (!saved && currentUser.id === 'user-me') {
        saved = localStorage.getItem('just_messages');
        if (saved) localStorage.removeItem('just_messages');
      }

      const parsed: Record<string, Message[]> = saved ? JSON.parse(saved) : {};
      const sanitized: Record<string, Message[]> = {};
      for (const [cId, msgs] of Object.entries(parsed)) {
        if (isChatForMe(cId, currentUser.id)) {
          sanitized[cId] = msgs;
        }
      }

      if (!sanitized[userSavedId] || sanitized[userSavedId].length === 0) {
        sanitized[userSavedId] = [defaultSavedWelcome];
      }
      if (!sanitized['chat-bot-stickerbot']) {
        sanitized['chat-bot-stickerbot'] = [stickerBotWelcome];
      }
      return sanitized;
    } catch (e) {
      console.warn('Error reading scoped just_messages, resetting:', e);
      return {};
    }
  });

  // Stories state (persisted, filtered to active < 24h & persistent Data URLs)
  const [stories, setStories] = useState<Story[]>(() => {
    try {
      const saved = localStorage.getItem('just_stories');
      const loaded: Story[] = saved ? JSON.parse(saved) : INITIAL_STORIES;
      return filterActiveStories(loaded);
    } catch (e) {
      return INITIAL_STORIES;
    }
  });
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const activeStory = stories.find((s) => s.id === activeStoryId) || null;

  // Live typing status from other users
  const [typingStatus, setTypingStatus] = useState<Record<string, { userName: string; isTyping: boolean }>>({});
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  // Live Presence & Cloud Profiles state
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [cloudProfiles, setCloudProfiles] = useState<any[]>([]);

  // Heartbeat & Online Presence lifecycle
  useEffect(() => {
    if (!currentUser.id) return;

    fetchCloudProfiles().then((profs) => {
      if (profs && profs.length > 0) {
        setCloudProfiles(profs);
      }
    });

    // Mark online initially
    updateOnlineStatusInCloud(currentUser.id, true);

    // Heartbeat every 30 seconds
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        updateOnlineStatusInCloud(currentUser.id, true);
      }
    }, 30000);

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        updateOnlineStatusInCloud(currentUser.id, false);
      } else {
        updateOnlineStatusInCloud(currentUser.id, true);
      }
    };

    const handleBeforeUnload = () => {
      updateOnlineStatusInCloud(currentUser.id, false);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      updateOnlineStatusInCloud(currentUser.id, false);
    };
  }, [currentUser.id]);

  // Keep chats and friends in sync with Realtime presence and cloud profiles
  useEffect(() => {
    setChats((prev) =>
      prev.map((c) => {
        const partnerId = getChatPartnerId(c, currentUser.id);
        if (!partnerId) return c;

        const prof = cloudProfiles.find((p) => p.id === partnerId);
        const isOnline = isUserOnline(
          partnerId,
          onlineUserIds,
          prof?.updated_at,
          prof?.is_online
        );
        const lastSeen = isOnline ? 'в сети' : formatLastSeen(prof?.updated_at);

        if (c.isOnline === isOnline && c.lastSeen === lastSeen && c.partnerId === partnerId) {
          return c;
        }

        return {
          ...c,
          partnerId,
          isOnline,
          lastSeen
        };
      })
    );

    setFriends((prev) =>
      prev.map((f) => {
        const prof = cloudProfiles.find((p) => p.id === f.id);
        const isOnline = isUserOnline(
          f.id,
          onlineUserIds,
          prof?.updated_at,
          prof?.is_online
        );
        const lastSeen = isOnline ? 'в сети' : formatLastSeen(prof?.updated_at || f.updatedAt);

        if (f.isOnline === isOnline && f.lastSeen === lastSeen) {
          return f;
        }

        return {
          ...f,
          isOnline,
          lastSeen,
          updatedAt: prof?.updated_at || f.updatedAt
        };
      })
    );
  }, [onlineUserIds, cloudProfiles, currentUser.id]);

  // Sync to scoped localStorage safely
  useEffect(() => {
    if (!currentUser.id || currentUser.id === 'user-pending') return;
    try {
      localStorage.setItem(`just_friends_${currentUser.id}`, JSON.stringify(friends));
    } catch (e) {}
  }, [friends, currentUser.id]);

  useEffect(() => {
    if (!currentUser.id || currentUser.id === 'user-pending') return;
    try {
      const sanitized = chats.filter((c) => isChatForMe(c.id, currentUser.id));
      localStorage.setItem(`just_chats_${currentUser.id}`, JSON.stringify(sanitized));
    } catch (e) {}
  }, [chats, currentUser.id]);

  useEffect(() => {
    if (!currentUser.id || currentUser.id === 'user-pending') return;
    try {
      const sanitized: Record<string, Message[]> = {};
      for (const [cId, msgs] of Object.entries(messages)) {
        if (isChatForMe(cId, currentUser.id)) {
          sanitized[cId] = msgs;
        }
      }
      localStorage.setItem(`just_messages_${currentUser.id}`, JSON.stringify(sanitized));
    } catch (e) {
      console.warn('LocalStorage quota exceeded for messages, retaining recent messages:', e);
      try {
        const trimmed: Record<string, Message[]> = {};
        for (const [cId, msgs] of Object.entries(messages)) {
          if (isChatForMe(cId, currentUser.id)) {
            trimmed[cId] = msgs.slice(-50);
          }
        }
        localStorage.setItem(`just_messages_${currentUser.id}`, JSON.stringify(trimmed));
      } catch (inner) {}
    }
  }, [messages, currentUser.id]);

  useEffect(() => {
    try {
      localStorage.setItem('just_stories', JSON.stringify(stories));
    } catch (e) {}
  }, [stories]);

  // Auto-cleanup expired stories (> 24 hours) every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setStories((prev) => {
        const active = filterActiveStories(prev);
        if (active.length !== prev.length) {
          return active;
        }
        return prev;
      });
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load friends' cloud stories from Supabase on startup
  useEffect(() => {
    fetchStoriesFromCloud().then((cloudStories) => {
      if (cloudStories && cloudStories.length > 0) {
        setStories((prev) => {
          const map = new Map<string, Story>();
          for (const s of cloudStories) map.set(s.id, s);
          for (const s of prev) {
            if (!map.has(s.id)) map.set(s.id, s);
          }
          return filterActiveStories(Array.from(map.values()));
        });
      }
    });
  }, []);

  // Auto-clean any legacy ghost users or test bots from storage on startup
  useEffect(() => {
    setFriends((prev) => {
      const filtered = prev.filter((f) => 
        !['max_fit', 'artem_beats', 'dasha_meow', 'nikita_pro'].includes(f.username) &&
        !f.username.toLowerCase().includes('stickerbotв') &&
        !f.id.includes('stickerbotв') &&
        !(f.username.toLowerCase().includes('stickerbot') && f.id !== 'user-stickerbot')
      );
      if (filtered.length !== prev.length && currentUser.id && currentUser.id !== 'user-pending') {
        try {
          localStorage.setItem(`just_friends_${currentUser.id}`, JSON.stringify(filtered));
        } catch (e) {}
      }
      return filtered;
    });

    setChats((prev) => {
      const filtered = prev.filter((c) => 
        isChatForMe(c.id, currentUser.id) &&
        !c.name.toLowerCase().includes('stickerbotв') && 
        !c.id.includes('stickerbotв') &&
        !(c.name.toLowerCase().includes('stickerbot') && c.id !== 'chat-bot-stickerbot')
      );
      if (filtered.length !== prev.length && currentUser.id && currentUser.id !== 'user-pending') {
        try {
          localStorage.setItem(`just_chats_${currentUser.id}`, JSON.stringify(filtered));
        } catch (e) {}
      }
      return filtered;
    });

    // Ensure default «нуя» sticker pack is present
    try {
      const raw = localStorage.getItem('just_sticker_packs');
      if (!raw || raw === '[]' || raw === 'null') {
        localStorage.setItem('just_sticker_packs', JSON.stringify(DEFAULT_STICKER_PACKS));
        window.dispatchEvent(new Event('just_sticker_packs_updated'));
      }
    } catch (e) {}
  }, []);

  // Decrypt any locally stored encrypted messages on launch / invite code change
  useEffect(() => {
    let cancelled = false;
    const sweep = async () => {
      let changed = false;
      const nextMessages: Record<string, Message[]> = {};
      for (const [chatId, msgList] of Object.entries(messages)) {
        let chatChanged = false;
        const nextList: Message[] = [];
        for (const msg of msgList) {
          if (msg.text && msg.text.startsWith('enc:v1:')) {
            try {
              const decrypted = await decryptText(msg.text, inviteCode);
              if (decrypted && !decrypted.includes('неверный код доступа')) {
                nextList.push({ ...msg, text: decrypted });
                chatChanged = true;
                continue;
              }
            } catch (e) {}
          }
          nextList.push(msg);
        }
        if (chatChanged) {
          nextMessages[chatId] = nextList;
          changed = true;
        }
      }
      if (changed && !cancelled) {
        setMessages((prev) => ({ ...prev, ...nextMessages }));
      }
    };
    sweep();
    return () => {
      cancelled = true;
    };
  }, [inviteCode]);

  // Auto-sync current user profile and custom sticker packs to global Supabase profiles table
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !currentUser || !currentUser.id) return;

    // Guard: Never overwrite customized cloud profile with unedited default phone mock!
    const isDefaultMock = currentUser.nickname === 'Булат' && (!currentUser.avatar || currentUser.avatar.includes('photo-1534528741775'));
    if (isDefaultMock) return;

    let packs: any[] = [];
    try {
      const raw = localStorage.getItem('just_sticker_packs');
      if (raw) packs = JSON.parse(raw);
    } catch (e) {}

    const payload: any = {
      id: currentUser.id,
      nickname: currentUser.nickname,
      username: currentUser.username,
      avatar: currentUser.avatar || null,
      status_emoji: currentUser.statusEmoji || '🎧',
      status_text: currentUser.statusText || '',
      bio: currentUser.bio || '',
      sticker_packs: packs,
      is_online: true,
      updated_at: new Date().toISOString()
    };

    client
      .from('profiles')
      .upsert(payload)
      .then(({ error }) => {
        if (error) console.warn('Supabase profile sync note:', error.message);
      });
  }, [currentUser]);

  // Load cloud profile (avatar, nickname, bio, sticker packs) on startup
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !currentUser || !currentUser.id) return;

    client
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          // If cloud has an avatar or profile info that differs from local, sync immediately!
          const hasNewAvatar = data.avatar && data.avatar !== currentUser.avatar;
          const hasNewNick = data.nickname && data.nickname !== currentUser.nickname;
          const hasNewEmoji = data.status_emoji && data.status_emoji !== currentUser.statusEmoji;
          const hasNewBio = data.bio !== undefined && data.bio !== currentUser.bio;

          if (hasNewAvatar || hasNewNick || hasNewEmoji || hasNewBio) {
            setCurrentUser((prev) => {
              const next: User = {
                ...prev,
                nickname: data.nickname || prev.nickname,
                avatar: data.avatar || prev.avatar,
                statusEmoji: data.status_emoji || prev.statusEmoji,
                statusText: data.status_text || prev.statusText,
                bio: data.bio !== undefined ? data.bio : prev.bio
              };
              localStorage.setItem('just_user', JSON.stringify(next));
              localStorage.setItem('bro_user', JSON.stringify(next));
              return next;
            });
          }

          // Sync cloud sticker packs into localStorage
          if (data.sticker_packs && Array.isArray(data.sticker_packs) && data.sticker_packs.length > 0) {
            try {
              localStorage.setItem('just_sticker_packs', JSON.stringify(data.sticker_packs));
              window.dispatchEvent(new Event('just_sticker_packs_updated'));
            } catch (e) {}
          }
        }
      });
  }, [currentUser.id]);

  // Live Device Sync from Supabase via QR code / link (?device_sync=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const syncUserId = params.get('device_sync');
    if (syncUserId) {
      const client = getSupabaseClient();
      if (client) {
        client
          .from('profiles')
          .select('*')
          .eq('id', syncUserId)
          .single()
          .then(({ data, error }) => {
            if (!error && data) {
              const syncedUser: User = {
                id: data.id,
                nickname: data.nickname || 'Бублик',
                username: data.username || 'bulat',
                avatar: data.avatar || CURRENT_USER_DEFAULT.avatar,
                statusEmoji: data.status_emoji || '🎧',
                statusText: data.status_text || '',
                bio: data.bio || '',
                isOnline: true,
                isVip: true,
                hideLastSeen: true
              };
              setCurrentUser(syncedUser);
              localStorage.setItem('just_user', JSON.stringify(syncedUser));
              localStorage.setItem('bro_user', JSON.stringify(syncedUser));

              if (data.sticker_packs && Array.isArray(data.sticker_packs) && data.sticker_packs.length > 0) {
                try {
                  localStorage.setItem('just_sticker_packs', JSON.stringify(data.sticker_packs));
                  window.dispatchEvent(new Event('just_sticker_packs_updated'));
                } catch (e) {}
              }

              setIsAuthOpen(false);
              window.history.replaceState({}, document.title, window.location.pathname);
              AudioHelper.playSentSound();
              setSyncToast(`Профиль «${syncedUser.nickname}» и стикеры успешно синхронизированы с ПК! ✨`);
              setTimeout(() => setSyncToast(null), 5000);
            }
          });
      }
    }
  }, []);

  // Supabase Realtime broadcast & presence listener
  useEffect(() => {
    const unsubscribe = subscribeToJustChat({
      onPresenceSync: (onlineKeys) => {
        setOnlineUserIds(new Set(onlineKeys));
      },
      onForceRelogin: ({ epoch }) => {
        if (epoch && epoch !== localStorage.getItem('just_auth_epoch')) {
          localStorage.removeItem('just_user');
          localStorage.removeItem('bro_user');
          localStorage.removeItem('just_chats');
          localStorage.removeItem('just_messages');
          localStorage.removeItem('just_friends');
          localStorage.setItem('just_auth_epoch', epoch);
          setCurrentUser(GUEST_PENDING_USER);
          setChats([]);
          setMessages({});
          setFriends([]);
          setSelectedChatId(null);
          setIsAuthOpen(true);
        }
      },
      onNewMessage: async (msg) => {
        if (msg.senderId === currentUser.id) return;
        if (!isChatForMe(msg.chatId, currentUser.id)) return;
        AudioHelper.playReceiveSound();
        const decryptedText = msg.text ? await decryptText(msg.text, inviteCode) : msg.text;
        const readableMsg: Message = { ...msg, text: decryptedText, isOutgoing: false };

        setMessages((prev) => ({
          ...prev,
          [msg.chatId]: [...(prev[msg.chatId] || []), readableMsg]
        }));
        setChats((prev) => {
          const exists = prev.some((c) => c.id === msg.chatId);
          if (!exists) {
            const newChat: Chat = {
              id: msg.chatId,
              type: 'direct',
              name: msg.senderName,
              avatar: msg.senderAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
              statusEmoji: msg.senderEmoji,
              isPinned: false,
              unreadCount: 1,
              partnerId: msg.senderId,
              lastMessage: {
                text: decryptedText || (msg.type === 'video' ? '🎬 Видео' : msg.type === 'image' ? '📷 Фото' : msg.type === 'voice' ? '🎙 Голосовое' : 'Сообщение'),
                createdAt: msg.createdAt,
                type: msg.type,
                isOutgoing: false
              }
            };
            return [newChat, ...prev];
          }
          return prev.map((c) =>
            c.id === msg.chatId
              ? {
                  ...c,
                  unreadCount: c.id === selectedChatId ? 0 : c.unreadCount + 1,
                  lastMessage: {
                    text: decryptedText || (msg.type === 'video' ? '🎬 Видео' : msg.type === 'image' ? '📷 Фото' : msg.type === 'voice' ? '🎙 Голосовое' : 'Сообщение'),
                    createdAt: msg.createdAt,
                    type: msg.type,
                    isOutgoing: false
                  }
                }
              : c
          );
        });
      },
      onReactionToggle: ({ messageId, emoji, userId, chatId }) => {
        if (!isChatForMe(chatId, currentUser.id)) return;
        setMessages((prev) => {
          const chatMsgs = prev[chatId];
          if (!chatMsgs) return prev;
          return {
            ...prev,
            [chatId]: chatMsgs.map((m) => {
              if (m.id !== messageId) return m;
              const currentList = m.reactions?.[emoji] || [];
              const nextList = currentList.includes(userId)
                ? currentList.filter((id) => id !== userId)
                : [...currentList, userId];
              return {
                ...m,
                reactions: {
                  ...m.reactions,
                  [emoji]: nextList
                }
              };
            })
          };
        });
      },
      onTypingStatus: ({ chatId, userId, userName, isTyping }) => {
        if (userId === currentUser.id) return;
        if (!isChatForMe(chatId, currentUser.id)) return;
        setTypingStatus((prev) => ({
          ...prev,
          [chatId]: { userName, isTyping }
        }));
      },
      onDeleteMessage: ({ chatId, messageId }) => {
        if (!isChatForMe(chatId, currentUser.id)) return;
        let remainingLast: Message | undefined;
        setMessages((prev) => {
          const chatMsgs = prev[chatId] || [];
          const filtered = chatMsgs.filter((m) => m.id !== messageId);
          remainingLast = filtered.length > 0 ? filtered[filtered.length - 1] : undefined;
          return {
            ...prev,
            [chatId]: filtered
          };
        });
        setChats((prev) =>
          prev.map((c) =>
            c.id === chatId
              ? {
                  ...c,
                  lastMessage: remainingLast
                    ? {
                        text: remainingLast.text || (remainingLast.type === 'video' ? '🎬 Видео' : remainingLast.type === 'image' ? '📷 Фото' : remainingLast.type === 'voice' ? '🎙 Голосовое' : remainingLast.type === 'video_note' ? '📹 Кружочек' : remainingLast.type === 'sticker' ? 'Стикер 🎨' : 'Сообщение'),
                        createdAt: remainingLast.createdAt,
                        type: remainingLast.type,
                        isOutgoing: remainingLast.isOutgoing
                      }
                    : undefined
                }
              : c
          )
        );
      },
      onEditMessage: async ({ chatId, messageId, text }) => {
        if (!isChatForMe(chatId, currentUser.id)) return;
        const decryptedText = await decryptText(text, inviteCode);
        setMessages((prev) => {
          const chatMsgs = prev[chatId] || [];
          return {
            ...prev,
            [chatId]: chatMsgs.map((m) =>
              m.id === messageId ? { ...m, text: decryptedText, isEdited: true } : m
            )
          };
        });
      },
      onDeleteChat: ({ chatId }) => {
        if (!isChatForMe(chatId, currentUser.id)) return;
        setChats((prev) => prev.filter((c) => c.id !== chatId));
        setMessages((prev) => {
          const copy = { ...prev };
          delete copy[chatId];
          return copy;
        });
        if (selectedChatId === chatId) {
          setSelectedChatId(null);
        }
      },
      onStickersUpdated: (packs) => {
        if (Array.isArray(packs) && packs.length > 0) {
          try {
            localStorage.setItem('just_sticker_packs', JSON.stringify(packs));
            window.dispatchEvent(new Event('just_sticker_packs_updated'));
            AudioHelper.playPop(520, 0.03);
          } catch (e) {}
        }
      },
      onProfileUpdated: (user) => {
        if (!user || !user.id || isAuthOpen || currentUser.id === 'user-pending') return;
        if (user.id === currentUser.id) {
          setCurrentUser((prev) => {
            const next: User = {
              ...prev,
              nickname: user.nickname || prev.nickname,
              avatar: user.avatar || prev.avatar,
              statusEmoji: user.statusEmoji || user.status_emoji || prev.statusEmoji,
              statusText: user.statusText || user.status_text || prev.statusText,
              bio: user.bio !== undefined ? user.bio : prev.bio
            };
            localStorage.setItem('just_user', JSON.stringify(next));
            localStorage.setItem('bro_user', JSON.stringify(next));
            return next;
          });
          setSyncToast('✨ Профиль синхронизирован');
          setTimeout(() => setSyncToast(null), 3000);
        } else {
          // Update friend's avatar in chats and friends list
          setChats((prev) =>
            prev.map((c) =>
              c.id.includes(user.id) || c.name === user.nickname
                ? { ...c, avatar: user.avatar || c.avatar, name: user.nickname || c.name, statusEmoji: user.statusEmoji || user.status_emoji || c.statusEmoji }
                : c
            )
          );
          setFriends((prev) =>
            prev.map((f) =>
              f.id === user.id
                ? { ...f, avatar: user.avatar || f.avatar, nickname: user.nickname || f.nickname, statusEmoji: user.statusEmoji || user.status_emoji || f.statusEmoji }
                : f
            )
          );
        }
      },
      onNewStory: (story) => {
        if (!story || !story.id) return;
        setStories((prev) => {
          if (prev.some((s) => s.id === story.id)) return prev;
          return [story, ...prev];
        });
        AudioHelper.playPop(480, 0.05);
      },
      onDeleteStory: ({ storyId }) => {
        setStories((prev) => prev.filter((s) => s.id !== storyId));
      },
      onStoryLike: ({ storyId, likes }) => {
        setStories((prev) =>
          prev.map((s) => (s.id === storyId ? { ...s, likes } : s))
        );
      }
    }, currentUser.id);

    return () => unsubscribe();
  }, [currentUser.id, selectedChatId]);

  // Fetch messages from Supabase cloud when entering a chat
  useEffect(() => {
    if (!selectedChatId || selectedChatId.startsWith('chat-bot-') || !isChatForMe(selectedChatId, currentUser.id)) return;
    fetchMessagesFromCloud(selectedChatId, currentUser.id).then(async (cloudMsgs) => {
      if (!cloudMsgs || cloudMsgs.length === 0) return;
      const decrypted = await Promise.all(
        cloudMsgs.map(async (m) => {
          if (m.text) {
            try {
              const dec = await decryptText(m.text, inviteCode);
              return { ...m, text: dec };
            } catch (e) {
              return m;
            }
          }
          return m;
        })
      );

      const isLocked = (t?: string) => !t || t.includes('неверный код доступа') || t.startsWith('enc:v1:');

      setMessages((prev) => {
        const local = prev[selectedChatId] || [];
        const map = new Map<string, Message>();
        for (const m of local) map.set(m.id, m);
        for (const m of decrypted) {
          if (!map.has(m.id)) {
            map.set(m.id, m);
          } else {
            const existing = map.get(m.id)!;
            const textToUse = !isLocked(m.text)
              ? m.text
              : !isLocked(existing.text)
                ? existing.text
                : (m.text || existing.text);

            map.set(m.id, {
              ...existing,
              text: textToUse,
              mediaUrl: m.mediaUrl || existing.mediaUrl,
              reactions: m.reactions || existing.reactions,
              status: m.status || existing.status
            });
          }
        }
        const updatedList = Array.from(map.values());

        const lastMsg = updatedList[updatedList.length - 1];
        if (lastMsg) {
          setChats((chatsPrev) =>
            chatsPrev.map((c) =>
              c.id === selectedChatId
                ? {
                    ...c,
                    lastMessage: {
                      text: lastMsg.text || (lastMsg.type === 'video' ? '🎬 Видео' : lastMsg.type === 'image' ? '📷 Фото' : lastMsg.type === 'voice' ? '🎙 Голосовое' : lastMsg.type === 'video_note' ? '📹 Кружочек' : lastMsg.type === 'sticker' ? 'Стикер 🎨' : 'Сообщение'),
                      createdAt: lastMsg.createdAt,
                      type: lastMsg.type,
                      isOutgoing: lastMsg.isOutgoing
                    }
                  }
                : c
            )
          );
        }

        return {
          ...prev,
          [selectedChatId]: updatedList
        };
      });
    });
  }, [selectedChatId, currentUser.id, inviteCode]);

  // Modals
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  // Music players state
  const [currentTrack, setCurrentTrack] = useState<TrackInfo | null>(null);
  const [trackUrl, setTrackUrl] = useState<string | null>(null);
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);

  // Video note viewer state (КРУЖОЧКИ НА ВЕСЬ ЭКРАН)
  const [activeVideoNote, setActiveVideoNote] = useState<{
    url: string;
    senderName: string;
    senderEmoji?: string;
    senderAvatar?: string;
    createdAt: string;
    messageId?: string;
    canDelete?: boolean;
  } | null>(null);

  // Mark chat messages as read whenever a chat is opened or selected
  const markChatAsRead = (chatId: string) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c))
    );
    setMessages((prev) => {
      const chatMsgs = prev[chatId];
      if (!chatMsgs) return prev;
      return {
        ...prev,
        [chatId]: chatMsgs.map((m) => ({ ...m, status: 'read' as const }))
      };
    });
  };

  // Run on mount for the initial selected chat
  useEffect(() => {
    if (selectedChatId) {
      markChatAsRead(selectedChatId);
    }
  }, [selectedChatId]);

  const handleSelectChat = (chat: Chat) => {
    setSelectedChatId(chat.id);
    markChatAsRead(chat.id);
  };

  // Pin / Unpin toggle handler
  const handleTogglePin = (chatId: string) => {
    AudioHelper.playPop(480, 0.05);
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, isPinned: !c.isPinned } : c))
    );
  };

  // Helper to broadcast message live and persist to Supabase cloud
  const persistAndBroadcastMessage = async (msg: Message, unencryptedText?: string) => {
    const activeChat = chats.find((c) => c.id === msg.chatId);
    let payload = msg;
    if (unencryptedText) {
      const encrypted = await encryptText(unencryptedText, inviteCode);
      payload = { ...msg, text: encrypted };
    }
    // Personal saved messages are private cloud storage and should NEVER be broadcast to others!
    if (!msg.chatId.startsWith('chat-saved')) {
      broadcastNewMessage(payload);
    }
    saveMessageToCloud(payload, {
      name: activeChat?.name,
      type: activeChat?.type,
      avatar: activeChat?.avatar,
      statusEmoji: activeChat?.statusEmoji
    });
  };

  // Send regular text message (with E2EE encryption before broadcasting)
  const handleSendMessage = async (text: string) => {
    if (!selectedChatId) return;

    AudioHelper.playSentSound();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      chatId: selectedChatId,
      senderId: currentUser.id,
      senderName: currentUser.nickname,
      senderEmoji: currentUser.statusEmoji,
      senderAvatar: currentUser.avatar,
      type: 'text',
      text,
      createdAt: timeStr,
      isOutgoing: true,
      status: 'sent'
    };

    setMessages((prev) => ({
      ...prev,
      [selectedChatId]: [...(prev[selectedChatId] || []), newMsg]
    }));

    setChats((prev) =>
      prev.map((c) =>
        c.id === selectedChatId
          ? {
              ...c,
              lastMessage: {
                text,
                createdAt: timeStr,
                type: 'text',
                isOutgoing: true
              }
            }
          : c
      )
    );

    // If chatting with official Stickers Bot
    if (selectedChatId === 'chat-bot-stickerbot') {
      setTypingStatus((prev) => ({
        ...prev,
        'chat-bot-stickerbot': { userName: 'Stickers Bot', isTyping: true }
      }));

      setTimeout(() => {
        setTypingStatus((prev) => ({
          ...prev,
          'chat-bot-stickerbot': { userName: 'Stickers Bot', isTyping: false }
        }));
        const botReply = processStickerBotInput({ text }, currentUser);
        AudioHelper.playReceiveSound();
        setMessages((prev) => ({
          ...prev,
          'chat-bot-stickerbot': [...(prev['chat-bot-stickerbot'] || []), botReply]
        }));
        setChats((prev) =>
          prev.map((c) =>
            c.id === 'chat-bot-stickerbot'
              ? {
                  ...c,
                  lastMessage: {
                    text: botReply.text || 'Стикер 🎨',
                    createdAt: botReply.createdAt,
                    type: botReply.type,
                    isOutgoing: false
                  }
                }
              : c
          )
        );
      }, 350);
      return;
    }

    await persistAndBroadcastMessage(newMsg, text);
  };

  // Send Video Note (КРУЖОЧЕК) - INSTANT zero-delay optimistic sending
  const handleSendVideoNote = (blob: Blob, localUrl: string, duration: number) => {
    if (!selectedChatId) return;

    AudioHelper.playSentSound();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgId = `msg-vid-${Date.now()}`;

    const newMsg: Message = {
      id: msgId,
      chatId: selectedChatId,
      senderId: currentUser.id,
      senderName: currentUser.nickname,
      senderEmoji: currentUser.statusEmoji,
      senderAvatar: currentUser.avatar,
      type: 'video_note',
      mediaUrl: localUrl,
      createdAt: timeStr,
      isOutgoing: true,
      status: 'sent'
    };

    // 1. Immediately show in chat! 0ms lag!
    setMessages((prev) => ({
      ...prev,
      [selectedChatId]: [...(prev[selectedChatId] || []), newMsg]
    }));

    setChats((prev) =>
      prev.map((c) =>
        c.id === selectedChatId
          ? {
              ...c,
              lastMessage: {
                text: '📹 Видеосообщение (кружочек)',
                createdAt: timeStr,
                type: 'video_note',
                isOutgoing: true
              }
            }
          : c
      )
    );

    // 2. Upload to Supabase Storage in background & broadcast when ready
    (async () => {
      try {
        const mime = blob.type || 'video/webm';
        const ext = mime.includes('mp4') ? 'mp4' : 'webm';
        let cloudUrl: string | null = null;
        if (blob && blob.size > 0) {
          cloudUrl = await uploadMediaToSupabase(blob, `circle_${Date.now()}.${ext}`, mime);
          if (!cloudUrl) {
            cloudUrl = await blobToDataUrl(blob);
          }
        }
        const persistentMsg = { ...newMsg, mediaUrl: cloudUrl || localUrl };
        persistAndBroadcastMessage(persistentMsg);

        if (cloudUrl && cloudUrl !== localUrl) {
          setMessages((prev) => ({
            ...prev,
            [selectedChatId]: (prev[selectedChatId] || []).map((m) =>
              m.id === msgId ? { ...m, mediaUrl: cloudUrl! } : m
            )
          }));
        }
      } catch (err) {
        console.warn('Background upload video note error:', err);
      }
    })();
  };

  // Send Voice Note (ГОЛОСОВОЕ) - INSTANT zero-delay optimistic sending
  const handleSendVoiceNote = (blob: Blob, localUrl: string, duration: number, waveform: number[]) => {
    if (!selectedChatId) return;

    AudioHelper.playSentSound();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgId = `msg-voice-${Date.now()}`;

    const newMsg: Message = {
      id: msgId,
      chatId: selectedChatId,
      senderId: currentUser.id,
      senderName: currentUser.nickname,
      senderEmoji: currentUser.statusEmoji,
      senderAvatar: currentUser.avatar,
      type: 'voice',
      mediaUrl: localUrl,
      audioDuration: duration,
      audioWaveform: waveform,
      createdAt: timeStr,
      isOutgoing: true,
      status: 'sent'
    };

    // 1. Immediately show in chat! 0ms lag!
    setMessages((prev) => ({
      ...prev,
      [selectedChatId]: [...(prev[selectedChatId] || []), newMsg]
    }));

    setChats((prev) =>
      prev.map((c) =>
        c.id === selectedChatId
          ? {
              ...c,
              lastMessage: {
                text: `🎙 Голосовое сообщение (0:${duration < 10 ? `0${duration}` : duration})`,
                createdAt: timeStr,
                type: 'voice',
                isOutgoing: true
              }
            }
          : c
      )
    );

    // 2. Upload to Supabase Storage in background & broadcast when ready
    (async () => {
      try {
        const mime = blob.type || 'audio/webm';
        const ext = mime.includes('mp4') ? 'mp4' : mime.includes('aac') ? 'aac' : 'webm';
        let cloudUrl = await uploadMediaToSupabase(blob, `voice_${Date.now()}.${ext}`, mime);
        if (!cloudUrl) {
          cloudUrl = await blobToDataUrl(blob);
        }
        const persistentMsg = { ...newMsg, mediaUrl: cloudUrl || localUrl };
        persistAndBroadcastMessage(persistentMsg);

        setMessages((prev) => ({
          ...prev,
          [selectedChatId]: (prev[selectedChatId] || []).map((m) =>
            m.id === msgId ? { ...m, mediaUrl: persistentMsg.mediaUrl } : m
          )
        }));
      } catch (err) {
        console.warn('Background upload voice note error:', err);
      }
    })();
  };

  // Send Cat Sticker (СТИКЕР С КОТИКОМ)
  const handleSendCatSticker = (sticker: CatSticker) => {
    if (!selectedChatId) return;

    AudioHelper.playSentSound();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg: Message = {
      id: `msg-stk-${Date.now()}`,
      chatId: selectedChatId,
      senderId: currentUser.id,
      senderName: currentUser.nickname,
      senderEmoji: currentUser.statusEmoji,
      senderAvatar: currentUser.avatar,
      type: 'sticker',
      stickerUrl: sticker.url,
      createdAt: timeStr,
      isOutgoing: true,
      status: 'sent'
    };

    setMessages((prev) => ({
      ...prev,
      [selectedChatId]: [...(prev[selectedChatId] || []), newMsg]
    }));

    setChats((prev) =>
      prev.map((c) =>
        c.id === selectedChatId
          ? {
              ...c,
              lastMessage: {
                text: `🐱 Стикер: ${sticker.title}`,
                createdAt: timeStr,
                type: 'sticker',
                isOutgoing: true
              }
            }
          : c
      )
    );

    persistAndBroadcastMessage(newMsg);
  };

  // Send Track (МУЗЫКА С ПЛЕЕРОМ)
  const handleSendTrack = (title: string, artist: string, url: string) => {
    if (!selectedChatId) return;

    AudioHelper.playSentSound();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg: Message = {
      id: `msg-trk-${Date.now()}`,
      chatId: selectedChatId,
      senderId: currentUser.id,
      senderName: currentUser.nickname,
      senderEmoji: currentUser.statusEmoji,
      senderAvatar: currentUser.avatar,
      type: 'audio',
      trackInfo: {
        title,
        artist,
        duration: '3:20'
      },
      mediaUrl: url,
      createdAt: timeStr,
      isOutgoing: true,
      status: 'sent'
    };

    setMessages((prev) => ({
      ...prev,
      [selectedChatId]: [...(prev[selectedChatId] || []), newMsg]
    }));

    setChats((prev) =>
      prev.map((c) =>
        c.id === selectedChatId
          ? {
              ...c,
              lastMessage: {
                text: `🎵 ${title} - ${artist}.mp3`,
                createdAt: timeStr,
                type: 'audio',
                isOutgoing: true
              }
            }
          : c
      )
    );

    persistAndBroadcastMessage(newMsg);
  };

  // Send photo / image in chat
  const handleSendImage = (mediaUrl: string) => {
    if (!selectedChatId) return;

    AudioHelper.playSentSound();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg: Message = {
      id: `msg-img-${Date.now()}`,
      chatId: selectedChatId,
      senderId: currentUser.id,
      senderName: currentUser.nickname,
      senderEmoji: currentUser.statusEmoji,
      senderAvatar: currentUser.avatar,
      type: 'image',
      mediaUrl,
      createdAt: timeStr,
      isOutgoing: true,
      status: 'sent'
    };

    setMessages((prev) => ({
      ...prev,
      [selectedChatId]: [...(prev[selectedChatId] || []), newMsg]
    }));

    setChats((prev) =>
      prev.map((c) =>
        c.id === selectedChatId
          ? {
              ...c,
              lastMessage: {
                text: '📷 Фотография',
                createdAt: timeStr,
                type: 'image',
                isOutgoing: true
              }
            }
          : c
      )
    );

    // If sending photo to official Stickers Bot
    if (selectedChatId === 'chat-bot-stickerbot') {
      setTypingStatus((prev) => ({
        ...prev,
        'chat-bot-stickerbot': { userName: 'Stickers Bot', isTyping: true }
      }));

      setTimeout(() => {
        setTypingStatus((prev) => ({
          ...prev,
          'chat-bot-stickerbot': { userName: 'Stickers Bot', isTyping: false }
        }));
        const botReply = processStickerBotInput({ mediaUrl }, currentUser);
        AudioHelper.playReceiveSound();
        setMessages((prev) => ({
          ...prev,
          'chat-bot-stickerbot': [...(prev['chat-bot-stickerbot'] || []), botReply]
        }));
        setChats((prev) =>
          prev.map((c) =>
            c.id === 'chat-bot-stickerbot'
              ? {
                  ...c,
                  lastMessage: {
                    text: botReply.text || 'Стикер 🎨',
                    createdAt: botReply.createdAt,
                    type: botReply.type,
                    isOutgoing: false
                  }
                }
              : c
          )
        );
      }, 400);
      return;
    }

    persistAndBroadcastMessage(newMsg);
  };

  // Send video file attachment in chat
  const handleSendVideo = (mediaUrl: string) => {
    if (!selectedChatId) return;

    AudioHelper.playSentSound();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg: Message = {
      id: `msg-vid-file-${Date.now()}`,
      chatId: selectedChatId,
      senderId: currentUser.id,
      senderName: currentUser.nickname,
      senderEmoji: currentUser.statusEmoji,
      senderAvatar: currentUser.avatar,
      type: 'video',
      mediaUrl,
      createdAt: timeStr,
      isOutgoing: true,
      status: 'sent'
    };

    setMessages((prev) => ({
      ...prev,
      [selectedChatId]: [...(prev[selectedChatId] || []), newMsg]
    }));

    setChats((prev) =>
      prev.map((c) =>
        c.id === selectedChatId
          ? {
              ...c,
              lastMessage: {
                text: '🎬 Видеозапись',
                createdAt: timeStr,
                type: 'video',
                isOutgoing: true
              }
            }
          : c
      )
    );

    persistAndBroadcastMessage(newMsg);
  };

  // Handle emoji reactions (❤️, 🔥, 😂, 👍, 👎, 😮)
  const handleToggleReaction = (messageId: string, emoji: string) => {
    if (!selectedChatId) return;

    let updatedReactions: Record<string, string[]> = {};

    setMessages((prev) => {
      const chatMsgs = prev[selectedChatId];
      if (!chatMsgs) return prev;
      return {
        ...prev,
        [selectedChatId]: chatMsgs.map((m) => {
          if (m.id !== messageId) return m;
          const currentList = Array.isArray(m.reactions?.[emoji]) ? m.reactions[emoji] : [];
          const nextList = currentList.includes(currentUser.id)
            ? currentList.filter((id) => id !== currentUser.id)
            : [...currentList, currentUser.id];
          updatedReactions = {
            ...(m.reactions || {}),
            [emoji]: nextList
          };
          return {
            ...m,
            reactions: updatedReactions
          };
        })
      };
    });

    // If reacting inside @stickerbot chat while awaiting sticker emoji, advance sticker creation!
    if (selectedChatId === 'chat-bot-stickerbot') {
      const session = getBotSession();
      if (session.step === 'AWAITING_STICKER_EMOJI') {
        handleSendMessage(emoji);
        return;
      }
    }

    broadcastReaction(messageId, emoji, currentUser.id, selectedChatId);
    updateReactionsInCloud(messageId, updatedReactions);
  };

  // Handle typing indicator emission
  const handleTyping = () => {
    if (!selectedChatId) return;
    broadcastTyping(selectedChatId, currentUser.id, currentUser.nickname, true);

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    typingTimerRef.current = setTimeout(() => {
      if (selectedChatId) {
        broadcastTyping(selectedChatId, currentUser.id, currentUser.nickname, false);
      }
    }, 2500);
  };

  // Play track in Full Music Player
  const handlePlayGlobalTrack = (track: TrackInfo, url: string) => {
    setCurrentTrack(track);
    setTrackUrl(url);
    setIsFullPlayerOpen(true);
  };

  // Open story and track view
  const handleOpenStory = (story: Story) => {
    setStories((prev) =>
      prev.map((s) => {
        if (s.id !== story.id) return s;
        const viewers = s.viewers || [];
        if (viewers.some((v) => v.id === currentUser.id)) return s;
        const newViewer: StoryViewer = {
          id: currentUser.id,
          name: currentUser.nickname,
          avatar: currentUser.avatar,
          statusEmoji: currentUser.statusEmoji,
          viewedAt: 'Только что'
        };
        return {
          ...s,
          viewsCount: (s.viewsCount || 0) + 1,
          viewers: [...viewers, newViewer]
        };
      })
    );
    setActiveStoryId(story.id);
  };

  // Add a new user story (with canvas image compression & 24h expiration)
  const handleAddStory = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const mediaDataUrl = await compressStoryMedia(file);
          const isVideo = file.type.startsWith('video');
          const now = Date.now();
          const newStory: Story = {
            id: `story-${now}`,
            userId: currentUser.id,
            author: currentUser,
            mediaUrl: mediaDataUrl,
            mediaType: isVideo ? 'video' : 'image',
            createdAtTimestamp: now,
            createdAt: 'только что',
            caption: 'Моя новая история 🔥',
            viewsCount: 1,
            viewers: [
              {
                id: currentUser.id,
                name: currentUser.nickname,
                avatar: currentUser.avatar,
                statusEmoji: currentUser.statusEmoji,
                viewedAt: 'только что'
              }
            ],
            likes: []
          };
          setStories((prev) => [newStory, ...filterActiveStories(prev)]);
          setActiveStoryId(newStory.id);
          saveStoryToCloud(newStory);
          broadcastNewStory(newStory);
        } catch (err) {
          console.error('Failed to process story:', err);
          alert('Ошибка при обработке файла для истории.');
        }
      }
    };
    input.click();
  };

  // Delete own story
  const handleDeleteStory = (storyId: string) => {
    AudioHelper.playPop(300, 0.08);
    setStories((prev) => prev.filter((s) => s.id !== storyId));
    setActiveStoryId(null);
    deleteStoryFromCloud(storyId);
    broadcastDeleteStory(storyId);
  };

  // Like / Unlike story
  const handleToggleStoryLike = (storyId: string) => {
    let nextLikes: StoryLike[] = [];
    setStories((prev) =>
      prev.map((s) => {
        if (s.id !== storyId) return s;
        const likes = s.likes || [];
        const exists = likes.some((l) => l.id === currentUser.id);
        nextLikes = exists
          ? likes.filter((l) => l.id !== currentUser.id)
          : [
              ...likes,
              {
                id: currentUser.id,
                name: currentUser.nickname,
                avatar: currentUser.avatar,
                statusEmoji: currentUser.statusEmoji,
                likedAt: 'Только что'
              }
            ];
        return { ...s, likes: nextLikes };
      })
    );
    updateStoryLikesInCloud(storyId, nextLikes);
    broadcastStoryLike(storyId, nextLikes);
  };

  // Story next / prev navigation
  const handleNextStory = () => {
    const currentIndex = stories.findIndex((s) => s.id === activeStoryId);
    if (currentIndex >= 0 && currentIndex < stories.length - 1) {
      handleOpenStory(stories[currentIndex + 1]);
    } else {
      setActiveStoryId(null);
    }
  };

  const handlePrevStory = () => {
    const currentIndex = stories.findIndex((s) => s.id === activeStoryId);
    if (currentIndex > 0) {
      handleOpenStory(stories[currentIndex - 1]);
    }
  };

  // Save profile updates
  const handleSaveProfile = (updated: Partial<User>) => {
    const nextUser = { ...currentUser, ...updated };
    setCurrentUser(nextUser);
    localStorage.setItem('just_user', JSON.stringify(nextUser));
    localStorage.setItem('bro_user', JSON.stringify(nextUser));
    broadcastProfileUpdated(nextUser);
  };

  // Logout / Switch account to test login screen
  const handleLogout = () => {
    localStorage.removeItem('just_user');
    localStorage.removeItem('bro_user');
    setCurrentUser(GUEST_PENDING_USER);
    setChats([]);
    setMessages({});
    setFriends([]);
    setSelectedChatId(null);
    setIsAuthOpen(true);
  };

  const handleUpdateInviteCode = (newCode: string) => {
    setInviteCode(newCode);
    localStorage.setItem('just_invite_code', newCode);
  };

  // Upload own avatar photo from device (compressed to 500x500 for lightning speed)
  const handlePhotoUpload = async (file: File) => {
    try {
      const compressedDataUrl = await compressAvatar(file);
      const nextUser = { ...currentUser, avatar: compressedDataUrl };
      setCurrentUser(nextUser);
      localStorage.setItem('just_user', JSON.stringify(nextUser));
      localStorage.setItem('bro_user', JSON.stringify(nextUser));
      broadcastProfileUpdated(nextUser);
    } catch (e) {
      console.warn('Avatar compression error:', e);
    }
  };

  // Start or open direct chat with a user found by @username
  const handleStartDirectChat = (friend: User) => {
    // Special handling for official Stickers Bot
    if (friend.id === 'user-stickerbot' || friend.username === 'stickerbot') {
      const existing = chats.find(c => c.id === 'chat-bot-stickerbot');
      if (existing) {
        setSelectedChatId(existing.id);
        markChatAsRead(existing.id);
      } else {
        setChats(prev => [STICKER_BOT_CHAT, ...prev]);
        setSelectedChatId(STICKER_BOT_CHAT.id);
      }

      setMessages(prev => {
        if (!prev['chat-bot-stickerbot'] || prev['chat-bot-stickerbot'].length === 0) {
          const welcomeMsg: Message = {
            id: 'msg-bot-welcome',
            chatId: 'chat-bot-stickerbot',
            senderId: STICKER_BOT_USER.id,
            senderName: STICKER_BOT_USER.nickname,
            senderEmoji: STICKER_BOT_USER.statusEmoji,
            senderAvatar: STICKER_BOT_USER.avatar,
            type: 'text',
            text: `Привет, ${currentUser.nickname}! Я Stickers Bot 🤖🎨\n\nЯ помогу вам превратить любые картинки и мемы в стикеры для JustChat.\n\nНажмите кнопку ниже или отправьте мне любое фото!`,
            createdAt: 'Только что',
            isOutgoing: false,
            status: 'read',
            botButtons: [
              { label: '➕ Создать новый набор (/newpack)', action: '/newpack' },
              { label: '📦 Мои стикеры (/mypacks)', action: '/mypacks' }
            ]
          };
          return { ...prev, 'chat-bot-stickerbot': [welcomeMsg] };
        }
        return prev;
      });
      return;
    }

    // Add to friends list if not present
    setFriends((prev) => {
      if (prev.some((f) => f.id === friend.id || f.username === friend.username)) return prev;
      return [...prev, friend];
    });

    // Use deterministic direct chat ID so both users always meet in the exact same room
    const directChatId = makeDirectChatId(currentUser.id, friend.id);
    const legacyDirectChatId = `chat-${[currentUser.id, friend.id].sort().join('-')}`;
    const existing = chats.find(c => 
      c.id === directChatId || 
      c.id === legacyDirectChatId || 
      c.partnerId === friend.id || 
      (c.name === friend.nickname && c.type === 'direct')
    );
    if (existing) {
      setSelectedChatId(existing.id);
      markChatAsRead(existing.id);
      return;
    }

    const isOnline = isUserOnline(
      friend.id,
      onlineUserIds,
      friend.updatedAt,
      friend.isOnline
    );
    const lastSeen = isOnline ? 'в сети' : (friend.lastSeen || formatLastSeen(friend.updatedAt));

    const newChat: Chat = {
      id: directChatId,
      type: 'direct',
      name: friend.nickname,
      avatar: friend.avatar,
      statusEmoji: friend.statusEmoji,
      isPinned: false,
      unreadCount: 0,
      partnerId: friend.id,
      isOnline,
      lastSeen,
      lastMessage: {
        text: 'Чат открыт',
        createdAt: 'Только что',
        type: 'text',
        isOutgoing: true
      }
    };

    setChats(prev => [newChat, ...prev]);
    setSelectedChatId(newChat.id);
  };

  // Create a new group chat
  const handleCreateGroupChat = (name: string, members: User[], avatar?: string) => {
    const newGroup: Chat = {
      id: `chat-group-${Date.now()}`,
      type: 'group',
      name,
      avatar: avatar || 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=150&auto=format&fit=crop&q=80',
      statusEmoji: '👥',
      isPinned: false,
      unreadCount: 0,
      lastMessage: {
        text: 'Группа создана',
        createdAt: 'Только что',
        type: 'text',
        isOutgoing: true
      },
      members
    };

    setChats(prev => [newGroup, ...prev]);
    setSelectedChatId(newGroup.id);
  };

  // Clear chat history
  const handleClearHistory = (chatId: string) => {
    setMessages(prev => ({
      ...prev,
      [chatId]: []
    }));
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, lastMessage: undefined } : c));
  };

  // Pull-to-refresh handler (syncs cloud profiles, stickers, stories & active chat)
  const handlePullRefresh = async () => {
    const client = getSupabaseClient();
    if (!client) return;

    try {
      const { data } = await client
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
      if (data) {
        if (data.nickname || data.avatar) {
          const updatedUser: User = {
            ...currentUser,
            nickname: data.nickname || currentUser.nickname,
            avatar: data.avatar || currentUser.avatar,
            statusEmoji: data.status_emoji || currentUser.statusEmoji,
            statusText: data.status_text || currentUser.statusText,
            bio: data.bio !== undefined ? data.bio : currentUser.bio
          };
          setCurrentUser(updatedUser);
          localStorage.setItem('just_user', JSON.stringify(updatedUser));
          localStorage.setItem('bro_user', JSON.stringify(updatedUser));
        }
        if (data.sticker_packs && Array.isArray(data.sticker_packs) && data.sticker_packs.length > 0) {
          localStorage.setItem('just_sticker_packs', JSON.stringify(data.sticker_packs));
          window.dispatchEvent(new Event('just_sticker_packs_updated'));
        }
      }

      // Sync registered cloud profiles for presence & last seen
      const allProfiles = await fetchCloudProfiles();
      if (allProfiles && allProfiles.length > 0) {
        setCloudProfiles(allProfiles);
      }

      // Sync stories from cloud
      const cloudStories = await fetchStoriesFromCloud();
      if (cloudStories && cloudStories.length > 0) {
        setStories((prev) => {
          const map = new Map<string, Story>();
          for (const s of cloudStories) map.set(s.id, s);
          for (const s of prev) {
            if (!map.has(s.id)) map.set(s.id, s);
          }
          return filterActiveStories(Array.from(map.values()));
        });
      }

      // If in an active chat, sync cloud messages (only if participant)
      if (selectedChatId && !selectedChatId.startsWith('chat-bot-') && isChatForMe(selectedChatId, currentUser.id)) {
        const cloudMsgs = await fetchMessagesFromCloud(selectedChatId, currentUser.id);
        if (cloudMsgs && cloudMsgs.length > 0) {
          const decrypted = await Promise.all(
            cloudMsgs.map(async (m) => {
              if (m.text) {
                try {
                  const dec = await decryptText(m.text, inviteCode);
                  return { ...m, text: dec };
                } catch (e) {
                  return m;
                }
              }
              return m;
            })
          );
          const isLocked = (t?: string) => !t || t.includes('неверный код доступа') || t.startsWith('enc:v1:');
          setMessages((prev) => {
            const local = prev[selectedChatId] || [];
            const map = new Map<string, Message>();
            for (const m of local) map.set(m.id, m);
            for (const m of decrypted) {
              if (!map.has(m.id)) {
                map.set(m.id, m);
              } else {
                const existing = map.get(m.id)!;
                const textToUse = !isLocked(m.text)
                  ? m.text
                  : !isLocked(existing.text)
                    ? existing.text
                    : (m.text || existing.text);
                map.set(m.id, {
                  ...existing,
                  text: textToUse,
                  mediaUrl: m.mediaUrl || existing.mediaUrl,
                  reactions: m.reactions || existing.reactions,
                  status: m.status || existing.status
                });
              }
            }
            const updatedList = Array.from(map.values());
            const lastMsg = updatedList[updatedList.length - 1];
            if (lastMsg) {
              setChats((chatsPrev) =>
                chatsPrev.map((c) =>
                  c.id === selectedChatId
                    ? {
                        ...c,
                        lastMessage: {
                          text: lastMsg.text || (lastMsg.type === 'video' ? '🎬 Видео' : lastMsg.type === 'image' ? '📷 Фото' : lastMsg.type === 'voice' ? '🎙 Голосовое' : lastMsg.type === 'video_note' ? '📹 Кружочек' : lastMsg.type === 'sticker' ? 'Стикер 🎨' : 'Сообщение'),
                          createdAt: lastMsg.createdAt,
                          type: lastMsg.type,
                          isOutgoing: lastMsg.isOutgoing
                        }
                      }
                    : c
                )
              );
            }
            return {
              ...prev,
              [selectedChatId]: updatedList
            };
          });
        }
      }
    } catch (e) {}

    AudioHelper.playPop(580, 0.04);
  };

  // Delete entire chat and its messages
  const handleDeleteChat = (chatId: string) => {
    if (chatId === 'chat-saved') {
      alert('Чат «Избранное» нельзя удалить — это ваше личное хранилище заметок и файлов.');
      return;
    }
    AudioHelper.playPop(300, 0.08);
    setChats(prev => prev.filter(c => c.id !== chatId));
    setMessages(prev => {
      const copy = { ...prev };
      delete copy[chatId];
      return copy;
    });
    if (selectedChatId === chatId) {
      setSelectedChatId(null);
    }
    broadcastDeleteChat(chatId);
  };

  // Delete contact from friends list & remove its direct chat
  const handleDeleteFriend = (friendId: string) => {
    AudioHelper.playPop(300, 0.08);
    setFriends((prev) => prev.filter((f) => f.id !== friendId));
    setChats((prev) => prev.filter((c) => c.id !== `chat-${friendId}`));
    setMessages((prev) => {
      const copy = { ...prev };
      delete copy[`chat-${friendId}`];
      return copy;
    });
    if (selectedChatId === `chat-${friendId}`) {
      setSelectedChatId('chat-saved');
    }
  };

  // Delete single message in active chat
  const handleDeleteMessage = (messageId: string) => {
    if (!selectedChatId) return;
    AudioHelper.playPop(340, 0.06);

    let updatedLast: Message | undefined;

    setMessages((prev) => {
      const chatMsgs = prev[selectedChatId] || [];
      const filtered = chatMsgs.filter((m) => m.id !== messageId);
      updatedLast = filtered.length > 0 ? filtered[filtered.length - 1] : undefined;
      return {
        ...prev,
        [selectedChatId]: filtered
      };
    });

    setChats((cList) =>
      cList.map((c) =>
        c.id === selectedChatId
          ? {
              ...c,
              lastMessage: updatedLast
                ? {
                    text: updatedLast.text || (updatedLast.type === 'video' ? '🎬 Видео' : updatedLast.type === 'image' ? '📷 Фото' : updatedLast.type === 'voice' ? '🎙 Голосовое' : updatedLast.type === 'video_note' ? '📹 Кружочек' : updatedLast.type === 'sticker' ? 'Стикер 🎨' : 'Сообщение'),
                    createdAt: updatedLast.createdAt,
                    type: updatedLast.type,
                    isOutgoing: updatedLast.isOutgoing
                  }
                : undefined
            }
          : c
      )
    );

    if (editingMessage?.id === messageId) {
      setEditingMessage(null);
    }

    broadcastDeleteMessage(selectedChatId, messageId);
    deleteMessageInCloud(messageId);
  };

  // Start editing a text message
  const handleEditMessage = (msg: Message) => {
    setEditingMessage(msg);
  };

  // Save edited text message
  const handleSaveEdit = async (messageId: string, newText: string) => {
    if (!selectedChatId) return;
    AudioHelper.playSentSound();

    setMessages((prev) => {
      const chatMsgs = prev[selectedChatId] || [];
      const updated = chatMsgs.map((m) =>
        m.id === messageId ? { ...m, text: newText, isEdited: true } : m
      );

      const last = updated.length > 0 ? updated[updated.length - 1] : undefined;
      if (last && last.id === messageId) {
        setChats((cList) =>
          cList.map((c) =>
            c.id === selectedChatId
              ? {
                  ...c,
                  lastMessage: {
                    text: newText,
                    createdAt: last.createdAt,
                    type: 'text',
                    isOutgoing: last.isOutgoing
                  }
                }
              : c
          )
        );
      }

      return {
        ...prev,
        [selectedChatId]: updated
      };
    });

    setEditingMessage(null);
    const encryptedText = await encryptText(newText, inviteCode);
    broadcastEditMessage(selectedChatId, messageId, encryptedText);
    editMessageInCloud(messageId, encryptedText);
  };

  const selectedChat = chats.find((c) => c.id === selectedChatId) || null;

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#0e1621] text-gray-100 relative">
      {/* Floating Device Sync Notification Banner */}
      {syncToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-emerald-600 text-white font-medium text-xs sm:text-sm px-4 py-2.5 rounded-2xl shadow-2xl flex items-center space-x-2 border border-emerald-400 animate-bounce">
          <span>✨</span>
          <span>{syncToast}</span>
          <button onClick={() => setSyncToast(null)} className="ml-2 text-white/80 hover:text-white font-bold">✕</button>
        </div>
      )}

      {/* Auth Modal with Invite Code */}
      {isAuthOpen && (
        <AuthModal
          validCode={inviteCode}
          onSuccess={(user) => {
            setCurrentUser(user);
            setIsAuthOpen(false);

            // Re-initialize chats for this user from their scoped storage or defaults
            const userChatsKey = `just_chats_${user.id}`;
            const userMsgsKey = `just_messages_${user.id}`;
            const userFriendsKey = `just_friends_${user.id}`;

            const userSavedId = `chat-saved-${user.id}`;
            const userSavedChat: Chat = {
              ...SAVED_MESSAGES_CHAT,
              id: userSavedId,
              unreadCount: 0,
              lastMessage: {
                text: 'Личное хранилище заметок, кружочков и файлов 🔖',
                createdAt: 'Всегда',
                type: 'text',
                isOutgoing: true
              }
            };

            const savedChatsRaw = localStorage.getItem(userChatsKey);
            let userChats: Chat[] = [];
            if (savedChatsRaw) {
              try {
                userChats = JSON.parse(savedChatsRaw);
                userChats = userChats.filter(c => isChatForMe(c.id, user.id));
              } catch (e) {
                userChats = [];
              }
            }

            userChats = userChats.filter(c => !c.id.startsWith('chat-saved') && !c.isSavedMessages);
            userChats = [userSavedChat, ...userChats];

            if (!userChats.some(c => c.id === 'chat-bot-stickerbot' || c.isBot)) {
              userChats.push(STICKER_BOT_CHAT);
            }

            if (user.id !== 'user-me') {
              const dmWithCreator = makeDirectChatId('user-me', user.id);
              const legacyDm = `chat-${['user-me', user.id].sort().join('-')}`;
              if (!userChats.some(c => c.id === dmWithCreator || c.id === legacyDm || c.partnerId === 'user-me' || c.name === 'Бублик')) {
                const creatorChat: Chat = {
                  id: dmWithCreator,
                  type: 'direct',
                  name: 'Бублик',
                  avatar: '/avatar-bublik.jpg',
                  statusEmoji: '🎧',
                  isPinned: true,
                  unreadCount: 0,
                  partnerId: 'user-me',
                  isOnline: false,
                  lastSeen: 'был(а) недавно',
                  lastMessage: {
                    text: 'Привет! Добро пожаловать в JustChat 🤙',
                    createdAt: 'Только что',
                    type: 'text',
                    isOutgoing: false
                  }
                };
                userChats.push(creatorChat);
              }
            }

            setChats(userChats);
            setSelectedChatId(userSavedId);

            // Re-initialize messages for this user from scoped storage
            const savedMsgsRaw = localStorage.getItem(userMsgsKey);
            let userMsgs: Record<string, Message[]> = {};
            if (savedMsgsRaw) {
              try {
                const parsed = JSON.parse(savedMsgsRaw);
                for (const [cId, msgs] of Object.entries(parsed)) {
                  if (isChatForMe(cId, user.id)) {
                    userMsgs[cId] = msgs as Message[];
                  }
                }
              } catch (e) {}
            }

            if (!userMsgs[userSavedId] || userMsgs[userSavedId].length === 0) {
              userMsgs[userSavedId] = [
                {
                  id: `saved-msg-welcome-${user.id}`,
                  chatId: userSavedId,
                  senderId: user.id,
                  senderName: 'Избранное',
                  type: 'text',
                  text: 'Добро пожаловать в ваше личное «Избранное»! 🔖\n\nЗдесь вы можете:\n• Записывать мысли и заметки\n• Отправлять себе ссылки и файлы\n• Сохранять любимые кружочки и треки',
                  createdAt: 'Только что',
                  isOutgoing: true,
                  status: 'read'
                }
              ];
            }

            if (!userMsgs['chat-bot-stickerbot']) {
              userMsgs['chat-bot-stickerbot'] = [
                {
                  id: 'msg-bot-welcome',
                  chatId: 'chat-bot-stickerbot',
                  senderId: STICKER_BOT_USER.id,
                  senderName: STICKER_BOT_USER.nickname,
                  senderEmoji: STICKER_BOT_USER.statusEmoji,
                  senderAvatar: STICKER_BOT_USER.avatar,
                  type: 'text',
                  text: 'Привет! Я официальный бот для создания стикеров в JustChat 🤖🎨\n\nЯ помогу вам превратить любые картинки и мемы в стикеры для чатов.\n\nКоманды:\n/newpack — создать новый набор стикеров\n/mypacks — список ваших наборов\n/help — помощь',
                  createdAt: 'Только что',
                  isOutgoing: false,
                  status: 'read',
                  botButtons: [
                    { label: '➕ Создать новый набор (/newpack)', action: '/newpack' },
                    { label: '📦 Мои стикеры (/mypacks)', action: '/mypacks' }
                  ]
                }
              ];
            }

            setMessages(userMsgs);

            // Re-initialize friends from scoped storage
            const savedFriendsRaw = localStorage.getItem(userFriendsKey);
            let userFriends: User[] = [];
            if (savedFriendsRaw) {
              try {
                userFriends = JSON.parse(savedFriendsRaw);
              } catch (e) {}
            }
            setFriends(userFriends);
          }}
        />
      )}

      {/* Mini Music Player Bar (when full player is minimized) */}
      {!isFullPlayerOpen && currentTrack && trackUrl && (
        <MusicPlayerBar
          currentTrack={currentTrack}
          trackUrl={trackUrl}
          onExpand={() => setIsFullPlayerOpen(true)}
          onClose={() => {
            setCurrentTrack(null);
            setTrackUrl(null);
          }}
        />
      )}

      {/* FULL-FLEDGED MUSIC PLAYER MODAL */}
      <FullMusicPlayerModal
        isOpen={isFullPlayerOpen}
        currentTrack={currentTrack}
        trackUrl={trackUrl}
        onClose={() => {
          setIsFullPlayerOpen(false);
          setCurrentTrack(null);
          setTrackUrl(null);
        }}
        onMinimize={() => setIsFullPlayerOpen(false)}
      />

      {/* Video Note Large Circular Viewer */}
      <VideoNoteViewerModal
        isOpen={!!activeVideoNote}
        videoUrl={activeVideoNote?.url || null}
        senderName={activeVideoNote?.senderName || ''}
        senderEmoji={activeVideoNote?.senderEmoji}
        senderAvatar={activeVideoNote?.senderAvatar}
        createdAt={activeVideoNote?.createdAt || ''}
        messageId={activeVideoNote?.messageId}
        canDelete={activeVideoNote?.canDelete}
        onDeleteMessage={(id) => {
          handleDeleteMessage(id);
          setActiveVideoNote(null);
        }}
        onClose={() => setActiveVideoNote(null)}
      />

      {/* LEFT COLUMN: Header + Stories + Chat List */}
      <div
        className={`w-full md:w-96 md:min-w-[340px] flex flex-col border-r border-[#242f3d] h-full ${
          selectedChatId ? 'hidden md:flex' : 'flex'
        }`}
      >
        <Header
          currentUser={currentUser}
          onOpenProfile={() => setIsViewingOwnProfile(true)}
          onOpenInstallGuide={() => setIsInstallModalOpen(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Stories Bar */}
        <StoriesBar
          stories={stories}
          currentUser={currentUser}
          onOpenStory={handleOpenStory}
          onAddStory={handleAddStory}
        />

        {/* Chat List with Pin & Delete Feature */}
        <ChatList
          chats={chats}
          messages={messages}
          selectedChatId={selectedChatId}
          onSelectChat={handleSelectChat}
          onTogglePin={handleTogglePin}
          onDeleteChat={handleDeleteChat}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenCreateChat={() => setIsCreateChatOpen(true)}
          onRefresh={handlePullRefresh}
          onStartDirectChat={handleStartDirectChat}
          currentUserId={currentUser.id}
        />
      </div>

      {/* RIGHT COLUMN: Active Chat Room or Empty State */}
      <div
        className={`flex-1 flex flex-col h-full ${
          selectedChatId ? 'flex' : 'hidden md:flex'
        }`}
      >
        {selectedChat ? (
          <ChatRoom
            chat={selectedChat}
            messages={messages[selectedChat.id] || []}
            currentUserId={currentUser.id}
            onBack={() => setSelectedChatId(null)}
            onSendMessage={handleSendMessage}
            onSendCatSticker={handleSendCatSticker}
            onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
            onOpenVideoModal={() => setIsVideoModalOpen(true)}
            onSendTrack={handleSendTrack}
            onSendImage={handleSendImage}
            onSendVideo={handleSendVideo}
            onTogglePin={handleTogglePin}
            onPlayGlobalTrack={handlePlayGlobalTrack}
            onOpenVideoViewer={(data) => setActiveVideoNote(data)}
            onOpenChatProfile={() => setViewingProfileChat(selectedChat)}
            onClearHistory={handleClearHistory}
            onDeleteChat={handleDeleteChat}
            onToggleReaction={handleToggleReaction}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            editingMessage={editingMessage}
            onCancelEdit={() => setEditingMessage(null)}
            onSaveEdit={handleSaveEdit}
            isTyping={Boolean(selectedChat && typingStatus[selectedChat.id]?.isTyping)}
            typingUserName={selectedChat ? typingStatus[selectedChat.id]?.userName : undefined}
            onTyping={handleTyping}
            onOpenStickerBot={() => handleStartDirectChat(STICKER_BOT_USER)}
            onBotButtonClick={handleSendMessage}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none bg-[#0e1621]">
            <img
              src="/logo.svg"
              alt="JustChat"
              className="w-20 h-20 rounded-3xl mb-4 shadow-2xl shadow-sky-500/20 ring-2 ring-[#2AABEE]/30"
            />
            <h3 className="text-base font-bold text-gray-200">JustChat</h3>
            <div className="inline-flex items-center space-x-1 mt-1 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-mono">
              <span>🔒</span>
              <span>E2EE защита активна</span>
            </div>
            <p className="text-xs text-gray-400 max-w-xs mt-2 leading-relaxed">
              Выберите или создайте чат слева, чтобы отправлять кружочки, треки и сообщения
            </p>
          </div>
        )}
      </div>

      {/* User / Friend / Own Profile Card Modal */}
      <UserProfileModal
        isOpen={isViewingOwnProfile || !!viewingProfileChat}
        user={isViewingOwnProfile ? currentUser : null}
        chat={isViewingOwnProfile ? null : viewingProfileChat}
        isOwnProfile={isViewingOwnProfile}
        isPinned={viewingProfileChat?.isPinned}
        onClose={() => {
          setIsViewingOwnProfile(false);
          setViewingProfileChat(null);
        }}
        onEditProfile={() => {
          setIsViewingOwnProfile(false);
          setIsProfileModalOpen(true);
        }}
        onTogglePin={() => {
          if (viewingProfileChat) {
            handleTogglePin(viewingProfileChat.id);
          }
        }}
        onPhotoUpload={handlePhotoUpload}
      />

      {/* Story Viewer Modal with Views Counter, Likes List & Delete */}
      <StoryViewerModal
        story={activeStory}
        currentUserId={currentUser.id}
        onClose={() => setActiveStoryId(null)}
        onNext={handleNextStory}
        onPrev={handlePrevStory}
        onToggleLike={handleToggleStoryLike}
        onDeleteStory={handleDeleteStory}
      />

      {/* Circular Video Note Recorder Modal (КРУЖОЧКИ) */}
      {isVideoModalOpen && (
        <VideoNoteRecorderModal
          isOpen={isVideoModalOpen}
          onClose={() => setIsVideoModalOpen(false)}
          onSendVideoNote={handleSendVideoNote}
        />
      )}

      {/* Voice Note Recorder Modal (ГОЛОСОВЫЕ) */}
      {isVoiceModalOpen && (
        <VoiceNoteRecorderModal
          isOpen={isVoiceModalOpen}
          onClose={() => setIsVoiceModalOpen(false)}
          onSendVoiceNote={handleSendVoiceNote}
        />
      )}

      {/* Profile & Emoji Status Settings Modal */}
      <ProfileSettingsModal
        isOpen={isProfileModalOpen}
        currentUser={currentUser}
        inviteCode={inviteCode}
        onUpdateInviteCode={handleUpdateInviteCode}
        onClose={() => setIsProfileModalOpen(false)}
        onSaveProfile={handleSaveProfile}
        onOpenInstallGuide={() => setIsInstallModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* iPhone & Android Installation Guide Modal */}
      <PwaInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />

      {/* Create Chat & Search by @username Modal */}
      <CreateChatModal
        isOpen={isCreateChatOpen}
        onClose={() => setIsCreateChatOpen(false)}
        friends={friends}
        currentUserId={currentUser.id}
        onStartDirectChat={handleStartDirectChat}
        onCreateGroupChat={handleCreateGroupChat}
        onDeleteFriend={handleDeleteFriend}
      />
    </div>
  );
}
export default App;
