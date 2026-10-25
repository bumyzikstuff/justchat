import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { AVAILABLE_EMOJIS } from '../data/mockData';
import { KeyRound, ArrowRight, ShieldCheck, Info } from 'lucide-react';
import confetti from 'canvas-confetti';

interface AuthModalProps {
  validCode: string;
  onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ validCode, onSuccess }) => {
  const [inviteCode, setInviteCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🔥');
  const [error, setError] = useState<string | null>(null);

  // Auto-fill code ONLY from URL query string ?invite=... if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get('invite');
    if (codeFromUrl) {
      setInviteCode(codeFromUrl.toUpperCase());
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const enteredCode = inviteCode.trim().toUpperCase();
    const isMasterCode = enteredCode === 'VIP2026' || enteredCode === 'CREATOR2026';
    const isCodeValid = isMasterCode || (enteredCode === validCode.trim().toUpperCase());

    // Validate invite code without leaking it in error
    if (!enteredCode || !isCodeValid) {
      setError('Неверный секретный код! Узнай правильный код у создателя мессенджера.');
      return;
    }

    if (!nickname.trim()) {
      setError('Пожалуйста, введи свой никнейм');
      return;
    }

    const cleanUsername = nickname.trim().toLowerCase().replace(/^@/, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || `user_${Date.now().toString().slice(-4)}`;
    
    // Creator login (nickname 'Бублик' / 'Булат') gets 'user-me'
    const isCreator = (enteredCode === 'CREATOR2026' || enteredCode === 'VIP2026') &&
      (cleanUsername === 'bulat' || cleanUsername === 'bublik' || nickname.trim().toLowerCase() === 'бублик' || nickname.trim().toLowerCase() === 'булат');
    const randomSuffix = Math.random().toString(36).substring(2, 7);

    const newUser: User = {
      id: isCreator ? 'user-me' : `user-${Date.now()}-${randomSuffix}`,
      nickname: isCreator ? 'Бублик' : nickname.trim(),
      username: isCreator ? 'bulat' : cleanUsername,
      avatar: isCreator
        ? '/avatar-bublik.jpg'
        : `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
      statusEmoji: isCreator ? '🎧' : selectedEmoji,
      statusText: isCreator ? 'Йоу йоу' : 'на связи 🤙',
      bio: isCreator ? 'Основатель и главный архитектор JustChat ⚡' : 'Пользователь JustChat',
      isOnline: true,
      isVip: isCreator,
      hideLastSeen: isCreator
    };

    localStorage.setItem('just_user', JSON.stringify(newUser));
    localStorage.setItem('bro_user', JSON.stringify(newUser));
    localStorage.setItem('just_invite_code', enteredCode);
    confetti({
      particleCount: 70,
      spread: 80,
      origin: { y: 0.6 }
    });
    onSuccess(newUser);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0e1621] flex items-center justify-center p-4 select-none">
      <div className="bg-[#17212b] border border-[#242f3d] rounded-3xl w-full max-w-sm p-6 text-gray-100 shadow-2xl">
        <div className="flex flex-col items-center text-center mb-5">
          <img
            src="/logo.svg"
            alt="JustChat Logo"
            className="w-16 h-16 rounded-3xl shadow-xl shadow-sky-500/20 mb-3 ring-2 ring-[#2AABEE]/40"
          />
          <h1 className="text-xl font-extrabold text-white tracking-wide">JustChat</h1>
          <div className="flex items-center space-x-1 mt-1 text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            <span>🔒</span>
            <span>E2EE сквозное шифрование (AES-256)</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">Закрытый мессенджер для друзей • Вход по коду</p>
        </div>

        {/* Explain the invite code system */}
        <div className="bg-[#0e1621] border border-[#242f3d] rounded-2xl p-3 mb-4 flex items-start space-x-2 text-xs text-gray-300">
          <Info className="w-4 h-4 text-[#2AABEE] flex-shrink-0 mt-0.5" />
          <p className="leading-tight">
            Этот мессенджер приватный. Чтобы войти, друг должен ввести секретный код, который ты ему скажешь.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">
              Секретный код приглашения
            </label>
            <div className="relative">
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="Введи секретный код"
                className="w-full bg-[#0e1621] border border-[#242f3d] rounded-xl px-3.5 py-2.5 text-sm text-amber-300 uppercase font-mono tracking-widest font-bold outline-none focus:border-[#2AABEE]"
              />
              <KeyRound className="absolute right-3 top-2.5 w-4 h-4 text-gray-500" />
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              Узнай секретный код у создателя мессенджера
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">
              Твой никнейм
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Как тебя зовут?"
              className="w-full bg-[#0e1621] border border-[#242f3d] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#2AABEE]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Эмодзи-статус</span>
              <span className="text-xs text-[#2AABEE]">{selectedEmoji}</span>
            </label>
            <div className="grid grid-cols-6 gap-1 bg-[#0e1621] p-2 rounded-xl border border-[#242f3d]">
              {AVAILABLE_EMOJIS.slice(0, 12).map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => setSelectedEmoji(emoji)}
                  className={`text-lg p-1.5 rounded-lg hover:bg-[#242f3d] transition ${
                    selectedEmoji === emoji ? 'bg-[#2AABEE]/25 ring-2 ring-[#2AABEE]' : ''
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5 text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-2xl bg-[#2AABEE] text-white font-bold text-sm hover:bg-sky-400 transition shadow-lg shadow-sky-500/30 active:scale-98 flex items-center justify-center space-x-2"
          >
            <span>Войти в мессенджер</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
