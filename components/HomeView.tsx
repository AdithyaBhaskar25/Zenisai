import React, { useEffect, useState, useRef } from 'react';
import { Song } from '../types';
import { saavnService } from '../services/saavnService';
import { lyricsService, ParsedLyricLine } from '../services/lyricsService';

interface HomeViewProps {
  onPlay: (song: Song, queue?: Song[]) => void;
  currentSong: Song | null;
  isPlaying: boolean;
  onAddClick: (song: Song) => void;
  onDownload: (song: Song) => void;
  progress: number;
  isFavorite: (songId: string) => boolean;
  onToggleFavorite: (song: Song) => void;
  onTogglePlay?: () => void;
}

const HomeView: React.FC<HomeViewProps> = ({ 
  onPlay, currentSong, isPlaying, onAddClick, onDownload, progress, isFavorite, onToggleFavorite, onTogglePlay 
}) => {
  const [tamilHits, setTamilHits] = useState<Song[]>([]);
  const [englishHits, setEnglishHits] = useState<Song[]>([]);
  const [recommended, setRecommended] = useState<Song[]>([]);
  const [syncedLyrics, setSyncedLyrics] = useState<ParsedLyricLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedMode, setFeedMode] = useState<'latest' | 'recommendations'>('latest');
  const feedScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchDiscovery = async () => {
      setLoading(true);
      try {
        const baseTamilQuery = 'New Tamil Songs';
        const baseEnglishQuery = 'New English Songs';

        const [t, e, rec] = await Promise.all([
          saavnService.searchSongs(baseTamilQuery, 0, 12),
          saavnService.searchSongs(baseEnglishQuery, 0, 12),
          currentSong ? saavnService.getSuggestions(currentSong.id, 12) : saavnService.searchSongs('New Releases', 0, 12)
        ]);

        setTamilHits(t.map(saavnService.mapSong));
        setEnglishHits(e.map(saavnService.mapSong));
        setRecommended(rec.map(saavnService.mapSong));
      } catch (err) {
        console.error("Discovery failed", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDiscovery();
  }, [currentSong?.id]);

  // Synchronized lyrics using central service & cache
  useEffect(() => {
    if (!currentSong) {
      setSyncedLyrics([]);
      return;
    }
    let cancelled = false;
    lyricsService.fetchLyrics(currentSong).then(result => {
      if (!cancelled) {
        setSyncedLyrics(result.syncedLyrics);
      }
    });
    return () => { cancelled = true; };
  }, [currentSong?.id]);

  const activeLyric = [...syncedLyrics].reverse().find(line => progress >= line.time)?.text;
  
  // Requirement 5: Keep 'latest' and 'for you', and ALWAYS show current playing song as a reel feed there in the home tab
  const baseFeedSongs = feedMode === 'recommendations' ? recommended : [...tamilHits, ...englishHits];
  const feedSongs = currentSong ? [currentSong, ...baseFeedSongs.filter(s => s.id !== currentSong.id)] : baseFeedSongs;

  const scrollToCurrentReel = () => {
    if (feedScrollRef.current) {
      feedScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (loading && tamilHits.length === 0) return (
    <div className="flex h-[80vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-[5px] border-accent border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-accent/50 animate-pulse">Curating your vibe</p>
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-220px)] compact-landscape:min-h-[calc(100dvh-120px)] max-w-4xl flex-col gap-3 sm:gap-4 px-0 pb-4 pt-2 sm:pt-4">
      <header className="flex items-center justify-between px-4 sm:px-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Sound for your day</p>
          <h1 className="mt-0.5 sm:mt-1 text-2xl sm:text-3xl font-bold">Zenisai</h1>
        </div>
        {currentSong && (
          <button 
            onClick={scrollToCurrentReel}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/15 border border-accent/30 text-accent text-xs font-semibold hover:bg-accent/25 active:scale-95 transition-all shadow-sm"
          >
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 ${isPlaying ? 'block' : 'hidden'}`}></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
            </span>
            <span className="max-w-[110px] truncate">{currentSong.title}</span>
          </button>
        )}
      </header>

      {/* Mode selection tabs: Latest & For You */}
      <div className="mx-3 flex rounded-[14px] border border-accent-tint bg-accent-tint p-1 sm:mx-0" role="tablist" aria-label="Home feed">
        {(['latest', 'recommendations'] as const).map(mode => (
          <button 
            key={mode} 
            role="tab" 
            aria-selected={feedMode === mode} 
            onClick={() => setFeedMode(mode)} 
            className={`flex-1 rounded-[10px] py-2 sm:py-2.5 text-xs sm:text-sm font-semibold transition-colors ${feedMode === mode ? 'bg-accent text-[#06101e] shadow-lg shadow-accent/20' : 'text-white/55'}`}
          >
            {mode === 'latest' ? 'Latest' : 'For you'}
          </button>
        ))}
      </div>

      {/* Reels Feed Container with current playing song always present */}
      <div 
        ref={feedScrollRef}
        className="h-[min(74dvh,720px)] compact-landscape:h-[calc(100dvh-130px)] compact-landscape:min-h-[250px] min-h-[360px] snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-none border-y border-white/10 bg-[var(--color-surface)] no-scrollbar sm:rounded-[24px] sm:border shadow-2xl"
      >
        {feedSongs.map((song, index) => {
          const isCurrent = currentSong?.id === song.id;
          const queue = feedSongs;

          return (
            <article 
              key={`${song.id}-${index}`} 
              onClick={() => {
                if (isCurrent && onTogglePlay) {
                  onTogglePlay();
                } else {
                  onPlay(song, queue);
                }
              }} 
              className="relative h-full min-h-full snap-start overflow-hidden bg-[var(--color-surface)] cursor-pointer"
            >
              <img src={song.artwork} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700" />
              <div 
                className="absolute inset-0" 
                style={{ background: 'linear-gradient(to top, color-mix(in srgb,var(--color-bg) 96%,transparent), color-mix(in srgb,var(--color-bg) 25%,transparent) 65%, color-mix(in srgb,var(--color-bg) 35%,transparent))' }} 
              />

              {/* Reel Header Badge */}
              <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 z-20">
                {isCurrent ? (
                  <div className="flex items-center gap-2 rounded-full border border-accent/40 bg-black/60 px-3.5 py-1.5 shadow-lg backdrop-blur-md">
                    <span className="flex gap-0.5 items-end h-3 w-3">
                      <span className={`w-0.5 bg-accent rounded-full transition-all ${isPlaying ? 'h-full animate-[bounce_0.8s_infinite]' : 'h-1.5'}`} />
                      <span className={`w-0.5 bg-accent rounded-full transition-all ${isPlaying ? 'h-3/4 animate-[bounce_0.6s_infinite_0.2s]' : 'h-2'}`} />
                      <span className={`w-0.5 bg-accent rounded-full transition-all ${isPlaying ? 'h-full animate-[bounce_0.9s_infinite_0.4s]' : 'h-1'}`} />
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-accent">Now Playing</span>
                  </div>
                ) : (
                  <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-[9px] font-bold uppercase text-white/80 backdrop-blur-md">
                    {feedMode === 'latest' ? (song.language === 'Tamil' ? 'Tamil · New' : 'English · New') : 'Picked for you'}
                  </span>
                )}
                <span className="text-xs font-medium text-white/70">{index + 1} / {feedSongs.length}</span>
              </div>

              {/* Bottom Reel Details & Lyrics */}
              <div className="absolute bottom-5 left-4 z-10 max-w-[calc(100%-5rem)] sm:left-6">
                <div className="mb-3 min-h-10">
                  {isCurrent && activeLyric ? (
                    <p className="text-base font-bold leading-snug text-accent drop-shadow-md animate-in fade-in duration-300">
                      "{activeLyric}"
                    </p>
                  ) : isCurrent ? (
                    <p className="text-xs font-medium text-white/70">Lyrics synchronize in real-time</p>
                  ) : (
                    <p className="text-xs font-medium text-white/60">Tap to play track</p>
                  )}
                </div>

                <h2 className="truncate text-2xl font-bold text-white drop-shadow-md">{song.title}</h2>
                <p className="mt-1 truncate text-sm text-white/70">{song.artist}</p>
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                  {isCurrent && isPlaying ? 'Playing live' : isCurrent ? 'Paused' : 'Zenisai Feed'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-3">
                <button 
                  aria-label={isFavorite(song.id) ? 'Remove from favorites' : 'Add to favorites'} 
                  onClick={event => { event.stopPropagation(); onToggleFavorite(song); }} 
                  className={`grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/35 backdrop-blur-md active:scale-90 transition-transform ${isFavorite(song.id) ? 'text-accent' : 'text-white'}`}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill={isFavorite(song.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
                  </svg>
                </button>
                <button 
                  aria-label="Add to playlist" 
                  onClick={event => { event.stopPropagation(); onAddClick(song); }} 
                  className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md active:scale-90 transition-transform"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
                <button 
                  aria-label="Download track" 
                  onClick={event => { event.stopPropagation(); onDownload(song); }} 
                  className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md active:scale-90 transition-transform"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3" />
                  </svg>
                </button>
                {isCurrent && (
                  <button
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                    onClick={event => { 
                      event.stopPropagation(); 
                      if (onTogglePlay) onTogglePlay(); 
                      else onPlay(song, queue);
                    }}
                    className="grid h-11 w-11 place-items-center rounded-full bg-accent text-[#06101e] shadow-lg shadow-accent/30 backdrop-blur-md active:scale-90 transition-transform"
                  >
                    {isPlaying ? (
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                    ) : (
                      <svg className="h-5 w-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    )}
                  </button>
                )}
              </div>
            </article>
          );
        })}
        {feedSongs.length === 0 && (
          <div className="grid min-h-[min(76dvh,760px)] place-items-center p-8 text-center text-sm text-white/45">
            {feedMode === 'recommendations' ? 'Play a track to build recommendations around it.' : 'No tracks found right now.'}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeView;
