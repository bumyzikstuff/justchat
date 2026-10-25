import React, { useEffect, useRef, useState } from 'react';
import { Chat, Message, CatSticker, TrackInfo } from '../types';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { ArrowLeft, Pin, MoreVertical, User, Trash2, Bell, BellOff, X, Bookmark } from 'lucide-react';

interface ChatRoomProps {
  chat: Chat;
  messages: Message[];
  currentUserId?: string;
  onBack: () => void;
  onSendMessage: (text: string) => void;
  onSendCatSticker: (sticker: CatSticker) => void;
  onOpenVoiceModal: () => void;
  onOpenVideoModal: () => void;
  onSendTrack: (title: string, artist: string, url: string) => void;
  onSendImage?: (imageUrl: string) => void;
  onSendVideo?: (videoUrl: string) => void;
  onTogglePin: (chatId: string) => void;
  onPlayGlobalTrack?: (track: TrackInfo, url: string) => void;
  onOpenVideoViewer?: (data: {
    url: string;
    senderName: string;
    senderEmoji?: string;
    senderAvatar?: string;
    createdAt: string;
  }) => void;
  onOpenChatProfile?: () => void;
  onClearHistory?: (chatId: string) => void;
  onDeleteChat?: (chatId: string) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onEditMessage?: (message: Message) => void;
  onDeleteMessage?: (messageId: string) => void;
  editingMessage?: Message | null;
  onCancelEdit?: () => void;
  onSaveEdit?: (messageId: string, newText: string) => void;
  isTyping?: boolean;
  typingUserName?: string;
  onTyping?: () => void;
  onBotButtonClick?: (action: string) => void;
  onOpenStickerBot?: () => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({
  chat,
  messages,
  currentUserId = 'user-me',
  onBack,
  onSendMessage,
  onSendCatSticker,
  onOpenVoiceModal,
  onOpenVideoModal,
  onSendTrack,
  onSendImage,
  onSendVideo,
  onTogglePin,
  onPlayGlobalTrack,
  onOpenVideoViewer,
  onOpenChatProfile,
  onClearHistory,
  onDeleteChat,
  onToggleReaction,
  onEditMessage,
  onDeleteMessage,
  editingMessage,
  onCancelEdit,
  onSaveEdit,
  isTyping,
  typingUserName,
  onTyping,
  onBotButtonClick,
  onOpenStickerBot
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const isSavedMessages = chat.isSavedMessages || chat.id === 'chat-saved';
  const isBotChat = chat.isBot || chat.id === 'chat-bot-stickerbot';

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0e1621] relative select-none">
      {/* Chat Room Top Navigation Bar */}
      <div className="bg-[#17212b] border-b border-[#242f3d] px-3 py-2 flex items-center justify-between z-20 shadow-sm">
        <div className="flex items-center space-x-2.5 min-w-0">
          {/* Back button (crucial for mobile) */}
          <button
            onClick={onBack}
            className="p-1.5 -ml-1 text-gray-300 hover:text-white rounded-full hover:bg-[#242f3d] transition active:scale-95"
            title="Назад"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Clickable Profile trigger (Avatar + Name) */}
          <div 
            onClick={onOpenChatProfile}
            className="flex items-center space-x-2.5 min-w-0 cursor-pointer group hover:opacity-90 transition"
            title="Посмотреть профиль"
          >
            {/* Avatar with Status Emoji badge */}
            {isSavedMessages ? (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#2AABEE] to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20 ring-1 ring-sky-400/30 flex-shrink-0">
                <Bookmark className="w-5 h-5 fill-white" />
              </div>
            ) : (
              <div className="relative flex-shrink-0">
                <img
                  src={chat.avatar}
                  alt={chat.name}
                  className="w-10 h-10 rounded-full object-cover shadow ring-1 ring-white/10 group-hover:ring-[#2AABEE] transition"
                />
                {chat.statusEmoji && (
                  <span 
                    className="absolute -bottom-1 -right-1 text-xs bg-[#17212b] rounded-full px-0.5 border border-[#242f3d] shadow"
                    title="Эмодзи-статус"
                  >
                    {chat.statusEmoji}
                  </span>
                )}
              </div>
            )}

