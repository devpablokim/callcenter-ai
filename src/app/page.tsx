'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

type CallState = 'idle' | 'connecting' | 'connected' | 'ended' | 'error';

interface Message {
  role: 'agent' | 'user';
  text: string;
  timestamp: number;
}

export default function CallCenterPage() {
  const [callState, setCallState] = useState<CallState>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startCall = useCallback(async () => {
    setCallState('connecting');
    setError(null);
    setMessages([]);

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Get signed URL from our API
      const res = await fetch('/callcenter-ai/api/conversation', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start conversation');
      const { signedUrl } = await res.json();

      // Connect WebSocket to ElevenLabs
      const ws = new WebSocket(signedUrl);
      wsRef.current = ws;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      ws.onopen = () => {
        setCallState('connected');

        // Send audio from microphone
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);

        source.connect(processor);
        processor.connect(audioContext.destination);

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN && !isMuted) {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcm16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
            }
            ws.send(JSON.stringify({
              type: 'audio',
              audio: btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer))),
            }));
          }
        };
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'transcript') {
          setMessages((prev) => [
            ...prev,
            { role: data.role, text: data.text, timestamp: Date.now() },
          ]);
        }
        if (data.type === 'audio') {
          // Play agent audio
          playAudio(data.audio, audioContext);
        }
      };

      ws.onerror = () => {
        setError('연결 오류가 발생했습니다.');
        setCallState('error');
      };

      ws.onclose = () => {
        if (callState === 'connected') setCallState('ended');
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : '통화 시작에 실패했습니다.');
      setCallState('error');
    }
  }, [callState, isMuted]);

  const endCall = useCallback(() => {
    wsRef.current?.close();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioContextRef.current?.close();
    setCallState('ended');
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          🤖 HOBBYTAN AI 콜센터
        </h1>
        <p className="text-gray-400 mt-2">ElevenLabs Conversational AI 기반 자동 응대 시스템</p>
      </div>

      {/* Call UI */}
      <div className="w-full max-w-lg bg-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Status Bar */}
        <div className={`px-4 py-3 text-center text-sm font-medium ${
          callState === 'connected' ? 'bg-green-600' :
          callState === 'connecting' ? 'bg-yellow-600' :
          callState === 'error' ? 'bg-red-600' :
          'bg-slate-700'
        }`}>
          {callState === 'idle' && '📞 통화 대기 중'}
          {callState === 'connecting' && '⏳ 연결 중...'}
          {callState === 'connected' && '🟢 통화 중'}
          {callState === 'ended' && '📴 통화 종료'}
          {callState === 'error' && `❌ ${error}`}
        </div>

        {/* Transcript */}
        <div className="h-80 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && callState === 'idle' && (
            <div className="text-center text-gray-500 mt-20">
              <p className="text-5xl mb-4">📞</p>
              <p>아래 버튼을 눌러 AI 상담원과 통화를 시작하세요</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-primary text-white rounded-br-sm'
                  : 'bg-slate-700 text-gray-200 rounded-bl-sm'
              }`}>
                <p className="text-xs opacity-60 mb-1">{msg.role === 'user' ? '고객' : '🤖 AI 상담원'}</p>
                <p>{msg.text}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Controls */}
        <div className="px-4 py-4 bg-slate-900 flex items-center justify-center gap-4">
          {callState === 'idle' || callState === 'ended' || callState === 'error' ? (
            <button
              onClick={startCall}
              className="px-8 py-3 bg-green-600 hover:bg-green-500 rounded-full text-lg font-bold transition-all hover:scale-105"
            >
              📞 통화 시작
            </button>
          ) : (
            <>
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-3 rounded-full transition-all ${isMuted ? 'bg-red-600' : 'bg-slate-700 hover:bg-slate-600'}`}
              >
                {isMuted ? '🔇' : '🎤'}
              </button>
              <button
                onClick={endCall}
                className="px-8 py-3 bg-red-600 hover:bg-red-500 rounded-full text-lg font-bold transition-all hover:scale-105"
              >
                📴 통화 종료
              </button>
            </>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="mt-6 text-center text-gray-500 text-sm max-w-md">
        <p>🔒 브라우저 마이크 권한이 필요합니다</p>
        <p className="mt-1">ElevenLabs Conversational AI + Twilio 연동</p>
      </div>
    </div>
  );
}

async function playAudio(base64Audio: string, audioContext: AudioContext) {
  try {
    const binaryStr = atob(base64Audio);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start(0);
  } catch {
    // Audio decode error — skip
  }
}
