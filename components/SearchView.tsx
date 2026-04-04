import React, { useState, useEffect } from 'react';
import { Song } from '../types';
import { saavnService } from '../services/saavnService';

interface SearchViewProps {
  onPlay: (song: Song, queue?: Song[]) => void;
  onAddClick: (song: Song) => void;
  onDownload: (song: Song) => void;
}

const SearchView: React.FC<SearchViewProps> = ({ onPlay, onAddClick, onDownload }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
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

  // --- Detail View Component ---
  if (activeDetail) {
    const detail = activeDetail.data;
    const songs = activeDetail.songs || [];
    const imageUrl = detail.image?.[detail.image.length - 1]?.url;

    return (
      <div className="min-h-screen bg-black text-white animate-in slide-in-from-right duration-700 pb-32">
        {/* Immersive Header Backdrop */}
        <div className="fixed top-0 inset-x-0 h-[45vh] opacity-30 pointer-events-none" 
             style={{ background: `radial-gradient(circle at 50% 0%, ${activeDetail.type === 'Artist' ? '#8b5cf6' : '#333'} 0%, transparent 80%)` }} />

        <div className="relative z-10 p-6 sm:p-10 space-y-8">
          <button 
            onClick={() => setActiveDetail(null)} 
            className="group flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-white/30 hover:text-white transition-all"
          >
            <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg>
            </div>
            Back to Explore
          </button>

          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-8">
            <img src={imageUrl} className={`w-48 h-48 sm:w-56 sm:h-56 shadow-2xl object-cover transition-all duration-700 ${activeDetail.type === 'Artist' ? 'rounded-full' : 'rounded-[44px]'}`} />
            <div className="text-center sm:text-left space-y-3">
              <span className="text-[10px] font-black uppercase tracking-[0.5em] text-accent">{activeDetail.type}</span>
              <h2 className="text-4xl sm:text-6xl font-black tracking-tighter italic leading-none">{detail.name || detail.title}</h2>
              {songs.length > 0 && (
                <button 
                  onClick={() => onPlay(songs[0], songs)}
                  className="mt-4 flex items-center gap-3 px-8 py-4 bg-white text-black rounded-full font-black text-[10px] uppercase tracking-widest active:scale-90 hover:scale-105 transition-all shadow-white/10 shadow-2xl"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
                  Shuffle Play
                </button>
              )}
            </div>
          </div>

          {detailLoading ? (
            <div className="flex justify-center py-32"><div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin"></div></div>
          ) : (
            <div className="grid gap-2 pt-6">
              {songs.map((s: Song) => (
                <div key={s.id} className="group flex items-center gap-4 p-3 rounded-[24px] hover:bg-white/[0.04] transition-all cursor-pointer border border-transparent hover:border-white/5" onClick={() => onPlay(s, songs)}>
                  <img src={s.artwork} className="w-12 h-12 rounded-xl object-cover shadow-lg" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate group-hover:text-accent transition-colors">{s.title}</p>
                    <p className="text-[10px] text-white/20 font-bold uppercase tracking-wider">{s.artist}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); onDownload(s); }} className="p-3 text-white/10 hover:text-white opacity-0 group-hover:opacity-100 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Main Search Interface ---
  return (
    <div className="min-h-screen bg-black text-white p-8 sm:p-12 space-y-12 animate-in fade-in duration-1000">
      <header className="space-y-3">
        <h1 className="text-7xl font-black tracking-tighter italic leading-none">Explore<span className="text-accent">.</span></h1>
        <div className="flex items-center gap-4">
          <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-[0.3em] text-white/40">Global Sonic Index</span>
          <div className="h-[1px] flex-1 bg-white/5"></div>
        </div>
      </header>

      {/* Modern Search Bar */}
      <div className="relative group max-w-2xl">
        <div className="absolute inset-y-0 left-6 flex items-center">
          {loading ? 
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin"></div> : 
            <svg className="w-5 h-5 text-white/20 group-focus-within:text-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          }
        </div>
        <input 
          type="text" 
          value={query} 
          onChange={(e) => setQuery(e.target.value)} 
          placeholder="Search Zenisai..." 
          className="w-full bg-zinc-900/50 backdrop-blur-xl rounded-[32px] py-6 pl-16 pr-8 outline-none border border-white/5 focus:border-accent/40 focus:bg-zinc-900 transition-all text-base font-medium placeholder:text-white/10 shadow-2xl" 
        />
      </div>

      {!results ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {['Anirudh', 'A.R. Rahman', 'Trending', 'Lo-fi Beats'].map(t => (
            <div 
              key={t} 
              onClick={() => setQuery(t)} 
              className="h-28 bg-zinc-950 border border-white/5 rounded-[36px] p-6 flex flex-col justify-end cursor-pointer hover:bg-zinc-900 hover:-translate-y-1 transition-all group"
            >
              <span className="text-accent text-[8px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity mb-1">Quick Search</span>
              <span className="font-black text-xs uppercase tracking-tight text-white/60 group-hover:text-white">{t}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-16 pb-32">
          {/* Songs */}
          {results.songs?.results.length > 0 && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 mb-6 flex items-center gap-4">Top Tracks <div className="h-[1px] flex-1 bg-white/5" /></h2>
              <div className="grid gap-2">
                {results.songs.results.slice(0, 6).map((item: any) => {
                  const s = saavnService.mapSong(item);
                  return (
                    <div key={item.id} className="flex items-center gap-4 p-3 rounded-[28px] hover:bg-white/[0.05] transition-all cursor-pointer group border border-transparent hover:border-white/5" onClick={() => onPlay(s)}>
                      <img src={s.artwork} className="w-14 h-14 rounded-2xl object-cover shadow-lg" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate text-white group-hover:text-accent transition-colors">{s.title}</p>
                        <p className="text-[10px] text-white/20 font-bold uppercase tracking-wider">{s.artist}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); onAddClick(s); }} className="p-3 text-white/10 hover:text-white transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg></button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Carousels for Album/Artist/Playlist */}
          {[
            { id: 'albums', title: 'Featured Albums', type: 'Album' },
            { id: 'artists', title: 'Visionary Artists', type: 'Artist' },
            { id: 'playlists', title: 'Curated Playlists', type: 'Playlist' }
          ].map(section => results[section.id]?.results.length > 0 && (
            <section key={section.id} className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 mb-6 flex items-center gap-4">{section.title} <div className="h-[1px] flex-1 bg-white/5" /></h2>
              <div className="relative -mx-8 px-8">
                <div className="flex gap-6 overflow-x-auto no-scrollbar pb-4 mask-edge-fade">
                  {results[section.id].results.map((item: any) => (
                    <div key={item.id} onClick={() => openDetail(section.type, item)} className={`flex-shrink-0 cursor-pointer group space-y-4 ${section.type === 'Artist' ? 'w-32' : 'w-40'}`}>
                      <div className={`relative aspect-square overflow-hidden shadow-2xl transition-all duration-700 group-hover:-translate-y-2 ${section.type === 'Artist' ? 'rounded-full scale-95 group-hover:scale-100 group-hover:rounded-[32px]' : 'rounded-[40px] group-hover:rounded-[24px]'}`}>
                        <img src={item.image?.[item.image.length - 1]?.url} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                        <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-inherit" />
                      </div>
                      <div className={`px-2 ${section.type === 'Artist' ? 'text-center' : ''}`}>
                        <p className="text-[11px] font-bold text-white/80 group-hover:text-white truncate transition-colors">{item.name || item.title}</p>
                        <p className="text-[9px] text-white/20 font-black uppercase tracking-widest mt-1">Explore</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex-shrink-0 w-8" />
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .mask-edge-fade {
          mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent);
        }
      `}} />
    </div>
  );
};

export default SearchView;
