import React, { useEffect, useState } from 'react';
import { Story, StoryLike, StoryViewer } from '../types';
import { X, Heart, Eye, Trash2, Users, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { AudioHelper } from '../utils/audio';
import { formatStoryTime, getStoryTimestamp } from '../utils/storyHelper';

interface StoryViewerModalProps {
  story: Story | null;
  currentUserId?: string;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onToggleLike?: (storyId: string) => void;
  onDeleteStory?: (storyId: string) => void;
}

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  story,
  currentUserId = 'user-me',
  onClose,
  onNext,
  onPrev,
  onToggleLike,
  onDeleteStory
}) => {
  const [progress, setProgress] = useState(0);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [showViewsModal, setShowViewsModal] = useState(false);
  const [mediaError, setMediaError] = useState(false);

  const isOwnStory = story ? story.userId === currentUserId : false;
  const isLikedByMe = story?.likes?.some(l => l.id === currentUserId) || false;

  // Pause progress if modal or popover is open
  const isPaused = showLikesModal || showViewsModal;

  useEffect(() => {
    if (!story || isPaused) return;

    const duration = 6000; // 6 seconds per story
    const step = 50; // update every 50ms
    const increment = (step / duration) * 100;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          if (onNext) onNext();
          else onClose();
          return 100;
        }
        return prev + increment;
      });
    }, step);

    return () => clearInterval(interval);
  }, [story, isPaused, onNext, onClose]);

  // Reset progress & state when switching stories
  useEffect(() => {
    setProgress(0);
    setShowLikesModal(false);
    setShowViewsModal(false);
    setMediaError(false);
  }, [story?.id]);

  if (!story) return null;

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    AudioHelper.playPop(560, 0.06);

    if (!isLikedByMe) {
      confetti({
        particleCount: 45,
        spread: 65,
        origin: { y: 0.85 }
      });
    }

    if (onToggleLike) {
      onToggleLike(story.id);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Удалить эту историю без возможности восстановления?')) {
      if (onDeleteStory) {
        onDeleteStory(story.id);
      }
    }
  };

  const totalViews = Math.max(story.viewsCount || 0, story.viewers?.length || 1);
  const totalLikes = story.likes?.length || 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-0 md:p-4 backdrop-blur-md select-none">
      <div className="relative w-full h-full md:max-w-md md:h-[90vh] bg-black md:rounded-3xl overflow-hidden flex flex-col justify-between shadow-2xl">
        {/* Progress bar */}
        <div className="absolute top-3 left-3 right-3 z-30 flex space-x-1.5">
          <div className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white transition-all duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Top Header with Author info & Delete Button */}
        <div className="absolute top-6 left-3 right-3 z-30 flex items-center justify-between text-white drop-shadow-md">
          <div className="flex items-center space-x-2.5">
            <div className="relative">
              <img
                src={story.author.avatar}
                alt={story.author.nickname}
                className="w-10 h-10 rounded-full object-cover border-2 border-white/60 shadow"
              />
              <span className="absolute -bottom-1 -right-1 text-xs bg-black/70 rounded-full px-1 border border-white/20">
                {story.author.statusEmoji}
              </span>
            </div>
            <div>
              <div className="flex items-center space-x-1.5 font-semibold text-sm">
                <span>{story.author.nickname}</span>
                <span>{story.author.statusEmoji}</span>
                {story.author.isVip && (
                  <span className="text-[9px] bg-amber-500/30 text-amber-300 px-1.5 py-0.2 rounded-full border border-amber-400/40">VIP</span>
                )}
              </div>
              <span className="text-xs text-white/80 flex items-center space-x-1.5 font-medium">
                <span>{formatStoryTime(getStoryTimestamp(story))}</span>
                <span className="text-white/40">•</span>
                <span className="text-[10px] text-sky-300 bg-sky-500/20 px-1.5 py-0.2 rounded-full border border-sky-400/30">
                  24ч
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            {/* Delete button (only for own stories) */}
            {isOwnStory && onDeleteStory && (
              <button
                onClick={handleDelete}
                className="p-2 rounded-full bg-rose-500/30 hover:bg-rose-500/60 border border-rose-500/40 text-rose-300 hover:text-white transition active:scale-95 shadow"
                title="Удалить историю"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition active:scale-95"
              title="Закрыть"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Media content */}
        <div className="relative flex-1 flex items-center justify-center bg-zinc-950 overflow-hidden">
          {mediaError ? (
            <div className="flex flex-col items-center justify-center p-6 text-center text-white z-10 space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-2xl shadow-lg">
                ⚠️
              </div>
              <div>
                <p className="text-sm font-bold text-white">Не удалось загрузить медиа</p>
                <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">
                  Файл был поврежден или истек срок действия.
                </p>
              </div>
              {isOwnStory && onDeleteStory && (
                <button
                  onClick={handleDelete}
                  className="px-4 py-2.5 rounded-2xl bg-rose-500/25 hover:bg-rose-500/50 border border-rose-500/40 text-rose-300 hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition active:scale-95 shadow-md"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Удалить эту историю</span>
                </button>
              )}
            </div>
          ) : story.mediaType === 'video' ? (
            <video
              src={story.mediaUrl}
              autoPlay
              playsInline
              loop
              onError={() => setMediaError(true)}
              className="w-full h-full object-contain"
            />
          ) : (
            <img
              src={story.mediaUrl}
              alt={story.caption || 'История'}
              onError={() => setMediaError(true)}
              className="w-full h-full object-cover"
            />
          )}

          {/* Left / Right click navigation touch areas */}
          <div
            onClick={onPrev || onClose}
            className="absolute left-0 top-16 bottom-28 w-1/3 z-20 cursor-pointer"
          />
          <div
            onClick={onNext || onClose}
            className="absolute right-0 top-16 bottom-28 w-1/3 z-20 cursor-pointer"
          />
        </div>

        {/* Bottom bar with stats (Views & Likes) + Caption + Quick Reaction */}
        <div className="absolute bottom-4 left-3 right-3 z-30 flex flex-col space-y-2.5">
          {/* Caption */}
          {story.caption && (
            <div className="bg-black/60 backdrop-blur-md text-white text-sm px-4 py-2 rounded-2xl border border-white/10 text-center font-medium shadow">
              {story.caption}
            </div>
          )}

          {/* Controls: Views counter, Likes list trigger, and Like heart */}
          <div className="flex items-center justify-between space-x-2">
            {/* Views counter & viewers list trigger */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowViewsModal(true);
              }}
              className="bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full px-3 py-2 text-xs text-white/90 border border-white/20 flex items-center space-x-1.5 transition active:scale-95 shadow"
              title="Кто просмотрел"
            >
              <Eye className="w-4 h-4 text-sky-400" />
              <span className="font-bold">{totalViews}</span>
            </button>

            {/* Likes list trigger button (if there are likes) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowLikesModal(true);
              }}
              className="bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full px-3 py-2 text-xs text-white/90 border border-white/20 flex items-center space-x-1.5 transition active:scale-95 shadow"
              title="Список лайкнувших"
            >
              <Heart className={`w-4 h-4 ${totalLikes > 0 ? 'fill-rose-500 text-rose-500' : 'text-gray-300'}`} />
              <span className="font-bold">{totalLikes}</span>
              <span className="text-[11px] text-white/70">лайк{totalLikes === 1 ? '' : totalLikes < 5 ? 'а' : 'ов'}</span>
            </button>

            {/* Like Heart Action */}
            <button
              onClick={handleLike}
              className={`p-2.5 rounded-full backdrop-blur-md border transition active:scale-125 shadow-lg ${
                isLikedByMe
                  ? 'bg-rose-500 border-rose-400 text-white shadow-rose-500/30'
                  : 'bg-black/50 border-white/20 text-white hover:bg-black/70'
              }`}
              title={isLikedByMe ? 'Убрать лайк' : 'Поставить лайк'}
            >
              <Heart className={`w-5 h-5 ${isLikedByMe ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* Modal: Viewers List */}
        {showViewsModal && (
          <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex flex-col justify-end animate-in fade-in duration-150">
            <div className="bg-[#17212b] border-t border-[#242f3d] rounded-t-3xl max-h-[60%] flex flex-col p-4 shadow-2xl text-white">
              <div className="flex items-center justify-between pb-3 border-b border-[#242f3d]">
                <div className="flex items-center space-x-2 text-sm font-bold">
                  <Eye className="w-4 h-4 text-sky-400" />
                  <span>Просмотры истории ({totalViews})</span>
                </div>
                <button
                  onClick={() => setShowViewsModal(false)}
                  className="p-1 rounded-full text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto py-2 space-y-2 flex-1">
                {(story.viewers && story.viewers.length > 0) ? (
                  story.viewers.map((viewer) => (
                    <div key={viewer.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-[#242f3d]/50">
                      <div className="flex items-center space-x-2.5">
                        <img src={viewer.avatar} alt={viewer.name} className="w-8 h-8 rounded-full object-cover" />
                        <div>
                          <p className="text-xs font-semibold text-white">{viewer.name} {viewer.statusEmoji}</p>
                          <p className="text-[10px] text-gray-400">{viewer.viewedAt || 'Недавно'}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-gray-400">
                    История просмотрена {totalViews} раз
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal: Likes List */}
        {showLikesModal && (
          <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex flex-col justify-end animate-in fade-in duration-150">
            <div className="bg-[#17212b] border-t border-[#242f3d] rounded-t-3xl max-h-[60%] flex flex-col p-4 shadow-2xl text-white">
              <div className="flex items-center justify-between pb-3 border-b border-[#242f3d]">
                <div className="flex items-center space-x-2 text-sm font-bold text-rose-400">
                  <Heart className="w-4 h-4 fill-current" />
                  <span>Понравилось ({totalLikes})</span>
                </div>
                <button
                  onClick={() => setShowLikesModal(false)}
                  className="p-1 rounded-full text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto py-2 space-y-2 flex-1">
                {(story.likes && story.likes.length > 0) ? (
                  story.likes.map((liker) => (
                    <div key={liker.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-[#242f3d]/50">
                      <div className="flex items-center space-x-2.5">
                        <img src={liker.avatar} alt={liker.name} className="w-8 h-8 rounded-full object-cover" />
                        <div>
                          <p className="text-xs font-semibold text-white">{liker.name} {liker.statusEmoji}</p>
                          <p className="text-[10px] text-gray-400">{liker.likedAt || 'Недавно'}</p>
                        </div>
                      </div>
                      <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-gray-400">
                    Пока никто не поставил лайк. Будьте первыми! ❤️
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
