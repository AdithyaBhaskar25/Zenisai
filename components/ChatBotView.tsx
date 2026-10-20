import React, { useState, useRef, useEffect } from 'react';
import { getGeminiChatResponse } from '../services/geminiService';
import { Song } from '../types';
import Visualizer from './Visualizer';

interface ChatBotViewProps {
  onClose: () => void;
  dominantColor: string;
  currentSong: Song | null;
  analyser?: AnalyserNode | null;
  isPlaying?: boolean;
  currentTime?: number;
  duration?: number;
  onSeek?: (newTime: number) => void;
  playbackControls: {
    toggle: () => void;
    next: () => void;
    prev: () => void;
    searchAndPlay: (query: string) => Promise<void>;
    recommendSongs: (query: string) => Promise<string>;
    addToFavorites: () => void;
    favoriteSong: (query: string) => Promise<void>;
    addSongToPlaylist: (query: string, playlistName: string) => Promise<void>;
    removeFromFavorites?: () => void;
    createPlaylist: (name: string) => any;
    clearQueue: () => void;
  };
}

function assistantErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/notallowederror|permission.*microphone/i.test(message)) return 'Microphone access was denied. Allow microphone access in your browser settings and try again.';
  if (/quota|resource exhausted|\b429\b|rate limit/i.test(message)) return 'The Gemini API quota is currently exhausted. Please try again in a moment.';
  if (/network|fetch|timeout|offline/i.test(message)) return 'Network issue: Could not reach assistant. Please check your connection and try again.';
  return message || 'Zenisai assistant could not complete the request. Please try again.';
}

