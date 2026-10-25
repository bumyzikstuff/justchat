import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Camera, RefreshCw, Loader2 } from 'lucide-react';
import { AudioHelper } from '../utils/audio';
import { uploadMediaToSupabase, blobToDataUrl } from '../services/supabase';

interface VideoNoteRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendVideoNote: (blob: Blob, localUrl: string, duration: number) => void;
}

const getSupportedVideoMime = (): string => {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4;codecs=avc1,mp4a',
    'video/mp4'
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
};

export const VideoNoteRecorderModal: React.FC<VideoNoteRecorderModalProps> = ({
  isOpen,
  onClose,
  onSendVideoNote
}) => {
  const [seconds, setSeconds] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const hasFinishedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleFinish = () => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    setIsRecording(false);
    clearTimer();
    AudioHelper.playRecordEnd();

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        try {
          const mime = recorder.mimeType || 'video/webm';
          const blob = new Blob(chunksRef.current, { type: mime });
          const localUrl = URL.createObjectURL(blob);
          onSendVideoNote(blob, localUrl, seconds || 1);
        } catch (e) {
          console.warn('Process video note error:', e);
        }
        cleanupStream();
        onClose();
      };
      try {
        recorder.stop();
      } catch (e) {
        onClose();
      }
    } else {
      // Fallback sample circular video note
      const fallbackUrl = 'https://assets.mixkit.co/videos/preview/mixkit-young-man-exercising-in-a-gym-42616-large.mp4';
      const mockBlob = new Blob([], { type: 'video/mp4' });
      onSendVideoNote(mockBlob, fallbackUrl, seconds || 3);
      cleanupStream();
      onClose();
    }
  };

  const cleanupStream = () => {
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      } catch (e) {}
      mediaStreamRef.current = null;
    }
  };

  const handleCancel = () => {
    hasFinishedRef.current = true;
    setIsRecording(false);
    clearTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    cleanupStream();
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    hasFinishedRef.current = false;
    setSeconds(0);
    setIsRecording(false);
    setIsUploading(false);
    chunksRef.current = [];

    async function startCamera() {
      try {
        setCameraError(null);
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode, width: { ideal: 480 }, height: { ideal: 480 } },
            audio: true
          });
          if (!isMounted) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          mediaStreamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }

          // Start recorder with optimized bitrates for fast sending & high quality
          const mimeType = getSupportedVideoMime();
          const options: MediaRecorderOptions = {
            ...(mimeType ? { mimeType } : {}),
            videoBitsPerSecond: 600000,
            audioBitsPerSecond: 64000
          };
          const recorder = new MediaRecorder(stream, options);
          mediaRecorderRef.current = recorder;

          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              chunksRef.current.push(e.data);
            }
          };

          recorder.start(150);
          if (isMounted) {
            setIsRecording(true);
            AudioHelper.playRecordStart();
          }
        } else {
          if (isMounted) {
            setCameraError('Камера недоступна в этом браузере');
            setIsRecording(true);
          }
        }
      } catch (err: unknown) {
        console.warn('Camera access issue:', err);
        if (isMounted) {
          setCameraError('Разрешите доступ к камере или используется демо-режим');
          setIsRecording(true);
        }
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      clearTimer();
      cleanupStream();
    };
  }, [isOpen, facingMode]);

  // Timer tick (pure state increment, capped at 60s)
  useEffect(() => {
    if (!isOpen || !isRecording) {
      clearTimer();
      return;
    }

    timerRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev >= 59) {
          clearTimer();
          setTimeout(() => handleFinish(), 0);
          return 60;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearTimer();
  }, [isOpen, isRecording]);

  if (!isOpen) return null;

  const maxSeconds = 60;
  const progressRatio = seconds / maxSeconds;
  const circumference = 2 * Math.PI * 135;
  const strokeDashoffset = circumference - progressRatio * circumference;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4 select-none">
      <div className="relative flex flex-col items-center">
        {/* Circular viewfinder with SVG timer ring */}
        <div className="relative w-72 h-72 flex items-center justify-center">
          {/* SVG Progress Circle */}
          <svg className="absolute w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 300 300">
            <circle
              cx="150"
              cy="150"
              r="135"
              fill="none"
              stroke="#242f3d"
              strokeWidth="6"
            />
            <circle
              cx="150"
              cy="150"
              r="135"
              fill="none"
              stroke="#2AABEE"
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          </svg>

          {/* Circular Camera Preview Video */}
          <div className="w-64 h-64 rounded-full overflow-hidden bg-zinc-900 border-4 border-[#17212b] shadow-2xl relative">
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              className="w-full h-full object-cover transform -scale-x-100"
            />

            {/* Error or Demo overlay message */}
            {cameraError && (
              <div className="absolute inset-0 bg-zinc-900/90 p-4 flex flex-col items-center justify-center text-center text-xs text-amber-300">
                <Camera className="w-8 h-8 mb-2 text-[#2AABEE]" />
                <p>{cameraError}</p>
                <p className="text-[10px] text-gray-400 mt-1">Запишется тестовый кружочек</p>
              </div>
            )}

            {/* Live recording indicator */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md text-white text-xs px-2.5 py-1 rounded-full flex items-center space-x-1.5 shadow">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="font-mono font-semibold">0:{seconds < 10 ? `0${seconds}` : seconds}</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-6 mt-8">
          <button
            onClick={handleCancel}
            className="p-3.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 transition active:scale-95"
            title="Отмена"
          >
            <X className="w-6 h-6" />
          </button>

          <button
            onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
            className="p-3 rounded-full bg-[#17212b] border border-[#242f3d] text-gray-300 hover:text-white transition active:scale-95"
            title="Переключить камеру"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          <button
            onClick={handleFinish}
            disabled={isUploading}
            className="p-4 rounded-full bg-[#2AABEE] text-white hover:bg-sky-400 transition shadow-lg shadow-sky-500/30 active:scale-95 flex items-center justify-center disabled:opacity-75"
            title="Отправить кружочек"
          >
            {isUploading ? (
              <Loader2 className="w-7 h-7 animate-spin" />
            ) : (
              <Check className="w-7 h-7 stroke-[3]" />
            )}
          </button>
        </div>

        <p className="text-gray-400 text-xs mt-4">
          {isUploading ? 'Отправка кружочка в облако...' : 'Кружочек (до 60 секунд) • Нажмите галочку для отправки'}
        </p>
      </div>
    </div>
  );
};
