'use client';

import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, X, Volume2, Loader2, MessageSquare } from 'lucide-react';
import { voiceApi } from '@/lib/api';
import { toast } from 'sonner';

type State = 'idle' | 'recording' | 'processing' | 'answering';

export default function VoiceAssistant() {
  const [state, setState] = useState<State>('idle');
  const [isOpen, setIsOpen] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [answer, setAnswer] = useState('');
  const [textQuery, setTextQuery] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await processAudio(blob);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setState('recording');
    } catch {
      toast.error('Microphone access denied. Please allow microphone access.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.stop();
      setState('processing');
    }
  }, [state]);

  const processAudio = async (blob: Blob) => {
    try {
      setState('processing');
      const res = await voiceApi.query(blob);
      const { transcript: t, answer: a, audioUrl: au } = res.data.data;
      setTranscript(t);
      setAnswer(a);
      setAudioUrl(au);
      setState('answering');

      // Auto-play audio response
      if (au) {
        const audio = new Audio(au);
        audioRef.current = audio;
        audio.play().catch(() => {});
      }
    } catch (err: any) {
      toast.error('Voice query failed. Please try again.');
      setState('idle');
    }
  };

  const submitTextQuery = async () => {
    if (!textQuery.trim()) return;
    setState('processing');
    try {
      const res = await voiceApi.queryText(textQuery);
      const { transcript: t, answer: a, audioUrl: au } = res.data.data;
      setTranscript(t);
      setAnswer(a);
      setAudioUrl(au);
      setTextQuery('');
      setState('answering');
      if (au) {
        const audio = new Audio(au);
        audioRef.current = audio;
        audio.play().catch(() => {});
      }
    } catch {
      toast.error('Query failed. Please try again.');
      setState('idle');
    }
  };

  const reset = () => {
    setState('idle');
    setTranscript('');
    setAnswer('');
    setAudioUrl(null);
    audioRef.current?.pause();
  };

  const exampleQueries = [
    'How many active goats do we have?',
    'What is the total outstanding payment?',
    'Which animals need vaccination this week?',
    'Which customer has the highest pending balance?',
  ];

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          id="voice-assistant-btn"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full text-white z-50 flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110"
          style={{
            background: 'linear-gradient(135deg, #6c47ff 0%, #8b5cf6 100%)',
            boxShadow: '0 8px 32px rgba(108, 71, 255, 0.5)',
          }}
          title="AI Voice Assistant"
        >
          <Mic size={22} />
        </button>
      )}

      {/* Voice Panel */}
      {isOpen && (
        <div
          className="fixed bottom-6 right-6 w-96 rounded-3xl z-50 overflow-hidden animate-scale-in"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)', boxShadow: '0 25px 80px rgba(0,0,0,0.6)' }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ background: 'linear-gradient(135deg, rgba(108, 71, 255, 0.15) 0%, rgba(108, 71, 255, 0.05) 100%)', borderBottom: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg"
                style={{ background: 'linear-gradient(135deg, #6c47ff, #8b5cf6)' }}>
                🤖
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>AI Farm Assistant</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Ask anything about your farm</p>
              </div>
            </div>
            <button onClick={() => { setIsOpen(false); reset(); }} className="btn-ghost p-1.5 rounded-lg">
              <X size={16} />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* State: Idle — show examples */}
            {state === 'idle' && (
              <div>
                <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>Try asking:</p>
                <div className="space-y-1.5">
                  {exampleQueries.map((q) => (
                    <button
                      key={q}
                      onClick={() => { setTextQuery(q); }}
                      className="w-full text-left text-xs px-3 py-2 rounded-xl transition-colors hover:bg-purple-500/10"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                    >
                      "{q}"
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* State: Recording */}
            {state === 'recording' && (
              <div className="text-center py-4">
                <div className="voice-wave mx-auto justify-center mb-4">
                  {[1, 2, 3, 4, 5].map((i) => <span key={i} />)}
                </div>
                <p className="text-sm font-medium text-purple-400">Listening...</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Speak your question</p>
              </div>
            )}

            {/* State: Processing */}
            {state === 'processing' && (
              <div className="text-center py-6">
                <Loader2 size={28} className="animate-spin text-purple-400 mx-auto mb-3" />
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Processing your query...</p>
              </div>
            )}

            {/* State: Answering */}
            {state === 'answering' && (
              <div className="space-y-3">
                {transcript && (
                  <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Your question:</p>
                    <p style={{ color: 'var(--text-secondary)' }}>{transcript}</p>
                  </div>
                )}
                <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(108, 71, 255, 0.08)', border: '1px solid rgba(108, 71, 255, 0.3)' }}>
                  <p className="text-xs font-medium mb-1 text-purple-400">Answer:</p>
                  <p className="text-gray-200 leading-relaxed">{answer}</p>
                </div>
                {audioUrl && (
                  <button
                    onClick={() => { const a = new Audio(audioUrl); a.play(); }}
                    className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-colors hover:bg-white/5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Volume2 size={14} className="text-purple-400" /> Play audio response
                  </button>
                )}
                <button onClick={reset} className="btn-ghost text-xs w-full">
                  Ask another question
                </button>
              </div>
            )}

            {/* Text input */}
            {(state === 'idle' || state === 'answering') && (
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={textQuery}
                  onChange={(e) => setTextQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitTextQuery()}
                  placeholder="Type your question..."
                  className="input text-xs flex-1 h-9"
                  id="voice-text-input"
                />
                <button onClick={submitTextQuery} className="btn-primary px-3 h-9 text-xs">
                  <MessageSquare size={14} />
                </button>
              </div>
            )}

            {/* Voice button */}
            {(state !== 'processing') && (
              <button
                id="mic-btn"
                onClick={state === 'recording' ? stopRecording : startRecording}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium transition-all duration-300"
                style={{
                  background: state === 'recording'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'linear-gradient(135deg, rgba(108, 71, 255, 0.15) 0%, rgba(108, 71, 255, 0.05) 100%)',
                  border: `1px solid ${state === 'recording' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(108, 71, 255, 0.4)'}`,
                  color: state === 'recording' ? '#ef4444' : '#a78bfa',
                }}
              >
                {state === 'recording' ? <MicOff size={16} /> : <Mic size={16} />}
                {state === 'recording' ? 'Tap to stop recording' : 'Hold to speak'}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
