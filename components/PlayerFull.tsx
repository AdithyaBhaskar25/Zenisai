import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Download, 
  Plus, 
  Timer, 
  Heart, 
  Shuffle, 
  Repeat, 
  ListMusic, 
  X,
  ChevronDown,
  GripVertical
} from 'lucide-react';
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
  const dragItemRef = useRef<number | null>(null);

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

  useEffect(() => {
    if (activeLyricRef.current) activeLyricRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentLineIndex, showLyricsModal, activeTab]);

  // --- AUDIO BEAT WAVE VISUALIZER ---
  useEffect(() => {
    if (!waveCanvasRef.current) return;
    const canvas = waveCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    let animationId: number;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { width, height } = canvas;
      const progressPercent = progress / (duration || 1);
      
      if (analyser && isPlaying) analyser.getByteFrequencyData(dataArray!);

      const barWidth = 4;
      const gap = 2;
      const bars = Math.floor(width / (barWidth + gap));
      
      for (let i = 0; i < bars; i++) {
        const x = i * (barWidth + gap);
        const freqIndex = Math.floor((i / bars) * (dataArray?.length || 1));
        const amplitude = dataArray ? dataArray[freqIndex] / 255 : Math.sin(i * 0.1) * 0.2 + 0.5;
        const barHeight = height * (isPlaying ? amplitude * 0.8 : 0.2);
        
        const isPlayed = (x / width) < progressPercent;
        ctx.fillStyle = isPlayed ? dominantColor : 'rgba(255,255,255,0.15)';
        
        ctx.beginPath();
        ctx.roundRect(x, (height - barHeight) / 2, barWidth, Math.max(barHeight, 4), 2);
        ctx.fill();
        if (isPlayed) {
          ctx.shadowBlur = 12;
          ctx.shadowColor = dominantColor;
        }
      }
      animationId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, progress, duration, dominantColor, analyser]);

  // --- GESTURE LOGIC ---
  const handleTouchStart = (e: React.TouchEvent) => touchStartRef.current = e.touches[0].clientX;
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return;
    const diff = touchStartRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 70) {
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
    <div className="fixed inset-0 z-[200] bg-black text-white flex flex-col landscape:flex-row overflow-hidden font-sans select-none">
      
      {/* Glossy Gradients */}
      <div className="absolute inset-0 opacity-40 transition-all duration-1000" style={{ background: `radial-gradient(circle at 50% 120%, ${dominantColor}, transparent 70%), linear-gradient(to bottom, transparent, #000 90%)` }} />
      <div className="absolute inset-0 backdrop-blur-[110px]" />

      {/* --- LEFT PANEL: PLAYER CORE --- */}
      <section className="relative flex-1 flex flex-col h-full z-10 landscape:max-w-[400px] landscape:border-r border-white/5 overflow-hidden">
        
        {/* Header: All Utility Icons (Portrait) */}
        <header className="flex items-center justify-between p-6 shrink-0">
          <button onClick={onClose} className="p-3 bg-white/5 rounded-full hover:bg-white/10 active:scale-90 transition-all">
            <ChevronDown className="w-6 h-6 stroke-[3]" />
          </button>
          
          <div className="landscape:hidden flex gap-3">
             <button onClick={onDownload} className="p-3 bg-white/5 rounded-full"><Download className="w-5 h-5" /></button>
             <button onClick={onShowPlaylistModal} className="p-3 bg-white/5 rounded-full"><Plus className="w-5 h-5" /></button>
             <div className="relative">
                <button onClick={() => setShowSleepDropdown(!showSleepDropdown)} className={`p-3 rounded-full transition-all ${sleepTimer ? 'bg-white text-black' : 'bg-white/5'}`}>
                  <Timer className="w-5 h-5" />
                </button>
                {showSleepDropdown && (
                  <div className="absolute right-0 mt-3 w-40 bg-zinc-900/95 border border-white/10 rounded-2xl p-2 shadow-2xl z-50">
                    {[null, 60, 900, 1800].map(v => (
                      <button key={String(v)} onClick={() => {setSleepTimer(v); setShowSleepDropdown(false)}} className="w-full text-left p-3 hover:bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest">
                        {v ? (v === 60 ? '60 Sec' : v/60 + ' Min') : 'Off'}
                      </button>
                    ))}
                  </div>
                )}
             </div>
          </div>
        </header>

        {/* Hero Section */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-8 min-h-0 landscape:justify-start landscape:pt-10">
          <div 
            onClick={onToggle}
            className="relative w-full max-w-[320px] landscape:max-w-[180px] aspect-square shrink-0 cursor-pointer"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <img src={song.artwork} className={`w-full h-full object-cover rounded-[56px] shadow-2xl transition-all duration-700 ${isPlaying ? 'scale-100' : 'scale-90 opacity-40 blur-[4px]'}`} />
            
            <button 
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }} 
              className="absolute bottom-5 left-5 p-4 rounded-3xl backdrop-blur-3xl shadow-xl transition-all active:scale-75"
              style={{ backgroundColor: `${dominantColor}dd` }}
            >
              <Heart className={`w-6 h-6 ${isFavorite ? 'fill-white' : ''}`} />
            </button>
          </div>

          <div className="text-center w-full space-y-1">
            <h2 className="text-2xl landscape:text-xl font-black truncate px-6">{song.title}</h2>
            <p className="text-xs landscape:text-[10px] font-bold opacity-30 uppercase tracking-[0.4em]">{song.artist}</p>
          </div>

          {/* Mini Lyrics Trigger */}
          <div onClick={() => setShowLyricsModal(true)} className="landscape:hidden w-full bg-white/5 p-5 rounded-[36px] border border-white/5 active:scale-95 transition-all text-center">
             <p className="text-[8px] font-black uppercase opacity-20 mb-1 tracking-widest">Current Lyrics</p>
             <p className="text-sm font-bold truncate opacity-80">{syncedLyrics[currentLineIndex]?.text || "•••"}</p>
          </div>
        </div>

        {/* Gesture Controls Overlay (Shuffle, Queue, Repeat) */}
        <div className="p-10 landscape:p-8 space-y-8 shrink-0">
          <div className="flex items-center justify-between px-4">
            <button onClick={onToggleShuffle} className={`p-2 transition-all ${isShuffle ? 'text-white' : 'opacity-20'}`}><Shuffle className="w-6 h-6 stroke-[2.5]" /></button>
            <button onClick={() => setShowQueueModal(true)} className="p-4 bg-white/5 rounded-3xl active:scale-90 transition-all">
              <ListMusic className="w-7 h-7 stroke-[2.5]" />
            </button>
            <button onClick={onToggleRepeat} className={`p-2 transition-all ${repeatMode !== 'off' ? 'text-white' : 'opacity-20'}`}>
              <div className="relative">
                <Repeat className="w-6 h-6 stroke-[2.5]" />
                {repeatMode === 'one' && <span className="absolute -top-1 -right-1 text-[8px] font-black bg-white text-black rounded-full w-3.5 h-3.5 flex items-center justify-center">1</span>}
              </div>
            </button>
          </div>
          <p className="text-[8px] font-black text-center opacity-10 uppercase tracking-widest">Tap Art: Play/Pause • Swipe: Next/Prev</p>
        </div>
      </section>

      {/* --- RIGHT PANEL: DASHBOARD (LANDSCAPE) --- */}
      <section className="hidden landscape:flex flex-1 flex-col h-full bg-black/20 backdrop-blur-3xl relative">
        <nav className="flex items-center justify-between px-10 py-8 shrink-0">
          <div className="flex gap-10">
            {(['lyrics', 'queue'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`text-[11px] font-black uppercase tracking-[0.5em] transition-all ${activeTab === t ? 'text-white border-b-2 border-white pb-2' : 'opacity-20'}`}>{t}</button>
            ))}
          </div>
          
          {/* Utilities in Landscape Nav */}
          <div className="flex gap-4 items-center">
             <button onClick={onDownload} className="p-3 bg-white/5 rounded-full hover:bg-white/10"><Download className="w-5 h-5" /></button>
             <button onClick={onShowPlaylistModal} className="p-3 bg-white/5 rounded-full hover:bg-white/10"><Plus className="w-5 h-5" /></button>
             <div className="relative">
                <button onClick={() => setShowSleepDropdown(!showSleepDropdown)} className={`p-3 rounded-full transition-all ${sleepTimer ? 'bg-white text-black' : 'bg-white/5'}`}>
                  <Timer className="w-5 h-5" />
                </button>
                {showSleepDropdown && (
                  <div className="absolute right-0 mt-3 w-40 bg-zinc-900 border border-white/10 rounded-2xl p-2 z-50 shadow-2xl">
                    {[null, 60, 900, 1800].map(v => (
                      <button key={String(v)} onClick={() => {setSleepTimer(v); setShowSleepDropdown(false)}} className="w-full text-left p-3 hover:bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest">{v ? (v===60?'1 Min':v/60+' Min') : 'Off'}</button>
                    ))}
                  </div>
                )}
             </div>
          </div>
        </nav>

        <div className="flex-1 overflow-y-auto no-scrollbar px-12 pb-24">
          {activeTab === 'lyrics' ? (
            <div className="space-y-10 py-8">
              {syncedLyrics.length > 0 ? syncedLyrics.map((l, i) => (
                <p key={i} ref={i === currentLineIndex ? activeLyricRef : null} onClick={() => onSeek(l.time)} className={`text-4xl font-black transition-all cursor-pointer ${i === currentLineIndex ? 'text-white' : 'text-white/5 hover:text-white/15'}`}>{l.text || "•••"}</p>
              )) : plainLyrics.map((l, i) => <p key={i} className="text-xl font-bold opacity-10 leading-relaxed">{l}</p>)}
            </div>
          ) : (
             <div className="space-y-3 py-8">
               {queue.map((qs, i) => (
                 <div key={qs.id} draggable onDragStart={() => (dragItemRef.current = i)} onDragOver={(e) => { e.preventDefault(); if (dragItemRef.current !== null && dragItemRef.current !== i) { onMoveQueueItem(dragItemRef.current, i); dragItemRef.current = i; } }} className={`flex items-center gap-4 p-5 rounded-[36px] transition-all border ${qs.id === song.id ? 'bg-white/10 border-white/20' : 'bg-white/5 border-transparent'}`}>
                   <img src={qs.artwork} className="w-12 h-12 rounded-2xl" />
                   <div className="flex-1 min-w-0" onClick={() => onPlayFromQueue(qs)}><p className={`text-sm font-black truncate ${qs.id === song.id ? 'text-accent' : ''}`}>{qs.title}</p></div>
                   <button onClick={() => onRemoveFromQueue(qs.id)} className="p-2 opacity-20 hover:opacity-100 hover:text-red-500"><X className="w-5 h-5" /></button>
                 </div>
               ))}
             </div>
          )}
        </div>
      </section>

      {/* --- GESTURE-BASED HORIZON WAVEBAR --- */}
      <div 
        className="fixed bottom-0 left-0 w-full h-10 landscape:h-14 z-[250] flex flex-col items-center justify-center cursor-pointer group"
        onClick={(e) => onSeek(((e.clientX - e.currentTarget.getBoundingClientRect().left) / e.currentTarget.offsetWidth) * duration)}
      >
        <canvas ref={waveCanvasRef} className="w-full h-8 landscape:h-10 px-6 opacity-80" width={1400} height={60} />
        <div className="flex justify-between w-full px-8 text-[9px] font-black opacity-20 -mt-1 uppercase tracking-widest">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
        </div>
        {/* Scrubber Glow */}
        <div 
            className="absolute h-full w-0.5 bg-white shadow-[0_0_20px_white] pointer-events-none transition-all duration-300"
            style={{ left: `${(progress / (duration || 1)) * 100}%` }}
        />
      </div>

      {/* --- MOBILE MODALS --- */}
      {showLyricsModal && (
        <div className="fixed inset-0 z-[300] bg-black animate-in slide-in-from-bottom duration-500 landscape:hidden">
          <div className="absolute inset-0 opacity-50" style={{ background: `linear-gradient(to bottom, ${dominantColor}, #000)` }} />
          <div className="relative h-full flex flex-col p-10 pt-24">
            <button onClick={() => setShowLyricsModal(false)} className="absolute top-10 right-10 p-3 bg-white/10 rounded-full"><X className="w-6 h-6 stroke-[3]" /></button>
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-10 pb-32">
                {syncedLyrics.length > 0 ? syncedLyrics.map((l, i) => (
                  <p key={i} ref={i === currentLineIndex ? activeLyricRef : null} onClick={() => onSeek(l.time)} className={`text-4xl font-black leading-tight transition-all ${i === currentLineIndex ? 'text-white scale-105' : 'text-white/10'}`}>{l.text || "•••"}</p>
                )) : plainLyrics.map((l, i) => <p key={i} className="text-xl font-bold opacity-10 leading-relaxed">{l}</p>)}
            </div>
          </div>
        </div>
      )}

      {showQueueModal && (
        <div className="fixed inset-0 z-[300] bg-[#050505] animate-in slide-in-from-bottom duration-500 landscape:hidden">
           <div className="relative h-full flex flex-col p-8 pt-20">
              <header className="flex justify-between items-center mb-10">
                <h3 className="text-[11px] font-black uppercase tracking-[0.5em] opacity-40">Queue List</h3>
                <button onClick={() => setShowQueueModal(false)} className="p-3 bg-white/10 rounded-full"><X className="w-6 h-6 stroke-[3]" /></button>
              </header>
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pb-32">
                {queue.map((qs, i) => (
                  <div 
                    key={qs.id} 
                    draggable 
                    onDragStart={() => (dragItemRef.current = i)}
                    onDragOver={(e) => { e.preventDefault(); if (dragItemRef.current !== null && dragItemRef.current !== i) { onMoveQueueItem(dragItemRef.current, i); dragItemRef.current = i; } }}
                    className="flex items-center gap-4 p-5 bg-white/5 rounded-[40px] border border-white/5 active:scale-95 touch-none"
                  >
                    <GripVertical className="w-5 h-5 opacity-20" />
                    <img src={qs.artwork} className="w-12 h-12 rounded-2xl" />
                    <div className="flex-1 min-w-0" onClick={() => {onPlayFromQueue(qs); setShowQueueModal(false);}}>
                      <p className="text-sm font-black truncate">{qs.title}</p>
                    </div>
                    <button onClick={() => onRemoveFromQueue(qs.id)} className="p-3 opacity-20"><X className="w-5 h-5" /></button>
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
