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
    <div className="flex h-screen items-center justify-center bg-black">
      <div className="relative">
        <div className="w-16 h-16 border-2 border-white/5 rounded-full"></div>
        <div className="absolute top-0 w-16 h-16 border-t-2 border-accent rounded-full animate-spin"></div>
        <p className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.4em] text-white/40">Initializing Zenisai</p>
      </div>
    </div>
  );

  const SongCard = ({ song, list }: { song: Song, list: Song[] }) => (
    <div className="flex-shrink-0 w-40 sm:w-48 group relative transition-all duration-500 ease-out">
      {/* Artwork Container */}
      <div 
        className="relative aspect-square rounded-3xl overflow-hidden bg-zinc-900 shadow-2xl transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-[0_20px_50px_rgba(0,0,0,1)] cursor-pointer"
        onClick={() => onPlay(song, list)}
      >
        <img 
          src={song.artwork} 
          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" 
          alt={song.title}
        />
        
        {/* Overlay Play State */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
           <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20">
              <svg className="w-6 h-6 text-white translate-x-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
           </div>
        </div>

        {/* Current Playing Indicator */}
        {currentSong?.id === song.id && isPlaying && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
             <div className="flex gap-1 items-end h-6">
                <div className="w-1 bg-accent animate-[bounce_1s_infinite] h-3"></div>
                <div className="w-1 bg-accent animate-[bounce_1s_infinite_0.2s] h-6"></div>
                <div className="w-1 bg-accent animate-[bounce_1s_infinite_0.4s] h-4"></div>
             </div>
          </div>
        )}
      </div>

      {/* Floating Action Buttons */}
      <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-2 group-hover:translate-x-0 z-20">
        <button onClick={(e) => { e.stopPropagation(); onDownload(song); }} className="p-2.5 bg-black/80 backdrop-blur-xl rounded-xl text-white/60 border border-white/5 hover:text-white transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg></button>
        <button onClick={(e) => { e.stopPropagation(); onAddClick(song); }} className="p-2.5 bg-black/80 backdrop-blur-xl rounded-xl text-white/60 border border-white/5 hover:text-white transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg></button>
      </div>

      {/* Metadata */}
      <div className="mt-4 px-1" onClick={() => onPlay(song, list)}>
        <p className={`font-bold text-sm truncate transition-colors ${currentSong?.id === song.id ? 'text-accent' : 'text-zinc-100'}`}>{song.title}</p>
        <p className="text-zinc-500 text-[10px] font-medium truncate mt-1 tracking-wide">{song.artist}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      {/* Background Ambient Glow */}
      <div 
        className="fixed top-0 left-0 right-0 h-[50vh] opacity-20 pointer-events-none transition-all duration-1000"
        style={{ 
          background: `radial-gradient(circle at 50% -20%, ${currentSong ? 'var(--color-primary)' : '#333'} 0%, transparent 70%)` 
        }}
      />

      <div className="relative z-10 px-6 sm:px-10 pt-20 space-y-16">
        {/* Header Section */}
        <header className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-1000">
          <h1 className="text-6xl sm:text-8xl font-black tracking-tighter italic leading-none">
            Zenisai<span className="text-accent">.</span>
          </h1>
          <div className="flex items-center gap-4">
            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-[0.3em] text-white/60">
              Personalized Discovery
            </span>
          </div>
        </header>

        {/* Sections Wrapper */}
        <div className="space-y-20">
          {[
            { title: "Inspired by your vibe", data: recommended, show: recommended.length > 0 },
            { title: "Regional Discovery", data: tamilHits, show: true },
            { title: "Global Anthems", data: englishHits, show: true },
          ].map((section, idx) => section.show && (
            <section key={idx} className="group/section">
              <div className="flex items-baseline gap-4 mb-6">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.5em] text-zinc-600 group-hover/section:text-zinc-400 transition-colors">
                  {section.title}
                </h2>
                <div className="h-[1px] flex-1 bg-zinc-900"></div>
              </div>
              
              {/* Horizontal Scroll with Masking for Smooth Ends */}
              <div className="relative -mx-6 px-6 sm:-mx-10 sm:px-10">
                <div className="flex gap-6 overflow-x-auto pb-6 no-scrollbar mask-edge-fade">
                  {section.data.map((song) => (
                    <SongCard key={song.id} song={song} list={section.data} />
                  ))}
                  {/* Padding item for end of scroll */}
                  <div className="flex-shrink-0 w-10"></div>
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        /* This creates the smooth fade at the edges of the horizontal scroll */
        .mask-edge-fade {
          mask-image: linear-gradient(
            to right, 
            transparent, 
            black 5%, 
            black 95%, 
            transparent
          );
          -webkit-mask-image: linear-gradient(
            to right, 
            transparent, 
            black 5%, 
            black 95%, 
            transparent
          );
        }
      `}} />
    </div>
  );
};

export default HomeView;
