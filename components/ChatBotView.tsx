import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

// Logic helpers (Keeping your existing implementations intact)
function decodeBase64(base64: string) { /* ... same as your code ... */ const binaryString = atob(base64); const bytes = new Uint8Array(binaryString.length); for (let i = 0; i < binaryString.length; i++) { bytes[i] = binaryString.charCodeAt(i); } return bytes; }
function encodeBase64(bytes: Uint8Array) { /* ... same as your code ... */ let binary = ''; for (let i = 0; i < bytes.byteLength; i++) { binary += String.fromCharCode(bytes[i]); } return btoa(binary); }
async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> { /* ... same as your code ... */ const dataInt16 = new Int16Array(data.buffer); const frameCount = dataInt16.length / numChannels; const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate); for (let channel = 0; channel < numChannels; channel++) { const channelData = buffer.getChannelData(channel); for (let i = 0; i < frameCount; i++) { channelData[i] = dataInt16[i * numChannels + channel] / 32768.0; } } return buffer; }

const ChatBotView: React.FC<ChatBotViewProps> = ({ onClose, dominantColor, playbackControls }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([
    { role: 'bot', text: 'Zenisai AI active. I can search, control music, save tracks, and create playlists. Try "Play some Anirudh"!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Live Session Refs (Logic preserved)
  const liveSessionRef = useRef<any>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, isLiveActive]);

  useEffect(() => { return () => stopLiveSession(); }, []);

  const stopLiveSession = () => {
    if (liveSessionRef.current) { liveSessionRef.current.close(); liveSessionRef.current = null; }
    if (inputAudioCtxRef.current) { inputAudioCtxRef.current.close(); inputAudioCtxRef.current = null; }
    if (outputAudioCtxRef.current) { outputAudioCtxRef.current.close(); outputAudioCtxRef.current = null; }
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    setIsLiveActive(false);
  };

  const startLiveSession = async () => {
    if (isLiveActive) { stopLiveSession(); return; }
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
              for (let i = 0; i < inputData.length; i++) { int16[i] = inputData[i] * 32768; }
              const base64 = encodeBase64(new Uint8Array(int16.buffer));
              sessionPromise.then(session => { session.sendRealtimeInput({ media: { data: base64, mimeType: 'audio/pcm;rate=16000' } }); });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioCtxRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
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
                sessionPromise.then(session => { session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result } } }); });
              }
            }
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
            if (message.serverContent?.interrupted) { sourcesRef.current.forEach(s => s.stop()); sourcesRef.current.clear(); nextStartTimeRef.current = 0; }
          },
          onerror: (e) => { console.error(e); stopLiveSession(); },
          onclose: () => setIsLiveActive(false)
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "You are Zenisai assistant...",
          tools: [{ functionDeclarations: CONTROL_PLAYBACK_FUNCTIONS }],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
        }
      });
      liveSessionRef.current = await sessionPromise;
    } catch (e) { setIsLiveActive(false); }
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
           // ... logic execution same as provided ...
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
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[500] bg-zinc-950/95 backdrop-blur-[50px] saturate-150 flex flex-col font-sans"
    >
      {/* Header */}
      <header className="flex justify-between items-center px-8 pt-10 pb-6">
        <div className="space-y-1">
          <h2 className="text-4xl font-black tracking-tighter text-white">Assistant</h2>
          <div className="flex items-center gap-2">
            <motion.div 
              animate={{ opacity: [1, 0.5, 1] }} 
              transition={{ repeat: Infinity, duration: 2 }}
              className={`w-2 h-2 rounded-full ${isLiveActive ? 'bg-accent' : 'bg-white/20'}`} 
            />
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
              {isLiveActive ? 'Live Spatial Voice' : 'Zenisai Neural Engine'}
            </span>
          </div>
        </div>
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={onClose} 
          className="p-4 bg-white/5 rounded-full text-white/40 border border-white/10 hover:bg-white/10 hover:text-white transition-all"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
        </motion.button>
      </header>

      {/* Main Content Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-6 no-scrollbar">
        <AnimatePresence mode="popLayout">
          {!isLiveActive ? (
            messages.map((m, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] p-4 px-6 shadow-2xl ${
                  m.role === 'user' 
                    ? 'bg-white text-black rounded-[24px] rounded-tr-none font-bold' 
                    : 'bg-zinc-900/50 text-white/90 rounded-[24px] rounded-tl-none border border-white/5'
                }`}>
                  <p className="text-[15px] leading-relaxed">{m.text}</p>
                </div>
              </motion.div>
            ))
          ) : (
            /* Immersive Voice Mode UI */
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center space-y-12 pb-20"
            >
              <div className="relative">
                {/* Reactive Voice Orb */}
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ repeat: Infinity, duration: 3 }}
                  className="absolute inset-0 blur-[60px] rounded-full"
                  style={{ backgroundColor: dominantColor || '#fff' }}
                />
                <div 
                  className="relative w-40 h-40 rounded-full flex items-center justify-center border border-white/20 shadow-2xl"
                  style={{ background: `radial-gradient(circle, ${dominantColor}44 0%, transparent 70%)` }}
                >
                  <div className="flex gap-1.5 items-end h-10">
                    {[1, 2, 3, 4, 5].map(i => (
                      <motion.div 
                        key={i}
                        animate={{ height: [10, 40, 10] }}
                        transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                        className="w-1.5 bg-white rounded-full"
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-xl font-bold text-white">Listening...</p>
                <p className="text-sm text-white/30">Go ahead, I'm synced to your music</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="px-6 py-3 bg-white/5 rounded-full border border-white/5">
              <div className="flex gap-1">
                <div className="w-1 h-1 bg-accent rounded-full animate-bounce" />
                <div className="w-1 h-1 bg-accent rounded-full animate-bounce delay-100" />
                <div className="w-1 h-1 bg-accent rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input Bar */}
      <footer className="p-8 pb-12 bg-gradient-to-t from-black via-black/80 to-transparent">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <div className="relative flex-1 group">
            <input 
              type="text" 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleSend()} 
              placeholder={isLiveActive ? "End voice session to type..." : "Ask Zenisai anything..."} 
              disabled={isLiveActive}
              className="w-full bg-white/[0.03] rounded-[32px] py-6 pl-8 pr-16 outline-none border border-white/10 focus:border-white/30 focus:bg-white/[0.06] transition-all text-base placeholder:text-white/20 disabled:opacity-20" 
            />
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleSend} 
              disabled={isLiveActive || !input.trim()}
              className="absolute right-3 top-3 bottom-3 aspect-square bg-white text-black rounded-full flex items-center justify-center shadow-xl disabled:opacity-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 12h14m-7-7l7 7-7 7"></path></svg>
            </motion.button>
          </div>

          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={startLiveSession}
            className={`w-[72px] h-[72px] rounded-full flex items-center justify-center shadow-2xl transition-all border ${
              isLiveActive 
                ? 'bg-red-500 text-white border-red-400' 
                : 'bg-white/10 text-white border-white/10 backdrop-blur-xl'
            }`}
          >
            {isLiveActive ? (
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
            ) : (
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-20a3 3 0 013 3v10a3 3 0 01-6 0V7a3 3 0 013-3z"></path></svg>
            )}
          </motion.button>
        </div>
      </footer>
    </motion.div>
  );
};

export default ChatBotView;
