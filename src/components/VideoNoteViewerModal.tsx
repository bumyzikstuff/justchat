import React, { useRef, useState, useEffect } from 'react';
import { X, Volume2, VolumeX, Play, Pause, Download, Trash2, AlertCircle } from 'lucide-react';

interface VideoNoteViewerModalProps {
  isOpen: boolean;
  videoUrl: string | null;
  senderName: string;
  senderEmoji?: string;
  senderAvatar?: string;
  createdAt: string;
  messageId?: string;
  canDelete?: boolean;
  onDeleteMessage?: (messageId: string) => void;
  onClose: () => void;
}

export const VideoNoteViewerModal: React.FC<VideoNoteViewerModalProps> = ({
  isOpen,
  videoUrl,
  senderName,
  senderEmoji,
  senderAvatar,
  createdAt,
  messageId,
  canDelete = true,
  onDeleteMessage,
  onClose
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const safeVideoUrl = videoUrl || '';

  useEffect(() => {
    if (!isOpen) return;
    setHasError(false);
    setIsPlaying(true);

    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.muted = isMuted;
      videoRef.current.play().catch(() => {
        if (videoRef.current) {
          videoRef.current.muted = true;
          setIsMuted(true);
          videoRef.current.play().catch(() => {});
        }
      });
    }
  }, [isOpen, videoUrl]);

  if (!isOpen || !videoUrl) return null;

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const next = !isMuted;
    setIsMuted(next);
    videoRef.current.muted = next;
  };

  const handleDelete = () => {
    if (!messageId || !onDeleteMessage) return;
    if (confirm('Удалить этот кружочек?')) {
      onDeleteMessage(messageId);
      onClose();
    }
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 select-none animate-in fade-in duration-150"
    >
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="relative flex flex-col items-center"
      >
        {/* Top bar info & actions */}
        <div className="flex items-center justify-between w-full max-w-xs sm:max-w-sm mb-4 text-white">
          <div className="flex items-center space-x-2">
            {senderAvatar && (
              <img src={senderAvatar} alt="" className="w-8 h-8 rounded-full object-cover" />
            )}
            <div className="flex items-center space-x-1 font-semibold text-sm">
              <span>{senderName}</span>
              {senderEmoji && <span>{senderEmoji}</span>}
            </div>
            <span className="text-xs text-gray-400">• {createdAt}</span>
          </div>

          <div className="flex items-center space-x-2">
            {Boolean(messageId && onDeleteMessage && canDelete) && (
              <button
                onClick={handleDelete}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/40 transition text-xs font-medium active:scale-95 shadow"
                title="Удалить кружочек"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Удалить</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 text-white transition active:scale-95"
              title="Закрыть"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Big Circular Video Player */}
        <div 
          onClick={togglePlay}
          className="relative w-72 h-72 sm:w-84 sm:h-84 rounded-full overflow-hidden border-4 border-[#2AABEE] shadow-2xl bg-black cursor-pointer group"
        >
          {hasError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-gray-400 p-6 text-center">
              <AlertCircle className="w-12 h-12 mb-2 text-rose-400" />
              <span className="text-sm font-medium text-gray-200">Не удалось воспроизвести видео</span>
              <span className="text-xs text-gray-400 mt-1">Формат повреждён или не поддерживается данным браузером</span>
            </div>
          ) : (
            <video
              ref={videoRef}
              src={safeVideoUrl}
              autoPlay
              loop
              playsInline
              muted={isMuted}
              onError={() => setHasError(true)}
              className="w-full h-full object-cover"
            />
          )}

          {/* Pause overlay when paused */}
          {!isPlaying && !hasError && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Play className="w-16 h-16 text-white fill-current ml-2" />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-4 sm:space-x-6 mt-6">
          <button
            onClick={toggleMute}
            className="p-3 rounded-full bg-white/15 text-white hover:bg-white/25 transition active:scale-95"
            title={isMuted ? 'Включить звук' : 'Выключить звук'}
          >
            {isMuted ? <VolumeX className="w-6 h-6 text-rose-400" /> : <Volume2 className="w-6 h-6 text-[#2AABEE]" />}
          </button>

          <button
            onClick={togglePlay}
            className="p-4 rounded-full bg-[#2AABEE] text-white hover:bg-sky-400 transition shadow-lg active:scale-95"
            title={isPlaying ? 'Пауза' : 'Воспроизведение'}
          >
            {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
          </button>

          <a
            href={videoUrl}
            download="circle.webm"
            className="p-3 rounded-full bg-white/15 text-white hover:bg-white/25 transition active:scale-95"
            title="Скачать кружочек"
          >
            <Download className="w-6 h-6" />
          </a>

          {Boolean(messageId && onDeleteMessage && canDelete) && (
            <button
              onClick={handleDelete}
              className="p-3 rounded-full bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30 transition active:scale-95"
              title="Удалить кружочек"
            >
              <Trash2 className="w-6 h-6" />
            </button>
          )}
        </div>

        <p className="text-gray-400 text-xs mt-3">Нажмите на видео, чтобы поставить на паузу</p>
      </div>
    </div>
  );
};