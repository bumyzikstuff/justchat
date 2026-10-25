import React, { useState, useRef, useEffect } from 'react';
import { Chat, Message, User } from '../types';
import { Pin, Search, Check, CheckCheck, Mic, Video, Music, Smile, Plus, Edit, Trash2, Bookmark, RefreshCw, X, Loader2, MessageCircle } from 'lucide-react';
import { AudioHelper } from '../utils/audio';
import { getSupabaseClient } from '../services/supabase';
import { formatLastSeen } from '../utils/presence';

interface ChatListProps {
  chats: Chat[];
  messages?: Record<string, Message[]>;
  selectedChatId: string | null;
  onSelectChat: (chat: Chat) => void;
  onTogglePin: (chatId: string) => void;
  onDeleteChat?: (chatId: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenCreateChat: () => void;
  onRefresh?: () => void | Promise<void>;
  onStartDirectChat?: (friend: User) => void;
  currentUserId?: string;
}

export const ChatList: React.FC<ChatListProps> = ({
  chats,
  messages,
  selectedChatId,
  onSelectChat,
  onTogglePin,
  onDeleteChat,
  searchQuery,
  onSearchChange,
  onOpenCreateChat,
  onRefresh,
  onStartDirectChat,
  currentUserId
}) => {
  const [filter, setFilter] = useState<'all' | 'pinned' | 'groups'>('all');
  const TABS: ('all' | 'pinned' | 'groups')[] = ['all', 'pinned', 'groups'];

  // Gesture swipe navigation between tabs + Pull-to-refresh
  const listContainerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontalSwipe = useRef(false);
  const isPullingDown = useRef(false);
  const [swipeOffsetX, setSwipeOffsetX] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = false;
    isPullingDown.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    // 1. Horizontal swipe across tabs
    if (!isPullingDown.current && absX > 15 && absX > absY * 1.3) {
      isHorizontalSwipe.current = true;
      setSwipeOffsetX(dx * 0.35);
      return;
    }

    // 2. Pull down to refresh when at top of list
    const isAtTop = (listContainerRef.current?.scrollTop || 0) <= 0;
    if (isAtTop && dy > 10 && absY > absX * 1.2 && !isHorizontalSwipe.current) {
      isPullingDown.current = true;
      setPullDistance(Math.min(dy * 0.45, 80));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Handle tab swipe
    if (isHorizontalSwipe.current) {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const currentIndex = TABS.indexOf(filter);

      if (dx < -45 && currentIndex < TABS.length - 1) {
        setFilter(TABS[currentIndex + 1]);
        AudioHelper.playPop(520, 0.03);
      } else if (dx > 45 && currentIndex > 0) {
        setFilter(TABS[currentIndex - 1]);
        AudioHelper.playPop(520, 0.03);
      }
    }

    // Handle pull to refresh
    if (isPullingDown.current) {
      if (pullDistance >= 50 && !isRefreshing) {
        setIsRefreshing(true);
        AudioHelper.playPop(500, 0.04);
        if (onRefresh) {
          Promise.resolve(onRefresh()).finally(() => {
            setTimeout(() => {
              setIsRefreshing(false);
              setPullDistance(0);
            }, 600);
          });
        } else {
          setTimeout(() => {
            setIsRefreshing(false);
            setPullDistance(0);
          }, 700);
        }
      } else {
        setPullDistance(0);
      }
    }

    setSwipeOffsetX(0);
    isHorizontalSwipe.current = false;
    isPullingDown.current = false;
  };

  const cleanQ = (searchQuery || '').trim().toLowerCase();
  const cleanUsernameQ = cleanQ.replace(/^@/, '');

  // Live remote search on Supabase profiles table for global discovery
  const [globalUsers, setGlobalUsers] = useState<User[]>([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);

  useEffect(() => {
    if (!cleanUsernameQ || cleanUsernameQ.length < 2) {
      setGlobalUsers([]);
      setIsSearchingGlobal(false);
      return;
    }

    const client = getSupabaseClient();
    if (!client) return;

    let active = true;
    setIsSearchingGlobal(true);

    const timer = setTimeout(async () => {
      try {
        const { data, error } = await client
          .from('profiles')
          .select('*')
          .or(`username.ilike.%${cleanUsernameQ}%,nickname.ilike.%${cleanUsernameQ}%`)
          .limit(8);

        if (!error && data && active) {
          const mapped: User[] = data.map((p) => {
            const isFresh = p.updated_at && (Date.now() - new Date(p.updated_at).getTime()) < 60000;
            const isOnline = Boolean(p.is_online && isFresh);
            return {
              id: p.id,
              nickname: p.nickname || 'Пользователь',
              username: p.username || '',
              avatar: p.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
              statusEmoji: p.status_emoji || '🔥',
              statusText: p.status_text || (isOnline ? 'в сети' : formatLastSeen(p.updated_at)),
              bio: p.bio,
              isOnline,
              lastSeen: isOnline ? 'в сети' : formatLastSeen(p.updated_at),
              updatedAt: p.updated_at,
              isVip: p.id === 'user-me' || p.username === 'bulat'
            };
          });
          setGlobalUsers(mapped.filter((u) => u.id !== currentUserId));
        }
      } catch (e) {
        console.warn('Global search error:', e);
      } finally {
        if (active) setIsSearchingGlobal(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [cleanUsernameQ, currentUserId]);

  // Sort chats: pinned first, then by last message time / order (completely crash-proof)
  const filteredChats = (chats || [])
    .filter((chat) => {
      if (!chat) return false;
      const chatName = (chat.name || '').toLowerCase();
      const matchesSearch = !cleanQ || chatName.includes(cleanQ);
      if (!matchesSearch) return false;
      if (filter === 'pinned') return Boolean(chat.isPinned);
      if (filter === 'groups') return chat.type === 'group';
      return true;
    })
    .sort((a, b) => {
      if (!a || !b) return 0;
      if (a.id === 'chat-saved' || a.isSavedMessages) return -1;
      if (b.id === 'chat-saved' || b.isSavedMessages) return 1;
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });

  const getMessagePreviewIcon = (type?: string) => {
    switch (type) {
      case 'voice':
        return <Mic className="w-3.5 h-3.5 text-[#2AABEE] inline mr-1" />;
      case 'video_note':
        return <Video className="w-3.5 h-3.5 text-[#2AABEE] inline mr-1" />;
      case 'audio':
        return <Music className="w-3.5 h-3.5 text-emerald-400 inline mr-1" />;
      case 'sticker':
        return <Smile className="w-3.5 h-3.5 text-amber-400 inline mr-1" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0e1621] overflow-hidden select-none relative">
      {/* Search Input Bar (Chat & @username search) */}
      <div className="px-3 pt-2 pb-1.5 bg-[#17212b]/80 border-b border-[#242f3d]/50">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Поиск чатов или @юзернейма..."
            className="w-full bg-[#0e1621] text-xs text-white placeholder-gray-500 rounded-xl pl-8 pr-8 py-2 outline-none border border-transparent focus:border-[#2AABEE]/60 transition"
          />
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-500" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-2.5 text-gray-400 hover:text-white transition"
              title="Очистить поиск"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Category filter tabs & New Chat Button */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#242f3d]/50 bg-[#17212b]/50">
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              filter === 'all'
                ? 'bg-[#2AABEE] text-white'
                : 'text-gray-400 hover:text-white hover:bg-[#242f3d]'
            }`}
          >
            Все ({chats.length})
          </button>
          <button
            onClick={() => setFilter('pinned')}
            className={`px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 transition ${
              filter === 'pinned'
                ? 'bg-[#2AABEE] text-white'
                : 'text-gray-400 hover:text-white hover:bg-[#242f3d]'
            }`}
          >
            <Pin className="w-3 h-3 rotate-45" />
            <span>Закреп</span>
          </button>
          <button
            onClick={() => setFilter('groups')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              filter === 'groups'
                ? 'bg-[#2AABEE] text-white'
                : 'text-gray-400 hover:text-white hover:bg-[#242f3d]'
            }`}
          >
            Группы
          </button>
        </div>

        <button
          onClick={onOpenCreateChat}
          className="text-xs text-[#2AABEE] font-semibold hover:text-sky-300 flex items-center space-x-1 p-1 rounded-lg hover:bg-sky-500/10 transition"
          title="Создать новый чат или найти по @юзернейму"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span className="hidden sm:inline">Новый</span>
        </button>
      </div>

      {/* Pull-to-refresh Indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div 
          className="flex items-center justify-center overflow-hidden transition-all duration-200 bg-[#17212b]/40 border-b border-[#242f3d]/30"
          style={{ height: isRefreshing ? 48 : pullDistance }}
        >
          <div 
            className="w-8 h-8 rounded-full bg-[#17212b] border border-[#2AABEE]/60 shadow-lg flex items-center justify-center text-[#2AABEE] transition-transform"
            style={{
              transform: isRefreshing ? undefined : `rotate(${pullDistance * 5}deg) scale(${Math.min(pullDistance / 40, 1)})`,
            }}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#2AABEE]' : 'text-sky-400'}`} />
          </div>
        </div>
      )}

      {/* Chat list items with gesture swipe support */}
      <div 
        ref={listContainerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: swipeOffsetX !== 0 ? `translateX(${swipeOffsetX}px)` : undefined,
          transition: isHorizontalSwipe.current ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)'
        }}
        className="flex-1 overflow-y-auto divide-y divide-[#242f3d]/20 transition-transform"
      >
        {filteredChats.length === 0 && globalUsers.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none space-y-3 mt-12">
            <div className="w-16 h-16 rounded-3xl bg-[#17212b] border border-[#242f3d] flex items-center justify-center text-3xl shadow-lg">
              {cleanQ ? '🔍' : '💬'}
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-200">
                {cleanQ ? 'Ничего не найдено' : 'Пока нет чатов'}
              </h3>
              <p className="text-xs text-gray-400 mt-1 max-w-[210px] leading-relaxed">
                {cleanQ 
                  ? `По запросу «${searchQuery}» ничего не найдено`
                  : 'Найдите друзей по @юзернейму или создайте группу'}
              </p>
            </div>
            {!cleanQ && (
              <button
                onClick={onOpenCreateChat}
                className="py-2 px-4 rounded-xl bg-[#2AABEE] text-white hover:bg-sky-400 text-xs font-semibold flex items-center space-x-1.5 shadow-md active:scale-95 transition"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Начать общение</span>
              </button>
            )}
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isSelected = chat.id === selectedChatId;
            return (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat)}
                className={`relative flex items-center px-3.5 py-3 cursor-pointer group transition ${
                  isSelected
                    ? 'bg-[#2b5278]/40 border-l-4 border-[#2AABEE]'
                    : 'hover:bg-[#17212b]/70'
                }`}
              >
                {/* Avatar with status emoji badge */}
                <div className="relative flex-shrink-0 mr-3">
                  {chat.isSavedMessages || chat.id === 'chat-saved' ? (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#2AABEE] to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/25 ring-2 ring-sky-400/30">
                      <Bookmark className="w-6 h-6 fill-white" />
                    </div>
                  ) : (
                    <img
                      src={chat.avatar}
                      alt={chat.name}
                      className="w-12 h-12 rounded-full object-cover shadow"
                    />
                  )}
                  {chat.statusEmoji && !(chat.isSavedMessages || chat.id === 'chat-saved') && (
                    <span 
                      className="absolute -bottom-1 -right-1 text-xs bg-[#17212b] rounded-full px-0.5 border border-[#242f3d] shadow"
                      title="Статус эмодзи"
                    >
                      {chat.statusEmoji}
                    </span>
                  )}
                </div>

                {/* Info & Last message */}
                {(() => {
                  const chatMsgs = messages ? messages[chat.id] : undefined;
                  const lastMsg = chatMsgs !== undefined
                    ? (chatMsgs.length > 0 ? chatMsgs[chatMsgs.length - 1] : undefined)
                    : chat.lastMessage;

                  const previewText = lastMsg
                    ? (lastMsg.text || (lastMsg.type === 'video' ? '🎬 Видео' : lastMsg.type === 'image' ? '📷 Фото' : lastMsg.type === 'voice' ? '🎙 Голосовое' : lastMsg.type === 'video_note' ? '📹 Кружочек' : lastMsg.type === 'sticker' ? 'Стикер 🎨' : 'Сообщение'))
                    : (chat.lastMessage?.text || 'Нет сообщений');
                  const previewTime = lastMsg ? lastMsg.createdAt : (chat.lastMessage?.createdAt || '');
                  const previewType = lastMsg ? lastMsg.type : chat.lastMessage?.type;
                  const isOutgoing = lastMsg ? lastMsg.isOutgoing : chat.lastMessage?.isOutgoing;

                  return (
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-1.5 truncate">
                          <h3 className="font-semibold text-sm text-gray-100 group-hover:text-[#2AABEE] transition truncate flex items-center space-x-1.5">
                            <span className="truncate">{chat.name}</span>
                            {chat.type === 'direct' && chat.isOnline === true && (
                              <span className="w-2 h-2 bg-emerald-400 rounded-full inline-block flex-shrink-0 animate-pulse" title="В сети" />
                            )}
                          </h3>
                          {chat.isBot && (
                            <span className="text-[9px] bg-sky-500/20 text-sky-400 border border-sky-400/40 px-1.5 py-0.2 rounded-full font-bold font-mono">
                              БОТ
                            </span>
                          )}
                          {chat.statusEmoji && !chat.isBot && (
                            <span className="text-xs" title="Эмодзи-статус">
                              {chat.statusEmoji}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-400 flex-shrink-0 ml-1">
                          {previewTime}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-400 truncate flex items-center mr-2">
                          {isOutgoing && (
                            <CheckCheck className="w-3.5 h-3.5 text-[#2AABEE] inline mr-1 flex-shrink-0" />
                          )}
                          {getMessagePreviewIcon(previewType)}
                          <span className="truncate">
                            {previewText}
                          </span>
                        </p>

                        <div className="flex items-center space-x-1.5 flex-shrink-0">
                          {/* Pinned Icon */}
                          {chat.isPinned && (
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                onTogglePin(chat.id);
                              }}
                              title="Закреплено (клик чтобы открепить)"
                              className="text-[#2AABEE] p-0.5 rounded hover:bg-white/10 transition"
                            >
                              <Pin className="w-3.5 h-3.5 fill-current rotate-45" />
                            </span>
                          )}

                          {/* Unread badge */}
                          {chat.unreadCount > 0 && (
                            <span className="bg-[#2AABEE] text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow min-w-[20px] text-center">
                              {chat.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Quick actions on Hover (Desktop) */}
                <div className="absolute right-2 top-2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition z-10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(chat.id);
                    }}
                    className={`p-1 rounded-full bg-[#17212b] border border-[#242f3d] text-gray-400 hover:text-white transition ${
                      chat.isPinned ? 'text-[#2AABEE]' : ''
                    }`}
                    title={chat.isPinned ? 'Открепить чат' : 'Закрепить чат'}
                  >
                    <Pin className="w-3 h-3 rotate-45" />
                  </button>

                  {onDeleteChat && !(chat.id === 'chat-saved' || chat.isSavedMessages) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Удалить чат "${chat.name}" и переписку?`)) {
                          onDeleteChat(chat.id);
                        }
                      }}
                      className="p-1 rounded-full bg-[#17212b] border border-[#242f3d] text-gray-400 hover:text-rose-400 hover:border-rose-500/50 transition"
                      title="Удалить чат"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Global Search Results from Supabase (Just like Telegram) */}
        {cleanQ && (
          <div className="bg-[#17212b]/60 border-t border-[#242f3d]/50">
            <div className="px-3.5 py-2 flex items-center justify-between text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-[#17212b]/90 sticky top-0 z-10 border-b border-[#242f3d]/30">
              <span className="flex items-center space-x-1.5">
                <span>Глобальный поиск</span>
                {isSearchingGlobal && <Loader2 className="w-3 h-3 animate-spin text-[#2AABEE]" />}
              </span>
              <span className="text-[10px] text-gray-500 lowercase">в JustChat</span>
            </div>

            {globalUsers.length === 0 && !isSearchingGlobal && (
              <div className="p-4 text-center text-xs text-gray-500">
                Пользователи с ником или @юзернеймом «{searchQuery}» не найдены
              </div>
            )}

            {globalUsers.map((user) => (
              <div
                key={user.id}
                onClick={() => {
                  if (onStartDirectChat) {
                    onStartDirectChat(user);
                    onSearchChange('');
                  }
                }}
                className="flex items-center px-3.5 py-2.5 hover:bg-[#2b5278]/30 cursor-pointer transition border-b border-[#242f3d]/20 active:bg-[#2b5278]/50"
              >
                <div className="relative flex-shrink-0 mr-3">
                  <img
                    src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                    alt={user.nickname}
                    className="w-10 h-10 rounded-full object-cover shadow ring-1 ring-sky-500/20"
                  />
                  {user.statusEmoji && (
                    <span className="absolute -bottom-1 -right-1 text-xs bg-[#17212b] rounded-full px-0.5 border border-[#242f3d]">
                      {user.statusEmoji}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center space-x-1.5">
                    <h4 className="font-semibold text-xs text-white truncate hover:text-[#2AABEE] transition">
                      {user.nickname}
                    </h4>
                    {user.isVip && (
                      <span className="text-[9px] bg-gradient-to-r from-amber-500/20 to-sky-500/20 border border-amber-400/40 text-amber-300 px-1 py-0.2 rounded-full font-bold">
                        VIP
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#2AABEE] font-mono truncate">
                    @{user.username || 'user'}
                  </p>
                </div>

                <button
                  type="button"
                  className="px-2.5 py-1 bg-[#2AABEE]/20 hover:bg-[#2AABEE] text-[#2AABEE] hover:text-white rounded-lg text-xs font-medium transition flex items-center space-x-1"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Написать</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) for Creating New Chat or Search */}
      <button
        onClick={onOpenCreateChat}
        className="absolute bottom-4 right-4 w-12 h-12 rounded-full bg-[#2AABEE] text-white hover:bg-sky-400 shadow-xl shadow-sky-500/30 flex items-center justify-center transition transform active:scale-90 z-20 group"
        title="Создать новый чат или найти по @юзернейму"
      >
        <Edit className="w-5 h-5 group-hover:scale-110 transition" />
      </button>
    </div>
  );
};
