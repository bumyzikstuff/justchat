import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  private handleRecover = () => {
    try {
      localStorage.removeItem('just_stickerbot_session');
    } catch (e) {}
    window.location.reload();
  };

  private handleFullReset = () => {
    try {
      localStorage.removeItem('just_messages');
      localStorage.removeItem('just_stickerbot_session');
      localStorage.removeItem('just_sticker_packs');
    } catch (e) {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-[#0e1621] p-6 text-center text-white select-none">
          <div className="bg-[#17212b] border border-[#242f3d] rounded-3xl p-6 max-w-sm flex flex-col items-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="w-16 h-16 rounded-3xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-3xl shadow-lg">
              ⚠️
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Произошла ошибка</h2>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                При обработке данных возник сбой. Нажмите кнопку ниже, чтобы перезапустить JustChat.
              </p>
              {this.state.error?.message && (
                <div className="mt-2 text-left bg-black/40 rounded-xl p-2.5 text-[11px] text-rose-300 font-mono break-all max-h-24 overflow-y-auto border border-rose-500/20">
                  {this.state.error.message}
                </div>
              )}
            </div>
            <div className="w-full space-y-2 pt-2">
              <button
                type="button"
                onClick={this.handleRecover}
                className="w-full py-2.5 px-4 bg-[#2AABEE] hover:bg-sky-400 text-white font-semibold text-xs rounded-xl shadow-md transition active:scale-95"
              >
                Перезапустить мессенджер
              </button>
              <button
                type="button"
                onClick={this.handleFullReset}
                className="w-full py-2 px-3 bg-[#242f3d]/60 hover:bg-[#242f3d] text-gray-400 hover:text-rose-400 text-[11px] rounded-xl transition"
              >
                Очистить кэш сообщений и стикеров
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
