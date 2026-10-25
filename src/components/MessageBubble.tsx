import React, { useState, useRef } from 'react';
import { Message, TrackInfo } from '../types';
import { Check, CheckCheck, Play, Pause, Volume2, VolumeX, Music, Download, Smile, Edit2, Trash2 } from 'lucide-react';
import { AudioHelper } from '../utils/audio';

const QUICK_REACTIONS = ['❤️', '🔥', '😂', '👍', '👎', '😮'];

interface MessageBubbleProps {
  message: Message;
  currentUserId?: string;
  isGroup?: boolean;
  onPlayGlobalTrack?: (track: TrackInfo, url: string) => void;
  onOpenVideoViewer?: (data: {
    url: string;
    senderName: string;
    senderEmoji?: string;
    senderAvatar?: string;
    createdAt: string;
  }) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onEditMessage?: (message: Message) => void;
  onDeleteMessage?: (messageId: string) => void;
  onBotButtonClick?: (action: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  currentUserId = 'user-me',
  isGroup,
  onPlayGlobalTrack,
  onOpenVideoViewer,
  onToggleReaction,
  onEditMessage,
  onDeleteMessage,
  onBotButtonClick
}) => {
  const isOut = message.isOutgoing;
  const [showPicker, setShowPicker] = useState(false);

  // Video note state
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const [hasVideoError, setHasVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const rawVideoUrl = message.mediaUrl || '';
  const videoSrc = (hasVideoError || !rawVideoUrl) ? '' : rawVideoUrl;

  // Audio voice state
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [hasVoiceError, setHasVoiceError] = useState(false);
  const [voiceProgress, setVoiceProgress] = useState(0);
  const [playSpeed, setPlaySpeed] = useState<1 | 1.5 | 2>(1);
  const audioVoiceRef = useRef<HTMLAudioElement>(null);

  const rawVoiceUrl = message.mediaUrl || '';
  const voiceSrc = (hasVoiceError || !rawVoiceUrl) ? '' : rawVoiceUrl;

  // Toggle video circle sound or open fullscreen
  const handleVideoClick = () => {
    if (onOpenVideoViewer) {
      onOpenVideoViewer({
        url: videoSrc,
        senderName: message.senderName,
        senderEmoji: message.senderEmoji,
        senderAvatar: message.senderAvatar,
        createdAt: message.createdAt
      });
      return;
    }
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsVideoMuted(videoRef.current.muted);
    }
  };

  // Toggle voice playback
  const toggleVoicePlayback = () => {
    if (!audioVoiceRef.current) return;
    if (isPlayingVoice) {
      audioVoiceRef.current.pause();
      setIsPlayingVoice(false);
    } else {
      audioVoiceRef.current.playbackRate = playSpeed;
      audioVoiceRef.current.play().catch(() => {});
      setIsPlayingVoice(true);
    }
  };

  const handleVoiceTimeUpdate = () => {
    if (audioVoiceRef.current) {
      const prog = (audioVoiceRef.current.currentTime / audioVoiceRef.current.duration) * 100;
      setVoiceProgress(isNaN(prog) ? 0 : prog);
    }
  };

  const handleVoiceEnded = () => {
    setIsPlayingVoice(false);
    setVoiceProgress(0);
  };

  const toggleSpeed = () => {
    const nextSpeed = playSpeed === 1 ? 1.5 : playSpeed === 1.5 ? 2 : 1;
    setPlaySpeed(nextSpeed);
    if (audioVoiceRef.current) {
      audioVoiceRef.current.playbackRate = nextSpeed;
    }
  };

  // Trigger Full Music Player
  const handleTrackClick = () => {
    if (onPlayGlobalTrack && message.trackInfo && message.mediaUrl) {
      onPlayGlobalTrack(message.trackInfo, message.mediaUrl);
    }
  };

  // Floating action bar: Reactions, Edit, Delete
  const renderReactionBar = () => (
    <div className="relative">
      <div
        className={`absolute ${
          isOut ? '-left-20' : '-right-20'
        } top-1/2 -translate-y-1/2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition z-20 ${
          showPicker ? 'opacity-100' : ''
        }`}
      >
        {/* Emoji reaction picker button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowPicker(!showPicker);
          }}
          className="p-1.5 rounded-full bg-[#17212b] border border-[#242f3d] text-gray-400 hover:text-white transition shadow active:scale-95"
          title="Добавить реакцию"
        >
          <Smile className="w-3.5 h-3.5" />
        </button>

        {/* Edit button (only for outgoing text messages) */}
        {isOut && message.type === 'text' && onEditMessage && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditMessage(message);
            }}
            className="p-1.5 rounded-full bg-[#17212b] border border-[#242f3d] text-gray-400 hover:text-[#2AABEE] transition shadow active:scale-95"
            title="Редактировать сообщение"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Delete message button */}
        {onDeleteMessage && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Удалить это сообщение?')) {
                onDeleteMessage(message.id);
              }
            }}
            className="p-1.5 rounded-full bg-[#17212b] border border-[#242f3d] text-gray-400 hover:text-rose-400 transition shadow active:scale-95"
            title="Удалить сообщение"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {showPicker && (
        <div
          className={`absolute z-30 ${isOut ? 'right-0' : 'left-0'} -top-10 bg-[#17212b]/95 border border-[#242f3d] backdrop-blur-md rounded-full px-2 py-1 shadow-2xl flex items-center space-x-1.5 animate-in fade-in zoom-in-95 duration-100`}
        >
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={(e) => {
                e.stopPropagation();
                onToggleReaction?.(message.id, emoji);
                setShowPicker(false);
                AudioHelper.playPop(540, 0.05);
              }}
              className="w-7 h-7 flex items-center justify-center text-sm hover:scale-125 active:scale-95 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // Render list of active reactions below message
  const renderReactionsList = () => {
    if (!message.reactions || typeof message.reactions !== 'object') return null;
    const entries = Object.entries(message.reactions).filter(([_, users]) => Array.isArray(users) && users.length > 0);
    if (entries.length === 0) return null;

    return (
      <div className={`flex flex-wrap items-center gap-1 mt-1 px-0.5 ${isOut ? 'justify-end' : 'justify-start'}`}>
        {entries.map(([emoji, users]) => {
          const hasReacted = Array.isArray(users) && users.includes(currentUserId);
          return (
            <button
              key={emoji}
              onClick={(e) => {
                e.stopPropagation();
                onToggleReaction?.(message.id, emoji);
                AudioHelper.playPop(500, 0.05);
              }}
              className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs transition active:scale-90 select-none ${
                hasReacted
                  ? 'bg-[#2AABEE]/25 border border-[#2AABEE] text-white shadow-sm'
                  : 'bg-[#17212b] border border-[#242f3d] text-gray-300 hover:border-gray-500'
              }`}
            >
              <span className="text-xs">{emoji}</span>
              <span className="text-[10px] font-semibold">{users.length}</span>
            </button>
          );
        })}
      </div>
    );
  };

  // Sticker format (no bubble background)
  if (message.type === 'sticker') {
    return (
      <div className={`relative group flex flex-col my-1.5 ${isOut ? 'items-end' : 'items-start'}`}>
        {!isOut && isGroup && (
          <div className="flex items-center space-x-1 text-xs text-sky-400 font-semibold mb-1 ml-1">
            <span>{message.senderName}</span>
            {message.senderEmoji && <span>{message.senderEmoji}</span>}
          </div>
        )}
        <div className="relative">
          <img
            src={message.stickerUrl}
            alt="Стикер"
            className="w-40 h-40 object-cover rounded-2xl shadow-lg hover:scale-105 transition transform active:scale-95"
          />
          <span className="absolute bottom-1 right-2 bg-black/60 backdrop-blur-sm text-[10px] text-white/90 px-1.5 py-0.5 rounded-full">
            {message.createdAt}
          </span>
          {renderReactionBar()}
        </div>
        {renderReactionsList()}
      </div>
    );
  }

  // Photo / Image format
  if (message.type === 'image') {
    return (
      <div className={`relative group flex flex-col my-1.5 max-w-[80%] sm:max-w-[65%] ${isOut ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
        {!isOut && isGroup && (
          <div className="flex items-center space-x-1 text-xs text-sky-400 font-semibold mb-1 ml-1">
            <span>{message.senderName}</span>
            {message.senderEmoji && <span>{message.senderEmoji}</span>}
          </div>
        )}
        <div className="relative rounded-2xl overflow-hidden shadow-lg border border-[#242f3d] bg-black">
          <img
            src={message.mediaUrl}
            alt="Фото"
            className="w-full max-h-80 object-cover rounded-2xl"
          />
          <div className="absolute bottom-1.5 right-2 bg-black/60 backdrop-blur-sm text-[10px] text-white/90 px-1.5 py-0.5 rounded-full flex items-center space-x-1">
            <span>{message.createdAt}</span>
            {isOut && <CheckCheck className="w-3.5 h-3.5 text-[#2AABEE]" />}
          </div>
          {renderReactionBar()}
        </div>
        {renderReactionsList()}
      </div>
    );
  }

  // Video format (обычное видео)
  if (message.type === 'video') {
    return (
      <div className={`relative group flex flex-col my-1.5 max-w-[85%] sm:max-w-[70%] ${isOut ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
        {!isOut && isGroup && (
          <div className="flex items-center space-x-1 text-xs text-sky-400 font-semibold mb-1 ml-1">
            <span>{message.senderName}</span>
            {message.senderEmoji && <span>{message.senderEmoji}</span>}
          </div>
        )}
        <div className="relative rounded-2xl overflow-hidden shadow-lg border border-[#242f3d] bg-black">
          <video
            src={message.mediaUrl}
            controls
            playsInline
            preload="metadata"
            className="w-full max-h-80 rounded-2xl bg-black"
          />
          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-[10px] text-white/90 px-1.5 py-0.5 rounded-full flex items-center space-x-1 pointer-events-none">
            <span>{message.createdAt}</span>
            {isOut && <CheckCheck className="w-3.5 h-3.5 text-[#2AABEE]" />}
          </div>
          {renderReactionBar()}
        </div>
        {renderReactionsList()}
      </div>
    );
  }

  // Video note format (КРУЖОЧЕК)
  if (message.type === 'video_note') {
    return (
      <div className={`relative group flex flex-col my-2 ${isOut ? 'items-end' : 'items-start'}`}>
        {!isOut && isGroup && (
          <div className="flex items-center space-x-1 text-xs text-sky-400 font-semibold mb-1 ml-1">
            <span>{message.senderName}</span>
            {message.senderEmoji && <span>{message.senderEmoji}</span>}
          </div>
        )}
        <div 
          onClick={handleVideoClick}
          className="relative w-56 h-56 rounded-full overflow-hidden border-2 border-[#2AABEE]/80 shadow-2xl cursor-pointer group bg-zinc-950"
        >
          <video
            ref={videoRef}
            src={videoSrc}
            playsInline
            autoPlay
            loop
            muted={isVideoMuted}
            onError={() => setHasVideoError(true)}
            className="w-full h-full object-cover"
          />

          {/* Sound / Expand Indicator */}
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white p-1.5 rounded-full opacity-80 group-hover:opacity-100 transition shadow">
            {isVideoMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-[#2AABEE]" />}
          </div>

          {/* Timestamp and duration */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md text-white text-[11px] px-2.5 py-0.5 rounded-full flex items-center space-x-1.5 shadow">
            <span>{message.createdAt}</span>
            {isOut && <CheckCheck className="w-3.5 h-3.5 text-[#2AABEE]" />}
          </div>
          {renderReactionBar()}
        </div>
        {renderReactionsList()}
      </div>
    );
  }

  return (
    <div className={`relative group flex flex-col my-1 max-w-[85%] sm:max-w-[70%] ${isOut ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
      {!isOut && isGroup && (
        <div className="flex items-center space-x-1 text-xs text-sky-400 font-semibold mb-1 ml-2">
          <span>{message.senderName}</span>
          {message.senderEmoji && <span>{message.senderEmoji}</span>}
        </div>
      )}

      <div
        className={`rounded-2xl px-3.5 py-2.5 shadow-md relative break-words ${
          isOut
            ? 'bg-[#2b5278] text-white rounded-br-sm'
            : 'bg-[#17212b] text-gray-100 rounded-bl-sm border border-[#242f3d]/60'
        }`}
      >
        {renderReactionBar()}
        {/* VOICE MESSAGE COMPONENT */}
        {message.type === 'voice' && (
          <div className="flex items-center space-x-3 min-w-[210px] sm:min-w-[240px]">
            <audio
              ref={audioVoiceRef}
              src={voiceSrc}
              onTimeUpdate={handleVoiceTimeUpdate}
              onEnded={handleVoiceEnded}
              onError={() => setHasVoiceError(true)}
            />
            {/* Play/Pause Button */}
            <button
              onClick={toggleVoicePlayback}
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition active:scale-95 ${
                isOut ? 'bg-white text-[#2b5278]' : 'bg-[#2AABEE] text-white'
              }`}
            >
              {isPlayingVoice ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            {/* Waveform and progress */}
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex items-center space-x-0.5 h-6 mb-1">
                {(message.audioWaveform || [40, 70, 90, 50, 80, 60, 30, 90, 45, 65, 80, 55, 30, 85, 40, 70]).map((h, i) => {
                  const barProgress = (i / 16) * 100;
                  const isPassed = voiceProgress >= barProgress;
                  return (
                    <div
                      key={i}
                      className={`w-1 rounded-full transition-all duration-150 ${
                        isPassed
                          ? isOut ? 'bg-sky-200' : 'bg-[#2AABEE]'
                          : isOut ? 'bg-sky-900/60' : 'bg-gray-600'
                      }`}
                      style={{ height: `${Math.max(20, h)}%` }}
                    />
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[10px] text-gray-300">
                <span>0:{message.audioDuration ? (message.audioDuration < 10 ? `0${message.audioDuration}` : message.audioDuration) : '15'}</span>
                <button
                  onClick={toggleSpeed}
                  className="px-1.5 py-0.5 rounded bg-black/20 hover:bg-black/40 font-mono text-[10px] transition"
                >
                  {playSpeed}x
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MUSIC TRACK COMPONENT (FULL PLAYER TRIGGER) */}
        {message.type === 'audio' && (
          <div 
            onClick={handleTrackClick}
            className="flex items-center space-x-3 min-w-[240px] sm:min-w-[280px] cursor-pointer group"
          >
            {/* Cover art with play icon */}
            <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 shadow-md">
              {message.trackInfo?.coverUrl ? (
                <img src={message.trackInfo.coverUrl} alt="Cover" className="w-full h-full object-cover group-hover:scale-110 transition duration-300" />
              ) : (
                <div className="w-full h-full bg-emerald-700 flex items-center justify-center text-white">
                  <Music className="w-6 h-6" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/50 transition">
                <Play className="w-5 h-5 text-white fill-current ml-0.5" />
              </div>
            </div>

            {/* Track Info */}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-xs text-white truncate group-hover:text-[#2AABEE] transition">
                {message.trackInfo?.title || 'Аудиозапись'}
              </h4>
              <p className="text-[11px] text-gray-300 truncate">
                {message.trackInfo?.artist || 'Неизвестный исполнитель'}
              </p>
              <span className="text-[10px] text-emerald-400 font-medium">
                Нажмите, чтобы открыть плеер 🎵
              </span>
            </div>

            <a
              href={message.mediaUrl}
              download
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-2 rounded-full hover:bg-black/20 text-gray-300 hover:text-white transition flex-shrink-0"
              title="Скачать трек"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* REGULAR TEXT MESSAGE */}
        {message.type === 'text' && (
          <div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap selection:bg-sky-500/30">
              {message.text}
            </p>
            {/* Interactive Bot Quick-Reply Buttons */}
            {message.botButtons && message.botButtons.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-white/10">
                {message.botButtons.map((btn, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onBotButtonClick?.(btn.action);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#2AABEE]/20 hover:bg-[#2AABEE]/35 border border-[#2AABEE]/40 text-sky-300 hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition active:scale-95 shadow-sm"
                  >
                    <span>{btn.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer: Time & Status checkmarks */}
        <div className="flex items-center justify-end space-x-1 mt-1 text-[10px] text-gray-300 select-none">
          {message.isEdited && (
            <span className="text-[9px] text-sky-300/80 mr-0.5">изм.</span>
          )}
          <span>{message.createdAt}</span>
          {isOut && (
            message.status === 'read'
              ? <CheckCheck className="w-3.5 h-3.5 text-[#2AABEE]" />
              : <Check className="w-3.5 h-3.5 text-gray-400" />
          )}
        </div>
      </div>
      {renderReactionsList()}
    </div>
  );
};
