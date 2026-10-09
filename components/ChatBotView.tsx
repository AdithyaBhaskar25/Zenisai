import React, { useState, useRef, useEffect } from 'react';
import { getGeminiChatResponse } from '../services/geminiService';
import { Song } from '../types';

interface ChatBotViewProps {
  onClose: () => void;
  dominantColor: string;
  currentSong: Song | null;
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

const ChatBotView: React.FC<ChatBotViewProps> = ({ onClose, dominantColor, currentSong, playbackControls }) => {
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

  return (
    <div className="fixed inset-0 z-[500] flex flex-col backdrop-blur-2xl transition-all duration-300" style={{ background: 'color-mix(in srgb, var(--color-bg) 92%, var(--color-primary) 8%)' }}>
      {/* Header */}
      <header className="flex justify-between items-center px-5 py-[calc(env(safe-area-inset-top)+1rem)] border-b border-white/[0.07]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Zenisai AI</p>
          <h2 className="text-2xl font-bold text-white mt-1">Assistant</h2>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-1.5 h-1.5 rounded-full ${isLiveActive ? 'bg-accent animate-pulse shadow-accent' : 'bg-white/20'}`} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
              {isLiveActive ? 'Live Voice' : 'Zenisai AI'}
            </span>
          </div>
          {currentSong && <div className="mt-3 flex max-w-[260px] items-center gap-2 rounded-[12px] border border-accent-tint bg-accent-tint p-2">
            <img src={currentSong.artwork} alt="" className="h-8 w-8 rounded-[8px] object-cover" />
            <div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold text-white">{currentSong.title}</p><p className="truncate text-[9px] text-white/55">{currentSong.artist}</p></div>
            <div className="flex h-5 items-end gap-0.5" aria-hidden="true">{[0, 1, 2, 3].map(bar => <span key={bar} className="w-1 rounded-full bg-accent" style={{ height: `${6 + ((bar * 7 + 3) % 13)}px` }} />)}</div>
          </div>}
        </div>
        <button 
          onClick={onClose} 
          className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-white/30 hover:bg-white/10 hover:text-white transition-all active:scale-90"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </header>

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4 no-scrollbar">
        {!isLiveActive ? (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-500`}>
              <div className={`max-w-[85%] p-4 px-6 shadow-xl ${
                m.role === 'user' 
                  ? 'bg-accent text-[#06101e] rounded-[18px] rounded-tr-sm font-semibold'
                  : 'bg-white/[0.06] text-white/90 rounded-[18px] rounded-tl-sm border border-white/[0.07]'
              }`}>
                <p className="text-sm leading-relaxed">{m.text}</p>
              </div>
            </div>
          ))
        ) : (
          /* Voice Mode Visualization */
          <div className="h-full flex flex-col items-center justify-center animate-in zoom-in-95 duration-500 pb-20">
            <div className="relative group">
              {/* Voice Pulse Effect */}
              <div className="absolute inset-0 bg-accent/20 blur-[80px] rounded-full animate-pulse scale-150" />
              <div 
                className="relative w-32 h-32 rounded-full border border-accent-tint flex items-center justify-center overflow-hidden"
                style={{ background: `radial-gradient(circle, ${dominantColor}33 0%, transparent 80%)` }}
              >
                <div className="flex gap-1 items-end h-8">
                  {[...Array(5)].map((_, i) => (
                    <div 
                      key={i} 
                      className="w-1.5 bg-accent rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.1}s`, animationDuration: '0.8s' }} 
                    />
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-8 text-xs font-black uppercase tracking-[0.4em] text-white/40 animate-pulse">Assistant Listening</p>
            {liveTranscript && (
              <p className="mt-4 px-6 max-w-md text-center text-sm font-medium text-white/90 italic animate-in fade-in">"{liveTranscript}"</p>
            )}
          </div>
        )}

        {loading && (
          <div className="flex justify-start px-2">
            <div className="flex gap-1.5 animate-pulse">
              <div className="w-1.5 h-1.5 bg-white/20 rounded-full" />
              <div className="w-1.5 h-1.5 bg-white/20 rounded-full" />
              <div className="w-1.5 h-1.5 bg-white/20 rounded-full" />
            </div>
          </div>
        )}
      </div>

      {/* Footer / Input */}
      <footer className="p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] border-t border-white/[0.07]">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="relative flex-1 group">
            <input 
              type="text" 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleSend()} 
              placeholder={isLiveActive ? "Listening to your voice..." : "Request a song..."} 
              disabled={isLiveActive}
              className="w-full bg-white/[0.04] rounded-[16px] py-4 pl-5 pr-14 outline-none border border-white/[0.08] focus:border-accent/40 focus:bg-white/[0.07] transition-all text-sm placeholder:text-white/30 disabled:opacity-20"
            />
            <button 
              onClick={() => handleSend()} 
              disabled={isLiveActive || !input.trim()}
              className="absolute right-2 top-2 bottom-2 aspect-square bg-accent text-[#06101e] rounded-[12px] flex items-center justify-center hover:brightness-110 active:scale-95 transition-transform disabled:opacity-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 12h14m-7-7l7 7-7 7"></path></svg>
            </button>
          </div>

          <button 
            onClick={startVoiceSession}
            className={`w-12 h-12 rounded-[16px] flex items-center justify-center shadow-lg transition-all duration-300 active:scale-90 border ${
              isLiveActive 
                ? 'bg-red-500 text-white border-red-400 rotate-90 shadow-red-500/30' 
                : 'bg-white/10 text-white border-white/10 hover:bg-white/20'
            }`}
          >
            {isLiveActive ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-20a3 3 0 013 3v10a3 3 0 01-6 0V7a3 3 0 013-3z"></path></svg>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default ChatBotView;
