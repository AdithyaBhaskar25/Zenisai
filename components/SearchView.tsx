
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

  if (activeDetail) {
    const detail = activeDetail.data;
    const songs = activeDetail.songs || [];
    
    return (
      <div className="p-8 space-y-10 animate-in slide-in-from-right duration-500">
        <button onClick={() => setActiveDetail(null)} className="p-3 bg-white/5 rounded-full text-purple-400 font-black uppercase tracking-[0.2em] text-[10px] flex items-center gap-2 active:scale-95 transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg>
          Back
        </button>
        
        <div className="flex gap-8 items-center">
          <img src={detail.image?.[detail.image.length - 1]?.url} className="w-32 h-32 rounded-[32px] shadow-2xl object-cover" />
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-black tracking-tight leading-tight">{detail.name || detail.title}</h2>
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mt-2">{activeDetail.type}</p>
            {songs.length > 0 && (
              <button 
                onClick={() => onPlay(songs[0], songs)}
                className="mt-6 flex items-center gap-3 px-6 py-3 bg-white text-black rounded-full font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-xl"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
                Play All
              </button>
            )}
          </div>
        </div>

        {detailLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid gap-3 pb-32">
            {songs.map((s: Song) => (
              <div key={s.id} className="flex items-center gap-4 p-4 bg-white/5 border border-white/5 rounded-[32px] cursor-pointer hover:bg-white/10 group" onClick={() => onPlay(s, songs)}>
                <img src={s.artwork} className="w-12 h-12 rounded-xl" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate text-white">{s.title}</p>
                  <p className="text-[10px] text-white/30 font-black uppercase">{s.artist}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onDownload(s); }} className="p-3 text-white/10 hover:text-white"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg></button>
              </div>
            ))}
            {songs.length === 0 && <p className="text-center text-white/20 text-[10px] font-black uppercase tracking-widest py-10">No songs found in this {activeDetail.type}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-8 space-y-10 pb-48">
      <header><h1 className="text-5xl font-black tracking-tighter">Explore</h1><p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] mt-2 opacity-60">Global Zenisai</p></header>
      
      <div className="relative group">
        <div className="absolute inset-y-0 left-5 flex items-center">{loading ? <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div> : <svg className="w-5 h-5 text-white/20 group-focus-within:text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>}</div>
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Artists, Songs, Playlists..." className="w-full bg-white/[0.04] rounded-[24px] py-5 pl-14 pr-6 outline-none border border-white/10 focus:border-purple-500/40 focus:bg-white/[0.07] transition-all text-sm font-semibold tracking-tight" />
      </div>

      {!results ? (
        <div className="grid grid-cols-2 gap-4">
          {['Anirudh', 'Rahman', 'English Pop', 'Vibe Hits'].map(t => (
            <div key={t} onClick={() => setQuery(t)} className="h-24 bg-white/[0.03] border border-white/5 rounded-[32px] p-6 flex items-end cursor-pointer hover:bg-white/[0.08] active:scale-[0.98] transition-all"><span className="font-black text-[10px] uppercase tracking-[0.2em]">{t}</span></div>
          ))}
        </div>
      ) : (
        <div className="space-y-12">
          {/* Songs Results */}
          {results.songs?.results.length > 0 && (
            <section>
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-6 px-2">Top Tracks</h2>
              <div className="grid gap-3">
                {results.songs.results.slice(0, 5).map((item: any) => {
                  const s = saavnService.mapSong(item);
                  return (
                    <div key={item.id} className="flex items-center gap-4 p-4 bg-white/[0.03] border border-white/5 rounded-[32px] cursor-pointer hover:bg-white/[0.08] transition-all group" onClick={() => onPlay(s)}>
                      <img src={s.artwork} className="w-14 h-14 rounded-2xl object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate text-white">{s.title}</p>
                        <p className="text-[9px] text-white/30 font-black uppercase">{s.artist}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); onAddClick(s); }} className="p-2.5 text-white/10 hover:text-purple-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg></button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Album Results */}
          {results.albums?.results.length > 0 && (
            <section>
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-6 px-2">Albums</h2>
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                {results.albums.results.map((alb: any) => (
                  <div key={alb.id} onClick={() => openDetail('Album', alb)} className="flex-shrink-0 w-36 space-y-2 cursor-pointer">
                    <img src={alb.image?.[alb.image.length - 1]?.url} className="w-full aspect-square rounded-[32px] object-cover" />
                    <p className="text-[10px] font-bold text-white truncate px-1">{alb.name || alb.title}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Artist Results */}
          {results.artists?.results.length > 0 && (
            <section>
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-6 px-2">Artists</h2>
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                {results.artists.results.map((art: any) => (
                  <div key={art.id} onClick={() => openDetail('Artist', art)} className="flex-shrink-0 w-32 space-y-2 cursor-pointer text-center">
                    <img src={art.image?.[art.image.length - 1]?.url} className="w-full aspect-square rounded-full object-cover grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all" />
                    <p className="text-[9px] font-black uppercase tracking-tighter text-white truncate">{art.name || art.title}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Playlist Results */}
          {results.playlists?.results.length > 0 && (
            <section>
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-6 px-2">Playlists</h2>
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                {results.playlists.results.map((pl: any) => (
                  <div key={pl.id} onClick={() => openDetail('Playlist', pl)} className="flex-shrink-0 w-36 space-y-2 cursor-pointer">
                    <img src={pl.image?.[pl.image.length - 1]?.url} className="w-full aspect-square rounded-[32px] object-cover" />
                    <p className="text-[10px] font-bold text-white truncate px-1">{pl.name || pl.title}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchView;
