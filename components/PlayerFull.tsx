import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Song, Playlist } from '../types';
import { ParsedLyricLine, lyricsService } from '../services/lyricsService';
import { colorWithAlpha } from '../services/colorUtils';
import Visualizer from './Visualizer';
import { themeService, VisualizerStyle } from '../services/themeService';

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
  onOpenEqualizer?: () => void;
  onOpenThemeSettings?: () => void;
  visualizerStyle?: VisualizerStyle;
}

interface FeedActionProps {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  activeColor: string;
  isLight: boolean;
}

const FeedAction: React.FC<FeedActionProps> = ({ label, onClick, active, children, activeColor, isLight }) => (
  <button 
    type="button" 
    title={label} 
    aria-label={label} 
    onClick={onClick} 
    className="flex w-10 sm:w-12 shrink-0 flex-col items-center gap-0.5 sm:gap-1 active:scale-90 transition-transform"
  >
    <span 
      className={`grid h-8 w-8 sm:h-10 sm:w-10 place-items-center rounded-full border shadow-lg backdrop-blur-md ${
        isLight 
          ? 'bg-white/90 border-slate-300 text-slate-900 shadow-slate-200' 
          : 'bg-black/40 border-white/20 text-white'
      }`}
      style={active ? { color: activeColor, borderColor: colorWithAlpha(activeColor, 0.6) } : {}}
    >
      {children}
    </span>
    <span className={`max-w-10 sm:max-w-12 truncate text-[7px] sm:text-[8px] font-bold ${isLight ? 'text-slate-800 font-extrabold' : 'text-white/90'}`}>
      {label}
    </span>
  </button>
);

