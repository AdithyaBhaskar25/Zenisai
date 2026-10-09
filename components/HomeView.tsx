import React, { useEffect, useState } from 'react';
import { Song } from '../types';
import { saavnService } from '../services/saavnService';

interface HomeViewProps {
  onPlay: (song: Song, queue?: Song[]) => void;
  currentSong: Song | null;
  isPlaying: boolean;
  onAddClick: (song: Song) => void;
  onDownload: (song: Song) => void;
  progress: number;
  isFavorite: (songId: string) => boolean;
  onToggleFavorite: (song: Song) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onPlay, currentSong, isPlaying, onAddClick, onDownload, progress, isFavorite, onToggleFavorite }) => {
  const [tamilHits, setTamilHits] = useState<Song[]>([]);
  const [englishHits, setEnglishHits] = useState<Song[]>([]);
  const [recommended, setRecommended] = useState<Song[]>([]);
  const [syncedLyrics, setSyncedLyrics] = useState<{ time: number; text: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedMode, setFeedMode] = useState<'latest' | 'recommendations'>('latest');

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

  useEffect(() => {
    if (!currentSong) {
      setSyncedLyrics([]);
      return;
    }
    let cancelled = false;
    setSyncedLyrics([]);
    const exactParams = new URLSearchParams({
      artist_name: currentSong.artist,
      track_name: currentSong.title,
      duration: String(Math.round(currentSong.duration || 0)),
    });
    const loadLyrics = async () => {
      try {
        const exactResponse = await fetch(`https://lrclib.net/api/get?${exactParams}`);
        let data = exactResponse.ok ? await exactResponse.json() : null;
        if (!data?.syncedLyrics) {
          const searchParams = new URLSearchParams({ artist_name: currentSong.artist, track_name: currentSong.title });
          const searchResponse = await fetch(`https://lrclib.net/api/search?${searchParams}`);
          const results = searchResponse.ok ? await searchResponse.json() : [];
          data = results.find((result: any) => result.syncedLyrics) ?? results[0] ?? null;
        }
        if (cancelled) return;
        const lines = data?.syncedLyrics?.split('\n').flatMap((line: string) => {
          const stamp = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\]/);
          const text = line.replace(/^\[[^\]]+\]/, '').trim();
          return stamp && text ? [{ time: Number(stamp[1]) * 60 + Number(stamp[2]), text }] : [];
        }) ?? [];
        setSyncedLyrics(lines);
      } catch {
        if (!cancelled) setSyncedLyrics([]);
      }
    };
    void loadLyrics();
    return () => { cancelled = true; };
  }, [currentSong?.id]);

  const activeLyric = [...syncedLyrics].reverse().find(line => progress >= line.time)?.text;
  const feedSongs = feedMode === 'recommendations' ? recommended : [...tamilHits, ...englishHits];

  if (loading && tamilHits.length === 0) return (
    <div className="flex h-[80vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-[5px] border-accent border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-accent/50 animate-pulse">Curating your vibe</p>
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-220px)] max-w-4xl flex-col gap-4 px-0 pb-4 pt-3 sm:px-6 sm:pt-4">
      <header className="flex items-center justify-between px-4 sm:px-2">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Sound for your day</p><h1 className="mt-1 text-3xl font-bold">Zenisai</h1></div>
        <span className="text-xs text-white/35">{currentSong ? 'Your mix' : 'Fresh drops'}</span>
      </header>
      <div className="mx-3 flex rounded-[14px] border border-accent-tint bg-accent-tint p-1 sm:mx-0" role="tablist" aria-label="Home feed">
        {(['latest', 'recommendations'] as const).map(mode => <button key={mode} role="tab" aria-selected={feedMode === mode} onClick={() => setFeedMode(mode)} className={`flex-1 rounded-[10px] py-2.5 text-sm font-semibold transition-colors ${feedMode === mode ? 'bg-accent text-[#06101e] shadow-lg shadow-accent/20' : 'text-white/55'}`}>{mode === 'latest' ? 'Latest' : 'For you'}</button>)}
      </div>
      <div className="h-[min(74dvh,720px)] min-h-[420px] snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-none border-y border-white/10 bg-[var(--color-surface)] no-scrollbar sm:rounded-[24px] sm:border">
        {feedSongs.map((song, index) => {
          const isCurrent = currentSong?.id === song.id;
          const queue = feedMode === 'latest' ? feedSongs : recommended;
          return <article key={`${song.id}-${index}`} onClick={() => onPlay(song, queue)} className="relative h-full min-h-full snap-start overflow-hidden bg-[var(--color-surface)]">
            <img src={song.artwork} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, color-mix(in srgb,var(--color-bg) 96%,transparent), color-mix(in srgb,var(--color-bg) 20%,transparent) 65%, color-mix(in srgb,var(--color-bg) 32%,transparent))' }} />
            <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4"><span className="rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-[9px] font-bold uppercase text-white/80 backdrop-blur-md">{feedMode === 'latest' ? (song.language === 'Tamil' ? 'Tamil · New' : 'English · New') : 'Picked for you'}</span><span className="text-xs text-white/70">{index + 1} / {feedSongs.length}</span></div>
            <div className="absolute bottom-5 left-4 z-10 max-w-[calc(100%-5rem)] sm:left-6"><p className="mb-3 min-h-10 text-sm font-medium text-white/80">{isCurrent && activeLyric ? activeLyric : isCurrent ? 'Lyrics follow the track' : 'Tap to play'}</p><h2 className="truncate text-2xl font-bold text-white">{song.title}</h2><p className="mt-1 truncate text-sm text-white/70">{song.artist}</p><p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">{isCurrent && isPlaying ? 'Now playing' : 'Zenisai feed'}</p></div>
            <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-3">
              <button aria-label={isFavorite(song.id) ? 'Remove from favorites' : 'Add to favorites'} onClick={event => { event.stopPropagation(); onToggleFavorite(song); }} className={`grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/35 backdrop-blur-md ${isFavorite(song.id) ? 'text-accent' : 'text-white'}`}><svg className="h-5 w-5" viewBox="0 0 24 24" fill={isFavorite(song.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg></button>
              <button aria-label="Add to playlist" onClick={event => { event.stopPropagation(); onAddClick(song); }} className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg></button>
              <button aria-label="Download track" onClick={event => { event.stopPropagation(); onDownload(song); }} className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3" /></svg></button>
            </div>
          </article>;
        })}
        {feedSongs.length === 0 && <div className="grid min-h-[min(76dvh,760px)] place-items-center p-8 text-center text-sm text-white/45">{feedMode === 'recommendations' ? 'Play a track to build recommendations around it.' : 'No tracks found right now.'}</div>}
      </div>
    </div>
  );
};

export default HomeView;

