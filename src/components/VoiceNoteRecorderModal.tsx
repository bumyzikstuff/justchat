import React, { useState, useEffect, useRef } from 'react';
import { Mic, X, Check, Trash2, Loader2 } from 'lucide-react';
import { AudioHelper } from '../utils/audio';
import { uploadMediaToSupabase, blobToDataUrl } from '../services/supabase';

interface VoiceNoteRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendVoiceNote: (audioUrl: string, duration: number, waveform: number[]) => void;
}

const getSupportedAudioMime = (): string => {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/ogg'
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
};

export const VoiceNoteRecorderModal: React.FC<VoiceNoteRecorderModalProps> = ({
  isOpen,
  onClose,
  onSendVoiceNote
}) => {
  const [seconds, setSeconds] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [waveform, setWaveform] = useState<number[]>([30, 50, 80, 40, 90, 60, 30, 70, 45, 85, 30, 95]);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    setSeconds(0);
    setIsUploading(false);
    chunksRef.current = [];
    AudioHelper.playRecordStart();

    async function startMic() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaStreamRef.current = stream;

          const mimeType = getSupportedAudioMime();
          const options = mimeType ? { mimeType } : undefined;
          const recorder = new MediaRecorder(stream, options);
          mediaRecorderRef.current = recorder;

          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
          };

          recorder.start(200);
        }
      } catch (e) {
        console.warn('Microphone access:', e);
      }
    }

    startMic();

    const timer = setInterval(() => {
      setSeconds(prev => prev + 1);
      // Randomize waveform bars for live animation
      setWaveform(Array.from({ length: 16 }, () => Math.floor(Math.random() * 70) + 20));
    }, 500);

    return () => {
      clearInterval(timer);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [isOpen]);

  const handleFinish = () => {
    AudioHelper.playRecordEnd();
    const finalWaveform = Array.from({ length: 24 }, () => Math.floor(Math.random() * 80) + 20);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      setIsUploading(true);
      mediaRecorderRef.current.onstop = async () => {
        try {
          const mime = mediaRecorderRef.current?.mimeType || 'audio/webm';
          const ext = mime.includes('mp4') ? 'mp4' : mime.includes('aac') ? 'aac' : 'webm';
          const blob = new Blob(chunksRef.current, { type: mime });

          let finalUrl: string | null = null;
          try {
            finalUrl = await uploadMediaToSupabase(blob, `voice_${Date.now()}.${ext}`, mime);
          } catch (e) {
            console.warn('Upload voice note error:', e);
          }

          if (!finalUrl) {
            finalUrl = await blobToDataUrl(blob);
          }

          if (finalUrl) {
            onSendVoiceNote(finalUrl, seconds || 1, finalWaveform);
          }
        } finally {
          setIsUploading(false);
          onClose();
        }
      };
      mediaRecorderRef.current.stop();
    } else {
      // Mock audio
      const mockAudioUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3';
      onSendVoiceNote(mockAudioUrl, seconds || 2, finalWaveform);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[#17212b] border border-[#242f3d] w-full max-w-sm rounded-3xl p-6 flex flex-col items-center shadow-2xl text-center">
        {/* Pulsing Mic Circle */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full bg-rose-500/20 flex items-center justify-center animate-pulse">
            <div className="w-14 h-14 rounded-full bg-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/40 text-white">
              <Mic className="w-7 h-7" />
            </div>
          </div>
        </div>

        {/* Live Timer */}
        <div className="font-mono text-2xl font-bold text-white mb-2">
          0:{seconds < 10 ? `0${seconds}` : seconds}
        </div>
        <p className="text-xs text-gray-400 mb-6">
          {isUploading ? 'Отправка в облако...' : 'Запись голосового сообщения...'}
        </p>

        {/* Animated Waveform Bars */}
        <div className="flex items-center justify-center space-x-1 h-12 w-full px-4 mb-8 bg-[#0e1621] rounded-2xl py-2">
          {waveform.map((height, i) => (
            <div
              key={i}
              className="w-1.5 bg-[#2AABEE] rounded-full transition-all duration-300"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-6 w-full justify-center">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="flex-1 py-3 px-4 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 transition flex items-center justify-center space-x-2 text-xs font-semibold disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>Отмена</span>
          </button>

          <button
            onClick={handleFinish}
            disabled={isUploading}
            className="flex-1 py-3 px-4 rounded-xl bg-[#2AABEE] text-white hover:bg-sky-400 transition flex items-center justify-center space-x-2 text-xs font-semibold shadow-lg shadow-sky-500/20 disabled:opacity-75"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Отправка...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Отправить</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
