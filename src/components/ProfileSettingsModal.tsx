import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { AVAILABLE_EMOJIS } from '../data/mockData';
import { X, Sparkles, Check, Copy, Shield, LogOut, KeyRound, Link as LinkIcon, Camera, Upload, Bell, Volume2, VolumeX, Smartphone, CheckCircle2, Cloud, Database, EyeOff } from 'lucide-react';
import confetti from 'canvas-confetti';
import { AudioHelper } from '../utils/audio';
import { getSupabaseConfig, resetSupabaseClient } from '../services/supabase';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80'
];

interface ProfileSettingsModalProps {
  isOpen: boolean;
  currentUser: User;
  inviteCode: string;
  onUpdateInviteCode: (newCode: string) => void;
  onClose: () => void;
  onSaveProfile: (updated: Partial<User>) => void;
  onOpenInstallGuide: () => void;
  onLogout: () => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  isOpen,
  currentUser,
  inviteCode,
  onUpdateInviteCode,
  onClose,
  onSaveProfile,
  onOpenInstallGuide,
  onLogout
}) => {
  const [nickname, setNickname] = useState(currentUser.nickname);
  const [username, setUsername] = useState(currentUser.username || 'bublik');
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [statusEmoji, setStatusEmoji] = useState(currentUser.statusEmoji);
  const [statusText, setStatusText] = useState(currentUser.statusText || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [hideLastSeen, setHideLastSeen] = useState<boolean>(currentUser.hideLastSeen ?? (currentUser.isVip ?? true));
  const [currentCode, setCurrentCode] = useState(inviteCode);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Supabase cloud settings
  const [supabaseUrl, setSupabaseUrl] = useState(() => localStorage.getItem('just_supabase_url') || import.meta.env.VITE_SUPABASE_URL || '');
  const [supabaseKey, setSupabaseKey] = useState(() => localStorage.getItem('just_supabase_anon_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '');
  const [isSupabaseSaved, setIsSupabaseSaved] = useState(false);
  const isSupabaseActive = Boolean(supabaseUrl && supabaseKey);

  const handleSaveSupabase = () => {
    localStorage.setItem('just_supabase_url', supabaseUrl.trim());
    localStorage.setItem('just_supabase_anon_key', supabaseKey.trim());
    resetSupabaseClient();
    setIsSupabaseSaved(true);
    AudioHelper.playSentSound();
    setTimeout(() => setIsSupabaseSaved(false), 2500);
  };

  // Notification settings
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('just_notif_sound') !== 'false';
  });
  const [vibrateEnabled, setVibrateEnabled] = useState<boolean>(() => {
    return localStorage.getItem('just_notif_vibrate') !== 'false';
  });
  const [pushStatus, setPushStatus] = useState<NotificationPermission>(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';
  });

  const requestPush = async () => {
    if ('Notification' in window) {
      try {
        const res = await Notification.requestPermission();
        setPushStatus(res);
        if (res === 'granted') {
          AudioHelper.playSentSound();
          new Notification('JustChat 💬', {
            body: 'Уведомления успешно включены!',
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%232AABEE"/><text x="50" y="65" font-size="50" text-anchor="middle" fill="white">💬</text></svg>'
          });
        }
      } catch (e) {
        console.warn('Push permission error:', e);
      }
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (typeof event.target?.result === 'string') {
          setAvatar(event.target.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveProfile({
      nickname,
      username: username.replace(/^@/, '').toLowerCase().trim(),
      avatar,
      statusEmoji,
      statusText,
      bio,
      hideLastSeen
    });
    localStorage.setItem('just_notif_sound', String(soundEnabled));
    localStorage.setItem('just_notif_vibrate', String(vibrateEnabled));
    if (currentCode.trim()) {
      onUpdateInviteCode(currentCode.trim().toUpperCase());
    }
    confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.6 }
    });
    onClose();
  };

  const handleCopyInvite = () => {
    navigator.clipboard?.writeText(currentCode);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const handleCopyInviteLink = () => {
    const url = `${window.location.origin}/?invite=${encodeURIComponent(currentCode)}`;
    navigator.clipboard?.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-[#17212b] border border-[#242f3d] rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 text-gray-100 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#242f3d] mb-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-[#2AABEE]" />
            <h2 className="font-bold text-base">Настройки профиля</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-[#242f3d] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden File Input for Avatar */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleAvatarFile}
          className="hidden"
        />

        {/* Live Profile Card Preview with clickable avatar */}
        <div className="bg-[#0e1621] border border-[#242f3d] rounded-2xl p-4 flex items-center space-x-3.5 mb-4 shadow-inner">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="relative cursor-pointer group flex-shrink-0"
            title="Нажмите, чтобы сменить фото"
          >
            <img
              src={avatar}
              alt="Avatar"
              className="w-16 h-16 rounded-full object-cover ring-2 ring-[#2AABEE] group-hover:opacity-75 transition"
            />
            {/* Camera overlay icon */}
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <span className="absolute -bottom-1 -right-1 text-base bg-[#17212b] rounded-full px-0.5 border border-[#242f3d]">
              {statusEmoji}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1.5 font-bold text-sm text-white">
              <span className="truncate">{nickname || 'Твой никнейм'}</span>
              <span>{statusEmoji}</span>
            </div>
            <p className="text-xs text-[#2AABEE] truncate">{statusText || 'Без статуса'}</p>
            <p className="text-[11px] text-gray-400 truncate mt-0.5">{bio || 'Нет описания'}</p>
          </div>
        </div>

        {/* PHOTO UPLOAD & PRESETS */}
        <div className="mb-4 bg-[#0e1621] p-3 rounded-2xl border border-[#242f3d]">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center space-x-1">
              <span>Фото профиля</span>
            </label>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-[#2AABEE] font-semibold hover:underline flex items-center space-x-1"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Загрузить своё фото</span>
            </button>
          </div>

          {/* Quick preset avatars */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1">
            {PRESET_AVATARS.map((presetUrl, idx) => (
              <img
                key={idx}
                src={presetUrl}
                alt={`Preset ${idx}`}
                onClick={() => setAvatar(presetUrl)}
                className={`w-10 h-10 rounded-full object-cover cursor-pointer hover:scale-110 transition flex-shrink-0 ${
                  avatar === presetUrl ? 'ring-2 ring-[#2AABEE] scale-105' : 'opacity-70 hover:opacity-100'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Nickname input */}
        <div className="mb-3">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
            Твой никнейм
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full bg-[#0e1621] border border-[#242f3d] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#2AABEE]"
            placeholder="Введи ник"
          />
        </div>

        {/* Username (@username) input */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>Юзернейм для поиска (@)</span>
            <span className="text-[10px] text-[#2AABEE]">Для поиска друзей</span>
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-2.5 text-sky-400 font-mono font-bold text-sm">@</span>
            <input
              type="text"
              value={username.replace(/^@/, '')}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              className="w-full bg-[#0e1621] border border-[#242f3d] rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-sky-300 font-mono outline-none focus:border-[#2AABEE]"
              placeholder="username"
            />
          </div>
        </div>

        {/* STATUS EMOJI PICKER */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center space-x-1">
              <span>Эмодзи-статус</span>
            </label>
            <span className="text-xs text-[#2AABEE] font-medium">Выбран: {statusEmoji}</span>
          </div>
          <div className="grid grid-cols-8 gap-1.5 bg-[#0e1621] p-2.5 rounded-2xl border border-[#242f3d]">
            {AVAILABLE_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setStatusEmoji(emoji)}
                className={`text-xl p-1.5 rounded-xl hover:bg-[#242f3d] transition transform active:scale-90 flex items-center justify-center ${
                  statusEmoji === emoji ? 'bg-[#2AABEE]/25 ring-2 ring-[#2AABEE]' : ''
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Status text input */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
            Текст статуса
          </label>
          <input
            type="text"
            value={statusText}
            onChange={(e) => setStatusText(e.target.value)}
            className="w-full bg-[#0e1621] border border-[#242f3d] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#2AABEE]"
            placeholder="Например: на чилле 🤙 / слушаю фонк"
          />
        </div>

        {/* Bio input */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
            О себе (Био)
          </label>
          <textarea
            rows={2}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full bg-[#0e1621] border border-[#242f3d] rounded-xl px-3.5 py-2 text-sm text-white outline-none focus:border-[#2AABEE] resize-none"
            placeholder="Расскажи пару слов о себе..."
          />
        </div>

        {/* NOTIFICATIONS SETTINGS */}
        <div className="bg-[#0e1621] border border-[#242f3d] rounded-2xl p-4 mb-4 space-y-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-white">
            <Bell className="w-4 h-4 text-[#2AABEE]" />
            <span>Уведомления и звуки</span>
          </div>

          <div className="space-y-2.5 pt-1">
            {/* Sound toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-gray-500" />}
                <span className="text-xs text-gray-200">Звук сообщений</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !soundEnabled;
                  setSoundEnabled(next);
                  if (next) AudioHelper.playSentSound();
                }}
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  soundEnabled ? 'bg-[#2AABEE]' : 'bg-gray-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                    soundEnabled ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Vibrate toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Smartphone className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-gray-200">Вибрация на телефоне</span>
              </div>
              <button
                type="button"
                onClick={() => setVibrateEnabled(!vibrateEnabled)}
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  vibrateEnabled ? 'bg-[#2AABEE]' : 'bg-gray-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                    vibrateEnabled ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Push Notifications permission button */}
            <div className="pt-1 border-t border-[#242f3d]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white">Системные Push-уведомления</p>
                  <p className="text-[10px] text-gray-400">
                    {pushStatus === 'granted'
                      ? 'Включены для этого устройства'
                      : pushStatus === 'denied'
                      ? 'Заблокированы в настройках браузера'
                      : 'Показывать пуши, когда приложение свернуто'}
                  </p>
                </div>

                {pushStatus === 'granted' ? (
                  <span className="text-[11px] text-emerald-400 font-semibold flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Активны</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={requestPush}
                    className="py-1 px-2.5 rounded-xl bg-[#2AABEE]/20 hover:bg-[#2AABEE]/30 text-[#2AABEE] text-xs font-semibold border border-sky-500/30 transition active:scale-95"
                  >
                    Включить
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* PRIVACY & GHOST MODE (НЕВИДИМКА) BOX */}
        <div className="bg-[#0e1621] border border-purple-500/30 rounded-2xl p-4 mb-5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-purple-300 text-xs font-bold">
              <EyeOff className="w-4 h-4" />
              <span>Приватность и время захода</span>
            </div>
            {currentUser.isVip && (
              <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-bold">
                VIP фича
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="pr-2">
              <p className="text-xs font-semibold text-white">Режим невидимки (Ghost Mode)</p>
              <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">
                Показывать собеседникам статус <b className="text-purple-300">«был(а) недавно»</b> вместо точного времени захода
              </p>
            </div>
            <button
              type="button"
              onClick={() => setHideLastSeen(!hideLastSeen)}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                hideLastSeen ? 'bg-purple-600' : 'bg-gray-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  hideLastSeen ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* INVITE CODE MANAGEMENT BOX */}
        <div className="bg-[#0e1621] border border-amber-500/40 rounded-2xl p-4 mb-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-amber-400 text-xs font-bold">
              <KeyRound className="w-4 h-4" />
              <span>Секретный код для входа друзей</span>
            </div>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-mono">
              Только для своих
            </span>
          </div>

          <p className="text-xs text-gray-300 leading-relaxed">
            Когда твой друг впервые открывает мессенджер, система требует этот код. Без него посторонний человек не сможет войти.
          </p>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={currentCode}
              onChange={(e) => setCurrentCode(e.target.value.toUpperCase())}
              className="flex-1 bg-[#17212b] border border-[#242f3d] text-amber-300 font-mono font-bold tracking-widest text-center py-2 px-3 rounded-xl uppercase text-sm outline-none focus:border-amber-400"
              placeholder="КОД"
            />
            <button
              onClick={handleCopyInvite}
              className="px-3 py-2 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-medium flex items-center space-x-1 transition active:scale-95"
              title="Скопировать код"
            >
              {copiedInvite ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedInvite ? 'Скопирован' : 'Код'}</span>
            </button>
            <button
              onClick={handleCopyInviteLink}
              className="px-3 py-2 rounded-xl bg-[#2AABEE]/20 text-sky-300 hover:bg-[#2AABEE]/30 border border-sky-500/40 text-xs font-medium flex items-center space-x-1 transition active:scale-95"
              title="Скопировать ссылку-приглашение"
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
              <span>{copiedLink ? 'Ссылка!' : 'Ссылка'}</span>
            </button>
          </div>

          <div className="pt-2 border-t border-[#242f3d] flex items-center space-x-1.5 text-[11px] text-emerald-400 font-medium">
            <Shield className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Сквозное E2EE шифрование (AES-256): активно для всех сообщений.</span>
          </div>
        </div>

        {/* SUPABASE REALTIME CLOUD BACKEND BOX */}
        <div className="bg-[#0e1621] border border-sky-500/40 rounded-2xl p-4 mb-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-[#2AABEE] text-xs font-bold">
              <Cloud className="w-4 h-4" />
              <span>Облачная синхронизация (Supabase Realtime)</span>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center space-x-1 ${
                isSupabaseActive
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-gray-700/40 text-gray-400'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isSupabaseActive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
              <span>{isSupabaseActive ? 'Realtime Активен' : 'Офлайн режим'}</span>
            </span>
          </div>

          <p className="text-xs text-gray-300 leading-relaxed">
            Подключите бесплатный сервер Supabase, чтобы кружочки, сообщения, реакции и статусы синхронизировались между устройствами всех друзей вживую.
          </p>

          <div className="space-y-2">
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Project URL
              </label>
              <input
                type="text"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                placeholder="https://xyzcompany.supabase.co"
                className="w-full bg-[#17212b] border border-[#242f3d] text-white text-xs px-3 py-2 rounded-xl outline-none focus:border-[#2AABEE]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Anon Public Key
              </label>
              <input
                type="password"
                value={supabaseKey}
                onChange={(e) => setSupabaseKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full bg-[#17212b] border border-[#242f3d] text-white text-xs px-3 py-2 rounded-xl outline-none focus:border-[#2AABEE]"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <a
                href="https://supabase.com"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[#2AABEE] hover:underline flex items-center space-x-1"
              >
                <span>Получить ключи на supabase.com (бесплатно)</span>
              </a>

              <button
                type="button"
                onClick={handleSaveSupabase}
                className="py-1.5 px-3.5 rounded-xl bg-[#2AABEE] hover:bg-sky-400 text-white text-xs font-semibold flex items-center space-x-1 transition active:scale-95 shadow-md shadow-sky-500/20"
              >
                {isSupabaseSaved ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Database className="w-3.5 h-3.5" />}
                <span>{isSupabaseSaved ? 'Подключено!' : 'Сохранить'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Install on phone CTA */}
        <div className="mb-4">
          <button
            onClick={() => {
              onClose();
              onOpenInstallGuide();
            }}
            className="w-full py-2.5 px-4 bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 rounded-xl text-xs font-semibold hover:bg-emerald-600/30 transition text-center"
          >
            📲 Как установить на iPhone и Android
          </button>
        </div>

        {/* Test Login Screen / Logout */}
        <div className="mb-5">
          <button
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="w-full py-2 px-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-semibold hover:bg-rose-500/20 transition flex items-center justify-center space-x-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Проверить экран входа по коду (Выйти)</span>
          </button>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          className="w-full py-3 rounded-2xl bg-[#2AABEE] text-white font-bold text-sm hover:bg-sky-400 transition shadow-lg shadow-sky-500/25 active:scale-98 flex items-center justify-center space-x-2"
        >
          <Check className="w-4 h-4 stroke-[3]" />
          <span>Сохранить настройки</span>
        </button>
      </div>
    </div>
  );
};