const PlayerFull: React.FC<PlayerFullProps> = ({ 
  song, isPlaying, onToggle, onNext, onPrev, onClose, dominantColor, progress, duration, onSeek, analyser,
  sleepTimer, setSleepTimer, queue, onPlayFromQueue, lyrics: propLyrics, onRemoveFromQueue, onMoveQueueItem, 
  isFavorite, onToggleFavorite, onDownload, onShare, isShuffle, onToggleShuffle, repeatMode, onToggleRepeat, onShowPlaylistModal,
  syncedLyricsList, plainLyricsList, onOpenEqualizer, onOpenThemeSettings, visualizerStyle
}) => {
  const [activeTab, setActiveTab] = useState<'player' | 'lyrics' | 'queue'>('player');
  const [showSleepTimerMenu, setShowSleepTimerMenu] = useState(false);
  const [themeConfig, setThemeConfig] = useState(() => themeService.getConfig());

  useEffect(() => {
    return themeService.subscribe(setThemeConfig);
  }, []);

  const activeVisualizer = visualizerStyle || themeConfig.visualizerStyle || 'bars';
  const activeColor = dominantColor || '#3b82f6';
  const isLight = themeConfig.mode === 'light' || themeConfig.mode === 'crisp_white';

  // --- SYNCHRONIZED LYRICS ENGINE ---
  const [syncedLyrics, setSyncedLyrics] = useState<ParsedLyricLine[]>(() => syncedLyricsList || []);
  const [plainLyrics, setPlainLyrics] = useState<string[]>(() => plainLyricsList || []);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);

  const lyricsScrollRef = useRef<HTMLDivElement>(null);
  const activeLyricRef = useRef<HTMLParagraphElement>(null);
  const feedScrollRef = useRef<HTMLDivElement>(null);
  const feedScrollTimerRef = useRef<number | null>(null);
  
  const isSuppressedUntilRef = useRef<number>(Date.now() + 650);
  const lastPlayedIdRef = useRef<string>(song.id);
  const hasMountedRef = useRef(false);

  const dragItemRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Synchronize lyrics directly
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

  // Handle position sync on open & on programmatic track change
  useEffect(() => {
    if (activeTab !== 'player' || !feedScrollRef.current) return;
    const feed = feedScrollRef.current;
    const activeIndex = queue.findIndex(item => item.id === song.id);
    if (activeIndex < 0) return;

    lastPlayedIdRef.current = song.id;
    const targetTop = activeIndex * feed.clientHeight;

    if (!hasMountedRef.current) {
      feed.scrollTop = targetTop;
      hasMountedRef.current = true;
      isSuppressedUntilRef.current = Date.now() + 650;
    } else {
      if (Math.abs(feed.scrollTop - targetTop) > 6) {
        isSuppressedUntilRef.current = Date.now() + 500;
        feed.scrollTo({ top: targetTop, behavior: 'smooth' });
      }
    }
  }, [activeTab, song.id, queue]);

  const checkAndPlayActiveReel = (feed: HTMLElement) => {
    if (Date.now() < isSuppressedUntilRef.current) return;
    const itemHeight = Math.max(feed.clientHeight, 1);
    const feedIndex = Math.round(feed.scrollTop / itemHeight);
    if (feedIndex >= 0 && feedIndex < queue.length) {
      const candidateSong = queue[feedIndex];
      if (candidateSong && candidateSong.id !== lastPlayedIdRef.current) {
        lastPlayedIdRef.current = candidateSong.id;
        onPlayFromQueue(candidateSong);
      }
    }
  };

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (Date.now() < isSuppressedUntilRef.current) return;
    const feed = event.currentTarget;
    if (feedScrollTimerRef.current !== null) window.clearTimeout(feedScrollTimerRef.current);
    feedScrollTimerRef.current = window.setTimeout(() => {
      checkAndPlayActiveReel(feed);
    }, 90);
  };

  useEffect(() => {
    const feed = feedScrollRef.current;
    if (!feed) return;
    const handleScrollEnd = () => {
      checkAndPlayActiveReel(feed);
    };
    feed.addEventListener('scrollend', handleScrollEnd);
    return () => feed.removeEventListener('scrollend', handleScrollEnd);
  }, [queue, onPlayFromQueue]);

  useEffect(() => () => {
    if (feedScrollTimerRef.current !== null) window.clearTimeout(feedScrollTimerRef.current);
  }, []);

  const currentLineIndex = useMemo(() => {
    for (let i = syncedLyrics.length - 1; i >= 0; i--) {
      if (progress >= syncedLyrics[i].time) return i;
    }
    return -1;
  }, [syncedLyrics, progress]);

  useEffect(() => {
    if (activeTab === 'lyrics' && activeLyricRef.current) {
      activeLyricRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentLineIndex, activeTab]);

  const handleTouchStart = (e: React.TouchEvent) => { 
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; 
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return;
    const deltaX = touchStartRef.current.x - e.changedTouches[0].clientX;
    const deltaY = touchStartRef.current.y - e.changedTouches[0].clientY;
    if (Math.abs(deltaX) > 75 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      deltaX > 0 ? onNext() : onPrev();
    }
    touchStartRef.current = null;
  };

  const formatTime = (t: number) => `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}`;

  return (
    <div 
      className={`fixed inset-0 z-[200] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-500 ${isLight ? '!bg-white !text-zinc-900' : '!bg-[#030711] text-white'}`} 
      onTouchStart={handleTouchStart} 
      onTouchEnd={handleTouchEnd}
    >
      {/* Background Aura / Ambient Gradient */}
      <div className="absolute inset-0 opacity-30 blur-[120px] pointer-events-none" style={{ background: `radial-gradient(circle at center, ${activeColor}, transparent 70%)` }} />

      {/* Responsive Viewport Wrapper */}
      <div className="relative z-10 flex flex-col h-full max-w-5xl mx-auto w-full px-3 sm:px-6 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
        {/* Header */}
        <header className="flex items-center gap-2 mb-3 compact-landscape:mb-1 h-11 compact-landscape:h-8">
          <button 
            onClick={onClose} 
            className={`p-2 rounded-full active:scale-90 transition-all border ${isLight ? 'bg-zinc-100 border-zinc-300 text-zinc-800 hover:bg-zinc-200' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`} 
            aria-label="Minimize player"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" /></svg>
          </button>
          <div className="flex-1 text-center min-w-0">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] leading-none mb-0.5" style={{ color: activeColor }}>Now playing</p>
            <p className={`text-xs font-bold truncate px-2 ${isLight ? 'text-zinc-900' : 'text-white'}`}>{song.title}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenEqualizer && (
              <button 
                onClick={onOpenEqualizer} 
                title="Equalizer & Sound Stage" 
                aria-label="Equalizer"
                className={`p-2 rounded-full border transition-all active:scale-90 ${isLight ? 'bg-zinc-100 border-zinc-300 text-zinc-900 hover:bg-zinc-200' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}
                style={{ color: activeColor }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </button>
            )}
            {onOpenThemeSettings && (
              <button 
                onClick={onOpenThemeSettings} 
                title="Theme & Visuals" 
                aria-label="Theme settings"
                className={`p-2 rounded-full border transition-all active:scale-90 ${isLight ? 'bg-zinc-100 border-zinc-300 text-zinc-900 hover:bg-zinc-200' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4 4 4 0 014-4 4 4 0 014 4 4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </button>
            )}
            {activeTab === 'player' ? (
              <span className={`text-[10px] font-bold pl-1 ${isLight ? 'text-zinc-600' : 'text-white/60'}`}>{queue.length || 1} tracks</span>
            ) : (
              <button onClick={() => setActiveTab('player')} className={`rounded-full border px-3 py-1.5 text-[9px] font-bold ${isLight ? 'border-zinc-300 bg-zinc-200 text-zinc-900 hover:bg-zinc-300' : 'border-white/20 bg-black/60 text-white hover:bg-white/20'}`}>Feed</button>
            )}
          </div>
        </header>

        {/* Main Feed / Content */}
        <main className="flex-1 flex flex-col min-h-0">
          {activeTab === 'player' && (
            <div 
              ref={feedScrollRef} 
              onScroll={handleScroll}
              className={`h-full min-h-0 snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-[24px] sm:rounded-[28px] border no-scrollbar shadow-2xl ${isLight ? 'bg-zinc-100 border-zinc-300' : 'bg-[#0b1220] border-white/15'}`}
            >
              {(queue.length > 0 ? queue : [song]).map((feedSong, index) => {
                const isCurrent = feedSong.id === song.id;
                return (
                  <article 
                    key={`${feedSong.id}-${index}`} 
                    className="relative h-full min-h-full snap-start overflow-hidden bg-black select-none"
                  >
                    <img src={feedSong.artwork} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/35" />

                    {/* Tap overlay */}
                    <button 
                      onClick={() => isCurrent ? onToggle() : onPlayFromQueue(feedSong)} 
                      aria-label={isCurrent && isPlaying ? 'Pause playback' : 'Play song'} 
                      className="absolute inset-0 z-[1] cursor-pointer" 
                    />

                    {/* Top status tag */}
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3 sm:p-4">
                      <span 
                        className="rounded-full border px-3 py-1 text-[9px] font-extrabold uppercase tracking-[0.16em] backdrop-blur-md shadow-md"
                        style={isCurrent ? { backgroundColor: colorWithAlpha(activeColor, 0.9), borderColor: activeColor, color: '#ffffff' } : { backgroundColor: 'rgba(0,0,0,0.6)', borderColor: 'rgba(255,255,255,0.3)', color: '#ffffff' }}
                      >
                        {isCurrent && isPlaying ? 'Now playing' : isCurrent ? 'Paused' : 'Zenisai reel'}
                      </span>
                      <span className="text-[10px] font-bold text-white bg-black/60 px-2.5 py-0.5 rounded-full backdrop-blur-md">
                        {index + 1} / {queue.length || 1}
                      </span>
                    </div>

                    {/* Bottom song metadata and synced lyrics */}
                    <div className="pointer-events-none absolute bottom-3 sm:bottom-5 left-3 sm:left-6 z-10 max-w-[calc(100%-5rem)] compact-landscape:max-w-[calc(100%-7.5rem)]">
                      <div className="mb-2 compact-landscape:mb-1 min-h-8 compact-landscape:min-h-5">
                        {isCurrent && currentLineIndex >= 0 ? (
                          <p className="text-base sm:text-lg compact-landscape:text-sm font-extrabold leading-tight drop-shadow-lg" style={{ color: activeColor }}>
                            {syncedLyrics[currentLineIndex].text}
                          </p>
                        ) : isCurrent && plainLyrics.length > 0 ? (
                          <p className="text-xs sm:text-sm font-bold text-white">{plainLyrics[0]}</p>
                        ) : (
                          <p className="text-[11px] font-semibold text-white/80">
                            {isLoadingLyrics ? 'Loading lyrics...' : 'Lyrics sync with track'}
                          </p>
                        )}
                      </div>
                      <h2 className="truncate text-xl sm:text-2xl compact-landscape:text-base font-black text-white drop-shadow-md">
                        {feedSong.title}
                      </h2>
                      <p className="mt-0.5 truncate text-xs sm:text-sm font-bold text-white/90">{feedSong.artist}</p>
                    </div>

                    {/* Action buttons rail */}
                    <div className="absolute right-2 top-1/2 z-20 flex max-h-[calc(100%-1.5rem)] -translate-y-1/2 flex-col compact-landscape:grid compact-landscape:grid-cols-2 compact-landscape:gap-1.5 compact-landscape:max-h-[92%] items-center gap-2 sm:gap-2.5 overflow-y-auto no-scrollbar sm:right-4">
                      <FeedAction label={isFavorite(feedSong.id) ? 'Saved' : 'Like'} active={isFavorite(feedSong.id)} onClick={() => onToggleFavorite(feedSong)} activeColor={activeColor} isLight={isLight}>
                        <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill={isFavorite(feedSong.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg>
                      </FeedAction>
                      {onOpenEqualizer && (
                        <FeedAction label="Equalizer" active={true} onClick={onOpenEqualizer} activeColor={activeColor} isLight={isLight}>
                          <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
                        </FeedAction>
                      )}
                      <FeedAction label="Queue" onClick={() => setActiveTab('queue')} activeColor={activeColor} isLight={isLight}>
                        <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h10m3-3 3 3-3 3" /></svg>
                      </FeedAction>
                      <FeedAction label="Lyrics" onClick={() => setActiveTab('lyrics')} activeColor={activeColor} isLight={isLight}>
                        <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13M9 9l12-2M5 19c0 1.1-1.1 2-2.5 2S0 20.1 0 19s1.1-2 2.5-2S5 17.9 5 19zm16-3c0 1.1-1.1 2-2.5 2S16 16.9 16 16s1.1-2 2.5-2S21 14.9 21 16z" /></svg>
                      </FeedAction>
                      <FeedAction label="Playlist" onClick={() => onShowPlaylistModal(feedSong)} activeColor={activeColor} isLight={isLight}>
                        <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                      </FeedAction>
                      <FeedAction label="Download" onClick={() => onDownload(feedSong)} activeColor={activeColor} isLight={isLight}>
                        <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3" /></svg>
                      </FeedAction>
                      <FeedAction label={sleepTimer ? 'Timer on' : 'Timer'} active={sleepTimer !== null} onClick={() => setShowSleepTimerMenu(value => !value)} activeColor={activeColor} isLight={isLight}>
                        <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                      </FeedAction>
                      <FeedAction label={isShuffle ? 'Shuffle on' : 'Shuffle'} active={isShuffle} onClick={onToggleShuffle} activeColor={activeColor} isLight={isLight}>
                        <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg>
                      </FeedAction>
                      <FeedAction label={repeatMode === 'off' ? 'Repeat' : repeatMode === 'one' ? 'Repeat 1' : 'Repeat all'} active={repeatMode !== 'off'} onClick={onToggleRepeat} activeColor={activeColor} isLight={isLight}>
                        <span className="relative">
                          <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3" /></svg>
                          {repeatMode === 'one' && <span className="absolute -right-1 -top-1 grid h-3 w-3 place-items-center rounded-full text-[7px] font-black text-white shadow" style={{ backgroundColor: activeColor }}>1</span>}
                        </span>
                      </FeedAction>
                      {onOpenThemeSettings && (
                        <FeedAction label="Themes" onClick={onOpenThemeSettings} activeColor={activeColor} isLight={isLight}>
                          <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 21a4 4 0 01-4-4 4 4 0 014-4 4 4 0 014 4 4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/></svg>
                        </FeedAction>
                      )}
                      <FeedAction label="Share" onClick={() => onShare(feedSong)} activeColor={activeColor} isLight={isLight}>
                        <svg className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.7 6.8-4.4m-6.8 7 6.8 4.1" /></svg>
                      </FeedAction>
                    </div>

                    {showSleepTimerMenu && (
                      <div className="absolute right-14 sm:right-16 top-1/2 z-30 w-32 -translate-y-1/2 rounded-2xl border border-white/20 bg-black/90 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in duration-200">
                        {[null, 60, 300, 900, 1800].map(value => (
                          <button 
                            key={String(value)} 
                            onClick={() => { setSleepTimer(value); setShowSleepTimerMenu(false); }} 
                            className={`w-full rounded-xl p-2 text-center text-[10px] font-bold uppercase transition-colors ${sleepTimer === value ? 'text-white' : 'text-white/70 hover:text-white'}`}
                            style={sleepTimer === value ? { backgroundColor: activeColor } : {}}
                          >
                            {value === null ? 'Off' : value < 60 ? `${value}s` : `${value / 60} min`}
                          </button>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {activeTab === 'queue' && (
            <div 
              className="h-full overflow-y-auto no-scrollbar" 
              onTouchMove={(e) => {
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
              }} 
              onTouchEnd={() => { dragItemRef.current = null; }}
            >
              <div className="space-y-2 pb-10">
                {queue.map((qs, i) => (
                  <div 
                    key={qs.id} 
                    data-queue-index={i} 
                    draggable 
                    onDragStart={() => { dragItemRef.current = i; }} 
                    onDragOver={event => event.preventDefault()} 
                    onDrop={event => { event.preventDefault(); if (dragItemRef.current !== null) onMoveQueueItem(dragItemRef.current, i); dragItemRef.current = null; }} 
                    onDragEnd={() => { dragItemRef.current = null; }} 
                    className={`flex items-center gap-3 p-3 rounded-[18px] border transition-all ${qs.id === song.id ? (isLight ? 'bg-zinc-200 border-zinc-300 shadow-md' : 'bg-white/15 border-white/30 shadow-lg') : (isLight ? 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100' : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08]')}`}
                  >
                    <div className="p-1.5 opacity-50 touch-none cursor-grab">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M4 8h16M4 16h16" /></svg>
                    </div>
                    <img src={qs.artwork} className="w-10 h-10 rounded-lg object-cover shadow-sm cursor-pointer" onClick={() => onPlayFromQueue(qs)} alt="" />
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onPlayFromQueue(qs)}>
                      <p className={`text-xs font-bold truncate ${qs.id === song.id ? '' : (isLight ? 'text-zinc-900 font-semibold' : 'text-white')}`} style={qs.id === song.id ? { color: activeColor } : {}}>{qs.title}</p>
                      <p className={`text-[9px] font-bold uppercase truncate mt-0.5 ${isLight ? 'text-zinc-600' : 'text-white/60'}`}>{qs.artist}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); onRemoveFromQueue(qs.id); }} className="p-2 opacity-60 hover:opacity-100 hover:text-rose-500 active:scale-75 transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'lyrics' && (
             <div ref={lyricsScrollRef} className="h-full overflow-y-auto no-scrollbar text-center py-6">
               <div className="space-y-7 px-4 sm:px-6 pb-20">
                 {syncedLyrics.length > 0 ? syncedLyrics.map((l, i) => (
                   <p 
                    key={i} 
                    ref={i === currentLineIndex ? activeLyricRef : null}
                    onClick={() => onSeek(l.time)} 
                    className={`text-lg sm:text-2xl font-bold cursor-pointer transition-all duration-500 ${
                      i === currentLineIndex 
                        ? 'scale-105 drop-shadow-lg font-extrabold' 
                        : isLight ? 'text-zinc-500 hover:text-zinc-900' : 'text-white/50 hover:text-white'
                    }`}
                    style={i === currentLineIndex ? { color: activeColor } : {}}
                   >
                    {l.text}
                   </p>
                 )) : plainLyrics.map((l, i) => <p key={i} className={`text-base sm:text-lg font-semibold py-1 ${isLight ? 'text-zinc-700' : 'text-white/70'}`}>{l}</p>)}
               </div>
             </div>
          )}
        </main>

        {/* Footer Scrub Bar & Equalizer Button */}
        <footer className={`mt-2.5 flex items-center gap-2 rounded-[18px] border px-3 py-1.5 backdrop-blur-xl shadow-lg ${isLight ? 'bg-zinc-100 border-zinc-300' : 'bg-[#0b1220] border-white/15'}`}>
          <div className={`relative h-6 sm:h-7 flex-1 min-w-0 overflow-hidden rounded-full ${isLight ? 'bg-zinc-200' : 'bg-white/10'}`}>
            <Visualizer 
              analyser={analyser} 
              color={activeColor} 
              isPlaying={isPlaying} 
              style={activeVisualizer} 
              glow={true} 
              className="absolute inset-0 h-full w-full opacity-80 pointer-events-none" 
            />
            <div className="absolute bottom-0 left-0 top-0 transition-all duration-150" style={{ width: `${(progress / (duration || 1)) * 100}%`, backgroundColor: colorWithAlpha(activeColor, 0.45) }} />
            <input aria-label="Seek track" type="range" min="0" max={duration || 100} value={progress} onChange={event => onSeek(Number(event.target.value))} className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0" />
            <div className={`pointer-events-none absolute inset-0 flex items-center justify-between px-2.5 text-[9px] font-extrabold ${isLight ? 'text-zinc-900' : 'text-white'}`}>
              <span>{formatTime(progress)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
          {onOpenEqualizer && (
            <button
              onClick={onOpenEqualizer}
              title="Open Equalizer modal"
              aria-label="Equalizer"
              className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider text-white hover:brightness-110 active:scale-95 transition-all shrink-0 flex items-center gap-1 shadow-sm"
              style={{ backgroundColor: activeColor }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <span>EQ</span>
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};

export default PlayerFull;
