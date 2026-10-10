import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Song, Playlist } from '../types';
import { ParsedLyricLine, lyricsService } from '../services/lyricsService';

interface PlayerFullProps {
  song: Song; isPlaying: boolean; onToggle: () => void; onNext: () => void; onPrev: () => void; onClose: () => void;
  dominantColor: string; progress: number; duration: number; onSeek: (val: number) => void; analyser: AnalyserNode | null;
  sleepTimer: number | null; setSleepTimer: (val: number | null) => void; queue: Song[]; onPlayFromQueue: (song: Song) => void;
  lyrics: string; onRemoveFromQueue: (id: string) => void; onMoveQueueItem: (from: number, to: number) => void;
  playlists: Playlist[]; onAddToPlaylist: (song: Song, playlistId: string) => void; isFavorite: (songId: string) => boolean;
  onToggleFavorite: (song: Song) => void; onDownload: (song: Song) => void; onShare: (song: Song) => void; isShuffle: boolean;
  onToggleShuffle: () => void; repeatMode: 'off' | 'one' | 'all'; onToggleRepeat: () => void; onShowPlaylistModal: (song: Song) => void;
  syncedLyricsList?: ParsedLyricLine[];
  plainLyricsList?: string[];
}

interface FeedActionProps {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}

const FeedAction: React.FC<FeedActionProps> = ({ label, onClick, active, children }) => (
  <button type="button" title={label} aria-label={label} onClick={onClick} className="flex w-12 shrink-0 flex-col items-center gap-1 text-white active:scale-90 transition-transform">
    <span className={`grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/35 shadow-lg backdrop-blur-md ${active ? 'text-accent' : 'text-white'}`}>{children}</span>
    <span className="max-w-12 truncate text-[8px] font-semibold text-white/80">{label}</span>
  </button>
);