            {/* Chat Name and Online subtitle */}
            <div className="min-w-0 flex flex-col justify-center">
              <div className="flex items-center space-x-1.5">
                <h2 className="font-semibold text-sm text-gray-100 group-hover:text-[#2AABEE] transition truncate">
                  {chat.name}
                </h2>
                {isBotChat && (
                  <span className="text-[9px] bg-sky-500/20 text-sky-400 border border-sky-400/30 px-1.5 py-0.2 rounded-full font-bold font-mono">
                    БОТ
                  </span>
                )}
                {chat.statusEmoji && !isSavedMessages && !isBotChat && (
                  <span className="text-xs" title="Статус-эмодзи">
                    {chat.statusEmoji}
                  </span>
                )}
                <span
                  className="text-[9px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-1.5 py-0.5 rounded-full font-mono flex items-center space-x-0.5 flex-shrink-0"
                  title="Сквозное E2EE шифрование активно (AES-GCM-256)"
                >
                  <span>🔒</span>
                  <span className="font-bold">E2EE</span>
                </span>
              </div>
              {isSavedMessages ? (
                <span className="text-xs text-sky-400 font-medium truncate flex items-center space-x-1">
                  <span>🔖</span>
                  <span>Личные заметки и облако файлов</span>
                </span>
              ) : isBotChat ? (
                <span className="text-xs text-sky-400 font-medium truncate">
                  {isTyping ? 'печатает...' : 'официальный бот'}
                </span>
              ) : isTyping ? (
                <span className="text-xs text-sky-400 flex items-center space-x-1.5 animate-pulse">
                  <span>{typingUserName ? `${typingUserName} печатает` : 'печатает'}</span>
                  <span className="inline-flex space-x-0.5">
                    <span className="w-1 h-1 bg-sky-400 rounded-full animate-bounce"></span>
                    <span className="w-1 h-1 bg-sky-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1 h-1 bg-sky-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </span>
                </span>
              ) : (
                <span className="text-xs truncate">
                  {chat.type === 'group' ? (
                    <span className="text-gray-400">участников: {chat.members?.length || 2}</span>
                  ) : chat.isOnline !== false ? (
                    <span className="text-[#2AABEE] font-medium">в сети</span>
                  ) : chat.lastSeen ? (
                    <span className="text-gray-400">
                      {chat.lastSeen.startsWith('был') ? chat.lastSeen : `был(а) в сети ${chat.lastSeen}`}
                    </span>
                  ) : (
                    <span className="text-gray-400">был(а) недавно</span>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right header buttons: Pin toggle & 3-dots options menu */}
        <div className="flex items-center space-x-1 text-gray-400 relative">
          <button
            onClick={() => onTogglePin(chat.id)}
            className={`p-2 rounded-full transition active:scale-95 ${
              chat.isPinned
                ? 'text-[#2AABEE] bg-[#2AABEE]/10'
                : 'hover:text-white hover:bg-[#242f3d]'
            }`}
            title={chat.isPinned ? 'Открепить чат' : 'Закрепить чат'}
          >
            <Pin className={`w-4 h-4 rotate-45 ${chat.isPinned ? 'fill-current' : ''}`} />
          </button>

          {/* 3 Dots Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`p-2 rounded-full transition active:scale-95 ${
              isMenuOpen ? 'bg-[#242f3d] text-white' : 'hover:text-white hover:bg-[#242f3d]'
            }`}
            title="Опции чата"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {/* 3 Dots Dropdown Menu */}
          {isMenuOpen && (
            <div 
              onClick={() => setIsMenuOpen(false)}
              className="absolute right-0 top-11 bg-[#17212b] border border-[#242f3d] rounded-2xl shadow-2xl py-2 w-56 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
            >
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  if (onOpenChatProfile) onOpenChatProfile();
                }}
                className="w-full px-3.5 py-2.5 text-xs text-left text-gray-200 hover:bg-[#242f3d] flex items-center space-x-2.5 transition"
              >
                <User className="w-4 h-4 text-[#2AABEE]" />
                <span>Открыть профиль</span>
              </button>

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onTogglePin(chat.id);
                }}
                className="w-full px-3.5 py-2.5 text-xs text-left text-gray-200 hover:bg-[#242f3d] flex items-center space-x-2.5 transition"
              >
                <Pin className="w-4 h-4 text-amber-400 rotate-45" />
                <span>{chat.isPinned ? 'Открепить этот чат' : 'Закрепить этот чат'}</span>
              </button>

              {!isSavedMessages && (
                <button
                  onClick={() => {
                    setIsMuted(!isMuted);
                    setIsMenuOpen(false);
                  }}
                  className="w-full px-3.5 py-2.5 text-xs text-left text-gray-200 hover:bg-[#242f3d] flex items-center space-x-2.5 transition"
                >
                  {isMuted ? <Bell className="w-4 h-4 text-emerald-400" /> : <BellOff className="w-4 h-4 text-gray-400" />}
                  <span>{isMuted ? 'Включить уведомления' : 'Без звука'}</span>
                </button>
              )}

              <div className="border-t border-[#242f3d] my-1" />

              {onClearHistory && (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (confirm('Очистить всю историю сообщений в этом чате?')) {
                      onClearHistory(chat.id);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 text-xs text-left text-amber-400 hover:bg-amber-500/10 flex items-center space-x-2.5 transition"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Очистить историю</span>
                </button>
              )}

              {onDeleteChat && !isSavedMessages && (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (confirm(`Удалить чат "${chat.name}" и всю переписку?`)) {
                      onDeleteChat(chat.id);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 text-xs text-left text-rose-400 hover:bg-rose-500/10 flex items-center space-x-2.5 transition"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Удалить чат</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 bg-[#0e1621] bg-opacity-95 bg-[radial-gradient(#242f3d_1px,transparent_1px)] [background-size:24px_24px]">
        {/* Pinned banner if chat is pinned */}
        {chat.isPinned && (
          <div className="flex justify-center mb-3">
            <div className="bg-[#17212b]/80 border border-[#242f3d] text-[#2AABEE] text-[11px] px-3 py-1 rounded-full flex items-center space-x-1.5 shadow-sm">
              <Pin className="w-3 h-3 rotate-45 fill-current" />
              <span>{isSavedMessages ? 'Избранное всегда закреплено первым' : 'Этот чат закреплен вверху'}</span>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            currentUserId={currentUserId}
            isGroup={chat.type === 'group'}
            onPlayGlobalTrack={onPlayGlobalTrack}
            onOpenVideoViewer={onOpenVideoViewer}
            onToggleReaction={onToggleReaction}
            onEditMessage={onEditMessage}
            onDeleteMessage={onDeleteMessage}
            onBotButtonClick={onBotButtonClick || onSendMessage}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <ChatInput
        placeholder={isSavedMessages ? 'Сохранить заметку, ссылку или файл...' : 'Сообщение...'}
        onSendMessage={onSendMessage}
        onSendCatSticker={onSendCatSticker}
        onOpenVoiceModal={onOpenVoiceModal}
        onOpenVideoModal={onOpenVideoModal}
        onSendTrack={onSendTrack}
        onSendImage={onSendImage}
        onSendVideo={onSendVideo}
        onTyping={onTyping}
        editingMessage={editingMessage}
        onCancelEdit={onCancelEdit}
        onSaveEdit={onSaveEdit}
        onOpenStickerBot={onOpenStickerBot}
      />
    </div>
  );
};
