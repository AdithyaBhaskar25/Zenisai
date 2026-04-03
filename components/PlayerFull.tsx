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
  const lastTapRef = useRef<number>(0);
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
  }, [currentLineIndex, showLyricsModal]);

  // --- AUDIO GRAPH VISUALIZER ---
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
      const gap = 3;
      const bars = Math.floor(width / (barWidth + gap));
      
      for (let i = 0; i < bars; i++) {
        const x = i * (barWidth + gap);
        const freqIndex = Math.floor((i / bars) * (dataArray?.length || 1));
        const amplitude = dataArray ? dataArray[freqIndex] / 255 : Math.sin(i * 0.15) * 0.2 + 0.4;
        const barHeight = height * (isPlaying ? amplitude * 0.8 : 0.2);
        const isPlayed = (x / width) < progressPercent;

        ctx.fillStyle = isPlayed ? dominantColor : 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.roundRect(x, (height - barHeight) / 2, barWidth, Math.max(barHeight, 4), 3);
        ctx.fill();
        if (isPlayed) { ctx.shadowBlur = 15; ctx.shadowColor = dominantColor; }
      }
      animationId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, progress, duration, dominantColor, analyser]);

  // --- GESTURE LOGIC ---
  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) onToggle();
    lastTapRef.current = now;
  };

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
      className="fixed inset-0 z-[200] bg-black text-white flex flex-col overflow-hidden font-sans select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={onToggle} // Desktop double-click
    >
      <div className="absolute inset-0 opacity-40 transition-all duration-1000" style={{ background: `linear-gradient(to bottom, ${dominantColor}22 0%, #000 100%)` }} />
      <div className="absolute inset-0 backdrop-blur-[140px]" />

      {/* --- EDGE TAP ZONES (NEXT/PREV) --- */}
      <div onClick={onPrev} className="absolute left-0 top-0 bottom-0 w-[12%] z-20 cursor-pointer group" />
      <div onClick={onNext} className="absolute right-0 top-0 bottom-0 w-[12%] z-20 cursor-pointer group" />

      {/* --- HEADER --- */}
      <header className="relative z-30 flex items-center justify-between p-6 landscape:px-12 landscape:pt-10 shrink-0">
        <div className="flex items-center gap-6">
            <button onClick={onClose} className="p-3 bg-white/5 rounded-full hover:bg-white/10 active:scale-90 transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            {/* Landscape Nav Tabs (Top Leftish) */}
            <div className="hidden landscape:flex gap-8 ml-4">
                {(['lyrics', 'queue'] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)} className={`text-[11px] font-black uppercase tracking-[0.4em] transition-all border-b-2 pb-1 ${activeTab === t ? 'text-white border-white' : 'opacity-20 border-transparent'}`}>{t}</button>
                ))}
            </div>
        </div>

        {/* Global Controls Row */}
        <div className="flex gap-3 items-center">
            <button onClick={onToggleShuffle} className={`p-3 rounded-full transition-all ${isShuffle ? 'bg-white text-black' : 'bg-white/5'}`}>
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
            </button>
            <button onClick={onToggleRepeat} className={`p-3 rounded-full transition-all ${repeatMode !== 'off' ? 'bg-white text-black' : 'bg-white/5'}`}>
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            </button>
            <button onClick={onDownload} className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M12 5v14m0 0l-5-5m5 5l5-5"></path></svg></button>
            <button onClick={onShowPlaylistModal} className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg></button>
            <div className="relative">
                <button onClick={() => setShowSleepDropdown(!showSleepDropdown)} className={`p-3 rounded-full transition-all ${sleepTimer ? 'bg-white text-black' : 'bg-white/5'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </button>
                {showSleepDropdown && (
                    <div className="absolute right-0 mt-3 w-40 bg-zinc-900/95 border border-white/10 rounded-2xl p-2 z-[60] shadow-2xl animate-in fade-in zoom-in-95">
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

      {/* --- CONTENT CENTERPIECE --- */}
      <main className="relative flex-1 flex flex-col landscape:flex-row items-center justify-center px-8 z-10 min-h-0">
        
        {/* Left Column (Landscape) / Top Section (Portrait) */}
        <div className="flex flex-col items-center landscape:items-start justify-center gap-6 landscape:w-[40%]">
            <div 
              onClick={handleDoubleTap}
              className="relative w-full max-w-[300px] landscape:max-w-[240px] aspect-square shrink-0 cursor-pointer transition-transform active:scale-95"
            >
              <img src={song.artwork} className={`w-full h-full object-cover rounded-[56px] shadow-2xl transition-all duration-1000 ${isPlaying ? 'scale-100' : 'scale-90 opacity-40 blur-[4px]'}`} />
              <button 
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }} 
                className="absolute bottom-5 left-5 p-4 rounded-3xl backdrop-blur-3xl shadow-xl transition-all active:scale-75"
                style={{ backgroundColor: `${dominantColor}dd` }}
              >
                <svg className="w-6 h-6" fill={isFavorite ? "currentColor" : "none"} stroke="white" viewBox="0 0 24 24"><path strokeWidth="3" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
              </button>
            </div>

            <div className="text-center landscape:text-left w-full space-y-2">
              <h2 className="text-2xl landscape:text-3xl font-black truncate px-2">{song.title}</h2>
              <p className="text-xs landscape:text-sm font-bold opacity-30 uppercase tracking-[0.4em]">{song.artist}</p>
            </div>
        </div>

        {/* Action Pills & Sync Lyrics Preview (Portrait Only) */}
        <div className="flex flex-col items-center gap-4 mt-8 landscape:hidden w-full max-w-sm">
            <div 
                onClick={() => setShowLyricsModal(true)}
                className="w-full bg-white/5 border border-white/5 p-5 rounded-[40px] active:scale-95 transition-all text-center"
            >
                <p className="text-[14px] font-bold opacity-80 animate-in fade-in slide-in-from-bottom-1">
                    {syncedLyrics[currentLineIndex]?.text || "•••"}
                </p>
            </div>
            <div className="flex gap-3 w-full">
                <button onClick={() => setShowLyricsModal(true)} className="flex-1 py-4 bg-white/10 rounded-full font-black text-[10px] uppercase tracking-widest">Full Lyrics</button>
                <button onClick={() => setShowQueueModal(true)} className="flex-1 py-4 bg-white/10 rounded-full font-black text-[10px] uppercase tracking-widest">Queue</button>
            </div>
        </div>
      </main>

      {/* --- GLOBAL GRAPH SCRUBBER --- */}
      <div 
        className="relative h-16 w-full z-40 bg-transparent cursor-pointer flex flex-col justify-end"
        onClick={(e) => onSeek(((e.clientX - e.currentTarget.getBoundingClientRect().left) / e.currentTarget.offsetWidth) * duration)}
      >
        <canvas ref={waveCanvasRef} className="w-full h-10 opacity-90 px-2" width={1600} height={100} />
        <div className="flex justify-between w-full px-8 py-4 text-[9px] font-black opacity-30 tracking-[0.3em] uppercase">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
        </div>
        <div 
            className="absolute top-0 bottom-0 w-1.5 h-full bg-white shadow-[0_0_25px_white] rounded-full pointer-events-none transition-all duration-300"
            style={{ left: `${(progress / (duration || 1)) * 100}%` }}
        />
      </div>

      {/* --- MODALS --- */}
      {showLyricsModal && (
        <div className="fixed inset-0 z-[300] bg-black animate-in slide-in-from-bottom duration-500">
          <div className="absolute inset-0 opacity-50" style={{ background: `linear-gradient(to bottom, ${dominantColor}, #000)` }} />
          <div className="relative h-full flex flex-col p-10 pt-24 max-w-4xl mx-auto">
            <button onClick={() => setShowLyricsModal(false)} className="absolute top-10 right-10 p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all">
               <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6"></path></svg>
            </button>
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-12 pb-40 px-4 text-center">
                {syncedLyrics.length > 0 ? syncedLyrics.map((l, i) => (
                  <p key={i} ref={i === currentLineIndex ? activeLyricRef : null} onClick={() => onSeek(l.time)} className={`text-4xl landscape:text-5xl font-black leading-tight transition-all cursor-pointer ${i === currentLineIndex ? 'text-white scale-105' : 'text-white/10 hover:text-white/20'}`}>{l.text || "•••"}</p>
                )) : plainLyrics.map((l, i) => <p key={i} className="text-xl font-bold opacity-10 leading-relaxed">{l}</p>)}
            </div>
          </div>
        </div>
      )}

      {showQueueModal && (
        <div className="fixed inset-0 z-[300] bg-[#080808] animate-in slide-in-from-bottom duration-500">
           <div className="relative h-full flex flex-col p-8 pt-24 max-w-2xl mx-auto">
              <header className="flex justify-between items-center mb-10 px-4">
                <h3 className="text-[11px] font-black uppercase tracking-[0.5em] opacity-30">Queue List</h3>
                <button onClick={() => setShowQueueModal(false)} className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all">
                   <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6"></path></svg>
                </button>
              </header>
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pb-32">
                {queue.map((qs, i) => (
                  <div 
                    key={qs.id} 
                    draggable 
                    onDragStart={() => (dragItemRef.current = i)}
                    onDragOver={(e) => { e.preventDefault(); if (dragItemRef.current !== null && dragItemRef.current !== i) { onMoveQueueItem(dragItemRef.current, i); dragItemRef.current = i; } }}
                    // Swipe to Delete (Mobile Only Implementation)
                    onTouchStart={(e) => (touchStartRef.current = e.touches[0].clientX)}
                    onTouchEnd={(e) => {
                        const diff = touchStartRef.current! - e.changedTouches[0].clientX;
                        if (Math.abs(diff) > 100) onRemoveFromQueue(qs.id);
                        touchStartRef.current = null;
                    }}
                    className="flex items-center gap-5 p-5 bg-white/5 rounded-[40px] border border-white/5 group hover:bg-white/10 transition-all cursor-move active:scale-95"
                  >
                    <img src={qs.artwork} className="w-14 h-14 rounded-2xl shadow-lg" />
                    <div className="flex-1 min-w-0" onClick={() => {onPlayFromQueue(qs); setShowQueueModal(false);}}>
                      <p className={`text-sm font-black truncate ${qs.id === song.id ? 'text-accent' : ''}`}>{qs.title}</p>
                      <p className="text-[10px] font-bold opacity-30 uppercase">{qs.artist}</p>
                    </div>
                    <button onClick={() => onRemoveFromQueue(qs.id)} className="p-3 opacity-40 hover:opacity-100">
                       <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M6 18L18 6"></path></svg>
                    </button>
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
