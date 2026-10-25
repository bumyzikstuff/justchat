import React, { useState } from 'react';
import { X, Smartphone, Apple, CheckCircle2, Share, PlusSquare, ArrowDownToLine } from 'lucide-react';

interface PwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PwaInstallModal: React.FC<PwaInstallModalProps> = ({
  isOpen,
  onClose
}) => {
  const [platform, setPlatform] = useState<'ios' | 'android'>('ios');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-[#17212b] border border-[#242f3d] rounded-3xl w-full max-w-md p-5 text-gray-100 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-[#242f3d] mb-4">
          <div className="flex items-center space-x-2">
            <Smartphone className="w-5 h-5 text-[#2AABEE]" />
            <h2 className="font-bold text-base">Установка на телефон</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-[#242f3d] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Platform Switcher */}
        <div className="flex bg-[#0e1621] p-1 rounded-2xl mb-5 border border-[#242f3d]">
          <button
            onClick={() => setPlatform('ios')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition ${
              platform === 'ios'
                ? 'bg-[#2AABEE] text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Apple className="w-4 h-4" />
            <span>iPhone (iOS)</span>
          </button>
          <button
            onClick={() => setPlatform('android')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition ${
              platform === 'android'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Android</span>
          </button>
        </div>

        {/* Content for iOS */}
        {platform === 'ios' ? (
          <div className="space-y-4 text-xs text-gray-300">
            <div className="bg-sky-500/10 border border-sky-500/30 rounded-2xl p-3 text-sky-200">
              💡 <strong>Никакого App Store!</strong> Открывается в полный экран, как настоящее нативное приложение, и поддерживает запись кружков.
            </div>

            <div className="space-y-3">
              <div className="flex items-start space-x-3 bg-[#0e1621] p-3 rounded-2xl border border-[#242f3d]">
                <div className="p-2 rounded-xl bg-sky-500/20 text-[#2AABEE]">
                  <Share className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-white mb-0.5">Шаг 1: Открой сайт в Safari</h4>
                  <p className="text-gray-400">Нажми на центральную кнопку «Поделиться» (квадрат со стрелкой вверх ⬆️) внизу экрана Safari.</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 bg-[#0e1621] p-3 rounded-2xl border border-[#242f3d]">
                <div className="p-2 rounded-xl bg-sky-500/20 text-[#2AABEE]">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-white mb-0.5">Шаг 2: На экран «Домой»</h4>
                  <p className="text-gray-400">Прокрути список вниз и выбери <strong>«На экран „Домой“» (Add to Home Screen)</strong>.</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 bg-[#0e1621] p-3 rounded-2xl border border-[#242f3d]">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-white mb-0.5">Шаг 3: Готово!</h4>
                  <p className="text-gray-400">Иконка мессенджера появится на рабочем столе твоего айфона. Открывай и общайся без рамок браузера!</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Content for Android */
          <div className="space-y-4 text-xs text-gray-300">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 text-emerald-200">
              ⚡ <strong>Два варианта установки на выбор:</strong>
            </div>

            <div className="space-y-3">
              <div className="bg-[#0e1621] p-3 rounded-2xl border border-[#242f3d]">
                <h4 className="font-bold text-white mb-1 flex items-center space-x-1.5">
                  <span>Вариант 1: В 1 клик через Chrome</span>
                </h4>
                <p className="text-gray-400 mb-2">Открой сайт в Google Chrome, нажми три точки в правом верхнем углу ➔ <strong>«Установить приложение»</strong>.</p>
              </div>

              <div className="bg-[#0e1621] p-3 rounded-2xl border border-[#242f3d]">
                <h4 className="font-bold text-white mb-1 flex items-center space-x-1.5">
                  <ArrowDownToLine className="w-4 h-4 text-emerald-400" />
                  <span>Вариант 2: Сборка готового .APK файла</span>
                </h4>
                <p className="text-gray-400 mb-2">
                  Мы подключили <strong>Capacitor</strong> — можно собрать готовый <code className="text-emerald-400">.apk</code> файл и скинуть друзьям файлом прямо в чат!
                </p>
                <div className="bg-black/40 p-2 rounded-xl font-mono text-[11px] text-gray-300">
                  npx cap add android<br />
                  npx cap build
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full py-3 rounded-2xl bg-[#2AABEE] text-white font-bold text-xs hover:bg-sky-400 transition"
        >
          Понял, спасибо!
        </button>
      </div>
    </div>
  );
};
