import React, { useRef, useState, useEffect } from 'react';
import { X, Volume2, VolumeX, Play, Pause, Download } from 'lucide-react';

interface VideoNoteViewerModalProps {
  isOpen: boolean;
  videoUrl: string | null;
  senderName: string;
  senderEmoji?: string;
  senderAvatar?: string;
  createdAt: string;
  onClose: () => void;
}

export const VideoNoteViewerModal: React.FC<VideoNoteViewerModalProps> = ({
  isOpen,
  videoUrl,
  senderName,
  senderEmoji,
  senderAvatar,
  createdAt,
  onClose
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const safeVideoUrl = (hasError || !videoUrl || videoUrl.startsWith('blob:'))
    ? '/sample-circle.mp4'
    : videoUrl;

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

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 select-none animate-in fade-in duration-150"
    >
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="relative flex flex-col items-center"
      >
        {/* Top bar info */}
        <div className="flex items-center justify-between w-full max-w-xs mb-4 text-white">
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

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Big Circular Video Player */}
        <div 
          onClick={togglePlay}
          className="relative w-72 h-72 sm:w-84 sm:h-84 rounded-full overflow-hidden border-4 border-[#2AABEE] shadow-2xl bg-black cursor-pointer group"
        >
          <video
            ref={videoRef}
            src={safeVideoUrl}
            autoPlay
            loop
            playsInline
            muted={isMuted}
            onError={() => setHasError(true)}
            className="w-full h-full object-cover transform -scale-x-100"
          />

          {/* Pause overlay when paused */}
          {!isPlaying && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Play className="w-16 h-16 text-white fill-current ml-2" />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-6 mt-6">
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
          >
            {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
          </button>

          <a
            href={videoUrl}
            download
            className="p-3 rounded-full bg-white/15 text-white hover:bg-white/25 transition active:scale-95"
            title="Скачать кружочек"
          >
            <Download className="w-6 h-6" />
          </a>
        </div>

        <p className="text-gray-400 text-xs mt-3">Нажмите на видео, чтобы поставить на паузу</p>
      </div>
    </div>
  );
};
