import React, { useState, useRef, useEffect, useMemo } from 'react';
import { getGeminiChatResponse, AssistantAppContext } from '../services/geminiService';
import { Song } from '../types';
import { equalizerService } from '../services/equalizerService';
import { themeService } from '../services/themeService';
import { colorWithAlpha } from '../services/colorUtils';
import Visualizer from './Visualizer';

interface ChatBotViewProps {
  onClose: () => void;
  dominantColor: string;
  currentSong: Song | null;
  analyser?: AnalyserNode | null;
  isPlaying?: boolean;
  queue?: Song[];
  playlists?: any[];
  activeView?: string;
  setActiveView?: (view: any) => void;
  isShuffle?: boolean;
  repeatMode?: 'off' | 'one' | 'all';
  onOpenEqualizer?: () => void;
  onOpenThemeSettings?: () => void;
  onOpenPlayer?: () => void;
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
    playFavorites?: () => void;
    createPlaylist: (name: string) => any;
    clearQueue: () => void;
    toggleShuffle?: () => void;
    setRepeatMode?: (mode: 'off' | 'one' | 'all') => void;
  };
}

function assistantErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/notallowederror|permission.*microphone/i.test(message)) return 'Microphone access was denied. Allow microphone access in your browser settings and try again.';
  if (/quota|resource exhausted|\b429\b|rate limit/i.test(message)) return 'The Gemini API quota is currently exhausted. Please try again in a moment.';
  if (/network|fetch|timeout|offline/i.test(message)) return 'Network issue: Could not reach assistant. Please check your connection and try again.';
  return message || 'Zenisai assistant could not complete the request. Please try again.';
}

