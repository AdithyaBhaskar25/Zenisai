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

// Keeping your original helpers intact
function decodeBase64(base64: string) { const binaryString = atob(base64); const bytes = new Uint8Array(binaryString.length); for (let i = 0; i < binaryString.length; i++) { bytes[i] = binaryString.charCodeAt(i); } return bytes; }
function encodeBase64(bytes: Uint8Array) { let binary = ''; for (let i = 0; i < bytes.byteLength; i++) { binary += String.fromCharCode(bytes[i]); } return btoa(binary); }
async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> { const dataInt16 = new Int16Array(data.buffer); const frameCount = dataInt16.length / numChannels; const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate); for (let channel = 0; channel < numChannels; channel++) { const channelData = buffer.getChannelData(channel); for (let i = 0; i < frameCount; i++) { channelData[i] = dataInt16[i * numChannels + channel] / 32768.0; } } return buffer; }

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

  useEffect(() => { 
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLiveActive]);

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
    <div className="fixed inset-0 z-[500] bg-zinc-950/98 backdrop-blur-[60px] flex flex-col transition-all duration-300">
      {/* Header */}
      <header className="flex justify-between items-center px-6 py-10">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-white">Assistant</h2>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-1.5 h-1.5 rounded-full ${isLiveActive ? 'bg-white animate-pulse' : 'bg-white/20'}`} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
              {isLiveActive ? 'Live Voice' : 'Zenisai AI'}
            </span>
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-white/30 hover:bg-white/10 hover:text-white transition-all active:scale-90"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </header>

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 space-y-6 no-scrollbar">
        {!isLiveActive ? (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-500`}>
              <div className={`max-w-[85%] p-4 px-6 shadow-xl ${
                m.role === 'user' 
                  ? 'bg-white text-black rounded-[24px] rounded-tr-none font-bold' 
                  : 'bg-zinc-900 text-white/90 rounded-[24px] rounded-tl-none border border-white/5'
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
              <div className="absolute inset-0 bg-white/10 blur-[80px] rounded-full animate-pulse scale-150" />
              <div 
                className="relative w-32 h-32 rounded-full border border-white/10 flex items-center justify-center overflow-hidden"
                style={{ background: `radial-gradient(circle, ${dominantColor}33 0%, transparent 80%)` }}
              >
                <div className="flex gap-1 items-end h-8">
                  {[...Array(5)].map((_, i) => (
                    <div 
                      key={i} 
                      className="w-1.5 bg-white rounded-full animate-bounce" 
                      style={{ animationDelay: `${i * 0.1}s`, animationDuration: '0.8s' }} 
                    />
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-8 text-xs font-black uppercase tracking-[0.4em] text-white/40 animate-pulse">Assistant Listening</p>
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
      <footer className="p-6 pb-12">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="relative flex-1 group">
            <input 
              type="text" 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleSend()} 
              placeholder={isLiveActive ? "End voice session to type..." : "Request a song..."} 
              disabled={isLiveActive}
              className="w-full bg-white/[0.04] rounded-full py-5 pl-7 pr-16 outline-none border border-white/5 focus:border-white/20 focus:bg-white/[0.07] transition-all text-sm placeholder:text-white/20 disabled:opacity-20" 
            />
            <button 
              onClick={handleSend} 
              disabled={isLiveActive || !input.trim()}
              className="absolute right-2.5 top-2.5 bottom-2.5 aspect-square bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform disabled:opacity-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 12h14m-7-7l7 7-7 7"></path></svg>
            </button>
          </div>

          <button 
            onClick={startLiveSession}
            className={`w-[60px] h-[60px] rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 active:scale-90 border ${
              isLiveActive 
                ? 'bg-red-500 text-white border-red-400 rotate-90' 
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
