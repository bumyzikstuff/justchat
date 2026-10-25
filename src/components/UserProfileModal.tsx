import React, { useRef } from 'react';
import { User, Chat } from '../types';
import { X, Pin, Bell, BellOff, Edit3, Camera, Sparkles, MessageCircle, AtSign, Bookmark } from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  user: User | null;
  chat?: Chat | null;
  isOwnProfile?: boolean;
  isPinned?: boolean;
  onClose: () => void;
  onEditProfile?: () => void;
  onTogglePin?: () => void;
  onPhotoUpload?: (file: File) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  user,
  chat,
  isOwnProfile,
  isPinned,
  onClose,
  onEditProfile,
  onTogglePin,
  onPhotoUpload
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || (!user && !chat)) return null;

  const isSavedChat = chat?.isSavedMessages || chat?.id === 'chat-saved';
  const isBotUser = user?.isBot || chat?.isBot || user?.id === 'user-stickerbot' || chat?.id === 'chat-bot-stickerbot';
  const displayName = isSavedChat ? 'Избранное' : (user?.nickname || chat?.name || 'Пользователь');
  const displayUsername = isSavedChat ? 'Личное облако' : (user?.username ? `@${user.username}` : (chat?.type === 'group' ? 'групповой чат' : ''));
  const displayAvatar = user?.avatar || chat?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';
  const displayEmoji = isSavedChat ? '⭐' : (user?.statusEmoji || chat?.statusEmoji || '🔥');
  const isOnline = user ? Boolean(user.isOnline) : Boolean(chat?.isOnline);
  const lastSeenText = user?.lastSeen || chat?.lastSeen || 'был(а) недавно';
  const displayStatus = isSavedChat ? 'Облачное хранилище' : (user?.statusText || (chat?.type === 'group' ? 'Групповой чат' : (isOnline ? 'в сети' : lastSeenText)));
  const displayBio = isSavedChat ? 'Ваше личное зашифрованное хранилище заметок, файлов, музыки и кружочков 🔖. Доступно только вам.' : (user?.bio || (chat?.type === 'group' ? 'Общий чат для общения и обмена треками' : 'Пользователь JustChat'));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onPhotoUpload) {
      onPhotoUpload(file);
    }
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none animate-in fade-in duration-150"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-[#17212b] border border-[#242f3d] rounded-3xl w-full max-w-sm overflow-hidden text-gray-100 shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col"
      >
        {/* Hidden input for changing photo */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Top Hero Section with Big Photo */}
        <div className="relative h-64 w-full bg-zinc-900 overflow-hidden flex items-center justify-center">
          {isSavedChat ? (
            <div className="w-full h-full bg-gradient-to-tr from-[#0e1621] via-[#1a365d] to-[#2563eb] flex items-center justify-center">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-[#2AABEE] to-indigo-600 flex items-center justify-center text-white shadow-2xl ring-4 ring-white/10">
                <Bookmark className="w-12 h-12 fill-white" />
              </div>
            </div>
          ) : (
            <img
              src={displayAvatar}
              alt={displayName}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#17212b] via-transparent to-black/40" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-30 p-2 rounded-full bg-black/50 text-white hover:bg-black/75 transition"
          >
            <X className="w-5 h-5" />
          </button>

          {/* User Name & Status Emoji floating on bottom of hero */}
          <div className="absolute bottom-3 left-4 right-32 z-20">
            <div className="flex items-center space-x-1.5 text-xl font-bold text-white drop-shadow-md truncate">
              <span className="truncate">{displayName}</span>
              <span className="text-xl flex-shrink-0" title="Статус эмодзи">{displayEmoji}</span>
              {isBotUser && (
                <span className="text-[10px] bg-sky-500/25 border border-sky-400/40 text-sky-300 px-2 py-0.5 rounded-full font-bold shadow-sm font-mono">
                  БОТ
                </span>
              )}
              {isOwnProfile && (
                <span className="text-[10px] bg-gradient-to-r from-amber-500/25 to-sky-500/25 border border-amber-400/40 text-amber-300 px-2 py-0.5 rounded-full font-bold shadow-sm">
                  VIP
                </span>
              )}
            </div>
            {displayUsername && (
              <p className="text-xs text-sky-300 font-mono drop-shadow font-medium">
                {displayUsername}
              </p>
            )}
            <p className="text-[11px] text-gray-300 drop-shadow">
              {isSavedChat
                ? 'Всегда доступно'
                : isBotUser
                ? 'официальный сервис JustChat'
                : isOwnProfile || user?.hideLastSeen
                ? (isOnline ? 'в сети' : 'был(а) недавно')
                : isOnline
                ? 'в сети'
                : lastSeenText}
            </p>
          </div>

          {/* If own profile: Quick change photo button on hero with highest z-index */}
          {isOwnProfile && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-3 right-4 z-30 py-2 px-3 rounded-2xl bg-[#2AABEE] text-white hover:bg-sky-400 transition cursor-pointer shadow-xl active:scale-95 flex items-center space-x-1.5 text-xs font-bold"
            >
              <Camera className="w-4 h-4" />
              <span>Сменить фото</span>
            </button>
          )}
        </div>

        {/* Info & Details Section */}
        <div className="p-4 space-y-3">
          {/* Username row */}
          {user?.username && (
            <div className="bg-[#0e1621] border border-[#242f3d] rounded-2xl p-3 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-500/15 flex items-center justify-center text-[#2AABEE]">
                  <AtSign className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Юзернейм</span>
                  <p className="text-xs font-mono font-bold text-sky-400">@{user.username}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(`@${user.username}`)}
                className="text-[11px] text-gray-400 hover:text-white bg-[#17212b] px-2.5 py-1 rounded-xl border border-[#242f3d] transition"
              >
                Копировать
              </button>
            </div>
          )}

          {/* Status text badge */}
          {displayStatus && (
            <div className="bg-[#0e1621] border border-[#242f3d] rounded-2xl p-3 flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#2AABEE]/15 flex items-center justify-center text-[#2AABEE]">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Статус</span>
                <p className="text-xs font-semibold text-white truncate">{displayStatus}</p>
              </div>
            </div>
          )}

          {/* Bio Description */}
          <div className="bg-[#0e1621] border border-[#242f3d] rounded-2xl p-3">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">
              {isSavedChat ? 'О хранилище' : 'О себе'}
            </span>
            <p className="text-xs text-gray-200 leading-relaxed">{displayBio}</p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {isOwnProfile ? (
              <button
                onClick={() => {
                  onClose();
                  if (onEditProfile) onEditProfile();
                }}
                className="col-span-2 py-3 rounded-2xl bg-[#2AABEE] text-white font-bold text-xs hover:bg-sky-400 transition shadow flex items-center justify-center space-x-2 active:scale-95"
              >
                <Edit3 className="w-4 h-4" />
                <span>Редактировать профиль</span>
              </button>
            ) : (
              <>
                {onTogglePin && (
                  <button
                    onClick={onTogglePin}
                    className={`py-2.5 px-3 rounded-2xl border text-xs font-semibold flex items-center justify-center space-x-1.5 transition active:scale-95 ${
                      isPinned
                        ? 'bg-[#2AABEE]/20 border-[#2AABEE] text-[#2AABEE]'
                        : 'bg-[#0e1621] border-[#242f3d] text-gray-300 hover:text-white'
                    }`}
                  >
                    <Pin className={`w-3.5 h-3.5 rotate-45 ${isPinned ? 'fill-current' : ''}`} />
                    <span>{isPinned ? 'Открепить' : 'Закрепить'}</span>
                  </button>
                )}

                <button
                  onClick={onClose}
                  className="py-2.5 px-3 rounded-2xl bg-[#0e1621] border border-[#242f3d] text-gray-300 hover:text-white text-xs font-semibold flex items-center justify-center space-x-1.5 transition active:scale-95"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-[#2AABEE]" />
                  <span>Написать</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