const PlayerFull: React.FC<PlayerFullProps> = ({ 
  song, isPlaying, onToggle, onNext, onPrev, onClose, dominantColor, progress, duration, onSeek, analyser,
  sleepTimer, setSleepTimer, queue, onPlayFromQueue, lyrics: propLyrics, onRemoveFromQueue, onMoveQueueItem, 
  isFavorite, onToggleFavorite, onDownload, onShare, isShuffle, onToggleShuffle, repeatMode, onToggleRepeat, onShowPlaylistModal,
  syncedLyricsList, plainLyricsList
}) => {
  const [activeTab, setActiveTab] = useState<'player' | 'lyrics' | 'queue'>('player');
  const [showSleepTimerMenu, setShowSleepTimerMenu] = useState(false);

  // --- ULTRA-ROBUST SYNCHRONIZED LYRIC ENGINE ---
  const [syncedLyrics, setSyncedLyrics] = useState<ParsedLyricLine[]>(() => syncedLyricsList || []);
  const [plainLyrics, setPlainLyrics] = useState<string[]>(() => plainLyricsList || []);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);

  const lyricsScrollRef = useRef<HTMLDivElement>(null);
  const activeLyricRef = useRef<HTMLParagraphElement>(null);
  const visualizerCanvasRef = useRef<HTMLCanvasElement>(null);
  const feedScrollRef = useRef<HTMLDivElement>(null);
  const feedScrollTimerRef = useRef<number | null>(null);
  const isProgrammaticScrollRef = useRef(false);
  const isUserInteractingRef = useRef(false);
  const hasMountedRef = useRef(false);
  const dragItemRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Keep lyrics 100% in sync with App.tsx and cache
  useEffect(() => {
    if (syncedLyricsList && syncedLyricsList.length > 0) {
      setSyncedLyrics(syncedLyricsList);
      if (plainLyricsList && plainLyricsList.length > 0) setPlainLyrics(plainLyricsList);
      setIsLoadingLyrics(false);
      return;
    }

    let isCancelled = false;
    const fetchLyrics = async () => {
      setIsLoadingLyrics(true);
      const res = await lyricsService.fetchLyrics(song);
      if (isCancelled) return;
      setSyncedLyrics(res.syncedLyrics);
      setPlainLyrics(res.plainLyrics.length > 0 ? res.plainLyrics : (propLyrics ? propLyrics.split('\n') : []));
      setIsLoadingLyrics(false);
    };

    fetchLyrics();
    return () => { isCancelled = true; };
  }, [song.id, song.title, song.artist, syncedLyricsList, plainLyricsList, propLyrics]);

  // Robust feed scroll sync: avoids jumping or switching to wrong song when opened from mini player!
  useEffect(() => {
    if (activeTab !== 'player' || !feedScrollRef.current) return;
    const feed = feedScrollRef.current;
    const activeIndex = queue.findIndex(item => item.id === song.id);
    if (activeIndex < 0) return;

    isProgrammaticScrollRef.current = true;
    const targetTop = activeIndex * feed.clientHeight;

    if (!hasMountedRef.current) {
      // Immediate instant jump on initial mount to prevent smooth scroll collision
      feed.scrollTop = targetTop;
      hasMountedRef.current = true;
    } else {
      if (Math.abs(feed.scrollTop - targetTop) > 6) {
        feed.scrollTo({ top: targetTop, behavior: 'smooth' });
      }
    }

    const timer = window.setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 450);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeTab, song.id, queue]);

  useEffect(() => () => {
    if (feedScrollTimerRef.current !== null) window.clearTimeout(feedScrollTimerRef.current);
  }, []);

  const currentLineIndex = useMemo(() => {
    for (let i = syncedLyrics.length - 1; i >= 0; i--) {
      if (progress >= syncedLyrics[i].time) return i;
    }
    return -1;
  }, [syncedLyrics, progress]);

  // --- LYRIC AUTOSCROLL LOGIC ---
  useEffect(() => {
    if (activeTab === 'lyrics' && activeLyricRef.current) {
      activeLyricRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentLineIndex, activeTab]);

  // --- ORIGINAL VISUALIZER LOGIC ---
  useEffect(() => {
    if (!analyser || !visualizerCanvasRef.current || !isPlaying) return;
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
  }, [analyser, dominantColor, isPlaying]);

  // --- SWIPE GESTURES ---
  const handleTouchStart = (e: React.TouchEvent) => { touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return;
    const deltaX = touchStartRef.current.x - e.changedTouches[0].clientX;
    const deltaY = touchStartRef.current.y - e.changedTouches[0].clientY;
    if (Math.abs(deltaX) > 70 && Math.abs(deltaX) > Math.abs(deltaY)) {
      deltaX > 0 ? onNext() : onPrev();
    }
    touchStartRef.current = null;
  };

  const formatTime = (t: number) => `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[var(--color-bg)] overflow-hidden animate-in slide-in-from-bottom duration-700" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <img src={song.artwork} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-3xl" />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--color-bg) 45%, transparent), color-mix(in srgb, var(--color-bg) 82%, transparent), var(--color-bg))' }} />
      <div className="absolute inset-0 opacity-25 blur-[100px]" style={{ background: `radial-gradient(circle at center, ${dominantColor}, transparent 70%)` }} />

      <div className="relative z-10 flex flex-col h-full px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+0.5rem)] sm:px-6">
        <header className="flex items-center gap-2 mb-4 h-12">
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full active:scale-90 transition-all"><svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" /></svg></button>
          <div className="flex-1 text-center min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-accent leading-none mb-1">Now playing</p>
            <p className="text-xs font-semibold text-white/85 truncate px-2">{song.title}</p>
          </div>
          {activeTab === 'player' ? <span className="min-w-8 text-right text-[10px] font-semibold text-white/35">{queue.length || 1}</span> : <button onClick={() => setActiveTab('player')} className="rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-[9px] font-semibold text-white/75">Back to feed</button>}
        </header>

        <main className="flex-1 flex flex-col min-h-0">
          {activeTab === 'player' && (
            <div 
              ref={feedScrollRef} 
              onTouchStart={() => { isUserInteractingRef.current = true; }}
              onTouchEnd={() => {
                // allow momentum scroll to finish
                setTimeout(() => { isUserInteractingRef.current = false; }, 400);
              }}
              onMouseDown={() => { isUserInteractingRef.current = true; }}
              onMouseUp={() => {
                setTimeout(() => { isUserInteractingRef.current = false; }, 400);
              }}
              onScroll={event => {
                if (isProgrammaticScrollRef.current) return;
                if (!isUserInteractingRef.current) return;
                if (feedScrollTimerRef.current !== null) window.clearTimeout(feedScrollTimerRef.current);
                const feed = event.currentTarget;
                feedScrollTimerRef.current = window.setTimeout(() => {
                  if (isProgrammaticScrollRef.current) return;
                  const itemHeight = Math.max(feed.clientHeight, 1);
                  const feedIndex = Math.round(feed.scrollTop / itemHeight);
                  const distFromSnap = Math.abs(feed.scrollTop - feedIndex * itemHeight);
                  // Ensure container has snapped close to the target reel
                  if (distFromSnap < itemHeight * 0.3) {
                    const selectedSong = queue[feedIndex];
                    if (selectedSong && selectedSong.id !== song.id) {
                      onPlayFromQueue(selectedSong);
                    }
                  }
                }, 150);
              }} 
              className="h-full min-h-0 snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-[26px] border border-white/10 bg-[var(--color-surface)] no-scrollbar"
            >
              {(queue.length > 0 ? queue : [song]).map((feedSong, index) => {
                const isCurrent = feedSong.id === song.id;
                return (
                  <article key={`${feedSong.id}-${index}`} className="relative h-full min-h-full snap-start overflow-hidden bg-[var(--color-surface)]">
                    <img src={feedSong.artwork} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#02040a]/95 via-[#02040a]/25 to-[#02040a]/35" />
                    <button onClick={() => isCurrent ? onToggle() : onPlayFromQueue(feedSong)} aria-label={isCurrent && isPlaying ? 'Pause playback' : 'Play song'} className="absolute inset-0 z-[1] cursor-pointer" />
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
                      <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-white/80 backdrop-blur-md">{isCurrent && isPlaying ? 'Now playing' : 'Up next'}</span>
                      <span className="text-[10px] font-semibold text-white/65">{index + 1} / {queue.length || 1}</span>
                    </div>
                    <div className="pointer-events-none absolute bottom-5 left-4 z-10 max-w-[calc(100%-5rem)] sm:left-6">
                      <div className="mb-4 min-h-12">
                        {isCurrent && currentLineIndex >= 0 ? <p className="text-lg font-semibold leading-tight text-white drop-shadow-lg">{syncedLyrics[currentLineIndex].text}</p> : isCurrent && plainLyrics.length > 0 ? <p className="text-sm font-semibold text-white/75">{plainLyrics[0]}</p> : <p className="text-xs font-medium text-white/65">{isLoadingLyrics ? 'Finding synced lyrics' : 'Lyrics appear as this track plays'}</p>}
                      </div>
                      <h2 className="truncate text-2xl font-bold text-white drop-shadow-md">{feedSong.title}</h2>
                      <p className="mt-1 truncate text-sm text-white/70">{feedSong.artist}</p>
                    </div>
                    <div className="absolute right-2 top-1/2 z-20 flex max-h-[calc(100%-2rem)] -translate-y-1/2 flex-col items-center gap-2.5 overflow-y-auto no-scrollbar sm:right-4">
                      <FeedAction label={isFavorite(feedSong.id) ? 'Saved' : 'Like'} active={isFavorite(feedSong.id)} onClick={() => onToggleFavorite(feedSong)}><svg className="h-5 w-5" viewBox="0 0 24 24" fill={isFavorite(feedSong.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg></FeedAction>
                      <FeedAction label="Queue" onClick={() => setActiveTab('queue')}><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h10m3-3 3 3-3 3" /></svg></FeedAction>
                      <FeedAction label="Lyrics" onClick={() => setActiveTab('lyrics')}><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13M9 9l12-2M5 19c0 1.1-1.1 2-2.5 2S0 20.1 0 19s1.1-2 2.5-2S5 17.9 5 19zm16-3c0 1.1-1.1 2-2.5 2S16 16.9 16 16s1.1-2 2.5-2S21 14.9 21 16z" /></svg></FeedAction>
                      <FeedAction label="Playlist" onClick={() => onShowPlaylistModal(feedSong)}><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg></FeedAction>
                      <FeedAction label="Download" onClick={() => onDownload(feedSong)}><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3" /></svg></FeedAction>
                      <FeedAction label={sleepTimer ? 'Timer on' : 'Timer'} active={sleepTimer !== null} onClick={() => setShowSleepTimerMenu(value => !value)}><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></FeedAction>
                      <FeedAction label={isShuffle ? 'Shuffle on' : 'Shuffle'} active={isShuffle} onClick={onToggleShuffle}><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg></FeedAction>
                      <FeedAction label={repeatMode === 'off' ? 'Repeat' : repeatMode === 'one' ? 'Repeat one' : 'Repeat all'} active={repeatMode !== 'off'} onClick={onToggleRepeat}><span className="relative"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3" /></svg>{repeatMode === 'one' && <span className="absolute -right-1 -top-1 grid h-3 w-3 place-items-center rounded-full bg-accent text-[8px] font-black text-white">1</span>}</span></FeedAction>
                      <FeedAction label="Share" onClick={() => onShare(feedSong)}><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.7 6.8-4.4m-6.8 7 6.8 4.1" /></svg></FeedAction>
                    </div>
                    {showSleepTimerMenu && (
                      <div className="absolute right-16 top-1/2 z-30 w-32 -translate-y-1/2 rounded-2xl border border-accent-tint bg-[var(--color-surface)] p-1 shadow-2xl backdrop-blur-xl">
                        {[null, 60, 300, 900, 1800].map(value => <button key={String(value)} onClick={() => { setSleepTimer(value); setShowSleepTimerMenu(false); }} className={`w-full rounded-xl p-2 text-center text-[9px] font-bold uppercase ${sleepTimer === value ? 'bg-accent/15 text-accent' : 'text-white/60'}`}>{value === null ? 'Off' : value < 60 ? `${value}s` : `${value / 60} min`}</button>)}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {activeTab === 'queue' && (
            <div className="h-full overflow-y-auto no-scrollbar" onTouchMove={(e) => {
              if (dragItemRef.current === null) return;
              const target = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
              const row = target?.closest('[data-queue-index]');
              if (row) {
                const targetIndex = parseInt(row.getAttribute('data-queue-index') || '-1');
                if (targetIndex !== -1 && targetIndex !== dragItemRef.current) {
                  onMoveQueueItem(dragItemRef.current, targetIndex);
                  dragItemRef.current = targetIndex; 
                }
              }
            }} onTouchEnd={() => dragItemRef.current = null}>
              <div className="space-y-2 pb-10">
                {queue.map((qs, i) => (
                  <div key={qs.id} data-queue-index={i} draggable onDragStart={() => { dragItemRef.current = i; }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (dragItemRef.current !== null) onMoveQueueItem(dragItemRef.current, i); dragItemRef.current = null; }} onDragEnd={() => { dragItemRef.current = null; }} className={`flex items-center gap-3 p-3 rounded-[18px] border transition-all ${qs.id === song.id ? 'bg-white/10 border-white/20' : 'bg-white/[0.03] border-white/5'}`}>
                    <div className="p-1.5 text-white/20 touch-none" onTouchStart={() => dragItemRef.current = i}><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M4 8h16M4 16h16" /></svg></div>
                    <img src={qs.artwork} className="w-10 h-10 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0" onClick={() => onPlayFromQueue(qs)}>
                      <p className={`text-xs font-black truncate ${qs.id === song.id ? 'text-accent' : 'text-white'}`}>{qs.title}</p>
                      <p className="text-[8px] text-white/30 font-black uppercase truncate">{qs.artist}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); onRemoveFromQueue(qs.id); }} className="p-2 text-white/20 hover:text-red-500 active:scale-75 transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'lyrics' && (
             <div ref={lyricsScrollRef} className="h-full overflow-y-auto no-scrollbar text-center py-6">
               <div className="space-y-8 px-6 pb-20">
                 {syncedLyrics.length > 0 ? syncedLyrics.map((l, i) => (
                   <p 
                    key={i} 
                    ref={i === currentLineIndex ? activeLyricRef : null}
                    onClick={() => onSeek(l.time)} 
                    className={`text-xl font-black transition-all duration-700 ${i === currentLineIndex ? 'text-white scale-110' : 'text-white/20'}`}
                   >
                    {l.text}
                   </p>
                 )) : plainLyrics.map((l, i) => <p key={i} className="text-lg font-bold text-white/30 py-1">{l}</p>)}
               </div>
             </div>
          )}
        </main>

        <footer className="mt-3 rounded-[18px] border border-white/10 bg-[var(--color-surface)] px-3 py-2 backdrop-blur-xl">
          <div className="relative h-7 w-full overflow-hidden rounded-full">
            <canvas ref={visualizerCanvasRef} width={400} height={28} className="absolute inset-0 h-full w-full opacity-70 pointer-events-none" />
            <div className="absolute bottom-0 left-0 top-0 bg-accent/15 transition-all duration-200" style={{ width: `${(progress / (duration || 1)) * 100}%` }} />
            <input aria-label="Seek within track" type="range" min="0" max={duration || 100} value={progress} onChange={event => onSeek(Number(event.target.value))} className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-2 text-[9px] font-semibold text-white/75"><span>{formatTime(progress)}</span><span>{formatTime(duration)}</span></div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default PlayerFull;
