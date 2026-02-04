
import React, { useState, useRef, useEffect } from 'react';
import { getGeminiChatResponse, CONTROL_PLAYBACK_FUNCTIONS } from '../services/geminiService';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';

interface ChatBotViewProps {
  onClose: () => void;
  dominantColor: string;
  playbackControls: {
    toggle: () => void;
    next: () => void;
    prev: () => void;
    searchAndPlay: (query: string) => Promise<void>;
    addToFavorites: () => void;
    removeFromFavorites?: () => void;
    createPlaylist: (name: string) => any;
    clearQueue: () => void;
  };
}

// Audio Helpers
function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encodeBase64(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const ChatBotView: React.FC<ChatBotViewProps> = ({ onClose, dominantColor, playbackControls }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([
    { role: 'bot', text: 'Zenisai AI active. I can search, control music, save tracks, and create playlists. Try "Play some Anirudh"!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Live Session Refs
  const liveSessionRef = useRef<any>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, []);

  const stopLiveSession = () => {
    if (liveSessionRef.current) {
      liveSessionRef.current.close();
      liveSessionRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close();
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close();
      outputAudioCtxRef.current = null;
    }
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    setIsLiveActive(false);
  };

  const startLiveSession = async () => {
    if (isLiveActive) {
      stopLiveSession();
      return;
    }

    setIsLiveActive(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    inputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            const source = inputAudioCtxRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioCtxRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const base64 = encodeBase64(new Uint8Array(int16.buffer));
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: { data: base64, mimeType: 'audio/pcm;rate=16000' } });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioCtxRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Tool Calls
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                let result = "ok";
                try {
                  if (fc.name === 'togglePlayback') playbackControls.toggle();
                  if (fc.name === 'playNext') playbackControls.next();
                  if (fc.name === 'playPrevious') playbackControls.prev();
                  if (fc.name === 'searchAndPlay') await playbackControls.searchAndPlay(fc.args.query as string);
                  if (fc.name === 'addToFavorites') playbackControls.addToFavorites();
                  if (fc.name === 'removeFromFavorites') playbackControls.removeFromFavorites?.();
                  if (fc.name === 'createPlaylist') playbackControls.createPlaylist(fc.args.name as string);
                  if (fc.name === 'clearQueue') playbackControls.clearQueue();
                } catch (e) { result = "error"; }
                
                sessionPromise.then(session => {
                  session.sendToolResponse({
                    functionResponses: { id: fc.id, name: fc.name, response: { result } }
                  });
                });
              }
            }

            // Handle Audio Playback
            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData && outputAudioCtxRef.current) {
              const ctx = outputAudioCtxRef.current;
              const bytes = decodeBase64(audioData);
              const buffer = await decodeAudioData(bytes, ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => sourcesRef.current.delete(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => {
            console.error("Live AI Error:", e);
            stopLiveSession();
          },
          onclose: () => setIsLiveActive(false)
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "You are Zenisai, a voice assistant for a premium music app. You can control playback (play, pause, next, prev), search and play music, manage favorites, and clear the queue. Keep your spoken responses friendly, concise, and helpful.",
          tools: [{ functionDeclarations: CONTROL_PLAYBACK_FUNCTIONS }],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
        }
      });

      liveSessionRef.current = await sessionPromise;
    } catch (e) {
      console.error("Failed to start live session:", e);
      setIsLiveActive(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const { text, functionCalls } = await getGeminiChatResponse(userMsg);
      if (functionCalls) {
        for (const fc of functionCalls) {
          if (fc.name === 'togglePlayback') playbackControls.toggle();
          if (fc.name === 'playNext') playbackControls.next();
          if (fc.name === 'playPrevious') playbackControls.prev();
          if (fc.name === 'searchAndPlay') await playbackControls.searchAndPlay(fc.args.query as string);
          if (fc.name === 'addToFavorites') playbackControls.addToFavorites();
          if (fc.name === 'removeFromFavorites') playbackControls.removeFromFavorites?.();
          if (fc.name === 'createPlaylist') playbackControls.createPlaylist(fc.args.name as string);
          if (fc.name === 'clearQueue') playbackControls.clearQueue();
        }
      }
      setMessages(prev => [...prev, { role: 'bot', text: text || "Processed your request." }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: "Error. Try again." }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-3xl flex flex-col animate-in fade-in duration-500">
      <header className="flex justify-between items-center p-6 border-b border-white/5 bg-zinc-900/40">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-white">Assistant</h2>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${isLiveActive ? 'bg-accent animate-ping' : 'bg-purple-500 animate-pulse'}`}></div>
            <p className="text-[10px] text-white/30 font-black uppercase tracking-widest">{isLiveActive ? 'Live Voice Active' : 'Zenisai AI'}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-3 bg-white/5 rounded-full text-white/40 active:scale-90 transition-all hover:bg-white/10 hover:text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar pb-20">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[85%] p-5 rounded-[32px] text-sm leading-relaxed shadow-xl ${m.role === 'user' ? 'bg-accent text-white font-bold' : 'bg-white/5 text-white/80 border border-white/5'}`}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/5 px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest text-accent animate-pulse border border-white/5">
              Processing Request...
            </div>
          </div>
        )}
        {isLiveActive && (
          <div className="flex flex-col items-center justify-center py-10 space-y-4 animate-in fade-in zoom-in-95">
             <div className="relative">
                <div className="absolute inset-0 bg-accent/20 rounded-full animate-ping"></div>
                <div className="relative w-24 h-24 bg-accent rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(var(--color-primary),0.5)]">
                   <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-20a3 3 0 013 3v10a3 3 0 01-6 0V7a3 3 0 013-3z"></path></svg>
                </div>
             </div>
             <p className="text-[10px] font-black uppercase tracking-[0.5em] text-accent animate-pulse">Listening & Responding</p>
          </div>
        )}
      </div>

      <div className="p-6 border-t border-white/5 bg-zinc-900/60 backdrop-blur-2xl pb-12 transition-all">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 group">
            <input 
              type="text" value={input} 
              onChange={e => setInput(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleSend()} 
              placeholder={isLiveActive ? "Voice mode active..." : "Type your request..."} 
              disabled={isLiveActive}
              className="w-full bg-white/[0.04] rounded-[28px] py-5 pl-6 pr-14 outline-none border border-white/5 focus:border-accent/40 focus:bg-white/[0.07] transition-all text-sm font-medium placeholder:text-white/20 disabled:opacity-30" 
            />
            <button onClick={handleSend} disabled={isLiveActive} className="absolute right-3 top-3 bottom-3 aspect-square bg-white text-black rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-0">
               Go
            </button>
          </div>
          
          <button 
            onClick={startLiveSession}
            className={`flex-shrink-0 w-[60px] h-[60px] rounded-[28px] flex items-center justify-center transition-all duration-500 active:scale-90 shadow-2xl border
              ${isLiveActive ? 'bg-red-500 text-white border-red-400 rotate-90' : 'bg-accent text-white border-white/10 hover:shadow-accent/40'}
            `}
          >
            {isLiveActive ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke="white" strokeWidth="3" strokeLinecap="round"></path></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-20a3 3 0 013 3v10a3 3 0 01-6 0V7a3 3 0 013-3z"></path></svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBotView;
