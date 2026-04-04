Import React from 'react';
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

  if (activePlaylist) {
    const p = playlists.find(pl => pl.id === activePlaylist.id) || activePlaylist;
    return (
      <div className="p-8 space-y-8 animate-in slide-in-from-right duration-500">
        <button onClick={() => setActivePlaylist(null)} className="p-3 bg-white/5 rounded-full text-purple-400 font-black uppercase text-[9px] flex items-center gap-2 active:scale-95 transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path>
          </svg>
          Library
        </button>
        <div className="flex gap-6 items-center bg-white/5 p-6 rounded-[40px] border border-white/5">
          <img src={p.artwork} className="w-24 h-24 rounded-3xl object-cover shadow-xl" />
          <div className="min-w-0">
            <h2 className="text-2xl font-black truncate">{p.name}</h2>
            <p className="text-white/20 text-[9px] font-black uppercase tracking-widest mt-1">{p.songs.length} Tracks</p>
          </div>
        </div>
        <div className="grid gap-3">
          {p.songs.map((song: Song) => (
            <div key={song.id} className="flex items-center gap-4 p-3 bg-white/[0.03] border border-white/5 rounded-[32px] hover:bg-white/[0.08] active:scale-[0.98] transition-all">
              <img src={song.artwork} className="w-12 h-12 rounded-xl object-cover" onClick={() => onPlay(song, p.songs)} />
              <div className="flex-1 min-w-0" onClick={() => onPlay(song, p.songs)}>
                <p className="text-xs font-bold truncate">{song.title}</p>
                <p className="text-[8px] text-white/30 font-black uppercase tracking-widest">{song.artist}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); onRemoveFromPlaylist(song.id, p.id); }} className="p-2 text-white/10 hover:text-red-500 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const displayPlaylists = playlists.filter(p => p.songs.length > 0 || p.id === 'favs');

  return (
    <div className="p-8 space-y-10 relative z-10 animate-in fade-in duration-700">
      <header>
        <h1 className="text-5xl font-black tracking-tighter leading-none">Library</h1>
        <p className="text-gray-500 text-[9px] font-black uppercase tracking-[0.5em] mt-3 opacity-40">Your Collections</p>
      </header>
      <div className="grid grid-cols-2 gap-6">
        {displayPlaylists.map(p => (
          <div key={p.id} className="space-y-3 cursor-pointer group" onClick={() => setActivePlaylist(p)}>
            <div className="relative aspect-square rounded-[44px] overflow-hidden bg-white/5 shadow-2xl transition-transform duration-500 group-hover:scale-[1.02]">
              <img src={p.artwork} alt={p.name} className="w-full h-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/95 to-transparent" />
            </div>
            <p className="font-black text-xs px-2 truncate">{p.name}</p>
            <p className="text-[8px] text-white/20 uppercase font-black px-2">{p.songs.length} Tracks</p>
          </div>
        ))}
      </div>
      {displayPlaylists.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 opacity-20">
          <p className="text-[10px] font-black uppercase tracking-[0.5em]">Empty Vault</p>
        </div>
      )}
    </div>
  );
};

export default LibraryView;
