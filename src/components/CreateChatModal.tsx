import React, { useState, useEffect } from 'react';
import { User, Chat } from '../types';
import { X, Search, Users, UserPlus, AtSign, Check, Plus, MessageCircle, Bot, Trash2, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { STICKER_BOT_USER } from '../services/stickerBot';
import { getSupabaseClient } from '../services/supabase';

interface CreateChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  friends: User[];
  currentUserId?: string;
  onStartDirectChat: (friend: User) => void;
  onCreateGroupChat: (name: string, members: User[], avatar?: string) => void;
  onDeleteFriend?: (friendId: string) => void;
}

export const CreateChatModal: React.FC<CreateChatModalProps> = ({
  isOpen,
  onClose,
  friends,
  currentUserId,
  onStartDirectChat,
  onCreateGroupChat,
  onDeleteFriend
}) => {
  const [activeTab, setActiveTab] = useState<'search' | 'group'>('search');

  // Search by @username state
  const [usernameQuery, setUsernameQuery] = useState('');

  // Group creation state
  const [groupName, setGroupName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [groupEmoji, setGroupEmoji] = useState('💬');

  if (!isOpen) return null;

  // Combine friends with official bots for global discovery, excluding currentUser
  const allSearchable = [
    STICKER_BOT_USER,
    ...friends.filter((f) => f.id !== STICKER_BOT_USER.id && (!currentUserId || f.id !== currentUserId))
  ];

  // Filter local friends & bots by query
  const cleanQuery = usernameQuery.replace(/^@/, '').toLowerCase().trim();
  const [remoteUsers, setRemoteUsers] = useState<User[]>([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);

  // Live remote search on Supabase profiles table
  useEffect(() => {
    if (!cleanQuery) {
      setRemoteUsers([]);
      return;
    }

    const client = getSupabaseClient();
    if (!client) return;

    let active = true;
    setIsSearchingRemote(true);

    const timer = setTimeout(async () => {
      try {
        const { data, error } = await client
          .from('profiles')
          .select('*')
          .or(`username.ilike.%${cleanQuery}%,nickname.ilike.%${cleanQuery}%`)
          .limit(10);

        if (!error && data && active) {
          const mapped: User[] = data.map((p) => ({
            id: p.id,
            nickname: p.nickname,
            username: p.username,
            avatar: p.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
            statusEmoji: p.status_emoji || '🔥',
            statusText: p.status_text || 'на связи 🤙',
            bio: p.bio,
            isOnline: p.is_online ?? true,
            isVip: p.id === 'user-me' || p.username === 'bulat'
          }));
          setRemoteUsers(mapped.filter((u) => u.id !== currentUserId));
        }
      } catch (e) {
        console.warn('Supabase profile search note:', e);
      } finally {
        if (active) setIsSearchingRemote(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [cleanQuery, currentUserId]);

  const localResults = cleanQuery
    ? allSearchable.filter(
        (f) =>
          f.username.toLowerCase().includes(cleanQuery) ||
          f.nickname.toLowerCase().includes(cleanQuery) ||
          (f.isBot && ('стикеры'.includes(cleanQuery) || 'бот'.includes(cleanQuery) || 'создать'.includes(cleanQuery)))
      )
    : allSearchable;

  // Merge local contacts with live Supabase database results without duplicates
  const searchResults = [...localResults];
  for (const r of remoteUsers) {
    if (!searchResults.some((u) => u.id === r.id || u.username === r.username)) {
      searchResults.push(r);
    }
  }

  const toggleSelectFriend = (friendId: string) => {
    setSelectedFriends((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    );
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    const members = friends.filter((f) => selectedFriends.includes(f.id));
    const avatar = `https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=150&auto=format&fit=crop&q=80`;

    onCreateGroupChat(groupName.trim(), members, avatar);
    confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.6 }
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none animate-in fade-in duration-150">
      <div className="bg-[#17212b] border border-[#242f3d] rounded-3xl w-full max-w-md max-h-[85vh] overflow-hidden text-gray-100 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#242f3d]">
          <h2 className="font-bold text-base text-white">Новый чат</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-[#242f3d] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs: Search / Group */}
        <div className="flex bg-[#0e1621] p-1.5 m-3 rounded-2xl border border-[#242f3d]">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition ${
              activeTab === 'search'
                ? 'bg-[#2AABEE] text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <AtSign className="w-3.5 h-3.5" />
            <span>Поиск по @юзернейму</span>
          </button>
          <button
            onClick={() => setActiveTab('group')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition ${
              activeTab === 'group'
                ? 'bg-[#2AABEE] text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Создать группу</span>
          </button>
        </div>

        {/* Tab 1: Search by @username */}
        {activeTab === 'search' && (
          <div className="flex-1 overflow-y-auto p-4 pt-1 space-y-3">
            {/* Search Input with @ */}
            <div className="relative">
              <input
                type="text"
                value={usernameQuery}
                onChange={(e) => setUsernameQuery(e.target.value)}
                placeholder="Введи @юзернейм (например: @alex)"
                className="w-full bg-[#0e1621] border border-[#242f3d] rounded-2xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-[#2AABEE]"
                autoFocus
              />
              <AtSign className="absolute left-3.5 top-2.5 w-4 h-4 text-[#2AABEE]" />
              {isSearchingRemote && (
                <Loader2 className="absolute right-3.5 top-2.5 w-4 h-4 text-[#2AABEE] animate-spin" />
              )}
            </div>

            <p className="text-[11px] text-gray-400 px-1">
              {cleanQuery
                ? `Результаты поиска для "@${cleanQuery}":`
                : 'Контакты и друзья JustChat:'}
            </p>

            {/* List of matching users */}
            <div className="space-y-2">
              {cleanQuery && searchResults.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-[#0e1621] border border-[#242f3d] flex items-center justify-center text-xl mx-auto text-gray-500">
                    🔍
                  </div>
                  <p className="font-semibold text-gray-200">Пользователь @{cleanQuery} не найден</p>
                  <p className="text-[11px] text-gray-400 max-w-xs mx-auto leading-relaxed">
                    Такого пользователя нет в JustChat. Проверьте правильность написания @юзернейма.
                  </p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-xs space-y-1">
                  <p className="font-semibold text-gray-300">Контактов пока нет</p>
                  <p className="text-[11px] text-gray-500">
                    Введите @юзернейм друга выше, чтобы найти его и начать диалог!
                  </p>
                </div>
              ) : (
                searchResults.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between p-2.5 bg-[#0e1621] hover:bg-[#1f2d3d] rounded-2xl border border-[#242f3d]/60 transition"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="relative flex-shrink-0">
                        <img
                          src={friend.avatar}
                          alt={friend.nickname}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <span className="absolute -bottom-1 -right-1 text-xs bg-[#17212b] rounded-full px-0.5 border border-[#242f3d]">
                          {friend.statusEmoji}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5 font-semibold text-xs text-white truncate">
                          <span className="truncate">{friend.nickname}</span>
                          <span>{friend.statusEmoji}</span>
                          {friend.isBot && (
                            <span className="text-[9px] bg-sky-500/20 text-sky-400 border border-sky-400/40 px-1.5 py-0.2 rounded-full font-bold font-mono">
                              БОТ
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-[#2AABEE] truncate">
                          @{friend.username}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate">
                          {friend.isBot ? (
                            <span className="text-sky-300 font-medium">официальный сервис JustChat</span>
                          ) : friend.isOnline ? (
                            <span className="text-emerald-400 font-medium">в сети</span>
                          ) : friend.lastSeen ? (
                            friend.lastSeen.startsWith('был') ? friend.lastSeen : `был(а) в сети ${friend.lastSeen}`
                          ) : (
                            'был(а) недавно'
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 flex-shrink-0 ml-2">
                      <button
                        onClick={() => {
                          onStartDirectChat(friend);
                          onClose();
                        }}
                        className="py-1.5 px-3 rounded-xl bg-[#2AABEE] text-white hover:bg-sky-400 text-xs font-semibold flex items-center space-x-1 transition active:scale-95 shadow"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Написать</span>
                      </button>

                      {!friend.isBot && onDeleteFriend && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteFriend(friend.id);
                          }}
                          title="Удалить контакт"
                          className="p-1.5 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition active:scale-95"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Create Group */}
        {activeTab === 'group' && (
          <form onSubmit={handleCreateGroup} className="flex-1 overflow-y-auto p-4 pt-1 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Название группы
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Например: Команда мечты ⚡"
                className="w-full bg-[#0e1621] border border-[#242f3d] rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-[#2AABEE]"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Добавить участников ({selectedFriends.length})
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {friends.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-400 bg-[#0e1621] rounded-2xl border border-[#242f3d] space-y-1">
                    <p className="font-semibold text-gray-300">Контактов пока нет</p>
                    <p className="text-[11px] text-gray-500">
                      Найдите друзей по @юзернейму на первой вкладке, либо создайте группу прямо сейчас и добавьте участников позже!
                    </p>
                  </div>
                ) : (
                  friends.map((friend) => {
                  const isChecked = selectedFriends.includes(friend.id);
                  return (
                    <div
                      key={friend.id}
                      onClick={() => toggleSelectFriend(friend.id)}
                      className={`flex items-center justify-between p-2 rounded-2xl cursor-pointer transition ${
                        isChecked
                          ? 'bg-[#2AABEE]/20 border border-[#2AABEE]/60'
                          : 'bg-[#0e1621] border border-[#242f3d] hover:bg-[#1a2533]'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <img
                          src={friend.avatar}
                          alt={friend.nickname}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">
                            {friend.nickname} {friend.statusEmoji}
                          </p>
                          <p className="text-[10px] text-gray-400 font-mono">@{friend.username}</p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center transition ${
                          isChecked
                            ? 'bg-[#2AABEE] border-[#2AABEE] text-white'
                            : 'border-gray-600'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                }))}
              </div>
            </div>

            <button
              type="submit"
              disabled={!groupName.trim()}
              className="w-full py-3 rounded-2xl bg-[#2AABEE] text-white font-bold text-xs hover:bg-sky-400 transition shadow-lg shadow-sky-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Создать группу</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
