import React, { useState, useEffect } from 'react';
import { CAT_STICKERS } from '../data/mockData';
import { CatSticker, CustomSticker, StickerPack } from '../types';
import { X, Sparkles, Plus, Bot, Image as ImageIcon } from 'lucide-react';
import { getStoredStickerPacks } from '../services/stickerBot';

interface CatStickerPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSticker: (sticker: CatSticker) => void;
  onOpenStickerBot?: () => void;
}

export const CatStickerPicker: React.FC<CatStickerPickerProps> = ({
  isOpen,
  onClose,
  onSelectSticker,
  onOpenStickerBot
}) => {
  const [selectedCat, setSelectedCat] = useState<'all' | 'funny' | 'chill' | 'love' | 'rage'>('all');
  const [selectedPackId, setSelectedPackId] = useState<string>('cats');
  const [customPacks, setCustomPacks] = useState<StickerPack[]>([]);

  useEffect(() => {
    if (isOpen) {
      setCustomPacks(getStoredStickerPacks());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredCatStickers = selectedCat === 'all'
    ? CAT_STICKERS
    : CAT_STICKERS.filter(s => s.category === selectedCat);

  const activeCustomPack = customPacks.find(p => p.id === selectedPackId);

  return (
    <div className="absolute bottom-16 left-2 right-2 md:left-auto md:right-16 md:w-88 bg-[#17212b] border border-[#242f3d] rounded-2xl shadow-2xl p-3 z-40 select-none backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150 flex flex-col max-h-[380px]">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#242f3d] mb-2">
        <div className="flex items-center space-x-1.5 font-medium text-xs text-gray-200">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Стикеры</span>
        </div>

        <div className="flex items-center space-x-1">
          {/* Create Stickers Bot Button */}
          {onOpenStickerBot && (
            <button
              onClick={() => {
                onClose();
                onOpenStickerBot();
              }}
              className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-sky-500/20 to-purple-500/20 hover:from-sky-500/30 hover:to-purple-500/30 border border-sky-400/40 text-[11px] font-bold text-sky-300 hover:text-white flex items-center space-x-1 transition active:scale-95 shadow-sm"
              title="Создать свои стикеры через @stickerbot"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>@stickerbot</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-[#242f3d] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Pack Tabs */}
      <div className="flex items-center space-x-1 mb-2.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
        {/* Default Cats Pack Tab */}
        <button
          onClick={() => setSelectedPackId('cats')}
          className={`px-2.5 py-1 rounded-xl whitespace-nowrap transition flex items-center space-x-1 ${
            selectedPackId === 'cats'
              ? 'bg-[#2AABEE] text-white font-semibold shadow'
              : 'bg-[#242f3d] text-gray-300 hover:text-white'
          }`}
        >
          <span>🐱</span>
          <span>Котики</span>
        </button>

        {/* User's Custom Sticker Packs */}
        {customPacks.map((pack) => (
          <button
            key={pack.id}
            onClick={() => setSelectedPackId(pack.id)}
            className={`px-2.5 py-1 rounded-xl whitespace-nowrap transition flex items-center space-x-1 ${
              selectedPackId === pack.id
                ? 'bg-[#2AABEE] text-white font-semibold shadow'
                : 'bg-[#242f3d] text-gray-300 hover:text-white'
            }`}
          >
            <span>📦</span>
            <span className="truncate max-w-[80px]">{pack.name}</span>
            <span className="text-[10px] opacity-75">({pack.stickers.length})</span>
          </button>
        ))}

        {/* Plus tab button to open bot */}
        {onOpenStickerBot && (
          <button
            onClick={() => {
              onClose();
              onOpenStickerBot();
            }}
            className="px-2 py-1 rounded-xl bg-sky-500/15 border border-sky-400/30 text-sky-300 hover:bg-sky-500/25 transition text-[11px] font-semibold flex items-center space-x-1 whitespace-nowrap"
            title="Создать новый набор стикеров"
          >
            <Plus className="w-3 h-3 stroke-[3]" />
            <span>Новый</span>
          </button>
        )}
      </div>

      {/* Content for Built-in Cats Pack */}
      {selectedPackId === 'cats' ? (
        <>
          {/* Sub-category Pills */}
          <div className="flex space-x-1 mb-2.5 overflow-x-auto pb-1 text-[10px] no-scrollbar">
            {(['all', 'funny', 'chill', 'love', 'rage'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCat(cat)}
                className={`px-2 py-0.5 rounded-full capitalize transition ${
                  selectedCat === cat
                    ? 'bg-sky-500/30 text-sky-200 border border-sky-400/50 font-semibold'
                    : 'bg-[#0e1621] text-gray-400 hover:text-white'
                }`}
              >
                {cat === 'all' ? 'Все' : cat === 'funny' ? 'Ржака' : cat === 'chill' ? 'Чилл' : cat === 'love' ? 'Любовь' : 'Злость'}
              </button>
            ))}
          </div>

          {/* Stickers Grid */}
          <div className="grid grid-cols-3 gap-2 overflow-y-auto pr-1 flex-1">
            {filteredCatStickers.map((sticker) => (
              <div
                key={sticker.id}
                onClick={() => {
                  onSelectSticker(sticker);
                  onClose();
                }}
                className="flex flex-col items-center p-1.5 rounded-xl hover:bg-[#242f3d] cursor-pointer transition transform active:scale-90 group"
              >
                <img
                  src={sticker.url}
                  alt={sticker.title}
                  className="w-16 h-16 object-cover rounded-xl shadow-md group-hover:scale-105 transition"
                />
                <span className="text-[10px] text-gray-400 mt-1 truncate max-w-full text-center">
                  {sticker.title}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : activeCustomPack ? (
        /* Content for User Custom Pack */
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeCustomPack.stickers.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center space-y-2">
              <span className="text-3xl">🖼️</span>
              <p className="text-xs font-semibold text-gray-200">В наборе пока нет стикеров</p>
              <p className="text-[11px] text-gray-400 max-w-[200px]">
                Откройте @stickerbot и отправьте фото для добавления в «{activeCustomPack.name}»
              </p>
              {onOpenStickerBot && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenStickerBot();
                  }}
                  className="py-1.5 px-3 rounded-xl bg-[#2AABEE] text-white text-xs font-semibold shadow active:scale-95 transition"
                >
                  Добавить стикеры
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 overflow-y-auto pr-1 flex-1">
              {activeCustomPack.stickers.map((sticker) => (
                <div
                  key={sticker.id}
                  onClick={() => {
                    onSelectSticker({
                      id: sticker.id,
                      title: sticker.title || sticker.emoji,
                      url: sticker.url,
                      category: 'chill'
                    });
                    onClose();
                  }}
                  className="relative flex flex-col items-center p-1.5 rounded-xl hover:bg-[#242f3d] cursor-pointer transition transform active:scale-90 group"
                >
                  <img
                    src={sticker.url}
                    alt={sticker.emoji}
                    className="w-16 h-16 object-cover rounded-xl shadow-md group-hover:scale-105 transition"
                  />
                  <span className="absolute bottom-1 right-2 text-xs bg-black/60 rounded-full px-1 shadow">
                    {sticker.emoji}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Bottom Invite Banner (if user has 0 custom packs) */}
      {customPacks.length === 0 && onOpenStickerBot && (
        <div 
          onClick={() => {
            onClose();
            onOpenStickerBot();
          }}
          className="mt-2.5 p-2 rounded-xl bg-gradient-to-r from-sky-500/15 to-purple-500/15 border border-sky-500/30 hover:border-sky-400/60 cursor-pointer flex items-center justify-between text-xs text-sky-200 transition active:scale-95"
        >
          <div className="flex items-center space-x-2">
            <span className="text-base">🤖</span>
            <div>
              <p className="font-bold text-[11px] text-white">Создайте свои стикеры</p>
              <p className="text-[10px] text-gray-300">Из любых фото через @stickerbot</p>
            </div>
          </div>
          <span className="text-xs font-bold text-[#2AABEE]">Открыть ➔</span>
        </div>
      )}
    </div>
  );
};
