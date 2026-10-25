import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Smile, Send, Mic, Video, Music, Image as ImageIcon, Edit2, X, Check } from 'lucide-react';
import { CatStickerPicker } from './CatStickerPicker';
import { CatSticker, Message } from '../types';
import { compressStoryMedia } from '../utils/storyHelper';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  onSendCatSticker: (sticker: CatSticker) => void;
  onOpenVoiceModal: () => void;
  onOpenVideoModal: () => void;
  onSendTrack: (title: string, artist: string, url: string) => void;
  onSendImage?: (imageUrl: string) => void;
  onSendVideo?: (videoUrl: string) => void;
  onTyping?: () => void;
  editingMessage?: Message | null;
  onCancelEdit?: () => void;
  onSaveEdit?: (messageId: string, newText: string) => void;
  placeholder?: string;
  onOpenStickerBot?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onSendCatSticker,
  onOpenVoiceModal,
  onOpenVideoModal,
  onSendTrack,
  onSendImage,
  onSendVideo,
  onTyping,
  editingMessage,
  onCancelEdit,
  onSaveEdit,
  placeholder = 'Сообщение...',
  onOpenStickerBot
}) => {
  const [text, setText] = useState('');
  const [recordMode, setRecordMode] = useState<'voice' | 'video'>('voice');
  const [isStickerPickerOpen, setIsStickerPickerOpen] = useState(false);
  const [isAttachOpen, setIsAttachOpen] = useState(false);

  const mediaInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingMessage && editingMessage.text) {
      setText(editingMessage.text);
    }
  }, [editingMessage]);

  const handleSend = () => {
    if (!text.trim()) return;
    if (editingMessage && onSaveEdit) {
      onSaveEdit(editingMessage.id, text.trim());
      setText('');
      onCancelEdit?.();
      return;
    }
    onSendMessage(text.trim());
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'Escape' && editingMessage && onCancelEdit) {
      onCancelEdit();
      setText('');
    }
  };

  // Handle local Image / Video upload (with canvas compression for images)
  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isVideo = file.type.startsWith('video');
      if (isVideo) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (typeof event.target?.result === 'string' && onSendVideo) {
            onSendVideo(event.target.result);
          }
        };
        reader.readAsDataURL(file);
      } else {
        try {
          const compressed = await compressStoryMedia(file);
          if (onSendImage) {
            onSendImage(compressed);
          }
        } catch (err) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (typeof event.target?.result === 'string' && onSendImage) {
              onSendImage(event.target.result);
            }
          };
          reader.readAsDataURL(file);
        }
      }
      setIsAttachOpen(false);
      e.target.value = '';
    }
  };

  // Toggle between Mic and Video note on tap
  const handleToggleRecordMode = () => {
    setRecordMode(prev => prev === 'voice' ? 'video' : 'voice');
  };

  const handleRecordAction = () => {
    if (recordMode === 'voice') {
      onOpenVoiceModal();
    } else {
      onOpenVideoModal();
    }
  };

  // Handle local MP3 file upload
  const handleMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const nameParts = file.name.replace(/\.[^/.]+$/, '').split('-');
      const artist = nameParts.length > 1 ? nameParts[0].trim() : 'Музыкальный трек';
      const title = nameParts.length > 1 ? nameParts.slice(1).join('-').trim() : nameParts[0].trim();
      onSendTrack(title, artist, url);
      setIsAttachOpen(false);
    }
  };

  return (
    <div className="flex flex-col bg-[#17212b] border-t border-[#242f3d] select-none">
      {/* Editing header banner */}
      {editingMessage && (
        <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#0e1621] border-b border-[#242f3d] text-xs animate-in slide-in-from-bottom-2 duration-100">
          <div className="flex items-center space-x-2 min-w-0">
            <Edit2 className="w-3.5 h-3.5 text-[#2AABEE] flex-shrink-0" />
            <div className="min-w-0">
              <span className="text-[#2AABEE] font-semibold text-[10px] uppercase tracking-wider block">Редактирование</span>
              <p className="text-gray-300 text-xs truncate max-w-[240px] sm:max-w-md">{editingMessage.text}</p>
            </div>
          </div>
          <button
            onClick={() => {
              onCancelEdit?.();
              setText('');
            }}
            className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-[#242f3d] transition ml-2"
            title="Отменить редактирование (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="relative p-2.5 sm:px-4 sm:py-3 flex items-center space-x-2">
        {/* Hidden file inputs */}
        <input
          type="file"
          ref={mediaInputRef}
          accept="image/*,video/*"
          onChange={handleMediaUpload}
          className="hidden"
        />
      <input
        type="file"
        ref={musicInputRef}
        accept="audio/*"
        onChange={handleMusicUpload}
        className="hidden"
      />

      {/* Cat & Custom stickers picker popup */}
      <CatStickerPicker
        isOpen={isStickerPickerOpen}
        onClose={() => setIsStickerPickerOpen(false)}
        onOpenStickerBot={() => {
          setIsStickerPickerOpen(false);
          onOpenStickerBot?.();
        }}
        onSelectSticker={(sticker) => {
          onSendCatSticker(sticker);
          setIsStickerPickerOpen(false);
        }}
      />

      {/* Attachments Dropdown Menu */}
      {isAttachOpen && (
        <div className="absolute bottom-16 left-3 bg-[#17212b] border border-[#242f3d] rounded-2xl shadow-2xl p-2 z-40 flex flex-col space-y-1 w-48 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
          <button
            onClick={() => {
              mediaInputRef.current?.click();
              setIsAttachOpen(false);
            }}
            className="flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs text-gray-200 hover:bg-[#242f3d] transition text-left"
          >
            <ImageIcon className="w-4 h-4 text-sky-400" />
            <span>Фото или видео</span>
          </button>

          <button
            onClick={() => {
              musicInputRef.current?.click();
              setIsAttachOpen(false);
            }}
            className="flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs text-gray-200 hover:bg-[#242f3d] transition text-left"
          >
            <Music className="w-4 h-4 text-emerald-400" />
            <span>Музыкальный трек</span>
          </button>
        </div>
      )}

      {/* Attachment Button */}
      <button
        onClick={() => setIsAttachOpen(!isAttachOpen)}
        className="p-2 text-gray-400 hover:text-white hover:bg-[#242f3d] rounded-full transition active:scale-95"
        title="Прикрепить файл или трек"
      >
        <Paperclip className="w-5 h-5 rotate-45" />
      </button>

      {/* Cat Stickers & Emoji Button */}
      <button
        onClick={() => setIsStickerPickerOpen(!isStickerPickerOpen)}
        className={`p-2 rounded-full transition active:scale-95 ${
          isStickerPickerOpen ? 'text-[#2AABEE] bg-[#242f3d]' : 'text-gray-400 hover:text-white hover:bg-[#242f3d]'
        }`}
        title="Стикеры с котиками"
      >
        <Smile className="w-5 h-5" />
      </button>

      {/* Text Input Field */}
      <div className="flex-1 relative">
        <input
          type="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onTyping?.();
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-[#0e1621] text-gray-100 placeholder-gray-500 text-sm rounded-full py-2.5 px-4 outline-none border border-transparent focus:border-[#2AABEE]/60 transition"
        />
      </div>

      {/* Right Action Button */}
      {editingMessage ? (
        <button
          onClick={handleSend}
          className="p-2.5 rounded-full bg-emerald-500 text-white hover:bg-emerald-400 transition shadow-md shadow-emerald-500/20 active:scale-95 flex items-center justify-center flex-shrink-0"
          title="Сохранить изменения"
        >
          <Check className="w-4 h-4 stroke-[3]" />
        </button>
      ) : text.trim().length > 0 ? (
        // Send message button
        <button
          onClick={handleSend}
          className="p-2.5 rounded-full bg-[#2AABEE] text-white hover:bg-sky-400 transition shadow-md shadow-sky-500/20 active:scale-95 flex items-center justify-center"
          title="Отправить"
        >
          <Send className="w-4 h-4 fill-current ml-0.5" />
        </button>
      ) : (
        // Dual Mode: Voice or Video Circle with tap-to-record & double-tap to switch
        <div className="flex items-center space-x-1">
          <button
            onClick={handleToggleRecordMode}
            className="p-1 text-[10px] text-gray-400 hover:text-gray-200 transition"
            title="Сменить режим (голос / кружок)"
          >
            {recordMode === 'voice' ? '🎙️' : '📹'}
          </button>

          <button
            onClick={handleRecordAction}
            className={`p-2.5 rounded-full text-white transition active:scale-95 shadow-md flex items-center justify-center ${
              recordMode === 'video'
                ? 'bg-sky-600 hover:bg-sky-500 shadow-sky-600/30'
                : 'bg-[#2AABEE] hover:bg-sky-400 shadow-sky-500/30'
            }`}
            title={recordMode === 'video' ? 'Записать кружочек' : 'Записать голосовое'}
          >
            {recordMode === 'video' ? (
              <Video className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>
        </div>
      )}
      </div>
    </div>
  );
};
