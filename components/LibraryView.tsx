import React from 'react';
import { Playlist, Song } from '../types';

interface LibraryViewProps {
  playlists: Playlist[];
  setPlaylists: React.Dispatch<React.SetStateAction<Playlist[]>>;
  onPlay: (song: Song, queue: Song[]) => void;
  onRemoveFromPlaylist: (songId: string, playlistId: string) => void;
  onAddClick: (song: Song) => void;
  onDownload: (song: Song) => void;
  onCreatePlaylist: (name: string) => void;
}

const LibraryView: React.FC<LibraryViewProps> = ({ playlists, setPlaylists, onPlay, onRemoveFromPlaylist, onAddClick, onDownload, onCreatePlaylist }) => {
  const [activePlaylist, setActivePlaylist] = React.useState<Playlist | null>(null);
  const [activeTab, setActiveTab] = React.useState<'saved' | 'playlists'>('saved');
  const [newPlaylistName, setNewPlaylistName] = React.useState('');

  if (activePlaylist) {
    const p = playlists.find(pl => pl.id === activePlaylist.id) || activePlaylist;
    return (
      <div className="p-5 pt-7 sm:p-8 space-y-7 animate-in slide-in-from-right duration-500">
        <button onClick={() => setActivePlaylist(null)} className="p-3 bg-white/5 rounded-full text-accent font-black uppercase text-[9px] flex items-center gap-2 active:scale-95 transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7"></path>
          </svg>
          Library
        </button>
        <div className="flex gap-4 items-center bg-white/[0.035] p-4 rounded-[20px] border border-white/[0.07]">
          <img src={p.artwork} className="w-20 h-20 rounded-[16px] object-cover shadow-xl" />
          <div className="min-w-0">
            <h2 className="text-2xl font-black truncate">{p.name}</h2>
            <p className="text-white/20 text-[9px] font-black uppercase tracking-widest mt-1">{p.songs.length} Tracks</p>
          </div>
          {p.songs.length > 0 && <button onClick={() => onPlay(p.songs[0], p.songs)} className="ml-auto rounded-full bg-white px-4 py-2 text-xs font-bold text-[#06101e]">Play all</button>}
        </div>
        <div className="grid gap-3">
          {p.songs.map((song: Song) => (
            <div key={song.id} className="flex items-center gap-3 p-3 bg-white/[0.035] border border-white/[0.07] rounded-[18px] hover:bg-white/[0.08] active:scale-[0.98] transition-all">
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

  const displayPlaylists = playlists;

  return (
    <div className="p-5 pt-7 sm:p-8 space-y-8 relative z-10 animate-in fade-in duration-500">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Your space</p>
        <h1 className="text-4xl font-bold leading-none mt-1">Saved</h1>
        <p className="text-white/40 text-sm mt-2">A grid of tracks and your collections</p>
      </header>
      <div className="flex border-b border-white/[0.08]" role="tablist" aria-label="Library sections">
        {(['saved', 'playlists'] as const).map(tab => <button key={tab} role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className={`flex-1 border-b-2 py-3 text-sm font-semibold capitalize ${activeTab === tab ? 'border-accent text-white' : 'border-transparent text-white/40'}`}>{tab}</button>)}
      </div>
      {activeTab === 'saved' ? (
        <div className="grid grid-cols-3 gap-1 sm:gap-2">
          {(playlists.find(playlist => playlist.id === 'favs')?.songs ?? []).map(song => <div key={song.id} className="group relative aspect-square overflow-hidden bg-white/[0.04]">
            <button onClick={() => onPlay(song, playlists.find(playlist => playlist.id === 'favs')?.songs ?? [song])} aria-label={`Play ${song.title}`} className="absolute inset-0 z-0"><img src={song.artwork} alt={song.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /></button>
            <button onClick={() => onRemoveFromPlaylist(song.id, 'favs')} aria-label={`Remove ${song.title} from saved tracks`} className="absolute right-1.5 top-1.5 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
          </div>)}
          {(playlists.find(playlist => playlist.id === 'favs')?.songs.length ?? 0) === 0 && <p className="col-span-3 py-16 text-center text-sm text-white/40">Your saved tracks will appear here.</p>}
        </div>
      ) : (
        <div className="space-y-5">
          <form onSubmit={event => { event.preventDefault(); const name = newPlaylistName.trim(); if (name) { onCreatePlaylist(name); setNewPlaylistName(''); } }} className="flex gap-2">
            <input value={newPlaylistName} onChange={event => setNewPlaylistName(event.target.value)} aria-label="New playlist name" placeholder="Name a playlist" className="min-w-0 flex-1 rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-accent/50" />
            <button type="submit" disabled={!newPlaylistName.trim()} className="rounded-[14px] bg-accent px-4 text-sm font-bold text-[#06101e] disabled:opacity-40">Create</button>
          </form>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {displayPlaylists.filter(playlist => playlist.id !== 'favs').map(playlist => <div key={playlist.id} className="group min-w-0">
              <button onClick={() => setActivePlaylist(playlist)} className="relative block w-full overflow-hidden rounded-[16px] bg-white/[0.04] text-left">
                <img src={playlist.artwork} alt={playlist.name} className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-3 pb-3 pt-8"><span className="block truncate text-sm font-semibold text-white">{playlist.name}</span><span className="text-[10px] text-white/60">{playlist.songs.length} tracks</span></span>
              </button>
              <button onClick={() => { if (window.confirm(`Delete playlist "${playlist.name}"?`)) setPlaylists(previous => previous.filter(item => item.id !== playlist.id)); }} aria-label={`Delete ${playlist.name}`} className="mt-2 text-xs text-white/40 hover:text-rose-300">Delete playlist</button>
            </div>)}
            {displayPlaylists.filter(playlist => playlist.id !== 'favs').length === 0 && <p className="col-span-2 py-12 text-center text-sm text-white/40 sm:col-span-3">Create a playlist to get started.</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default LibraryView;
