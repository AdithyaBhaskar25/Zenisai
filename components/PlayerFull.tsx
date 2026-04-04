Import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Song, Playlist } from '../types';

// Helper to parse [mm:ss.xx] or [mm:ss] into seconds
const parseTimestamp = (lrcTimestamp: string): number => {
  const match = lrcTimestamp.match(/\[(\d+):(\d+(?:\.\d+)?)\]/);
  if (!match) return 0;
  const minutes = parseInt(match[1]);
  const seconds = parseFloat(match[2]);
  return minutes * 60 + seconds;
};

interface LyricLine {
  time: number;
  text: string;
}

interface PlayerFullProps {
  song: Song;
  isPlaying: boolean;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  dominantColor: string;
  progress: number;
  duration: number;
  onSeek: (val: number) => void;
  analyser: AnalyserNode | null;
  sleepTimer: number | null;
  setSleepTimer: (val: number | null) => void;
  queue: Song[];
  onPlayFromQueue: (song: Song) => void;
  lyrics: string;
  onRemoveFromQueue: (id: string) => void;
  onMoveQueueItem: (from: number, to: number) => void;
  playlists: Playlist[];
  onAddToPlaylist: (song: Song, playlistId: string) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onDownload: () => void;
  onShare: () => void;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  repeatMode: 'off' | 'one' | 'all';
  onToggleRepeat: () => void;
  onShowPlaylistModal: () => void;
}

