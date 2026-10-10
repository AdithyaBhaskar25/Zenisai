import React, { useState, useMemo } from 'react';
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

const formatDuration = (seconds?: number): string => {
  if (!seconds || isNaN(seconds)) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const LibraryView: React.FC<LibraryViewProps> = ({ 
  playlists, setPlaylists, onPlay, onRemoveFromPlaylist, onAddClick, onDownload, onCreatePlaylist 
}) => {
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);
  const [activeTab, setActiveTab] = useState<'saved' | 'playlists'>('saved');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortBy, setSortBy] = useState<'default' | 'title' | 'artist'>('default');

  const favsPlaylist = playlists.find(pl => pl.id === 'favs');
  const favSongs = favsPlaylist?.songs || [];

  // Filtered and sorted favorites for handling large numbers smoothly
  const processedFavorites = useMemo(() => {
    let list = [...favSongs];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
    }
    if (sortBy === 'title') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'artist') {
      list.sort((a, b) => a.artist.localeCompare(b.artist));
    }
    return list;
  }, [favSongs, searchQuery, sortBy]);

  const totalDurationMinutes = useMemo(() => {
    const totalSecs = favSongs.reduce((acc, s) => acc + (s.duration || 180), 0);
    return Math.round(totalSecs / 60);
  }, [favSongs]);

  const handleShufflePlay = (songsToPlay: Song[]) => {
    if (songsToPlay.length === 0) return;
    const shuffled = [...songsToPlay];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    onPlay(shuffled[0], shuffled);
  };

  // Dedicated Detailed Playlist View
  if (activePlaylist) {
    const p = playlists.find(pl => pl.id === activePlaylist.id) || activePlaylist;
    return (
      <div className="p-4 pt-6 sm:p-8 space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setActivePlaylist(null)} 
            className="px-4 py-2 bg-white/5 rounded-full text-accent font-bold uppercase text-xs flex items-center gap-2 active:scale-95 transition-all hover:bg-white/10"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Library
          </button>

          {p.id !== 'favs' && (
            <button
              onClick={() => {
                setPlaylists(previous => previous.filter(item => item.id !== p.id));
                setActivePlaylist(null);
              }}
              title={`Delete ${p.name}`}
              aria-label={`Delete ${p.name}`}
              className="p-2.5 rounded-full bg-white/5 text-white/40 hover:text-rose-400 hover:bg-rose-500/10 active:scale-90 transition-all flex items-center gap-1.5 text-xs font-semibold"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="hidden sm:inline">Delete</span>
            </button>
          )}
        </div>

        {/* Collection Hero Header */}
        <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-end bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-5 sm:p-6 rounded-[24px] border border-white/10 shadow-2xl backdrop-blur-xl">
          <img 
            src={p.artwork || 'https://picsum.photos/seed/playlist/400/400'} 
            className="w-36 h-36 sm:w-44 sm:h-44 rounded-[20px] object-cover shadow-2xl ring-1 ring-white/15" 
            alt={p.name}
          />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <span className="text-[10px] font-black tracking-widest uppercase text-accent bg-accent/15 px-2.5 py-1 rounded-full border border-accent/25">Playlist</span>
            <h2 className="text-2xl sm:text-4xl font-extrabold truncate mt-2 text-white">{p.name}</h2>
            <p className="text-white/40 text-xs font-semibold mt-1.5">{p.songs.length} Tracks</p>

            {p.songs.length > 0 && (
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-4">
                <button 
                  onClick={() => onPlay(p.songs[0], p.songs)} 
                  className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-bold text-[#06101e] shadow-lg shadow-accent/25 hover:brightness-110 active:scale-95 transition-all"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  Play all
                </button>
                <button 
                  onClick={() => handleShufflePlay(p.songs)} 
                  className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/10 active:scale-95 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg>
                  Shuffle
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Songs List */}
        <div className="space-y-2">
          {p.songs.map((song: Song, idx: number) => (
            <div 
              key={`${song.id}-${idx}`} 
              className="flex items-center gap-3.5 p-3 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] rounded-[18px] transition-all group"
            >
              <span className="text-xs font-bold text-white/30 w-5 text-center">{idx + 1}</span>
              <img 
                src={song.artwork} 
                className="w-12 h-12 rounded-xl object-cover cursor-pointer shadow-md group-hover:scale-105 transition-transform" 
                onClick={() => onPlay(song, p.songs)} 
                alt={song.title}
              />
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onPlay(song, p.songs)}>
                <p className="text-sm font-bold truncate text-white group-hover:text-accent transition-colors">{song.title}</p>
                <p className="text-xs text-white/40 truncate">{song.artist}</p>
              </div>
              {song.duration ? <span className="text-xs text-white/30 hidden sm:block">{formatDuration(song.duration)}</span> : null}
              <button 
                onClick={() => onDownload(song)} 
                title="Download track"
                className="p-2 text-white/25 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3"/></svg>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onRemoveFromPlaylist(song.id, p.id); }} 
                title="Remove from playlist"
                className="p-2 text-white/25 hover:text-rose-400 active:scale-90 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          ))}
          {p.songs.length === 0 && (
            <div className="py-16 text-center text-sm text-white/40">No songs in this playlist yet. Add tracks while browsing or searching!</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pt-6 sm:p-8 space-y-6 relative z-10 animate-in fade-in duration-300">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Your Library</p>
        <h1 className="text-3xl sm:text-4xl font-extrabold leading-none mt-1">Collections</h1>
        <p className="text-white/40 text-sm mt-1.5">Manage your saved tracks and personalized playlists</p>
      </header>

      {/* Primary Tab Switcher */}
      <div className="flex border-b border-white/[0.08]" role="tablist" aria-label="Library sections">
        <button 
          role="tab" 
          aria-selected={activeTab === 'saved'} 
          onClick={() => setActiveTab('saved')} 
          className={`flex-1 border-b-2 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'saved' ? 'border-accent text-white' : 'border-transparent text-white/40 hover:text-white/70'}`}
        >
          <svg className={`w-4 h-4 ${activeTab === 'saved' ? 'text-accent fill-accent' : 'text-current'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
          </svg>
          Favorites ({favSongs.length})
        </button>
        <button 
          role="tab" 
          aria-selected={activeTab === 'playlists'} 
          onClick={() => setActiveTab('playlists')} 
          className={`flex-1 border-b-2 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'playlists' ? 'border-accent text-white' : 'border-transparent text-white/40 hover:text-white/70'}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
          Playlists ({playlists.filter(p => p.id !== 'favs').length})
        </button>
      </div>

      {/* Requirement 4: Supercharged, Robust Saved Favorites Collection View */}
      {activeTab === 'saved' ? (
        <div className="space-y-5">
          {/* Collection Hero Card */}
          <div className="relative overflow-hidden rounded-[24px] border border-accent/20 bg-gradient-to-br from-accent/15 via-white/[0.04] to-transparent p-5 sm:p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden shadow-2xl border border-white/20 shrink-0 bg-accent/20 flex items-center justify-center">
                {favSongs.length > 0 && favSongs[0].artwork ? (
                  <img src={favSongs[0].artwork} alt="Favorites" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-12 h-12 text-accent fill-accent/40" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></svg>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2">
                  <span className="text-[10px] font-black uppercase text-accent tracking-wider">Collection</span>
                </div>
              </div>

              <div className="flex-1 text-center sm:text-left min-w-0">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white truncate">Saved Favorites</h2>
                <p className="text-white/60 text-xs mt-1">
                  {favSongs.length} {favSongs.length === 1 ? 'Track' : 'Tracks'} · ~{totalDurationMinutes} mins
                </p>

                {favSongs.length > 0 && (
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-4">
                    <button 
                      onClick={() => onPlay(favSongs[0], favSongs)} 
                      className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-bold text-[#06101e] shadow-lg shadow-accent/30 hover:brightness-110 active:scale-95 transition-all"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      Play All
                    </button>
                    <button 
                      onClick={() => handleShufflePlay(favSongs)} 
                      className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/15 active:scale-95 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg>
                      Shuffle
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Filtering, Search & View Controls for Large Collections */}
          {favSongs.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input 
                  type="text" 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                  placeholder={`Search ${favSongs.length} saved songs...`} 
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs font-medium text-white placeholder-white/40 outline-none focus:border-accent/50 transition-colors"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 justify-end">
                {/* Sort selector */}
                <select 
                  value={sortBy} 
                  onChange={e => setSortBy(e.target.value as any)} 
                  className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-white/70 outline-none focus:border-accent/50 cursor-pointer"
                >
                  <option value="default" className="bg-[#0b1220]">Recently Added</option>
                  <option value="title" className="bg-[#0b1220]">Title (A-Z)</option>
                  <option value="artist" className="bg-[#0b1220]">Artist (A-Z)</option>
                </select>

                {/* View Mode Toggle: List vs Grid */}
                <div className="flex bg-white/[0.04] border border-white/10 rounded-xl p-0.5">
                  <button 
                    onClick={() => setViewMode('list')} 
                    title="List view"
                    className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white'}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
                  </button>
                  <button 
                    onClick={() => setViewMode('grid')} 
                    title="Grid view"
                    className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white'}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* List View Rendering for Large Favorites Collections */}
          {viewMode === 'list' ? (
            <div className="space-y-2">
              {processedFavorites.map((song, idx) => (
                <div 
                  key={song.id} 
                  className="flex items-center gap-3.5 p-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] rounded-[20px] transition-all group active:scale-[0.99]"
                >
                  <span className="text-xs font-bold text-white/30 w-5 text-center shrink-0">{idx + 1}</span>
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-md">
                    <img 
                      src={song.artwork} 
                      alt={song.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                    />
                    <button 
                      onClick={() => onPlay(song, favSongs)} 
                      aria-label={`Play ${song.title}`}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white"
                    >
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                  </div>

                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onPlay(song, favSongs)}>
                    <p className="text-sm font-bold truncate text-white group-hover:text-accent transition-colors">{song.title}</p>
                    <p className="text-xs text-white/45 truncate mt-0.5">{song.artist}</p>
                  </div>

                  {song.duration ? (
                    <span className="text-xs text-white/30 hidden sm:block shrink-0">{formatDuration(song.duration)}</span>
                  ) : null}

                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      onClick={() => onAddClick(song)} 
                      title="Add to playlist"
                      className="p-2 text-white/30 hover:text-white transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
                    </button>
                    <button 
                      onClick={() => onDownload(song)} 
                      title="Download track"
                      className="p-2 text-white/30 hover:text-white transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3"/></svg>
                    </button>
                    <button 
                      onClick={() => onRemoveFromPlaylist(song.id, 'favs')} 
                      title="Remove from favorites"
                      className="p-2 text-accent hover:text-rose-400 active:scale-90 transition-all"
                    >
                      <svg className="w-4 h-4 fill-accent" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Grid View */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {processedFavorites.map(song => (
                <div 
                  key={song.id} 
                  className="group relative overflow-hidden rounded-[20px] bg-white/[0.03] border border-white/[0.07] hover:border-white/20 transition-all p-2.5 flex flex-col"
                >
                  <div className="relative aspect-square w-full rounded-[14px] overflow-hidden mb-2.5">
                    <img src={song.artwork} alt={song.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <button 
                      onClick={() => onPlay(song, favSongs)} 
                      aria-label={`Play ${song.title}`}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white"
                    >
                      <div className="w-10 h-10 rounded-full bg-accent text-[#06101e] flex items-center justify-center shadow-lg">
                        <svg className="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      </div>
                    </button>
                    <button 
                      onClick={() => onRemoveFromPlaylist(song.id, 'favs')} 
                      title="Remove"
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-accent backdrop-blur-md hover:scale-110 transition-transform"
                    >
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></svg>
                    </button>
                  </div>
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onPlay(song, favSongs)}>
                    <p className="text-xs font-bold truncate text-white group-hover:text-accent transition-colors">{song.title}</p>
                    <p className="text-[10px] text-white/45 truncate mt-0.5">{song.artist}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {favSongs.length === 0 && (
            <div className="py-20 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 mx-auto flex items-center justify-center text-white/30">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></svg>
              </div>
              <h3 className="text-lg font-bold text-white">No saved tracks yet</h3>
              <p className="text-xs text-white/40 max-w-xs mx-auto">Tap the heart icon on any song while listening or browsing to build your collection.</p>
            </div>
          )}

          {favSongs.length > 0 && processedFavorites.length === 0 && (
            <div className="py-12 text-center text-xs text-white/40">
              No matching tracks found for "{searchQuery}".
            </div>
          )}
        </div>
      ) : (
        /* Playlists Section */
        <div className="space-y-6">
          <form 
            onSubmit={event => { 
              event.preventDefault(); 
              const name = newPlaylistName.trim(); 
              if (name) { 
                onCreatePlaylist(name); 
                setNewPlaylistName(''); 
              } 
            }} 
            className="flex gap-2"
          >
            <input 
              value={newPlaylistName} 
              onChange={event => setNewPlaylistName(event.target.value)} 
              aria-label="New playlist name" 
              placeholder="Name a new playlist..." 
              className="min-w-0 flex-1 rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-xs sm:text-sm outline-none focus:border-accent/50 transition-colors" 
            />
            <button 
              type="submit" 
              disabled={!newPlaylistName.trim()} 
              className="rounded-[16px] bg-accent px-5 text-xs sm:text-sm font-bold text-[#06101e] disabled:opacity-40 hover:brightness-110 active:scale-95 transition-all shadow-md shadow-accent/20"
            >
              Create
            </button>
          </form>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {playlists.filter(playlist => playlist.id !== 'favs').map(playlist => (
              <div key={playlist.id} className="group relative min-w-0">
                <div className="relative block w-full overflow-hidden rounded-[20px] bg-white/[0.04] text-left border border-white/10 group-hover:border-white/20 transition-all shadow-lg">
                  <button 
                    onClick={() => setActivePlaylist(playlist)} 
                    className="block w-full text-left cursor-pointer"
                    aria-label={`Open playlist ${playlist.name}`}
                  >
                    <img 
                      src={playlist.artwork} 
                      alt={playlist.name} 
                      className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105" 
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-3 pb-3 pt-10">
                      <span className="block truncate text-sm font-bold text-white pr-6">{playlist.name}</span>
                      <span className="text-[10px] text-white/60 font-semibold">{playlist.songs.length} tracks</span>
                    </span>
                  </button>

                  {/* Direct delete button with trash icon - no OS modal */}
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation();
                      setPlaylists(previous => previous.filter(item => item.id !== playlist.id)); 
                    }} 
                    title={`Delete ${playlist.name}`}
                    aria-label={`Delete ${playlist.name}`} 
                    className="absolute top-2.5 right-2.5 z-20 grid h-8 w-8 place-items-center rounded-full bg-black/65 text-white/60 hover:text-rose-400 hover:bg-black/90 backdrop-blur-md active:scale-90 transition-all shadow-md"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            {playlists.filter(playlist => playlist.id !== 'favs').length === 0 && (
              <p className="col-span-2 py-12 text-center text-sm text-white/40 sm:col-span-3">
                Create a playlist to organize your music.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LibraryView;
