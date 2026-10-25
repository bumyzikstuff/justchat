import React, { useState, useRef, useEffect } from 'react';
import { TrackInfo } from '../types';
import { Play, Pause, X, Music, Maximize2 } from 'lucide-react';

interface MusicPlayerBarProps {
  currentTrack: TrackInfo | null;
  trackUrl: string | null;
  onClose: () => void;
  onExpand: () => void;
}

export const MusicPlayerBar: React.FC<MusicPlayerBarProps> = ({
  currentTrack,
  trackUrl,
  onClose,
  onExpand
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (trackUrl && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, [trackUrl]);

  if (!currentTrack || !trackUrl) return null;

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current && audioRef.current.duration) {
      setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
    }
  };

  return (
    <div 
      onClick={onExpand}
      className="fixed top-14 left-0 right-0 z-40 bg-[#17212b]/95 border-b border-[#242f3d] backdrop-blur-md px-3 py-2 flex items-center justify-between shadow-lg select-none cursor-pointer hover:bg-[#1f2d3b] transition"
    >
      <audio
        ref={audioRef}
        src={trackUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Track Info */}
      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-lg bg-emerald-600/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
          <Music className={`w-4 h-4 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
        </div>
        <div className="min-w-0">
          <h4 className="text-xs font-semibold text-white truncate">{currentTrack.title}</h4>
          <p className="text-[10px] text-gray-400 truncate">{currentTrack.artist}</p>
        </div>
      </div>

      {/* Progress bar in background */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-700">
        <div className="h-full bg-emerald-400 transition-all" style={{ width: `${progress}%` }} />
      </div>

      {/* Controls */}
      <div className="flex items-center space-x-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onExpand}
          className="p-1.5 rounded-full text-gray-400 hover:text-white transition"
          title="Открыть плеер на весь экран"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <button
          onClick={togglePlay}
          className="p-1.5 rounded-full bg-emerald-500 text-white hover:bg-emerald-400 transition"
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="p-1.5 rounded-full text-gray-400 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