const ChatBotView: React.FC<ChatBotViewProps> = ({ 
  onClose, 
  dominantColor, 
  currentSong, 
  analyser = null, 
  isPlaying = false,
  queue = [],
  playlists = [],
  activeView = 'home',
  setActiveView,
  isShuffle = false,
  repeatMode = 'off',
  onOpenEqualizer,
  onOpenThemeSettings,
  onOpenPlayer,
  playbackControls 
}) => {
  const activeColor = dominantColor || '#3b82f6';

  const [themeConfig, setThemeConfig] = useState(() => themeService.getConfig());
  const isLight = themeConfig.mode === 'light';

  useEffect(() => {
    return themeService.subscribe(newConfig => {
      setThemeConfig(newConfig);
    });
  }, []);

  const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([
    { 
      role: 'bot', 
      text: currentSong 
        ? `Zenisai AI active. Currently playing "${currentSong.title}" by ${currentSong.artist}. I can control music, adjust the 5-band equalizer, switch themes, and find similar tracks!`
        : 'Zenisai AI active. I can search & play any song, tune equalizer presets, change themes, and manage your library. Try "Play some Anirudh"!'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Dynamic context-aware chips based on currently playing track and app state
  const suggestionChips = useMemo(() => {
    if (currentSong) {
      const artistClean = currentSong.artist?.split(',')[0]?.split('&')[0]?.trim() || currentSong.artist;
      return [
        "What song is playing?",
        `Play more by ${artistClean}`,
        "Deep Bass Boost EQ",
        `Save "${currentSong.title}" to favorites`,
        "What's next in queue?",
        "Switch to Smooth Wave visualizer",
        "Switch to Modern Light theme",
        "Explain this song",
        "Shuffle queue",
        "Surprise recommendations"
      ];
    }
    return [
      "Play some Anirudh",
      "Trending Tamil Hits",
      "Top Global Hits",
      "Chill Lo-Fi Beats",
      "Bass Boost Equalizer",
      "Switch to Modern Light theme",
      "Switch to Smooth Wave visualizer",
      "Play my favorites",
      "Show my playlists",
      "Open Equalizer"
    ];
  }, [currentSong]);

  // Construct live context to pass to Gemini API
  const buildAppContext = (): AssistantAppContext => {
    const eq = equalizerService.getSettings();
    const favsPlaylist = playlists.find(p => p.id === 'favs');
    const favSongs = favsPlaylist?.songs || [];

    return {
      currentSong,
      isPlaying,
      queue,
      favoritesCount: favSongs.length,
      favorites: favSongs,
      playlists: playlists.map(p => ({ id: p.id, name: p.name, songsCount: p.songs?.length || 0 })),
      activeView,
      themeMode: themeConfig.mode,
      accent: themeConfig.accent,
      visualizerStyle: themeConfig.visualizerStyle,
      eqPreset: eq.preset,
      eqEnabled: eq.enabled,
      bassBoost: eq.bassBoost,
      virtualizer: eq.virtualizer,
      repeatMode,
      isShuffle,
    };
  };

  const executePlaybackTool = async (name: string, args: Record<string, any>): Promise<string> => {
    try {
      if (name === 'togglePlayback') playbackControls.toggle();
      else if (name === 'playNext') playbackControls.next();
      else if (name === 'playPrevious') playbackControls.prev();
      else if (name === 'searchAndPlay') await playbackControls.searchAndPlay(args.query as string);
      else if (name === 'recommendSongs') return playbackControls.recommendSongs(args.query as string);
      else if (name === 'addToFavorites') playbackControls.addToFavorites();
      else if (name === 'removeFromFavorites') playbackControls.removeFromFavorites?.();
      else if (name === 'playFavorites') playbackControls.playFavorites?.();
      else if (name === 'favoriteSong') await playbackControls.favoriteSong(args.query as string);
      else if (name === 'addSongToPlaylist') await playbackControls.addSongToPlaylist(args.query as string, args.playlistName as string);
      else if (name === 'createPlaylist') playbackControls.createPlaylist(args.name as string);
      else if (name === 'clearQueue') playbackControls.clearQueue();
      else if (name === 'toggleShuffle') playbackControls.toggleShuffle?.();
      else if (name === 'setRepeatMode') playbackControls.setRepeatMode?.(args.mode as any);
      else if (name === 'setEqualizerPreset') equalizerService.setPreset(args.preset as string);
      else if (name === 'setBassBoost') equalizerService.setBassBoost(args.percent as number);
      else if (name === 'toggleEqualizer') equalizerService.setEnabled(args.enabled !== undefined ? args.enabled : !equalizerService.getSettings().enabled);
      else if (name === 'toggleVirtualizer') equalizerService.setVirtualizer(args.enabled !== undefined ? args.enabled : !equalizerService.getSettings().virtualizer);
      else if (name === 'setVisualizerStyle') themeService.setVisualizerStyle(args.style as any);
      else if (name === 'setThemeMode') themeService.setMode(args.mode as any);
      else if (name === 'setAccentPreset') themeService.setAccent(args.accent as any);
      else if (name === 'navigateView') {
        if (args.view === 'equalizer') onOpenEqualizer?.();
        else if (args.view === 'themes') onOpenThemeSettings?.();
        else if (args.view === 'player') onOpenPlayer?.();
        else setActiveView?.(args.view as any);
      }
      return 'ok';
    } catch (e) {
      console.warn('Tool execution issue', e);
      return 'Action completed.';
    }
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
      const context = buildAppContext();
      const { text, functionCalls } = await getGeminiChatResponse(textToSend, context);
      const actionResults: string[] = [];
      if (functionCalls) {
        for (const fc of functionCalls) {
          const result = await executePlaybackTool(fc.name, fc.args as Record<string, any>);
          if (result && result !== 'ok') actionResults.push(result);
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

  return (
    <div 
      className="fixed inset-0 z-[500] flex flex-col backdrop-blur-3xl transition-all duration-700" 
      style={{ 
        background: isLight 
          ? `radial-gradient(circle at top, ${colorWithAlpha(activeColor, 0.15)} 0%, #f1f5f9 65%, #e2e8f0 100%)`
          : `radial-gradient(circle at top, ${colorWithAlpha(activeColor, 0.2)} 0%, #030712 75%)` 
      }}
    >
      {/* Dynamic Dominant Color Background Glows */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full blur-[140px] pointer-events-none opacity-40 transition-all duration-700" 
        style={{ backgroundColor: activeColor }}
      />

      {/* Header with back button & Zenisai AI title */}
      <header 
        className={`relative z-10 flex justify-between items-center px-4 sm:px-6 py-[calc(env(safe-area-inset-top)+0.75rem)] border-b backdrop-blur-xl transition-colors duration-700 ${
          isLight ? 'bg-white/80 border-slate-200' : ''
        }`}
        style={!isLight ? { 
          borderColor: colorWithAlpha(activeColor, 0.2), 
          backgroundColor: colorWithAlpha(activeColor, 0.08) 
        } : {}}
      >
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose} 
            aria-label="Back to music"
            title="Back to music"
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-sm ${
              isLight 
                ? 'bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200' 
                : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h2 className={`text-base sm:text-lg font-extrabold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Zenisai AI
              </h2>
              <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: activeColor }} />
            </div>
            <p className={`text-[10px] sm:text-[11px] font-medium ${isLight ? 'text-slate-500' : 'text-white/60'}`}>
              Context-aware music & app copilot
            </p>
          </div>
        </div>
      </header>

      {/* Clean Now Playing Metadata & Live Frequency Visualizer Dock */}
      {currentSong && (
        <div 
          className={`relative z-10 mx-4 sm:mx-6 mt-3.5 p-3.5 sm:p-4 rounded-[24px] border shadow-xl backdrop-blur-2xl flex flex-col gap-3 overflow-hidden transition-all duration-500 ${
            isLight ? 'bg-white/90 border-slate-200 shadow-slate-200/50' : 'bg-[var(--color-surface)] border-white/10'
          }`}
          style={{
            borderColor: colorWithAlpha(activeColor, isLight ? 0.35 : 0.4),
          }}
        >
          <div className="relative z-10 flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div 
                className="relative w-12 h-12 rounded-xl overflow-hidden shadow-lg border shrink-0 bg-white/5" 
                style={{ borderColor: colorWithAlpha(activeColor, 0.5) }}
              >
                <img 
                  src={currentSong.artwork} 
                  alt="" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = 'https://picsum.photos/seed/audio/400/400';
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: activeColor }} />
                  <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: activeColor }}>
                    {isPlaying ? 'Now Playing' : 'Paused'}
                  </span>
                </div>
                <p className={`text-xs sm:text-sm font-extrabold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {currentSong.title}
                </p>
                <p className={`text-[11px] truncate mt-0.5 ${isLight ? 'text-slate-500' : 'text-white/60'}`}>
                  {currentSong.artist}
                </p>
              </div>
            </div>

            <button
              onClick={playbackControls.toggle}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 active:scale-90 transition-transform shadow-md"
              style={{ backgroundColor: activeColor }}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg className="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>
          </div>

          {/* Real-time Frequency Spectrum Visualizer */}
          <div 
            className={`relative z-10 w-full h-12 rounded-xl overflow-hidden border px-3 py-1 flex items-center justify-center shadow-inner ${
              isLight ? 'bg-slate-100/90 border-slate-200' : 'bg-black/40 border-white/10'
            }`}
            style={{ borderColor: colorWithAlpha(activeColor, 0.25) }}
          >
            <Visualizer analyser={analyser} color={activeColor} isPlaying={isPlaying} style={themeConfig.visualizerStyle} className="w-full h-full" />
          </div>
        </div>
      )}

      {/* Chat Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3.5 no-scrollbar relative z-10">
        {!isLiveActive ? (
          <>
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className={`max-w-[85%] p-3.5 px-4 shadow-lg transition-all ${
                  m.role === 'user' 
                    ? 'text-white rounded-[20px] rounded-tr-sm font-semibold'
                    : isLight
                      ? 'bg-white text-slate-800 rounded-[20px] rounded-tl-sm border border-slate-200/90 shadow-slate-200/60'
                      : 'bg-white/[0.06] text-white/90 rounded-[20px] rounded-tl-sm border border-white/[0.08] backdrop-blur-md'
                }`}
                style={m.role === 'user' ? { 
                  backgroundColor: activeColor,
                  boxShadow: `0 6px 20px ${colorWithAlpha(activeColor, 0.35)}` 
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
              <div 
                className="absolute inset-0 blur-[90px] rounded-full animate-pulse scale-150 opacity-60" 
                style={{ backgroundColor: activeColor }} 
              />
              <div 
                className="relative w-36 h-36 rounded-full border flex items-center justify-center overflow-hidden shadow-2xl"
                style={{ 
                  background: `radial-gradient(circle, ${colorWithAlpha(activeColor, 0.6)} 0%, #070e1f 80%)`,
                  borderColor: colorWithAlpha(activeColor, 0.5) 
                }}
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
            <p className={`mt-8 text-xs font-black uppercase tracking-[0.3em] animate-pulse ${isLight ? 'text-slate-800' : 'text-white/80'}`}>
              Listening to your voice...
            </p>
            {liveTranscript && (
              <div className={`mt-5 px-6 py-3 max-w-md rounded-2xl border backdrop-blur-md shadow-md ${
                isLight ? 'bg-white text-slate-900 border-slate-200' : 'bg-white/5 text-white border-white/10'
              }`}>
                <p className="text-center text-sm font-semibold italic">"{liveTranscript}"</p>
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="flex justify-start px-2 animate-in fade-in">
            <div className={`flex gap-2 p-3 rounded-2xl items-center border ${
              isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.06] border-white/[0.08]'
            }`}>
              <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: activeColor, animationDelay: '0s' }} />
              <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: activeColor, animationDelay: '0.2s' }} />
              <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: activeColor, animationDelay: '0.4s' }} />
            </div>
          </div>
        )}
      </div>

      {/* Footer / Input */}
      <footer 
        className={`relative z-10 p-3 sm:p-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] border-t backdrop-blur-xl transition-colors duration-700 space-y-2.5 ${
          isLight ? 'bg-white/90 border-slate-200' : ''
        }`}
        style={!isLight ? { 
          borderColor: colorWithAlpha(activeColor, 0.2), 
          backgroundColor: colorWithAlpha(activeColor, 0.08) 
        } : {}}
      >
        {/* Dynamic Context-Aware Suggestion Chips */}
        <div className="max-w-3xl mx-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {suggestionChips.map(chip => (
            <button
              key={chip}
              onClick={() => handleSend(chip)}
              className={`text-[10px] sm:text-[11px] font-semibold whitespace-nowrap px-3 py-1.5 rounded-full border active:scale-95 transition-all shadow-sm ${
                isLight 
                  ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-slate-100'
                  : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/15 hover:text-white'
              }`}
            >
              {chip}
            </button>
          ))}
        </div>

        <div className="max-w-3xl mx-auto flex items-center gap-2.5">
          <div className="relative flex-1 group">
            <input 
              type="text" 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleSend()} 
              placeholder={isLiveActive ? "Listening..." : "Ask assistant, command EQ, or search music..."} 
              disabled={isLiveActive}
              className={`w-full rounded-[18px] py-3.5 pl-4 pr-12 outline-none border transition-all text-xs sm:text-sm font-medium shadow-inner ${
                isLight 
                  ? 'bg-white text-slate-900 border-slate-300 placeholder:text-slate-400 focus:border-blue-500' 
                  : 'bg-white/[0.04] text-white border-white/15 placeholder:text-white/40 focus:bg-white/[0.08]'
              }`}
              style={{ borderColor: colorWithAlpha(activeColor, 0.4) }}
            />
            <button 
              onClick={() => handleSend()} 
              disabled={isLiveActive || !input.trim()}
              className="absolute right-1.5 top-1.5 bottom-1.5 aspect-square text-white rounded-[13px] flex items-center justify-center hover:brightness-110 active:scale-95 transition-transform disabled:opacity-0 shadow-md font-bold"
              style={{ backgroundColor: activeColor }}
              aria-label="Send message"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 12h14m-7-7l7 7-7 7" />
              </svg>
            </button>
          </div>

          <button 
            onClick={startVoiceSession}
            className={`w-12 h-12 rounded-[18px] flex items-center justify-center shadow-lg transition-all duration-300 active:scale-90 border shrink-0 ${
              isLiveActive 
                ? 'bg-rose-500 text-white border-rose-400 rotate-90 shadow-rose-500/30' 
                : isLight
                  ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
            }`}
            title={isLiveActive ? 'Stop voice session' : 'Start voice session'}
            aria-label="Toggle voice input"
          >
            {isLiveActive ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-20a3 3 0 013 3v10a3 3 0 01-6 0V7a3 3 0 013-3z"/></svg>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default ChatBotView;