const formatDuration = (seconds?: number): string => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const ChatBotView: React.FC<ChatBotViewProps> = ({ 
  onClose, 
  dominantColor, 
  currentSong, 
  analyser = null, 
  isPlaying = false, 
  currentTime = 0,
  duration = 0,
  onSeek,
  playbackControls 
}) => {
  // Use dominant color with vibrant multi-stop fallback tints
  const activeColor = dominantColor || '#3b82f6';

  const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([
    { role: 'bot', text: 'Zenisai AI active. I can search, control music, save tracks, and create playlists. Try "Play some Anirudh"!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const executePlaybackTool = async (name: string, args: Record<string, any>): Promise<string> => {
    if (name === 'togglePlayback') playbackControls.toggle();
    else if (name === 'playNext') playbackControls.next();
    else if (name === 'playPrevious') playbackControls.prev();
    else if (name === 'searchAndPlay') await playbackControls.searchAndPlay(args.query as string);
    else if (name === 'recommendSongs') return playbackControls.recommendSongs(args.query as string);
    else if (name === 'addToFavorites') playbackControls.addToFavorites();
    else if (name === 'favoriteSong') await playbackControls.favoriteSong(args.query as string);
    else if (name === 'addSongToPlaylist') await playbackControls.addSongToPlaylist(args.query as string, args.playlistName as string);
    else if (name === 'removeFromFavorites') playbackControls.removeFromFavorites?.();
    else if (name === 'createPlaylist') playbackControls.createPlaylist(args.name as string);
    else if (name === 'clearQueue') playbackControls.clearQueue();
    return 'ok';
  };

  useEffect(() => { 
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLiveActive]);

  useEffect(() => { 
    return () => {
      stopVoiceSession();
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    }; 
  }, []);

  const stopVoiceSession = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setIsLiveActive(false);
    setLiveTranscript('');
  };

  const startVoiceSession = () => {
    if (isLiveActive) {
      stopVoiceSession();
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setMessages(prev => [...prev, { role: 'bot', text: 'Voice recognition is not supported in this browser. You can type your music request below!' }]);
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsLiveActive(true);
        setLiveTranscript('');
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        setLiveTranscript(transcript);
        if (event.results[0]?.isFinal) {
          stopVoiceSession();
          handleSend(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error', event.error);
        stopVoiceSession();
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setMessages(prev => [...prev, { role: 'bot', text: `Voice input notice: ${event.error}. You can also type your message.` }]);
        }
      };

      recognition.onend = () => {
        setIsLiveActive(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error('Failed to start speech recognition', e);
      setIsLiveActive(false);
      setMessages(prev => [...prev, { role: 'bot', text: assistantErrorMessage(e) }]);
    }
  };

  const handleSend = async (overrideText?: string) => {
    const textToSend = (typeof overrideText === 'string' ? overrideText : input).trim();
    if (!textToSend || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: textToSend }]);
    setLoading(true);
    try {
      const { text, functionCalls } = await getGeminiChatResponse(textToSend);
      const actionResults: string[] = [];
      if (functionCalls) {
        for (const fc of functionCalls) {
          const result = await executePlaybackTool(fc.name, fc.args as Record<string, any>);
          if (result !== 'ok') actionResults.push(result);
        }
      }
      const responseText = [text || 'Processed your request.', ...actionResults].filter(Boolean).join('\n');
      setMessages(prev => [...prev, { role: 'bot', text: responseText }]);
      
      if (typeof window !== 'undefined' && window.speechSynthesis && overrideText) {
        try {
          const utterance = new SpeechSynthesisUtterance(responseText);
          utterance.rate = 1.05;
          window.speechSynthesis.speak(utterance);
        } catch {}
      }
    } catch (err) {
      console.error('Gemini chat request failed', err);
      setMessages(prev => [...prev, { role: 'bot', text: assistantErrorMessage(err) }]);
    } finally { 
      setLoading(false); 
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div 
      className="fixed inset-0 z-[500] flex flex-col backdrop-blur-3xl transition-all duration-700" 
      style={{ 
        background: `radial-gradient(circle at top, ${activeColor}22 0%, #030712 70%)` 
      }}
    >
      
      {/* Rich Multi-Color Ambient Glow Backgrounds */}
      <div 
        className="absolute top-[-10%] left-1/4 w-[400px] h-[400px] rounded-full blur-[150px] pointer-events-none opacity-40 transition-all duration-700" 
        style={{ backgroundColor: activeColor }}
      />
      <div 
        className="absolute top-[20%] right-[-10%] w-[350px] h-[350px] rounded-full blur-[160px] pointer-events-none opacity-25 transition-all duration-700" 
        style={{ backgroundColor: '#8b5cf6' }}
      />

      {/* Header with elegant 'Z' symbol & vibrant tint */}
      <header 
        className="relative z-10 flex justify-between items-center px-5 py-[calc(env(safe-area-inset-top)+1rem)] border-b backdrop-blur-xl transition-colors duration-700"
        style={{ borderColor: `${activeColor}33`, backgroundColor: `${activeColor}11` }}
      >
        <div className="flex items-center gap-3.5">
          <div 
            className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-xl border text-white font-black text-xl italic tracking-tighter"
            style={{ 
              background: `linear-gradient(135deg, ${activeColor}, #1e1b4b)`,
              borderColor: `${activeColor}80`,
              boxShadow: `0 0 20px ${activeColor}4d`
            }}
          >
            Z
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-white tracking-tight">Zenisai AI</h2>
              <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: activeColor }} />
            </div>
            <p className="text-[11px] text-white/60 font-medium">Your intelligent music companion</p>
          </div>
        </div>

        <button 
          onClick={onClose} 
          className="w-11 h-11 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition-all active:scale-90 shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </header>

      {/* Rich Standout Hero Visualizer & Metadata Dock with Progress Bar */}
      {currentSong && (
        <div 
          className="relative z-10 mx-5 mt-4 p-5 rounded-[28px] border shadow-2xl backdrop-blur-2xl flex flex-col gap-4 overflow-hidden group transition-all duration-500"
          style={{
            borderColor: `${activeColor}55`,
            backgroundImage: `linear-gradient(to bottom right, ${activeColor}33, #070e1f, #030712)`
          }}
        >
          {/* Subtle Ambient Glow Behind Artwork */}
          <div className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full blur-3xl opacity-30 pointer-events-none" style={{ backgroundColor: activeColor }} />

          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-2xl border shrink-0 bg-white/5" style={{ borderColor: `${activeColor}66` }}>
                <img 
                  src={currentSong.artwork} 
                  alt="" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = 'https://picsum.photos/seed/audio/400/400';
                  }}
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: activeColor }} />
                  <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: activeColor }}>Now Playing</span>
                </div>
                <p className="text-sm sm:text-base font-extrabold text-white truncate">{currentSong.title}</p>
                <p className="text-xs text-white/60 truncate mt-0.5">{currentSong.artist} · {currentSong.album || 'Zenisai Music'}</p>
              </div>
            </div>

            {/* Dynamically updating Play/Pause Button */}
            <button 
              onClick={() => playbackControls.toggle()} 
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl active:scale-95 transition-all shrink-0 hover:brightness-110"
              style={{ 
                backgroundColor: activeColor,
                boxShadow: `0 4px 20px ${activeColor}66`
              }}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg className="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>
          </div>

          {/* Progress Bar & Timestamps */}
          <div className="space-y-1.5 relative z-10">
            <div 
              className="w-full bg-white/10 rounded-full h-2 overflow-hidden cursor-pointer relative group/progress"
              onClick={(e) => {
                if (!duration || !onSeek) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                onSeek(ratio * duration);
              }}
            >
              <div
                className="h-full rounded-full transition-all duration-150 relative"
                style={{
                  width: `${progressPercent}%`,
                  backgroundColor: activeColor,
                  boxShadow: `0 0 12px ${activeColor}`
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-semibold text-white/50 tracking-wider">
              <span>{formatDuration(currentTime)}</span>
              <span>{formatDuration(duration)}</span>
            </div>
          </div>

          {/* Integrated Live Frequency Visualizer Waveform */}
          <div 
            className="relative z-10 w-full h-16 bg-black/40 rounded-2xl overflow-hidden border px-3 py-1.5 shadow-inner flex items-center justify-center"
            style={{ borderColor: `${activeColor}33` }}
          >
            <Visualizer analyser={analyser} color={activeColor} isPlaying={isPlaying} className="w-full h-full" />
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 space-y-4 no-scrollbar relative z-10">
        {!isLiveActive ? (
          <>
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-400`}>
                <div className={`max-w-[85%] p-4 px-5 shadow-xl transition-all ${
                  m.role === 'user' 
                    ? 'text-white rounded-[22px] rounded-tr-sm font-semibold shadow-2xl'
                    : 'bg-white/[0.06] text-white/90 rounded-[22px] rounded-tl-sm border border-white/[0.08] backdrop-blur-md'
                }`}
                style={m.role === 'user' ? { 
                  backgroundColor: activeColor,
                  boxShadow: `0 8px 25px ${activeColor}4d` 
                } : {}}
                >
                  <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-line">{m.text}</p>
                </div>
              </div>
            ))}
          </>
        ) : (
          /* Voice Mode Visualization */
          <div className="h-full flex flex-col items-center justify-center animate-in zoom-in-95 duration-500 pb-10">
            <div className="relative group">
              <div className="absolute inset-0 blur-[90px] rounded-full animate-pulse scale-150 opacity-50" style={{ backgroundColor: activeColor }} />
              <div 
                className="relative w-36 h-36 rounded-full border border-white/20 flex items-center justify-center overflow-hidden shadow-2xl"
                style={{ background: `radial-gradient(circle, ${activeColor}66 0%, #070e1f 80%)` }}
              >
                <div className="flex gap-1.5 items-end h-10">
                  {[...Array(5)].map((_, i) => (
                    <div 
                      key={i} 
                      className="w-2 bg-white rounded-full animate-bounce shadow-lg"
                      style={{ animationDelay: `${i * 0.12}s`, animationDuration: '0.7s' }} 
                    />
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-8 text-xs font-black uppercase tracking-[0.3em] text-white/70 animate-pulse">Listening to your voice...</p>
            {liveTranscript && (
              <div className="mt-5 px-6 py-3 max-w-md rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                <p className="text-center text-sm font-semibold text-white italic">"{liveTranscript}"</p>
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="flex justify-start px-2 animate-in fade-in">
            <div className="flex gap-2 p-3.5 rounded-2xl bg-white/[0.06] border border-white/[0.08] items-center">
              <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: activeColor, animationDelay: '0s' }} />
              <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: activeColor, animationDelay: '0.2s' }} />
              <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: activeColor, animationDelay: '0.4s' }} />
            </div>
          </div>
        )}
      </div>

      {/* Footer / Input */}
      <footer 
        className="relative z-10 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] border-t backdrop-blur-xl transition-colors duration-700"
        style={{ borderColor: `${activeColor}33`, backgroundColor: `${activeColor}0d` }}
      >
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="relative flex-1 group">
            <input 
              type="text" 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleSend()} 
              placeholder={isLiveActive ? "Listening..." : "Ask assistant or search song..."} 
              disabled={isLiveActive}
              className="w-full bg-white/[0.04] rounded-[18px] py-3.5 pl-5 pr-14 outline-none border focus:bg-white/[0.08] transition-all text-xs sm:text-sm text-white placeholder:text-white/40 disabled:opacity-20 shadow-inner"
              style={{ borderColor: `${activeColor}4d` }}
            />
            <button 
              onClick={() => handleSend()} 
              disabled={isLiveActive || !input.trim()}
              className="absolute right-2 top-2 bottom-2 aspect-square text-white rounded-[12px] flex items-center justify-center hover:brightness-110 active:scale-95 transition-transform disabled:opacity-0 shadow-md font-bold"
              style={{ backgroundColor: activeColor }}
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 12h14m-7-7l7 7-7 7"></path>
              </svg>
            </button>
          </div>

          <button 
            onClick={startVoiceSession}
            className={`w-12 h-12 rounded-[18px] flex items-center justify-center shadow-lg transition-all duration-300 active:scale-90 border ${
              isLiveActive 
                ? 'bg-rose-500 text-white border-rose-400 rotate-90 shadow-rose-500/30' 
                : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
            }`}
            title={isLiveActive ? 'Stop voice session' : 'Start voice session'}
          >
            {isLiveActive ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-20a3 3 0 013 3v10a3 3 0 01-6 0V7a3 3 0 013-3z"></path></svg>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default ChatBotView;
