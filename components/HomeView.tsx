
import React, { useEffect, useState } from 'react';
import { Song } from '../types';
import { saavnService } from '../services/saavnService';

interface HomeViewProps {
  onPlay: (song: Song, queue?: Song[]) => void;
  currentSong: Song | null;
  isPlaying: boolean;
  onAddClick: (song: Song) => void;
  onDownload: (song: Song) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onPlay, currentSong, isPlaying, onAddClick, onDownload }) => {
  const [tamilHits, setTamilHits] = useState<Song[]>([]);
  const [englishHits, setEnglishHits] = useState<Song[]>([]);
  const [recommended, setRecommended] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDiscovery = async () => {
      setLoading(true);
      try {
        const baseTamilQuery = currentSong?.language === 'Tamil' ? currentSong.artist : 'Tamil Viral Hits';
        const baseEnglishQuery = currentSong?.language === 'English' ? currentSong.artist : 'Trending Global';
        
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

  if (loading && tamilHits.length === 0) return (
    <div className="flex h-[80vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-[5px] border-accent border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-accent/50 animate-pulse">Curating your vibe</p>
      </div>
    </div>
  );

  const SongCard = ({ song, list }: { song: Song, list: Song[] }) => (
    <div className="flex-shrink-0 w-44 space-y-4 group relative">
      <div className="relative aspect-square rounded-[48px] overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.6)] transition-all duration-700 hover:scale-[1.04] active:scale-95 group shadow-black/80" onClick={() => onPlay(song, list)}>
        <img src={song.artwork} className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110" />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
           <svg className="w-12 h-12 text-white/80" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
        </div>
        {currentSong?.id === song.id && isPlaying && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center">
             <div className="flex gap-1.5 items-end h-8">
                <div className="w-1.5 h-3 bg-accent animate-bounce shadow-accent"></div>
                <div className="w-1.5 h-7 bg-accent animate-bounce shadow-accent [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-4 bg-accent animate-bounce shadow-accent [animation-delay:0.4s]"></div>
             </div>
          </div>
        )}
      </div>
      <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-4 group-hover:translate-x-0">
        <button onClick={(e) => { e.stopPropagation(); onDownload(song); }} className="p-3 bg-black/60 backdrop-blur-2xl rounded-2xl text-white/80 border border-white/10 shadow-2xl hover:text-accent hover:bg-black/80 transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg></button>
        <button onClick={(e) => { e.stopPropagation(); onAddClick(song); }} className="p-3 bg-black/60 backdrop-blur-2xl rounded-2xl text-white/80 border border-white/10 shadow-2xl hover:text-accent hover:bg-black/80 transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"></path></svg></button>
      </div>
      <div className="px-3" onClick={() => onPlay(song, list)}>
        <p className={`font-black text-[13px] truncate tracking-tight mb-0.5 leading-none ${currentSong?.id === song.id ? 'text-accent' : 'text-white/90'}`}>{song.title}</p>
        <p className="text-white/20 text-[9px] font-black uppercase tracking-[0.2em]">{song.artist}</p>
      </div>
    </div>
  );

  return (
    <div className="p-10 pt-14 space-y-16 relative z-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-7xl font-black tracking-tighter leading-none italic bg-clip-text text-transparent bg-gradient-to-br from-white via-white to-white/20">Zenisai</h1>
        <div className="flex items-center gap-3">
          <div className="h-[2px] w-8 bg-accent shadow-accent rounded-full"></div>
          <p className="text-accent text-[10px] font-black uppercase tracking-[0.6em] drop-shadow-[0_0_10px_rgba(var(--color-primary),0.5)]">AI Sonic Experience</p>
        </div>
      </header>

      {recommended.length > 0 && (
        <section>
          <div className="flex justify-between items-end mb-8 px-1">
            <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-white/30">
              {currentSong ? `Inspired by your vibe` : "Top Pick For You"}
            </h2>
            <div className="h-[1px] flex-1 mx-6 bg-white/5"></div>
          </div>
          <div className="flex gap-8 overflow-x-auto pb-10 no-scrollbar">
            {recommended.map((song) => (
              <SongCard key={song.id} song={song} list={recommended} />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex justify-between items-end mb-8 px-1">
          <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-white/30">Regional Discovery</h2>
          <div className="h-[1px] flex-1 mx-6 bg-white/5"></div>
        </div>
        <div className="flex gap-8 overflow-x-auto pb-10 no-scrollbar">
          {tamilHits.map((song) => (
            <SongCard key={song.id} song={song} list={tamilHits} />
          ))}
        </div>
      </section>

      <section>
        <div className="flex justify-between items-end mb-8 px-1">
          <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-white/30">Global Anthems</h2>
          <div className="h-[1px] flex-1 mx-6 bg-white/5"></div>
        </div>
        <div className="flex gap-8 overflow-x-auto pb-10 no-scrollbar">
          {englishHits.map((song) => (
            <SongCard key={song.id} song={song} list={englishHits} />
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomeView;
