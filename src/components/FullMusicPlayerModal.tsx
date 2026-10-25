import React, { useState, useEffect, useRef } from 'react';
import { TrackInfo } from '../types';
import {
  Play,
  Pause,
  X,
  ChevronDown,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Download,
  Shuffle,
  Repeat,
  Music,
  Share2
} from 'lucide-react';

interface FullMusicPlayerModalProps {
  isOpen: boolean;
  currentTrack: TrackInfo | null;
  trackUrl: string | null;
  onClose: () => void;
  onMinimize: () => void;
}

export const FullMusicPlayerModal: React.FC<FullMusicPlayerModalProps> = ({
  isOpen,
  currentTrack,
  trackUrl,
  onClose,
  onMinimize
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (trackUrl && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.volume = volume;
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, [trackUrl]);

  if (!isOpen || !currentTrack || !trackUrl) return null;

  const togglePlay = () => {
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
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleSkip = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(
        Math.max(0, audioRef.current.currentTime + seconds),
        duration
      );
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audioRef.current.muted = nextMuted;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      setIsMuted(val === 0);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? `0${secs}` : secs}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col justify-between p-4 sm:p-8 select-none animate-in fade-in zoom-in-95 duration-200">
      <audio
        ref={audioRef}
        src={trackUrl}
        loop={isRepeat}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={() => {
          if (!isRepeat) setIsPlaying(false);
        }}
      />

      {/* Top Bar */}
      <div className="flex items-center justify-between text-gray-300">
        <button
          onClick={onMinimize}
          className="p-2.5 rounded-full hover:bg-white/10 hover:text-white transition active:scale-95"
          title="Свернуть плеер"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-center">
          <span className="text-[11px] uppercase tracking-widest text-[#2AABEE] font-bold">
            JustChat Music
          </span>
          <span className="text-xs text-gray-400">Сейчас играет</span>
        </div>

        <button
          onClick={onClose}
          className="p-2.5 rounded-full hover:bg-white/10 hover:text-white transition active:scale-95"
          title="Закрыть"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main Track Artwork with Glowing Vinyl Effect */}
      <div className="flex-1 flex flex-col items-center justify-center my-6">
        <div className="relative group">
          {/* Animated Glow Aura */}
          <div
            className={`absolute -inset-4 bg-gradient-to-r from-sky-500 to-emerald-500 rounded-3xl blur-2xl opacity-40 transition-all duration-700 ${
              isPlaying ? 'scale-105 opacity-60' : 'scale-95 opacity-20'
            }`}
          />

          {/* Album Cover Card */}
          <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-3xl overflow-hidden shadow-2xl border-2 border-white/10 bg-zinc-900 flex items-center justify-center">
            {currentTrack.coverUrl ? (
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                className={`w-full h-full object-cover transition-transform duration-700 ${
                  isPlaying ? 'scale-105' : 'scale-100'
                }`}
              />
            ) : (
              <div className="flex flex-col items-center text-white/50 space-y-3">
                <Music className="w-20 h-20 text-[#2AABEE]" />
                <span className="text-sm font-semibold">Аудиозапись</span>
              </div>
            )}
          </div>
        </div>

        {/* Title and Artist */}
        <div className="mt-8 text-center max-w-sm px-4">
          <h2 className="text-xl sm:text-2xl font-black text-white truncate drop-shadow">
            {currentTrack.title}
          </h2>
          <p className="text-sm sm:text-base font-medium text-gray-400 mt-1 truncate">
            {currentTrack.artist}
          </p>
        </div>
      </div>

      {/* Player Controls & Scrubber */}
      <div className="w-full max-w-md mx-auto space-y-4">
        {/* Seekbar Slider */}
        <div className="space-y-1.5">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#2AABEE]"
          />
          <div className="flex justify-between text-xs font-mono text-gray-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration || 165)}</span>
          </div>
        </div>

        {/* Action Buttons Row: Shuffle, -10s, Play/Pause, +10s, Repeat */}
        <div className="flex items-center justify-between px-2 pt-2">
          <button
            onClick={() => setIsShuffle(!isShuffle)}
            className={`p-2 rounded-full transition ${
              isShuffle ? 'text-[#2AABEE]' : 'text-gray-400 hover:text-white'
            }`}
            title="Перемешать"
          >
            <Shuffle className="w-5 h-5" />
          </button>

          <button
            onClick={() => handleSkip(-10)}
            className="p-2.5 rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition active:scale-95"
            title="Назад на 10 сек"
          >
            <RotateCcw className="w-6 h-6" />
          </button>

          {/* Central Play/Pause Big Button */}
          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-[#2AABEE] text-white flex items-center justify-center shadow-lg shadow-sky-500/40 hover:scale-105 active:scale-95 transition"
            title={isPlaying ? 'Пауза' : 'Играть'}
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 fill-current" />
            ) : (
              <Play className="w-8 h-8 fill-current ml-1" />
            )}
          </button>

          <button
            onClick={() => handleSkip(10)}
            className="p-2.5 rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition active:scale-95"
            title="Вперед на 10 сек"
          >
            <RotateCw className="w-6 h-6" />
          </button>

          <button
            onClick={() => setIsRepeat(!isRepeat)}
            className={`p-2 rounded-full transition ${
              isRepeat ? 'text-[#2AABEE]' : 'text-gray-400 hover:text-white'
            }`}
            title="Повтор трека"
          >
            <Repeat className="w-5 h-5" />
          </button>
        </div>

        {/* Volume & Download Row */}
        <div className="flex items-center space-x-3 pt-3 px-3 text-gray-400">
          <button onClick={toggleMute} className="hover:text-white transition">
            {isMuted || volume === 0 ? (
              <VolumeX className="w-5 h-5 text-rose-400" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#2AABEE]"
          />
          <a
            href={trackUrl}
            download
            className="p-2 rounded-full hover:bg-white/10 hover:text-white transition ml-2"
            title="Скачать трек"
          >
            <Download className="w-5 h-5" />
          </a>
        </div>
      </div>
    </div>
  );
};
