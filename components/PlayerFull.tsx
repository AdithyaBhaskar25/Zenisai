import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Song, Playlist } from '../types';

const parseTimestamp = (lrc: string): number => {
  const match = lrc.match(/\[(\d+):(\d+(?:\.\d+)?)\]/);
  if (!match) return 0;
  return parseInt(match[1]) * 60 + parseFloat(match[2]);
};

interface LyricLine { time: number; text: string; }

interface PlayerFullProps {
  song: Song; isPlaying: boolean; onToggle: () => void; onNext: () => void; onPrev: () => void;
  onClose: () => void; dominantColor: string; progress: number; duration: number;
  onSeek: (val: number) => void; analyser: AnalyserNode | null; sleepTimer: number | null;
  setSleepTimer: (val: number | null) => void; queue: Song[]; onPlayFromQueue: (song: Song) => void;
  lyrics: string; onRemoveFromQueue: (id: string) => void; onMoveQueueItem: (from: number, to: number) => void;
  playlists: Playlist[]; onAddToPlaylist: (song: Song, playlistId: string) => void;
  isFavorite: boolean; onToggleFavorite: () => void; onDownload: () => void; onShare: () => void;
  isShuffle: boolean; onToggleShuffle: () => void; repeatMode: 'off' | 'one' | 'all';
  onToggleRepeat: () => void; onShowPlaylistModal: () => void;
}

