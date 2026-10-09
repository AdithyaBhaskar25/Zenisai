import React, { useState, useEffect } from 'react';
import { Song } from '../types';
import { saavnService } from '../services/saavnService';

interface SearchViewProps {
  onPlay: (song: Song, queue?: Song[]) => void;
  onAddClick: (song: Song) => void;
  onDownload: (song: Song) => void;
  isFavorite: (songId: string) => boolean;
  onToggleFavorite: (song: Song) => void;
}

const SearchView: React.FC<SearchViewProps> = ({ onPlay, onAddClick, onDownload, isFavorite, onToggleFavorite }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [category, setCategory] = useState<'songs' | 'artists' | 'playlists' | 'albums'>('songs');
  const [loading, setLoading] = useState(false);
  const [activeDetail, setActiveDetail] = useState<{ type: string, data: any, songs?: Song[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (!query.trim()) {
        setResults(null);
        return;
      }
      setLoading(true);
      try {
        const data = await saavnService.searchAll(query);
        setResults(data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [query]);

  const openDetail = async (type: string, item: any) => {
    setDetailLoading(true);
    setActiveDetail({ type, data: item });
    try {
      let songs: Song[] = [];
      if (type === 'Album') {
        const data = await saavnService.getAlbumDetails(item.id);
        songs = (data.songs || []).map(saavnService.mapSong);
      } else if (type === 'Artist') {
        const data = await saavnService.getArtistDetails(item.id);
        songs = (data.topSongs || []).map(saavnService.mapSong);
      } else if (type === 'Playlist') {
        const data = await saavnService.getPlaylistDetails(item.id);
        songs = (data.songs || []).map(saavnService.mapSong);
      }
      setActiveDetail(prev => prev ? { ...prev, songs } : null);
    } catch (err) {
      console.error("Failed to load details", err);
    } finally {
      setDetailLoading(false);
    }
  };

  if (activeDetail) {
    const detail = activeDetail.data;
    const songs = activeDetail.songs || [];

    return (
      <div className="px-4 pb-5 pt-5 sm:px-8 space-y-5 animate-in slide-in-from-right duration-500">
        <button onClick={() => setActiveDetail(null)} className="p-3 bg-white/5 rounded-full text-accent font-black uppercase tracking-[0.2em] text-[10px] flex items-center gap-2 active:scale-95 transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg>
          Back
        </button>

        <div className="flex gap-8 items-center">
          <img src={detail.image?.[detail.image.length - 1]?.url} className="w-24 h-24 rounded-[20px] shadow-xl object-cover" />
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl sm:text-3xl font-bold leading-tight">{detail.name || detail.title}</h2>
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mt-2">{activeDetail.type}</p>
            {songs.length > 0 && (
              <button 
                onClick={() => onPlay(songs[0], songs)}
                className="mt-6 flex items-center gap-3 px-6 py-3 bg-accent text-[#06101e] rounded-full font-bold text-xs active:scale-95 transition-all shadow-xl"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
                Play All
              </button>
            )}
          </div>
        </div>

        {detailLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="h-[min(62dvh,620px)] min-h-[380px] snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-[22px] border border-white/10 no-scrollbar">
            {songs.map((s: Song, index: number) => (
              <article key={s.id} className="relative h-full min-h-full snap-start overflow-hidden bg-[var(--color-surface)]">
                <img src={s.artwork} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, color-mix(in srgb,var(--color-bg) 96%,transparent), color-mix(in srgb,var(--color-bg) 20%,transparent) 65%, color-mix(in srgb,var(--color-bg) 32%,transparent))' }} />
                <button aria-label={`Play ${s.title}`} onClick={() => onPlay(s, songs)} className="absolute inset-0 z-[1]" />
                <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-4"><span className="rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-[9px] font-bold uppercase text-white/80 backdrop-blur-md">{activeDetail.type}</span><span className="text-xs text-white/70">{index + 1} / {songs.length}</span></div>
                <div className="pointer-events-none absolute bottom-5 left-4 z-10 max-w-[calc(100%-5rem)]"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">{detail.name || detail.title}</p><h3 className="mt-2 truncate text-2xl font-bold text-white">{s.title}</h3><p className="mt-1 truncate text-sm text-white/70">{s.artist}</p></div>
                <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-3">
                  <button aria-label={isFavorite(s.id) ? 'Remove from favorites' : 'Add to favorites'} onClick={() => onToggleFavorite(s)} className={`grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/35 backdrop-blur-md ${isFavorite(s.id) ? 'text-accent' : 'text-white'}`}><svg className="h-5 w-5" viewBox="0 0 24 24" fill={isFavorite(s.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z" /></svg></button>
                  <button aria-label="Add to playlist" onClick={() => onAddClick(s)} className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg></button>
                  <button aria-label="Download track" onClick={() => onDownload(s)} className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3" /></svg></button>
                </div>
              </article>
            ))}
            {songs.length === 0 && <div className="grid h-full place-items-center text-sm text-white/45">No songs found in this {activeDetail.type}.</div>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 pb-5 pt-5 sm:px-8 space-y-5">
      <header><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Find your next sound</p><h1 className="text-4xl font-bold mt-1">Explore</h1><p className="text-white/40 text-sm mt-1">Tracks, artists, albums and playlists</p></header>

      <div className="relative group">
        <div className="absolute inset-y-0 left-5 flex items-center">{loading ? <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin"></div> : <svg className="w-5 h-5 text-white/20 group-focus-within:text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>}</div>
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Songs, artists, albums..." className="w-full bg-white/[0.04] rounded-[16px] py-4 pl-12 pr-5 outline-none border border-white/10 focus:border-accent/40 focus:bg-white/[0.07] transition-all text-sm font-medium" />
      </div>

      <div className="flex overflow-x-auto rounded-[14px] border border-white/[0.08] bg-white/[0.035] p-1 no-scrollbar" role="tablist" aria-label="Search categories">
        {(['songs', 'artists', 'playlists', 'albums'] as const).map(value => <button key={value} role="tab" aria-selected={category === value} onClick={() => setCategory(value)} className={`min-w-0 flex-1 rounded-[10px] px-3 py-2.5 text-xs font-semibold capitalize transition-colors ${category === value ? 'bg-accent text-[#06101e]' : 'text-white/45'}`}>{value}</button>)}
      </div>

      {!results ? (
        <div className="grid grid-cols-2 gap-3">
          {['Anirudh', 'Rahman', 'English Pop', 'Vibe Hits'].map(t => (
            <div key={t} onClick={() => setQuery(t)} className="h-24 bg-white/[0.03] border border-white/5 rounded-[32px] p-6 flex items-end cursor-pointer hover:bg-white/[0.08] active:scale-[0.98] transition-all"><span className="font-black text-[10px] uppercase tracking-[0.2em]">{t}</span></div>
          ))}
        </div>
      ) : (
        <div className="space-y-12">
          {/* Songs Results */}
          {category === 'songs' && results.songs?.results.length > 0 && (
            <section className="h-[min(62dvh,620px)] min-h-[380px] snap-y snap-mandatory overflow-y-auto rounded-[22px] border border-white/10 no-scrollbar">
              {results.songs.results.slice(0, 12).map((item: any, index: number, items: any[]) => {
                const foundSong = saavnService.mapSong(item);
                const songQueue = items.map(saavnService.mapSong);
                return <article key={item.id} onClick={() => onPlay(foundSong, songQueue)} className="relative h-full min-h-full snap-start overflow-hidden bg-[var(--color-surface)]">
                  <img src={foundSong.artwork} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, color-mix(in srgb,var(--color-bg) 96%,transparent), color-mix(in srgb,var(--color-bg) 20%,transparent) 65%, color-mix(in srgb,var(--color-bg) 32%,transparent))' }} />
                  <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4"><span className="rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-[9px] font-bold uppercase text-white/80 backdrop-blur-md">Track {index + 1}</span><span className="text-xs text-white/70">{index + 1} / {items.length}</span></div>
                  <div className="absolute bottom-5 left-4 z-10 max-w-[calc(100%-5rem)]"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">Search result</p><h2 className="mt-2 truncate text-2xl font-bold text-white">{foundSong.title}</h2><p className="mt-1 truncate text-sm text-white/70">{foundSong.artist}</p></div>
                  <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-3">
                    <button aria-label={isFavorite(foundSong.id) ? 'Remove from favorites' : 'Add to favorites'} onClick={event => { event.stopPropagation(); onToggleFavorite(foundSong); }} className={`grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/35 backdrop-blur-md ${isFavorite(foundSong.id) ? 'text-accent' : 'text-white'}`}><svg className="h-5 w-5" viewBox="0 0 24 24" fill={isFavorite(foundSong.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z" /></svg></button>
                    <button aria-label="Add to playlist" onClick={event => { event.stopPropagation(); onAddClick(foundSong); }} className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg></button>
                    <button aria-label="Download track" onClick={event => { event.stopPropagation(); onDownload(foundSong); }} className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3" /></svg></button>
                  </div>
                </article>;
              })}
            </section>
          )}

          {/* Album Results */}
          {category === 'albums' && results.albums?.results.length > 0 && (
            <section>
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-6 px-2">Albums</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {results.albums.results.map((alb: any) => (
                  <div key={alb.id} onClick={() => openDetail('Album', alb)} className="group min-w-0 cursor-pointer overflow-hidden rounded-[18px] border border-white/[0.08] bg-white/[0.035]">
                    <img src={alb.image?.[alb.image.length - 1]?.url} className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    <p className="truncate px-3 py-2 text-xs font-semibold text-white">{alb.name || alb.title}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Artist Results */}
          {category === 'artists' && results.artists?.results.length > 0 && (
            <section>
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-6 px-2">Artists</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {results.artists.results.map((art: any) => (
                  <div key={art.id} onClick={() => openDetail('Artist', art)} className="group min-w-0 cursor-pointer overflow-hidden rounded-[18px] border border-white/[0.08] bg-white/[0.035]">
                    <img src={art.image?.[art.image.length - 1]?.url} className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    <p className="truncate px-3 py-2 text-xs font-semibold text-white">{art.name || art.title}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Playlist Results */}
          {category === 'playlists' && results.playlists?.results.length > 0 && (
            <section>
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-6 px-2">Playlists</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {results.playlists.results.map((pl: any) => (
                  <div key={pl.id} onClick={() => openDetail('Playlist', pl)} className="group min-w-0 cursor-pointer overflow-hidden rounded-[18px] border border-white/[0.08] bg-white/[0.035]">
                    <img src={pl.image?.[pl.image.length - 1]?.url} className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    <p className="truncate px-3 py-2 text-xs font-semibold text-white">{pl.name || pl.title}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
          {!results[category]?.results?.length && <div className="rounded-[18px] border border-accent-tint bg-accent-tint px-5 py-8 text-center text-sm text-white/70">No {category} found for “{query}”. Try another search.</div>}
        </div>
      )}
    </div>
  );
};

export default SearchView;