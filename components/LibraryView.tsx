import React from 'react';
import { Playlist, Song } from '../types';

interface LibraryViewProps {
  playlists: Playlist[];
  setPlaylists: React.Dispatch<React.SetStateAction<Playlist[]>>;
  onPlay: (song: Song, queue: Song[]) => void;
  onRemoveFromPlaylist: (songId: string, playlistId: string) => void;
  onAddClick: (song: Song) => void;
  onDownload: (song: Song) => void;
}

const LibraryView: React.FC<LibraryViewProps> = ({ playlists, setPlaylists, onPlay, onRemoveFromPlaylist, onAddClick, onDownload }) => {
  const [activePlaylist, setActivePlaylist] = React.useState<Playlist | null>(null);

  // --- Playlist Detail View ---
  if (activePlaylist) {
    const p = playlists.find(pl => pl.id === activePlaylist.id) || activePlaylist;
    return (
      <div className="min-h-screen bg-black text-white animate-in slide-in-from-right duration-700">
        {/* Dynamic Background Glow */}
        <div className="fixed top-0 inset-x-0 h-[40vh] opacity-20 pointer-events-none transition-all duration-1000"
             style={{ background: `radial-gradient(circle at 50% 0%, ${p.id === 'favs' ? '#ef4444' : '#ffffff22'} 0%, transparent 70%)` }} />

        <div className="relative z-10 p-6 sm:p-10 space-y-10">
          {/* Back Button */}
          <button 
            onClick={() => setActivePlaylist(null)} 
            className="group flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-white/30 hover:text-white transition-all"
          >
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path></svg>
            </div>
            Back to Library
          </button>

          {/* Playlist Hero */}
          <div className="flex flex-col sm:flex-row items-end gap-8">
            <div className="relative w-48 h-48 sm:w-56 sm:h-56 shrink-0 shadow-[0_30px_60px_-12px_rgba(0,0,0,1)] rounded-[40px] overflow-hidden">
              <img src={p.artwork} className="w-full h-full object-cover" alt={p.name} />
              <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-[40px]" />
            </div>
            <div className="space-y-2 mb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-accent">Collection</span>
              <h2 className="text-5xl sm:text-7xl font-black tracking-tighter leading-none italic">{p.name}</h2>
              <p className="text-white/20 text-xs font-bold tabular-nums">{p.songs.length} Tracks Syncing</p>
            </div>
          </div>

          {/* Track List */}
          <div className="space-y-1 pt-6">
            {p.songs.map((song: Song) => (
              <div 
                key={song.id} 
                className="group flex items-center gap-5 p-3 rounded-[24px] hover:bg-white/[0.04] transition-all cursor-pointer border border-transparent hover:border-white/5"
                onClick={() => onPlay(song, p.songs)}
              >
                <div className="relative w-12 h-12 shrink-0 rounded-xl overflow-hidden shadow-lg">
                  <img src={song.artwork} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate group-hover:text-accent transition-colors">{song.title}</p>
                  <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider mt-0.5">{song.artist}</p>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                  <button 
                    onClick={(e) => { e.stopPropagation(); onRemoveFromPlaylist(song.id, p.id); }} 
                    className="p-3 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all"
                    title="Remove from collection"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- Main Library View ---
  const displayPlaylists = playlists.filter(p => p.songs.length > 0 || p.id === 'favs');

  return (
    <div className="min-h-screen bg-black text-white p-8 sm:p-12 space-y-16 animate-in fade-in duration-1000">
      <header className="flex flex-col gap-4">
        <h1 className="text-7xl font-black tracking-tighter italic leading-none">Vault<span className="text-accent">.</span></h1>
        <div className="flex items-center gap-4">
          <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-[0.3em] text-white/40">
            Stored Playlists
          </span>
          <div className="h-[1px] flex-1 bg-white/5"></div>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {displayPlaylists.map(p => (
          <div 
            key={p.id} 
            className="group cursor-pointer space-y-5" 
            onClick={() => setActivePlaylist(p)}
          >
            <div className="relative aspect-square rounded-[48px] overflow-hidden bg-zinc-900 shadow-2xl transition-all duration-700 group-hover:scale-105 group-hover:-translate-y-2 group-hover:shadow-[0_40px_80px_-15px_rgba(0,0,0,1)]">
              <img src={p.artwork} alt={p.name} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
              
              {/* Stats Overlay */}
              <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black via-black/40 to-transparent">
                 <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(var(--color-primary),0.8)]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/60">{p.songs.length} Syncs</span>
                 </div>
              </div>
              
              <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-[48px] transition-opacity opacity-50 group-hover:opacity-100" />
            </div>
            
            <div className="px-2 space-y-1">
              <p className="font-black text-sm tracking-tight group-hover:text-accent transition-colors">{p.name}</p>
              <p className="text-[9px] text-white/20 uppercase font-black tracking-widest">{p.id === 'favs' ? 'Curated' : 'Custom Vault'}</p>
            </div>
          </div>
        ))}
      </div>

      {displayPlaylists.length === 0 && (
        <div className="flex flex-col items-center justify-center py-32 space-y-4 border-2 border-dashed border-white/5 rounded-[48px]">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
             <svg className="w-6 h-6 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/10 italic">Empty Vault</p>
        </div>
      )}

      {/* Padding for Floating Player */}
      <div className="h-32" />
    </div>
  );
};

export default LibraryView;