const PlayerFull: React.FC<PlayerFullProps> = ({ 
  song, isPlaying, onToggle, onNext, onPrev, onClose, dominantColor, progress, duration, onSeek, analyser,
  sleepTimer, setSleepTimer, queue, onPlayFromQueue, lyrics: propLyrics, onRemoveFromQueue, onMoveQueueItem, 
  isFavorite, onToggleFavorite, onDownload, onShare, isShuffle, onToggleShuffle, repeatMode, onToggleRepeat, onShowPlaylistModal
}) => {
  const [activeTab, setActiveTab] = useState<'player' | 'lyrics' | 'queue'>('player');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSleepTimerMenu, setShowSleepTimerMenu] = useState(false);

  // --- LYRIC ENGINE STATE ---
  const [syncedLyrics, setSyncedLyrics] = useState<LyricLine[]>([]);
  const [plainLyrics, setPlainLyrics] = useState<string[]>([]);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);

  const lyricsScrollRef = useRef<HTMLDivElement>(null);
  const activeLyricRef = useRef<HTMLParagraphElement>(null);
  const visualizerCanvasRef = useRef<HTMLCanvasElement>(null);
  const touchStartRef = useRef<number | null>(null);

  // --- ULTRA-ROBUST LYRIC FETCHING ---
  useEffect(() => {
    const fetchLyrics = async () => {
      if (!song.title) return;
      setIsLoadingLyrics(true);
      setSyncedLyrics([]);
      setPlainLyrics([]);

      // Clean title: "Mutta Kalaki (From Kedi...)" -> "Mutta Kalaki"
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
        // Tier 1: Exact Match GET
        const getRes = await fetch(`https://lrclib.net/api/get?artist_name=${artist}&track_name=${title}&duration=${dur}`);
        if (getRes.ok && processData(await getRes.json())) return;

        // Tier 2: Search by Track + Artist (Handles slight duration mismatch)
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

        // Tier 3: Broad "Clean Title" Keyword Search (The Mutta Kalaki Fix)
        const broadRes = await fetch(`https://lrclib.net/api/search?q=${simpleTitle}`);
        if (broadRes.ok) {
          const broadResults = await broadRes.json();
          if (broadResults?.length > 0) {
            const bestBroadMatch = broadResults.sort((a: any, b: any) => {
              if (a.syncedLyrics && !b.syncedLyrics) return -1;
              return Math.abs(a.duration - dur) - Math.abs(b.duration - dur);
            })[0];
            if (processData(bestBroadMatch)) return;
          }
        }

        // Tier 4: Local Fallback
        if (propLyrics) setPlainLyrics(propLyrics.split('\n'));
      } catch (e) {
        if (propLyrics) setPlainLyrics(propLyrics.split('\n'));
      } finally {
        setIsLoadingLyrics(false);
      }
    };

    fetchLyrics();
  }, [song.id, duration]);

  // Sync scroll to current line
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

  // --- VISUALIZER LOGIC ---
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
      const barWidth = (canvas.width / bufferLength) * 2.2;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const val = dataArray[i];
        const barHeight = (val / 255) * canvas.height;
        const grad = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        grad.addColorStop(0, dominantColor.replace('rgb', 'rgba').replace(')', ', 0.1)'));
        grad.addColorStop(1, dominantColor.replace('rgb', 'rgba').replace(')', `, ${0.4 + (val/255) * 0.6})`));
        ctx.fillStyle = grad;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1.5;
      }
    };
    draw();
    return () => cancelAnimationFrame(animationId);
  }, [analyser, dominantColor]);

  // --- QUEUE TOUCH REORDERING ---
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

  const handleTouchStart = (e: React.TouchEvent) => touchStartRef.current = e.touches[0].clientX;
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return;
    const diff = touchStartRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 70) { diff > 0 ? onNext() : onPrev(); }
    touchStartRef.current = null;
  };

  const formatTime = (time: number) => {
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const progressPercent = (progress / (duration || 1)) * 100;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black overflow-hidden animate-in slide-in-from-bottom duration-700 cubic-bezier(0.23, 1, 0.32, 1)">
      <div className="absolute inset-0 opacity-40 blur-[200px] transition-all duration-1000 animate-pulse" style={{ background: `radial-gradient(circle at center, ${dominantColor}, transparent 80%)` }} />

      <div className="relative z-10 flex flex-col h-full px-6 pt-12 pb-6">
        <header className="flex justify-between items-center mb-6">
          <button onClick={onClose} className="p-3 bg-white/5 rounded-full text-white/70 active:scale-[0.85] transition-all hover:bg-white/10 shadow-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
          </button>
          <div className="flex-1 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 mb-0.5 leading-none">Zenisai</p>
            <p className="text-[11px] font-bold text-white/80 truncate max-w-[150px] mx-auto uppercase tracking-widest">{song.album}</p>
          </div>
          <div className="relative">
            <button onClick={() => { setShowDropdown(!showDropdown); setShowSleepTimerMenu(false); }} className={`p-3 bg-white/5 rounded-full text-white/70 active:scale-[0.85] transition-all hover:bg-white/10 ${showDropdown ? 'text-accent' : ''} shadow-lg`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
            </button>
            {showDropdown && (
              <div className="absolute right-0 top-14 w-48 bg-zinc-900/95 backdrop-blur-3xl border border-white/10 rounded-[32px] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-in fade-in slide-in-from-top-3 duration-500 z-50">
                {!showSleepTimerMenu ? (
                  <div className="space-y-1">
                    <button onClick={() => { onDownload(); setShowDropdown(false); }} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/10 text-[10px] font-black uppercase tracking-widest text-white/70 hover:text-white transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> Save
                    </button>
                    <button onClick={() => { onShowPlaylistModal(); setShowDropdown(false); }} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/10 text-[10px] font-black uppercase tracking-widest text-white/70 hover:text-white transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg> Add
                    </button>
                    <button onClick={() => { onShare(); setShowDropdown(false); }} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/10 text-[10px] font-black uppercase tracking-widest text-white/70 hover:text-white transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg> Share
                    </button>
                    <button onClick={() => setShowSleepTimerMenu(true)} className={`w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/10 text-[10px] font-black uppercase tracking-widest transition-all ${sleepTimer ? 'text-accent' : 'text-white/70 hover:text-white'}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Sleep Timer
                    </button>
                  </div>
                ) : (
                  <div className="animate-in slide-in-from-right-4 duration-500 space-y-1">
                    <button onClick={() => setShowSleepTimerMenu(false)} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/10 text-[9px] font-black uppercase tracking-widest text-white/30 border-b border-white/5 mb-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg> Back
                    </button>
                    {[null, 900, 1800, 2700, 3600].map(val => (
                      <button key={String(val)} onClick={() => { setSleepTimer(val); setShowDropdown(false); }} className={`w-full text-left p-3 rounded-2xl hover:bg-white/10 text-[10px] font-black uppercase tracking-widest transition-all ${sleepTimer === val ? 'text-accent' : 'text-white/70'}`}>
                        {val === null ? 'Off' : `${val/60} Min`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative flex flex-col items-center">
           {activeTab === 'player' && (
  <div className="flex-1 flex flex-col w-full animate-in fade-in zoom-in-95 duration-700">
    {/* 1. Artwork Container - Slightly smaller to make room */}
    <div className="flex-[2] flex items-center justify-center min-h-0">
      <div 
        className="relative aspect-square w-full max-w-[220px] bg-white/[0.03] backdrop-blur-2xl rounded-[40px] p-3 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6)] select-none" 
        onTouchStart={handleTouchStart} 
        onTouchEnd={handleTouchEnd}
      >
        <img 
          src={song.artwork} 
          alt=""
          className={`w-full h-full rounded-[32px] object-cover transition-all duration-1000 pointer-events-none ${isPlaying ? 'scale-100' : 'opacity-40 grayscale scale-90'}`} 
        />
        <button 
          onClick={onToggleFavorite} 
          className={`absolute top-6 right-6 p-2 rounded-full transition-all duration-500 ${isFavorite ? 'bg-accent text-white' : 'bg-black/40 text-white/40'}`}
        >
          <svg className="w-5 h-5" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
          </svg>
        </button>
      </div>
    </div>

    {/* 2. Info & Lyrics Container - Flex-grow allows this to take all remaining space */}
    <div className="flex-[3] flex flex-col justify-start text-center px-8 w-full animate-in slide-in-from-bottom-4 duration-700 delay-200 overflow-visible">
      {/* Title & Artist */}
      <div className="mb-6">
        <h2 className="text-2xl font-black tracking-tight truncate leading-tight text-white mb-1">{song.title}</h2>
        <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.4em] truncate">{song.artist}</p>
      </div>

      {/* Dynamic Synced Lyric Display */}
      <div className="flex-1 flex items-start justify-center pt-2">
        {syncedLyrics.length > 0 && currentLineIndex !== -1 ? (
          <p 
            key={currentLineIndex}
            className="text-xl font-bold text-white leading-snug break-words animate-in fade-in slide-in-from-bottom-2 duration-500"
            style={{ 
              textShadow: `0 0 20px ${dominantColor}44`,
              display: '-webkit-box',
              WebkitLineClamp: '3',
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {syncedLyrics[currentLineIndex].text}
          </p>
        ) : (
          <div className="mt-4 flex gap-1.5 opacity-20">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0s' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0.2s' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0.4s' }} />
          </div>
        )}
      </div>
    </div>
  </div>
)}

          {activeTab === 'lyrics' && (
            <div ref={lyricsScrollRef} className="h-full w-full overflow-y-auto no-scrollbar text-center py-16 animate-in slide-in-from-bottom-8 duration-700 select-none">
              <div className="space-y-10 px-10 pb-40">
                {isLoadingLyrics ? (
                   <p className="text-white/20 text-[10px] font-black uppercase animate-pulse tracking-widest">Searching LRCLIB...</p>
                ) : syncedLyrics.length > 0 ? (
                  syncedLyrics.map((line, i) => (
                    <p key={i} ref={i === currentLineIndex ? activeLyricRef : null} onClick={() => onSeek(line.time)} className={`text-2xl font-black transition-all duration-700 leading-tight cursor-pointer ${i === currentLineIndex ? 'text-white scale-110 opacity-100' : 'text-white/20 hover:text-white/40'}`}>
                      {line.text || "•••"}
                    </p>
                  ))
                ) : plainLyrics.length > 0 ? (
                  plainLyrics.map((l, i) => <p key={i} className="text-xl font-bold text-white/40 leading-relaxed py-2">{l}</p>)
                ) : (
                  <p className="text-white/20 text-[10px] font-black uppercase tracking-widest">Lyrics not found</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'queue' && (
            <div className="h-full w-full overflow-y-auto no-scrollbar py-6 animate-in slide-in-from-bottom-8 duration-700">
              <div className="space-y-3 pb-32 px-2" onTouchMove={handleQueueTouchMove} onTouchEnd={() => { dragItemRef.current = null; }}>
                {queue.map((qs, i) => (
                    <div key={qs.id} data-queue-index={i} className={`flex items-center gap-4 p-3.5 rounded-[32px] border transition-all duration-300 relative group ${qs.id === song.id ? 'bg-white/10 border-white/20' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.07]'}`}>
                      <div className="p-2 -ml-2 text-white/20 touch-none cursor-grab active:cursor-grabbing" onTouchStart={() => handleQueueTouchStart(i)}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16"></path></svg>
                      </div>
                      <img src={qs.artwork} className="w-12 h-12 rounded-xl object-cover pointer-events-none" />
                      <div className="flex-1 min-w-0" onClick={() => onPlayFromQueue(qs)}>
                        <p className={`text-[13px] font-black truncate leading-tight ${qs.id === song.id ? 'text-accent' : 'text-white'}`}>{qs.title}</p>
                        <p className="text-[9px] text-white/30 uppercase font-black tracking-widest mt-0.5">{qs.artist}</p>
                      </div>
                      <button onClick={() => onRemoveFromQueue(qs.id)} className="p-2 text-white/10 hover:text-red-500 active:scale-75 transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </button>
                    </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="mt-8 space-y-5 bg-zinc-900/50 backdrop-blur-3xl rounded-[44px] p-4 border border-white/5 shadow-2xl">
          <div className="space-y-2 relative">
             <div className="relative h-12 w-full bg-white/5 rounded-[20px] overflow-hidden group border border-white/5">
               <canvas ref={visualizerCanvasRef} width={400} height={48} className="absolute inset-0 w-full h-full opacity-30 pointer-events-none" />
               <div className="absolute h-full bg-white/[0.04] transition-all duration-300" style={{ width: `${progressPercent}%`, backgroundColor: dominantColor.replace('rgb', 'rgba').replace(')', ', 0.1)') }} />
               <input type="range" min="0" max={duration || 100} value={progress} onChange={(e) => onSeek(Number(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer" />
               <div className="absolute inset-0 flex items-center justify-between px-6 pointer-events-none">
                 <span className="text-[10px] font-black text-white/20 tracking-[0.2em]">{formatTime(progress)}</span>
                 <div className="flex gap-1 items-end h-3">
                   {[...Array(6)].map((_, i) => (
                     <div key={i} className={`w-[2px] rounded-full transition-all duration-300 ${isPlaying ? 'animate-bounce' : 'h-1'}`} style={{ height: isPlaying ? `${6 + Math.random() * 8}px` : '3px', animationDelay: `${i * 0.1}s`, backgroundColor: dominantColor }} />
                   ))}
                 </div>
                 <span className="text-[10px] font-black text-white/20 tracking-[0.2em]">{formatTime(duration)}</span>
               </div>
             </div>
          </div>

          <div className="flex items-center justify-between px-2">
            <button onClick={onToggleShuffle} className={`p-2.5 rounded-full transition-all duration-500 ${isShuffle ? 'text-accent' : 'text-white/20'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
            </button>
            <div className="flex items-center gap-4">
              <button onClick={onPrev} className="text-white/30 p-2 active:scale-[0.85] transition-all"><svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"></path></svg></button>
              <button onClick={onToggle} className="w-14 h-14 flex items-center justify-center bg-white text-black rounded-full active:scale-[0.85] transition-all shadow-xl">
                {isPlaying ? <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg> : <svg className="w-7 h-7 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>}
              </button>
              <button onClick={onNext} className="text-white/30 p-2 active:scale-[0.85] transition-all"><svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"></path></svg></button>
            </div>
            <button onClick={onToggleRepeat} className={`p-2.5 rounded-full transition-all duration-500 ${repeatMode !== 'off' ? 'text-accent' : 'text-white/20'}`}>
              <div className="relative">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                {repeatMode === 'one' && <span className="absolute -top-1 -right-1 text-[7px] bg-accent text-white rounded-full w-3.5 h-3.5 flex items-center justify-center border-2 border-zinc-900 font-black">1</span>}
              </div>
            </button>
          </div>

          <div className="flex bg-white/5 rounded-[28px] p-1 border border-white/5">
            {['player', 'lyrics', 'queue'].map(t => (
              <button key={t} onClick={() => setActiveTab(t as any)} className={`flex-1 py-2.5 rounded-[22px] text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${activeTab === t ? 'bg-white text-black shadow-lg' : 'text-white/20 hover:text-white/40'}`}>
                {t}
              </button>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
};

export default PlayerFull;