const PlayerFull: React.FC<PlayerFullProps> = ({ 
  song, isPlaying, onToggle, onNext, onPrev, onClose, dominantColor, progress, duration, onSeek, analyser,
  sleepTimer, setSleepTimer, queue, onPlayFromQueue, lyrics: propLyrics, onRemoveFromQueue, onMoveQueueItem, 
  isFavorite, onToggleFavorite, onDownload, onShare, isShuffle, onToggleShuffle, repeatMode, onToggleRepeat, onShowPlaylistModal
}) => {
  const [activeTab, setActiveTab] = useState<'lyrics' | 'queue'>('lyrics');
  const [showLyricsModal, setShowLyricsModal] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [showSleepDropdown, setShowSleepDropdown] = useState(false);
  
  const [syncedLyrics, setSyncedLyrics] = useState<LyricLine[]>([]);
  const [plainLyrics, setPlainLyrics] = useState<string[]>([]);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  
  const activeLyricRef = useRef<HTMLParagraphElement>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const touchStartRef = useRef<number | null>(null);

  // --- LYRIC ENGINE ---
  useEffect(() => {
    const fetchLyrics = async () => {
      if (!song.title) return;
      setIsLoadingLyrics(true);
      try {
        const res = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(song.artist)}&track_name=${encodeURIComponent(song.title)}&duration=${Math.round(duration)}`);
        const data = await res.json();
        if (data.syncedLyrics) {
          setSyncedLyrics(data.syncedLyrics.split('\n').map((l: string) => ({
            time: parseTimestamp(l), text: l.replace(/\[.*\]/, '').trim()
          })).filter((l: any) => l.text !== undefined));
        } else { setPlainLyrics((data.plainLyrics || propLyrics).split('\n')); }
      } catch (e) { setPlainLyrics(propLyrics.split('\n')); }
      finally { setIsLoadingLyrics(false); }
    };
    fetchLyrics();
  }, [song.id, duration]);

  const currentLineIndex = useMemo(() => {
    for (let i = syncedLyrics.length - 1; i >= 0; i--) {
      if (progress >= syncedLyrics[i].time) return i;
    }
    return -1;
  }, [syncedLyrics, progress]);

  // --- AUDIO GRAPH VISUALIZER ---
  useEffect(() => {
    if (!waveCanvasRef.current) return;
    const canvas = waveCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animationId: number;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { width, height } = canvas;
      const progressPercent = progress / (duration || 1);
      
      const barWidth = 3;
      const gap = 2;
      const totalBars = Math.floor(width / (barWidth + gap));
      
      for (let i = 0; i < totalBars; i++) {
        const x = i * (barWidth + gap);
        // Generate pseudo-random bar heights that look like a waveform
        const seed = Math.sin(i * 0.2) * 0.5 + 0.5;
        const dynamicH = isPlaying ? Math.random() * 0.3 : 0;
        const barHeight = (seed + dynamicH) * height * 0.8;
        
        const isPlayed = (x / width) < progressPercent;
        ctx.fillStyle = isPlayed ? dominantColor : 'rgba(255,255,255,0.1)';
        
        // Rounded bars
        ctx.beginPath();
        ctx.roundRect(x, (height - barHeight) / 2, barWidth, barHeight, 2);
        ctx.fill();
        
        if (isPlayed) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = dominantColor;
        } else {
          ctx.shadowBlur = 0;
        }
      }
      animationId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, progress, duration, dominantColor]);

  // --- GESTURE SWIPE LOGIC ---
  const handleTouchStart = (e: React.TouchEvent) => touchStartRef.current = e.touches[0].clientX;
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return;
    const diff = touchStartRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 80) {
      if (diff > 0) onNext();
      else onPrev();
    }
    touchStartRef.current = null;
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div 
      className="fixed inset-0 z-[200] bg-black text-white flex flex-col landscape:flex-row overflow-hidden font-sans select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Immersive Background */}
      <div className="absolute inset-0 opacity-40 transition-all duration-1000" style={{ background: `radial-gradient(circle at 50% 50%, ${dominantColor} 0%, #000 80%)` }} />
      <div className="absolute inset-0 backdrop-blur-[100px]" />

      {/* --- EDGE CONTROLS (LANDSCAPE ONLY) --- */}
      <button onClick={onPrev} className="hidden landscape:flex absolute left-0 top-0 bottom-0 w-20 z-[210] items-center justify-center group bg-gradient-to-r from-black/20 to-transparent">
        <svg className="w-10 h-10 opacity-0 group-hover:opacity-100 transition-all" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
      </button>
      <button onClick={onNext} className="hidden landscape:flex absolute right-0 top-0 bottom-0 w-20 z-[210] items-center justify-center group bg-gradient-to-l from-black/20 to-transparent">
        <svg className="w-10 h-10 opacity-0 group-hover:opacity-100 transition-all" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
      </button>

      {/* --- LEFT COLUMN: PLAYER CORE --- */}
      <section className="relative flex-1 flex flex-col h-full z-10 landscape:max-w-[320px] lg:landscape:max-w-[380px] landscape:border-r border-white/5 overflow-hidden">
        
        {/* Top Header Controls (Universal) */}
        <header className="flex items-center justify-between p-6 shrink-0">
          <button onClick={onClose} className="p-3 bg-white/5 rounded-full hover:bg-white/10 active:scale-90 transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
          </button>
          
          <div className="flex gap-2">
             <button onClick={onDownload} className="p-3 bg-white/5 rounded-full"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m4 4V4"/></svg></button>
             <button onClick={onShowPlaylistModal} className="p-3 bg-white/5 rounded-full"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M12 4v16m8-8H4"/></svg></button>
             <div className="relative">
                <button onClick={() => setShowSleepDropdown(!showSleepDropdown)} className={`p-3 rounded-full transition-all ${sleepTimer ? 'bg-white text-black' : 'bg-white/5'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></button>
                {showSleepDropdown && (
                  <div className="absolute right-0 mt-3 w-40 bg-zinc-900 border border-white/10 rounded-2xl p-2 shadow-2xl z-50">
                    {[null, 15*60, 30*60, 45*60].map(v => (
                      <button key={String(v)} onClick={() => {setSleepTimer(v); setShowSleepDropdown(false)}} className="w-full text-left p-3 hover:bg-white/5 rounded-xl text-[10px] font-bold uppercase tracking-widest">{v ? v/60+' Min' : 'Off'}</button>
                    ))}
                  </div>
                )}
             </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6 min-h-0 landscape:justify-start landscape:pt-10">
          {/* Album Art: Tap to Toggle Play/Pause in Landscape */}
          <div 
            onClick={() => { if(window.innerWidth > window.innerHeight) onToggle(); }}
            className="relative w-full max-w-[280px] landscape:max-w-[180px] aspect-square shrink-0 cursor-pointer group"
          >
            <img src={song.artwork} className={`w-full h-full object-cover rounded-[48px] shadow-2xl transition-all duration-700 ${isPlaying ? 'scale-100' : 'scale-90 opacity-40 blur-[2px]'}`} />
            {/* Play Icon Overlay (Landscape Only) */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity landscape:flex hidden">
              {isPlaying ? <svg className="w-12 h-12" fill="white" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg className="w-12 h-12" fill="white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
            </div>
            
            <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }} className="absolute bottom-4 left-4 p-3.5 rounded-2xl backdrop-blur-3xl shadow-xl transition-all active:scale-75" style={{ backgroundColor: `${dominantColor}dd` }}>
              <svg className="w-5 h-5" fill={isFavorite ? "currentColor" : "none"} stroke="white" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
            </button>
          </div>

          <div className="text-center w-full space-y-1">
            <h2 className="text-xl landscape:text-lg font-black truncate px-4">{song.title}</h2>
            <p className="text-[10px] landscape:text-[9px] font-bold opacity-30 uppercase tracking-[0.3em]">{song.artist}</p>
          </div>
        </div>

        {/* --- CONTROLS DOCK (PORTRAIT ORDER: Shuffle -> Prev -> Play -> Next -> Repeat) --- */}
        <div className="p-10 landscape:p-8 space-y-8 shrink-0">
          <div className="flex items-center justify-between">
            <button onClick={onToggleShuffle} className={`p-2 transition-all ${isShuffle ? 'text-white' : 'opacity-20'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg></button>
            
            <div className="flex items-center gap-6">
              <button onClick={onPrev} className="opacity-60 active:scale-75 transition-all"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg></button>
              <button onClick={onToggle} className="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all">
                {isPlaying ? <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
              </button>
              <button onClick={onNext} className="opacity-60 active:scale-75 transition-all"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg></button>
            </div>

            <button onClick={onToggleRepeat} className={`p-2 transition-all ${repeatMode !== 'off' ? 'text-white' : 'opacity-20'}`}>
              <div className="relative">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                {repeatMode === 'one' && <span className="absolute -top-1 -right-1 text-[7px] font-black bg-white text-black rounded-full w-3.5 h-3.5 flex items-center justify-center">1</span>}
              </div>
            </button>
          </div>
          
          <button onClick={() => setShowQueueModal(true)} className="landscape:hidden w-full py-2 text-[9px] font-black uppercase tracking-[0.4em] opacity-20 text-center">Open Queue</button>
        </div>
      </section>

      {/* --- RIGHT PANEL: DASHBOARD --- */}
      <section className="hidden landscape:flex flex-1 flex-col h-full bg-black/20 backdrop-blur-3xl relative">
        <nav className="flex items-center justify-between px-10 py-8 shrink-0">
          <div className="flex gap-8">
            {(['lyrics', 'queue'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`text-[10px] font-black uppercase tracking-[0.4em] transition-all ${activeTab === t ? 'text-white border-b-2 border-white pb-1' : 'opacity-20'}`}>{t}</button>
            ))}
          </div>
        </nav>

        <div className="flex-1 overflow-y-auto no-scrollbar px-10 pb-20">
          {activeTab === 'lyrics' ? (
            <div className="space-y-8 py-4">
              {syncedLyrics.length > 0 ? syncedLyrics.map((l, i) => (
                <p key={i} ref={i === currentLineIndex ? activeLyricRef : null} onClick={() => onSeek(l.time)} className={`text-4xl font-black transition-all cursor-pointer ${i === currentLineIndex ? 'text-white scale-105' : 'text-white/5 hover:text-white/10'}`}>{l.text || "•••"}</p>
              )) : plainLyrics.map((l, i) => <p key={i} className="text-xl font-bold opacity-10 leading-relaxed">{l}</p>)}
            </div>
          ) : (
             <div className="space-y-2 py-4">
               {queue.map((qs, i) => (
                 <div key={qs.id} className={`flex items-center gap-4 p-4 rounded-3xl transition-all border ${qs.id === song.id ? 'bg-white/10 border-white/20' : 'bg-white/5 border-transparent'}`}>
                   <img src={qs.artwork} className="w-10 h-10 rounded-xl" />
                   <div className="flex-1 min-w-0" onClick={() => onPlayFromQueue(qs)}><p className={`text-xs font-black truncate ${qs.id === song.id ? 'text-accent' : ''}`}>{qs.title}</p></div>
                   <button onClick={() => onRemoveFromQueue(qs.id)} className="p-2 opacity-20 hover:opacity-100"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6"/></svg></button>
                 </div>
               ))}
             </div>
          )}
        </div>
      </section>

      {/* --- GLOBAL WAVE PROGRESS BAR (Scrubber) --- */}
      <div 
        className="fixed bottom-0 left-0 w-full h-8 landscape:h-12 z-[250] bg-transparent cursor-pointer group"
        onClick={(e) => onSeek(((e.clientX - e.currentTarget.getBoundingClientRect().left) / e.currentTarget.offsetWidth) * duration)}
      >
        <div className="absolute inset-x-4 bottom-2 landscape:bottom-4 h-full flex items-center">
            <canvas ref={waveCanvasRef} className="w-full h-full opacity-80" width={1200} height={60} />
            {/* Scrubber Knob */}
            <div 
                className="absolute w-1 h-full bg-white shadow-[0_0_15px_white] transition-all duration-300 pointer-events-none" 
                style={{ left: `${(progress / (duration || 1)) * 100}%` }} 
            />
        </div>
      </div>

      {/* --- PORTRAIT MODALS --- */}
      {showQueueModal && (
        <div className="fixed inset-0 z-[300] bg-[#0a0a0a] animate-in slide-in-from-bottom duration-500">
           <div className="relative h-full flex flex-col p-8 pt-20">
              <header className="flex justify-between items-center mb-8 px-4"><h3 className="text-[10px] font-black uppercase tracking-[0.5em] opacity-30">Queue</h3><button onClick={() => setShowQueueModal(false)} className="p-3 bg-white/10 rounded-full"><svg className="w-6 h-6" strokeWidth="3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6"/></svg></button></header>
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pb-32">
                {queue.map((qs, i) => (
                  <div key={qs.id} className="flex items-center gap-4 p-5 bg-white/5 rounded-[32px] border border-white/5">
                    <img src={qs.artwork} className="w-14 h-14 rounded-2xl" />
                    <div className="flex-1 min-w-0" onClick={() => {onPlayFromQueue(qs); setShowQueueModal(false);}}><p className="text-sm font-black truncate">{qs.title}</p></div>
                    <button onClick={() => onRemoveFromQueue(qs.id)} className="p-3 opacity-20"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6"/></svg></button>
                  </div>
                ))}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PlayerFull;
