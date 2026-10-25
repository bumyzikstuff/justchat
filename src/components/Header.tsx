import React from 'react';
import { User } from '../types';
import { Settings, Smartphone, Sparkles } from 'lucide-react';

interface HeaderProps {
  currentUser: User;
  onOpenProfile: () => void;
  onOpenInstallGuide: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onOpenProfile,
  onOpenInstallGuide
}) => {
  return (
    <header className="bg-[#17212b] border-b border-[#242f3d] px-3.5 py-2.5 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* User profile avatar & status emoji */}
      <div 
        onClick={onOpenProfile}
        className="flex items-center space-x-3 cursor-pointer group active:opacity-85 transition min-w-0"
      >
        <div className="relative flex-shrink-0">
          <img
            src={currentUser.avatar}
            alt={currentUser.nickname}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-[#2AABEE]/40 group-hover:ring-[#2AABEE] transition"
          />
          {/* Status Emoji badge */}
          {currentUser.statusEmoji && (
            <span 
              className="absolute -bottom-1 -right-1 text-xs bg-[#17212b] rounded-full px-0.5 shadow-md border border-[#242f3d]"
              title={`Статус: ${currentUser.statusText || 'В сети'}`}
            >
              {currentUser.statusEmoji}
            </span>
          )}
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center space-x-1.5">
            <span className="font-semibold text-sm text-gray-100 group-hover:text-[#2AABEE] transition truncate max-w-[140px]">
              {currentUser.nickname}
            </span>
            {currentUser.isVip && (
              <span
                className="text-[10px] bg-gradient-to-r from-amber-500/20 to-sky-500/20 border border-amber-400/40 text-amber-300 px-1.5 py-0.5 rounded-full font-bold flex items-center space-x-0.5 flex-shrink-0 shadow-sm"
                title="Создатель JustChat • Эксклюзивный VIP"
              >
                <Sparkles className="w-2.5 h-2.5 mr-0.5 text-amber-300" />
                VIP
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400 truncate max-w-[150px]">
            {currentUser.statusText || 'в сети'}
          </span>
        </div>
      </div>

      {/* Right actions: phone install guide & profile settings */}
      <div className="flex items-center space-x-0.5 flex-shrink-0">
        <button
          onClick={onOpenInstallGuide}
          className="p-2 rounded-full text-gray-400 hover:text-emerald-400 hover:bg-[#242f3d] transition active:scale-95"
          title="Как установить на iPhone и Android"
        >
          <Smartphone className="w-5 h-5" />
        </button>

        <button
          onClick={onOpenProfile}
          className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-[#242f3d] transition active:scale-95"
          title="Настройки профиля"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
