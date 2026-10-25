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
import { compressStoryMedia, filterActiveStories, getStoryTimestamp, formatStoryTime } from './utils/storyHelper';
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
  broadcastDeleteChat
} from './services/supabase';

export function App() {
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
        return CURRENT_USER_DEFAULT;
      }
    }
    return CURRENT_USER_DEFAULT;
  });

  // Friends & Contacts state (persisted)
  const [friends, setFriends] = useState<User[]>(() => {
    const saved = localStorage.getItem('just_friends');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.filter((f: User) => 
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

  // Chats state (persisted)
  const [chats, setChats] = useState<Chat[]>(() => {
    const saved = localStorage.getItem('just_chats');
    let loaded: Chat[] = saved ? JSON.parse(saved) : INITIAL_CHATS;
    loaded = loaded.filter(c => 
      !c.name.toLowerCase().includes('stickerbotв') && 
      !c.id.includes('stickerbotв') &&
      !(c.name.toLowerCase().includes('stickerbot') && c.id !== 'chat-bot-stickerbot')
    );
    if (!loaded.some((c: Chat) => c.id === 'chat-saved' || c.isSavedMessages)) {
      loaded = [SAVED_MESSAGES_CHAT, ...loaded];
    }
    if (!loaded.some((c: Chat) => c.id === 'chat-bot-stickerbot' || c.isBot)) {
      loaded = [...loaded, STICKER_BOT_CHAT];
    }
    return loaded;
  });
  const [selectedChatId, setSelectedChatId] = useState<string | null>(() => {
    const saved = localStorage.getItem('just_chats');
    const parsed: Chat[] = saved ? JSON.parse(saved) : [];
    if (parsed.length > 0) return parsed[0].id;
    return 'chat-saved';
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Messages state (persisted)
  const [messages, setMessages] = useState<Record<string, Message[]>>(() => {
    try {
      const saved = localStorage.getItem('just_messages');
      const parsed = saved ? JSON.parse(saved) : INITIAL_MESSAGES;
      if (!parsed['chat-saved']) {
        parsed['chat-saved'] = INITIAL_MESSAGES['chat-saved'] || [];
      }
      if (!parsed['chat-bot-stickerbot']) {
        parsed['chat-bot-stickerbot'] = [
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
      return parsed;
    } catch (e) {
      console.warn('Error reading just_messages from localStorage, resetting:', e);
      return INITIAL_MESSAGES;
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

  // Sync to localStorage safely
  useEffect(() => {
    try {
      localStorage.setItem('just_friends', JSON.stringify(friends));
    } catch (e) {}
  }, [friends]);

  useEffect(() => {
    try {
      localStorage.setItem('just_chats', JSON.stringify(chats));
    } catch (e) {}
  }, [chats]);

  useEffect(() => {
    try {
      localStorage.setItem('just_messages', JSON.stringify(messages));
    } catch (e) {
      console.warn('LocalStorage quota exceeded for messages, pruning large payloads to survive:', e);
      try {
        const sanitized: Record<string, Message[]> = {};
        for (const [cId, msgList] of Object.entries(messages)) {
          sanitized[cId] = msgList.map((m) => {
            if (m.mediaUrl && m.mediaUrl.length > 500000) {
              return { ...m, mediaUrl: '' };
            }
            return m;
          });
        }
        localStorage.setItem('just_messages', JSON.stringify(sanitized));
      } catch (inner) {}
    }
  }, [messages]);

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

  // Auto-clean any legacy ghost users or test bots from storage on startup
  useEffect(() => {
    setFriends((prev) => {
      const filtered = prev.filter((f) => 
        !['max_fit', 'artem_beats', 'dasha_meow', 'nikita_pro'].includes(f.username) &&
        !f.username.toLowerCase().includes('stickerbotв') &&
        !f.id.includes('stickerbotв') &&
        !(f.username.toLowerCase().includes('stickerbot') && f.id !== 'user-stickerbot')
      );
      if (filtered.length !== prev.length) {
        try {
          localStorage.setItem('just_friends', JSON.stringify(filtered));
        } catch (e) {}
      }
      return filtered;
    });

    setChats((prev) => {
      const filtered = prev.filter((c) => 
        !c.name.toLowerCase().includes('stickerbotв') && 
        !c.id.includes('stickerbotв') &&
        !(c.name.toLowerCase().includes('stickerbot') && c.id !== 'chat-bot-stickerbot')
      );
      if (filtered.length !== prev.length) {
        try {
          localStorage.setItem('just_chats', JSON.stringify(filtered));
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
          // If phone has default mock data and cloud has real custom data, pull everything from cloud!
          const isLocalDefault = (!currentUser.avatar || currentUser.avatar.includes('photo-1534528741775')) && currentUser.nickname === 'Булат';
          if (isLocalDefault && (data.nickname !== 'Булат' || (data.avatar && !data.avatar.includes('photo-1534528741775')))) {
            setCurrentUser((prev) => {
              const next: User = {
                ...prev,
                nickname: data.nickname || prev.nickname,
                avatar: data.avatar || prev.avatar,
                statusEmoji: data.status_emoji || prev.statusEmoji,
                statusText: data.status_text || prev.statusText,
                bio: data.bio || prev.bio
              };
              localStorage.setItem('just_user', JSON.stringify(next));
              return next;
            });
          } else if (data.avatar && (!currentUser.avatar || currentUser.avatar.includes('photo-1534528741775'))) {
            // Also sync avatar if local avatar is default unsplash
            setCurrentUser((prev) => {
              const next = { ...prev, avatar: data.avatar };
              localStorage.setItem('just_user', JSON.stringify(next));
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

  // Supabase Realtime broadcast listener
  useEffect(() => {
    const unsubscribe = subscribeToJustChat({
      onNewMessage: async (msg) => {
        if (msg.senderId === currentUser.id) return;
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
        setTypingStatus((prev) => ({
          ...prev,
          [chatId]: { userName, isTyping }
        }));
      },
      onDeleteMessage: ({ chatId, messageId }) => {
        setMessages((prev) => {
          const chatMsgs = prev[chatId] || [];
          const filtered = chatMsgs.filter((m) => m.id !== messageId);
          return {
            ...prev,
            [chatId]: filtered
          };
        });
      },
      onEditMessage: async ({ chatId, messageId, text }) => {
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
        setChats((prev) => prev.filter((c) => c.id !== chatId));
        setMessages((prev) => {
          const copy = { ...prev };
          delete copy[chatId];
          return copy;
        });
        if (selectedChatId === chatId) {
          setSelectedChatId(null);
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser.id, selectedChatId]);

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

    const encryptedText = await encryptText(text, inviteCode);
    broadcastNewMessage({ ...newMsg, text: encryptedText });
  };

  // Send Video Note (КРУЖОЧЕК)
  const handleSendVideoNote = (mediaUrl: string, duration: number) => {
    if (!selectedChatId) return;

    AudioHelper.playSentSound();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg: Message = {
      id: `msg-vid-${Date.now()}`,
      chatId: selectedChatId,
      senderId: currentUser.id,
      senderName: currentUser.nickname,
      senderEmoji: currentUser.statusEmoji,
      senderAvatar: currentUser.avatar,
      type: 'video_note',
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
                text: '📹 Видеосообщение (кружочек)',
                createdAt: timeStr,
                type: 'video_note',
                isOutgoing: true
              }
            }
          : c
      )
    );

    broadcastNewMessage(newMsg);
  };

  // Send Voice Note (ГОЛОСОВОЕ)
  const handleSendVoiceNote = (mediaUrl: string, duration: number, waveform: number[]) => {
    if (!selectedChatId) return;

    AudioHelper.playSentSound();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg: Message = {
      id: `msg-voice-${Date.now()}`,
      chatId: selectedChatId,
      senderId: currentUser.id,
      senderName: currentUser.nickname,
      senderEmoji: currentUser.statusEmoji,
      senderAvatar: currentUser.avatar,
      type: 'voice',
      mediaUrl,
      audioDuration: duration,
      audioWaveform: waveform,
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
                text: `🎙 Голосовое сообщение (0:${duration < 10 ? `0${duration}` : duration})`,
                createdAt: timeStr,
                type: 'voice',
                isOutgoing: true
              }
            }
          : c
      )
    );

    broadcastNewMessage(newMsg);
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

    broadcastNewMessage(newMsg);
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

    broadcastNewMessage(newMsg);
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

    broadcastNewMessage(newMsg);
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

    broadcastNewMessage(newMsg);
  };

  // Handle emoji reactions (❤️, 🔥, 😂, 👍, 👎, 😮)
  const handleToggleReaction = (messageId: string, emoji: string) => {
    if (!selectedChatId) return;

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

    // If reacting inside @stickerbot chat while awaiting sticker emoji, advance sticker creation!
    if (selectedChatId === 'chat-bot-stickerbot') {
      const session = getBotSession();
      if (session.step === 'AWAITING_STICKER_EMOJI') {
        handleSendMessage(emoji);
        return;
      }
    }

    broadcastReaction(messageId, emoji, currentUser.id, selectedChatId);
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
  };

  // Like / Unlike story
  const handleToggleStoryLike = (storyId: string) => {
    setStories((prev) =>
      prev.map((s) => {
        if (s.id !== storyId) return s;
        const likes = s.likes || [];
        const exists = likes.some((l) => l.id === currentUser.id);
        const updatedLikes: StoryLike[] = exists
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
        return { ...s, likes: updatedLikes };
      })
    );
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
  };

  // Logout / Switch account to test login screen
  const handleLogout = () => {
    localStorage.removeItem('just_user');
    localStorage.removeItem('bro_user');
    setIsAuthOpen(true);
  };

  const handleUpdateInviteCode = (newCode: string) => {
    setInviteCode(newCode);
    localStorage.setItem('just_invite_code', newCode);
  };

  // Upload own avatar photo from device
  const handlePhotoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === 'string') {
        const nextUser = { ...currentUser, avatar: e.target.result };
        setCurrentUser(nextUser);
        localStorage.setItem('just_user', JSON.stringify(nextUser));
      }
    };
    reader.readAsDataURL(file);
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
    const directChatId = `chat-${[currentUser.id, friend.id].sort().join('-')}`;
    const existing = chats.find(c => c.id === directChatId || c.id === `chat-${friend.id}` || (c.name === friend.nickname && c.type === 'direct'));
    if (existing) {
      setSelectedChatId(existing.id);
      markChatAsRead(existing.id);
      return;
    }

    const newChat: Chat = {
      id: directChatId,
      type: 'direct',
      name: friend.nickname,
      avatar: friend.avatar,
      statusEmoji: friend.statusEmoji,
      isPinned: false,
      unreadCount: 0,
      isOnline: friend.isOnline,
      lastSeen: friend.lastSeen || 'недавно',
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

    setMessages((prev) => {
      const chatMsgs = prev[selectedChatId] || [];
      const filtered = chatMsgs.filter((m) => m.id !== messageId);
      const last = filtered.length > 0 ? filtered[filtered.length - 1] : undefined;

      setChats((cList) =>
        cList.map((c) =>
          c.id === selectedChatId
            ? {
                ...c,
                lastMessage: last
                  ? {
                      text: last.text || (last.type === 'video' ? '🎬 Видео' : last.type === 'image' ? '📷 Фото' : last.type === 'voice' ? '🎙 Голосовое' : 'Сообщение'),
                      createdAt: last.createdAt,
                      type: last.type,
                      isOutgoing: last.isOutgoing
                    }
                  : undefined
              }
            : c
        )
      );

      return {
        ...prev,
        [selectedChatId]: filtered
      };
    });

    if (editingMessage?.id === messageId) {
      setEditingMessage(null);
    }

    broadcastDeleteMessage(selectedChatId, messageId);
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
          selectedChatId={selectedChatId}
          onSelectChat={handleSelectChat}
          onTogglePin={handleTogglePin}
          onDeleteChat={handleDeleteChat}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenCreateChat={() => setIsCreateChatOpen(true)}
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
      <VideoNoteRecorderModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        onSendVideoNote={handleSendVideoNote}
      />

      {/* Voice Note Recorder Modal (ГОЛОСОВЫЕ) */}
      <VoiceNoteRecorderModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onSendVoiceNote={handleSendVoiceNote}
      />

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
