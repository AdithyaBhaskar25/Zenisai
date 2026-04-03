import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Song, Playlist } from '../types';

// Helper to parse [mm:ss.xx] or [mm:ss] into seconds
const parseTimestamp = (lrcTimestamp: string): number => {
  const match = lrcTimestamp.match(/\[(\d+):(\d+(?:\.\d+)?)\]/);
  if (!match) return 0;
  const minutes = parseInt(match[1]);
  const seconds = parseFloat(match[2]);
  return minutes * 60 + seconds;
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
  const [activeTab, setActiveTab] = useState<'player' | 'lyrics' | 'queue'>('player');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSleepTimerMenu, setShowSleepTimerMenu] = useState(false);
  
  const [syncedLyrics, setSyncedLyrics] = useState<LyricLine[]>([]);
  const [plainLyrics, setPlainLyrics] = useState<string[]>([]);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  
  const lyricsScrollRef = useRef<HTMLDivElement>(null);
  const activeLyricRef = useRef<HTMLParagraphElement>(null);
  const visualizerCanvasRef = useRef<HTMLCanvasElement>(null);
  const touchStartRef = useRef<number | null>(null);

  // --- ROBUST LYRIC FETCHING ENGINE ---
  useEffect(() => {
    const fetchLyrics = async () => {
      if (!song.title) return;
      setIsLoadingLyrics(true);
      setSyncedLyrics([]);
      setPlainLyrics([]);

      const cleanTitleStr = song.title.replace(/\s*[\(\[].*?[\)\]]\s*/g, '').trim();
      const artist = encodeURIComponent(song.artist);
      const title = encodeURIComponent(song.title);
      const simpleTitle = encodeURIComponent(cleanTitleStr);
      const dur = Math.round(duration);

      const processData = (data: any): boolean => {
        if (data && (data.syncedLyrics || data.plainLyrics || data.instrumental)) {
          if (data.syncedLyrics) {
            const lines = data.syncedLyrics.split('\n')
              .map((line: string) => ({
                time: parseTimestamp(line),
                text: line.replace(/\[.*\]/, '').trim()
              }))
              .filter((l: any) => l.text.length > 0 || l.text === "");
            setSyncedLyrics(lines);
          } else if (data.plainLyrics) {
            setPlainLyrics(data.plainLyrics.split('\n'));
          } else if (data.instrumental) {
            setPlainLyrics(["◆ Instrumental ◆"]);
          }
          return true;
        }
        return false;
      };

      try {
        const getRes = await fetch(`https://lrclib.net/api/get?artist_name=${artist}&track_name=${title}&duration=${dur}`);
        if (getRes.ok && processData(await getRes.json())) return;

        const searchRes = await fetch(`https://lrclib.net/api/search?track_name=${title}&artist_name=${artist}`);
        if (searchRes.ok) {
          const results = await searchRes.json();
          if (results?.length > 0) {
            const bestMatch = results.sort((a: any, b: any) => {
              if (a.syncedLyrics && !b.syncedLyrics) return -1;
              return Math.abs(a.duration - dur) - Math.abs(b.duration - dur);
            })[0];
            if (processData(bestMatch)) return;
          }
        }

        const broadRes = await fetch(`https://lrclib.net/api/search?q=${simpleTitle}`);
        if (broadRes.ok) {
          const broadResults = await broadRes.json();
          if (broadResults?.length > 0) {
            const bestMatch = broadResults.sort((a: any, b: any) => {
              if (a.syncedLyrics && !b.syncedLyrics) return -1;
              return Math.abs(a.duration - dur) - Math.abs(b.duration - dur);
            })[0];
            if (processData(bestMatch)) return;
          }
        }
        if (propLyrics) setPlainLyrics(propLyrics.split('\n'));
      } catch (e) {
        if (propLyrics) setPlainLyrics(propLyrics.split('\n'));
      } finally {
        setIsLoadingLyrics(false);
      }
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
    if (activeTab === 'lyrics' && activeLyricRef.current) {
      activeLyricRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentLineIndex, activeTab]);

  // --- VISUALIZER ---
  useEffect(() => {
    if (!analyser || !visualizerCanvasRef.current) return;
    const canvas = visualizerCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let animationId: number;
    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 2;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const val = dataArray[i];
        const barHeight = (val / 255) * canvas.height;
        ctx.fillStyle = dominantColor;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 2;
      }
    };
    draw();
    return () => cancelAnimationFrame(animationId);
  }, [analyser, dominantColor]);

  // --- QUEUE TOUCH REORDER ---
  const dragItemRef = useRef<number | null>(null);
  const handleQueueTouchStart = (index: number) => { dragItemRef.current = index; };
  const handleQueueTouchMove = (e: React.TouchEvent) => {
    if (dragItemRef.current === null) return;
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const row = target?.closest('[data-queue-index]');
    if (row) {
      const targetIndex = parseInt(row.getAttribute('data-queue-index') || '-1');
      if (targetIndex !== -1 && targetIndex !== dragItemRef.current) {
        onMoveQueueItem(dragItemRef.current, targetIndex);
        dragItemRef.current = targetIndex; 
      }
    }
  };

  const formatTime = (time: number) => {
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const progressPercent = (progress / (duration || 1)) * 100;

  return (
    <div className="fixed inset-0 z-[200] bg-[#050505] text-white flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-500">
      
      {/* Background Ambient Glow */}
      <div 
        className="absolute inset-0 opacity-20 blur-[120px] transition-all duration-1000"
        style={{ background: `radial-gradient(circle at 50% 50%, ${dominantColor}, transparent 70%)` }}
      />

      {/* Top Bar - Responsive Header */}
      <header className="relative z-20 flex items-center justify-between px-6 py-4 md:px-10 md:py-8 shrink-0">
        <button onClick={onClose} className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 active:scale-90 transition-all">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
        </button>

        <div className="flex-1 text-center px-4">
          <h1 className="text-[10px] font-black uppercase tracking-[0.5em] text-white/40 mb-1">Zenisai</h1>
          <p className="text-xs font-bold truncate max-w-[200px] mx-auto text-white/80">{song.album}</p>
        </div>

        <div className="relative">
          <button onClick={() => setShowDropdown(!showDropdown)} className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 active:scale-90 transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01" /></svg>
          </button>
          {showDropdown && (
            <div className="absolute right-0 top-14 w-52 bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-2 shadow-2xl z-50">
               {!showSleepTimerMenu ? (
                 <>
                   <button onClick={() => {onDownload(); setShowDropdown(false)}} className="w-full text-left p-3 rounded-2xl hover:bg-white/5 text-[10px] font-bold uppercase tracking-widest flex items-center gap-3">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> Download
                   </button>
                   <button onClick={() => setShowSleepTimerMenu(true)} className="w-full text-left p-3 rounded-2xl hover:bg-white/5 text-[10px] font-bold uppercase tracking-widest flex items-center gap-3">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Sleep Timer
                   </button>
                 </>
               ) : (
                 <div className="p-1">
                    <button onClick={() => setShowSleepTimerMenu(false)} className="mb-2 p-2 text-[9px] font-black text-white/30 uppercase">← Back</button>
                    {[15, 30, 45, 60].map(m => (
                      <button key={m} onClick={() => {setSleepTimer(m * 60); setShowDropdown(false)}} className="w-full text-left p-3 rounded-xl hover:bg-white/5 text-xs font-bold">{m} Minutes</button>
                    ))}
                    <button onClick={() => {setSleepTimer(null); setShowDropdown(false)}} className="w-full text-left p-3 rounded-xl hover:bg-white/5 text-xs font-bold text-red-400">Turn Off</button>
                 </div>
               )}
            </div>
          )}
        </div>
      </header>

      {/* Main Container - Dynamic Layout Grid */}
      <main className="relative z-10 flex-1 flex flex-col md:flex-row items-center gap-8 px-6 md:px-12 lg:px-24 overflow-hidden h-full">
        
        {/* Left Section: Artwork (Scale logic for landscape/tablet) */}
        <section className={`flex-1 flex flex-col items-center justify-center transition-all duration-500 w-full
          ${activeTab !== 'player' ? 'hidden md:flex md:opacity-40' : 'flex'}`}>
          <div className="relative group w-full max-w-[320px] md:max-w-[450px] aspect-square">
            <img 
              src={song.artwork} 
              className={`w-full h-full object-cover rounded-[40px] md:rounded-[60px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] transition-all duration-700
                ${isPlaying ? 'scale-100 rotate-0' : 'scale-90 -rotate-2 opacity-60'}`} 
            />
            <button 
              onClick={onToggleFavorite}
              className={`absolute top-6 right-6 p-3 rounded-full backdrop-blur-md transition-all active:scale-75
                ${isFavorite ? 'bg-accent text-white' : 'bg-black/20 text-white/60 hover:text-white'}`}
            >
              <svg className="w-6 h-6" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
            </button>
          </div>
          
          <div className="mt-8 text-center md:text-left md:w-full max-w-[450px]">
            <h2 className="text-3xl md:text-5xl font-black tracking-tighter truncate leading-tight">{song.title}</h2>
            <p className="text-xs md:text-base font-bold text-white/40 uppercase tracking-[0.4em] mt-2">{song.artist}</p>
          </div>
        </section>

        {/* Right Section: Lyrics / Queue (Swaps on mobile, persists on large screens) */}
        <section className={`flex-1 w-full h-full flex flex-col overflow-hidden transition-all duration-500
          ${activeTab === 'player' ? 'hidden md:flex' : 'flex'}`}>
          
          <div className="flex-1 overflow-hidden relative">
            {activeTab === 'lyrics' && (
              <div ref={lyricsScrollRef} className="h-full overflow-y-auto no-scrollbar py-10">
                <div className="space-y-8 px-4 pb-20">
                  {isLoadingLyrics ? (
                    <div className="h-full flex items-center justify-center animate-pulse text-white/20 font-black uppercase tracking-widest">Searching...</div>
                  ) : syncedLyrics.length > 0 ? (
                    syncedLyrics.map((line, i) => (
                      <p 
                        key={i} 
                        ref={i === currentLineIndex ? activeLyricRef : null}
                        onClick={() => onSeek(line.time)}
                        className={`text-2xl md:text-4xl font-black transition-all duration-500 cursor-pointer
                          ${i === currentLineIndex ? 'text-white scale-105' : 'text-white/10 hover:text-white/30'}`}
                      >
                        {line.text || "•••"}
                      </p>
                    ))
                  ) : (
                    <p className="text-white/30 text-center font-bold italic">Lyrics unavailable</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'queue' && (
              <div className="h-full overflow-y-auto no-scrollbar py-6">
                <div className="space-y-3 pb-20" onTouchMove={handleQueueTouchMove} onTouchEnd={() => dragItemRef.current = null}>
                  {queue.map((qs, i) => (
                    <div 
                      key={qs.id} 
                      data-queue-index={i}
                      className={`flex items-center gap-4 p-4 rounded-[32px] border transition-all 
                        ${qs.id === song.id ? 'bg-white/10 border-white/20' : 'bg-white/[0.02] border-white/5 hover:bg-white/5'}`}
                    >
                      <div className="p-2 text-white/20 touch-none" onTouchStart={() => handleQueueTouchStart(i)}>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M7 7h2v2H7V7zm0 4h2v2H7v-2zm4-4h2v2h-2V7zm0 4h2v2h-2v-2z" /></svg>
                      </div>
                      <img src={qs.artwork} className="w-12 h-12 rounded-2xl object-cover" />
                      <div className="flex-1 min-w-0" onClick={() => onPlayFromQueue(qs)}>
                        <p className={`text-sm font-black truncate ${qs.id === song.id ? 'text-accent' : 'text-white'}`}>{qs.title}</p>
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{qs.artist}</p>
                      </div>
                      <button onClick={() => onRemoveFromQueue(qs.id)} className="p-2 text-white/10 hover:text-red-400 active:scale-75 transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer: Universal Controls */}
      <footer className="relative z-30 w-full max-w-4xl mx-auto px-6 pb-8 md:pb-12 shrink-0">
        
        {/* Progress System */}
        <div className="mb-6 group relative">
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-white transition-all duration-300" style={{ width: `${progressPercent}%` }} />
          </div>
          <input 
            type="range" min="0" max={duration || 100} value={progress} 
            onChange={(e) => onSeek(Number(e.target.value))}
            className="absolute inset-0 w-full h-1.5 opacity-0 cursor-pointer"
          />
          <div className="flex justify-between mt-3 text-[10px] font-black text-white/30 tracking-widest">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <canvas ref={visualizerCanvasRef} width={800} height={40} className="absolute -top-12 left-0 w-full h-10 pointer-events-none opacity-50" />
        </div>

        {/* Playback Buttons */}
        <div className="flex items-center justify-between">
          <button onClick={onToggleShuffle} className={`p-2 transition-all ${isShuffle ? 'text-accent' : 'text-white/20 hover:text-white/40'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
          </button>

          <div className="flex items-center gap-6 md:gap-10">
            <button onClick={onPrev} className="text-white/40 hover:text-white active:scale-75 transition-all">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
            </button>
            
            <button 
              onClick={onToggle}
              className="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center bg-white text-black rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all"
            >
              {isPlaying ? (
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>

            <button onClick={onNext} className="text-white/40 hover:text-white active:scale-75 transition-all">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
            </button>
          </div>

          <button onClick={onToggleRepeat} className={`p-2 transition-all ${repeatMode !== 'off' ? 'text-accent' : 'text-white/20 hover:text-white/40'}`}>
            <div className="relative">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              {repeatMode === 'one' && <span className="absolute -top-1 -right-1 text-[8px] font-black bg-accent text-white rounded-full w-3 h-3 flex items-center justify-center">1</span>}
            </div>
          </button>
        </div>

        {/* Tab Switcher - Mobile centric, Desktop hidden */}
        <div className="mt-8 flex bg-white/5 p-1 rounded-2xl md:hidden">
          {(['player', 'lyrics', 'queue'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all
                ${activeTab === tab ? 'bg-white text-black shadow-lg' : 'text-white/40'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
};

export default PlayerFull;
