import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Song, Playlist } from '../types';
import { deviceMusicService } from '../services/deviceMusicService';

interface DeviceMusicViewProps {
  onPlay: (song: Song, queue: Song[]) => void;
  onAddClick: (song: Song) => void;
  onDownload: (song: Song) => void;
  currentSong?: Song | null;
  isPlaying?: boolean;
  dominantColor?: string;
}

const formatDuration = (seconds?: number): string => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const DeviceMusicView: React.FC<DeviceMusicViewProps> = ({
  onPlay,
  onAddClick,
  onDownload,
  currentSong,
  isPlaying,
  dominantColor
}) => {
  // Use active theme dominant color if a song is playing, otherwise default blue
  const activeColor = isPlaying && currentSong && dominantColor ? dominantColor : '#3b82f6';
  const accentGlowStyle = {
    borderColor: `${activeColor}40`,
    backgroundColor: `${activeColor}15`
  };

  const [deviceSongs, setDeviceSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'tracks' | 'artists' | 'albums' | 'playlists'>('tracks');
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'title' | 'artist' | 'album' | 'duration'>('title');
  const [scanProgress, setScanProgress] = useState<{ processed: number; total: number; currentTitle: string } | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(() => {
    return localStorage.getItem('zenisai_device_storage_permission') === 'granted';
  });
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [devicePlaylists, setDevicePlaylists] = useState<Playlist[]>(() => {
    try {
      const saved = localStorage.getItem('zenisai_device_playlists');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [autoScanEnabled, setAutoScanEnabled] = useState<boolean>(() => {
    return localStorage.getItem('zenisai_auto_scan_device') !== 'false';
  });
  const [isAutoScanning, setIsAutoScanning] = useState(false);

  // Auto scan on startup every time the app opens if enabled, or load saved songs
  useEffect(() => {
    let isCancelled = false;
    const initDeviceLibrary = async () => {
      const autoScan = localStorage.getItem('zenisai_auto_scan_device') !== 'false';
      if (autoScan) {
        setIsAutoScanning(true);
        try {
          const songs = await deviceMusicService.autoScanOnStartup((processed, total, currentTitle) => {
            if (!isCancelled) setScanProgress({ processed, total, currentTitle });
          });
          if (!isCancelled) {
            setDeviceSongs(songs);
            setIsAutoScanning(false);
            setScanProgress(null);
          }
        } catch {
          const fallback = await deviceMusicService.loadSavedSongs();
          if (!isCancelled) setDeviceSongs(fallback);
        }
      } else {
        const songs = await deviceMusicService.loadSavedSongs();
        if (!isCancelled) setDeviceSongs(songs);
      }
      if (!isCancelled) setIsLoading(false);
    };

    initDeviceLibrary();
    return () => { isCancelled = true; };
  }, []);

  useEffect(() => {
    localStorage.setItem('zenisai_device_playlists', JSON.stringify(devicePlaylists));
  }, [devicePlaylists]);

  const handleGrantPermission = () => {
    setPermissionGranted(true);
    localStorage.setItem('zenisai_device_storage_permission', 'granted');
    setShowPermissionModal(false);
    setTimeout(() => {
      handleAutoScan();
    }, 200);
  };

  const handleAutoScan = async () => {
    setIsAutoScanning(true);
    setPermissionGranted(true);
    localStorage.setItem('zenisai_device_storage_permission', 'granted');
    localStorage.setItem('zenisai_auto_scan_device', 'true');
    setAutoScanEnabled(true);

    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker({
          id: 'zenisai_music_folder',
          mode: 'read'
        });
        if (dirHandle) {
          await deviceMusicService.saveDirectoryHandle(dirHandle);
          const scanned = await deviceMusicService.scanDirectoryHandle(
            dirHandle,
            (processed, total, currentTitle) => {
              setScanProgress({ processed, total, currentTitle });
            }
          );
          setDeviceSongs(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const filtered = scanned.filter(s => !existingIds.has(s.id));
            return [...prev, ...filtered];
          });
          setIsAutoScanning(false);
          setScanProgress(null);
          return;
        }
      } catch (pickerErr: any) {
        if (pickerErr.name === 'AbortError') {
          setIsAutoScanning(false);
          return;
        }
      }
    }

    folderInputRef.current?.click();
    setIsAutoScanning(false);
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setPermissionGranted(true);
    localStorage.setItem('zenisai_device_storage_permission', 'granted');

    const newSongs = await deviceMusicService.processAudioFiles(
      files,
      (processed, total, currentTitle) => {
        setScanProgress({ processed, total, currentTitle });
      }
    );

    setDeviceSongs(prev => {
      const existingIds = new Set(prev.map(s => s.id));
      const filteredNew = newSongs.filter(s => !existingIds.has(s.id));
      return [...prev, ...filteredNew];
    });

    setScanProgress(null);
    e.target.value = '';
  };

  const handleRemoveTrack = async (songId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deviceMusicService.removeSong(songId);
    setDeviceSongs(prev => prev.filter(s => s.id !== songId));
  };

  const handleClearAll = async () => {
    if (confirm('Clear all scanned device songs from Zenisai? Audio files on your device will NOT be deleted.')) {
      await deviceMusicService.clearAll();
      setDeviceSongs([]);
    }
  };

  // Group songs by Artist
  const artistsMap = useMemo(() => {
    const map = new Map<string, { artist: string; songs: Song[]; artwork: string }>();
    deviceSongs.forEach(song => {
      const artist = song.artist || 'Unknown Artist';
      if (!map.has(artist)) {
        map.set(artist, { artist, songs: [], artwork: song.artwork });
      }
      const entry = map.get(artist)!;
      entry.songs.push(song);
      if (entry.artwork.includes('picsum.photos') && !song.artwork.includes('picsum.photos')) {
        entry.artwork = song.artwork;
      }
    });
    return Array.from(map.values()).sort((a, b) => a.artist.localeCompare(b.artist));
  }, [deviceSongs]);

  // Group songs by Album
  const albumsMap = useMemo(() => {
    const map = new Map<string, { album: string; artist: string; songs: Song[]; artwork: string }>();
    deviceSongs.forEach(song => {
      const album = song.album || 'Device Music';
      if (!map.has(album)) {
        map.set(album, { album, artist: song.artist, songs: [], artwork: song.artwork });
      }
      const entry = map.get(album)!;
      entry.songs.push(song);
      if (entry.artwork.includes('picsum.photos') && !song.artwork.includes('picsum.photos')) {
        entry.artwork = song.artwork;
      }
    });
    return Array.from(map.values()).sort((a, b) => a.album.localeCompare(b.album));
  }, [deviceSongs]);

  // Filtered and sorted tracks
  const processedTracks = useMemo(() => {
    let list = [...deviceSongs];
    if (selectedArtist) {
      list = list.filter(s => s.artist === selectedArtist);
    }
    if (selectedAlbum) {
      list = list.filter(s => (s.album || 'Device Music') === selectedAlbum);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        s.album.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'artist') return a.artist.localeCompare(b.artist);
      if (sortBy === 'album') return a.album.localeCompare(b.album);
      if (sortBy === 'duration') return (a.duration || 0) - (b.duration || 0);
      return 0;
    });
    return list;
  }, [deviceSongs, selectedArtist, selectedAlbum, searchQuery, sortBy]);

  const handleShufflePlay = (songs: Song[]) => {
    if (songs.length === 0) return;
    const shuffled = [...songs];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    onPlay(shuffled[0], shuffled);
  };

  // Hidden file/folder inputs
  const hiddenInputs = (
    <>
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        multiple
        accept="audio/*"
        onChange={handleFilesSelected}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.m4a,.flac,.wav,.ogg,.aac"
        onChange={handleFilesSelected}
        className="hidden"
      />
    </>
  );

  return (
    <div className="space-y-6">
      {hiddenInputs}

      {/* Device Storage Status & Scanner Card */}
      <div 
        className="relative overflow-hidden rounded-[24px] border p-5 sm:p-6 shadow-2xl backdrop-blur-xl transition-colors duration-500"
        style={{
          borderColor: `${activeColor}33`,
          backgroundImage: `linear-gradient(to bottom right, ${activeColor}26, #070e1f, #030712)`
        }}
      >
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
          <div 
            className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shadow-2xl border shrink-0 flex items-center justify-center transition-colors duration-500"
            style={{ borderColor: `${activeColor}4D`, backgroundColor: `${activeColor}1A` }}
          >
            <svg className="w-10 h-10" style={{ color: activeColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent flex items-end p-1.5">
              <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: activeColor }}>Storage</span>
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">Device Music</h2>
              <span 
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors duration-500"
                style={{ backgroundColor: `${activeColor}26`, color: activeColor, borderColor: `${activeColor}4D` }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: activeColor }} />
                {permissionGranted ? 'Storage Access Active' : 'Storage Permission Needed'}
              </span>
            </div>

            <p className="text-white/60 text-xs mt-1">
              {deviceSongs.length} Local Tracks · {artistsMap.length} Artists · {albumsMap.length} Albums
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mt-3.5">
              <button
                onClick={handleAutoScan}
                disabled={isAutoScanning}
                style={{ backgroundColor: activeColor }}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-white shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-75"
              >
                <svg className={`w-4 h-4 ${isAutoScanning ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isAutoScanning ? 'Scanning...' : 'Auto Scan'}
              </button>

              <button
                onClick={() => folderInputRef.current?.click()}
                className="flex items-center gap-2 rounded-full border bg-blue-950/30 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-900/40 active:scale-95 transition-all"
                style={{ borderColor: `${activeColor}33` }}
              >
                <svg className="w-4 h-4" style={{ color: activeColor }} fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Scan Folder
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 rounded-full border bg-blue-950/30 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-900/40 active:scale-95 transition-all"
                style={{ borderColor: `${activeColor}33` }}
              >
                <svg className="w-4 h-4" style={{ color: activeColor }} fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Files
              </button>

              <button
                onClick={() => {
                  const next = !autoScanEnabled;
                  setAutoScanEnabled(next);
                  localStorage.setItem('zenisai_auto_scan_device', String(next));
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[10px] font-bold border transition-all active:scale-95 ${
                  autoScanEnabled
                    ? 'shadow-sm'
                    : 'bg-white/5 text-white/50 border-white/10 hover:text-white'
                }`}
                style={autoScanEnabled ? { backgroundColor: `${activeColor}26`, color: activeColor, borderColor: `${activeColor}66` } : {}}
                title="Automatically scan device music files every time Zenisai is opened"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${autoScanEnabled ? 'animate-pulse' : 'bg-white/30'}`} style={autoScanEnabled ? { backgroundColor: activeColor } : {}} />
                Auto-Scan on Open: {autoScanEnabled ? 'ON' : 'OFF'}
              </button>

              {!permissionGranted && (
                <button
                  onClick={() => setShowPermissionModal(true)}
                  className="flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold hover:bg-opacity-30 active:scale-95 transition-all"
                  style={{ backgroundColor: `${activeColor}26`, borderColor: `${activeColor}66`, color: activeColor }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Permissions
                </button>
              )}

              {deviceSongs.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="p-2 text-white/30 hover:text-rose-400 active:scale-90 transition-all rounded-full hover:bg-white/5"
                  title="Clear scanned library"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Scan Progress Bar */}
        {scanProgress && (
          <div className="mt-4 pt-4 border-t border-blue-500/20 space-y-1.5 animate-in fade-in duration-200">
            <div className="flex justify-between text-xs text-white/80">
              <span className="truncate max-w-[70%] font-semibold" style={{ color: activeColor }}>
                Parsing: {scanProgress.currentTitle}
              </span>
              <span className="font-bold" style={{ color: activeColor }}>{scanProgress.processed} / {scanProgress.total}</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full transition-all duration-200 rounded-full"
                style={{
                  width: `${(scanProgress.processed / scanProgress.total) * 100}%`,
                  backgroundColor: activeColor
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Permission Modal */}
      {showPermissionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className="w-full max-w-sm rounded-[24px] border bg-[#070e1f] p-6 shadow-2xl space-y-4"
            style={{ borderColor: `${activeColor}4D` }}
          >
            <div 
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${activeColor}26`, color: activeColor }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Device Storage Access</h3>
              <p className="text-xs text-white/60 mt-1">
                Zenisai scans your local audio files directly on your device, extracts embedded metadata (artist names, cover art, lyrics), and enables offline playback without external servers.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowPermissionModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 bg-white/5 text-xs font-semibold text-white/60 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleGrantPermission}
                style={{ backgroundColor: activeColor }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg hover:brightness-110"
              >
                Allow & Scan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Device Category Pills */}
      <div className="flex border-b border-blue-500/15 overflow-x-auto no-scrollbar gap-2 pb-2">
        <button
          onClick={() => { setActiveSubTab('tracks'); setSelectedArtist(null); setSelectedAlbum(null); }}
          style={activeSubTab === 'tracks' && !selectedArtist && !selectedAlbum ? { backgroundColor: activeColor } : {}}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${
            activeSubTab === 'tracks' && !selectedArtist && !selectedAlbum
              ? 'text-white shadow-md'
              : 'bg-white/5 text-white/60 hover:text-white'
          }`}
        >
          Tracks ({deviceSongs.length})
        </button>

        <button
          onClick={() => { setActiveSubTab('artists'); setSelectedAlbum(null); }}
          style={activeSubTab === 'artists' || selectedArtist ? { backgroundColor: activeColor } : {}}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${
            activeSubTab === 'artists' || selectedArtist
              ? 'text-white shadow-md'
              : 'bg-white/5 text-white/60 hover:text-white'
          }`}
        >
          Artists ({artistsMap.length})
        </button>

        <button
          onClick={() => { setActiveSubTab('albums'); setSelectedArtist(null); }}
          style={activeSubTab === 'albums' || selectedAlbum ? { backgroundColor: activeColor } : {}}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${
            activeSubTab === 'albums' || selectedAlbum
              ? 'text-white shadow-md'
              : 'bg-white/5 text-white/60 hover:text-white'
          }`}
        >
          Albums ({albumsMap.length})
        </button>

        <button
          onClick={() => { setActiveSubTab('playlists'); setSelectedArtist(null); setSelectedAlbum(null); }}
          style={activeSubTab === 'playlists' ? { backgroundColor: activeColor } : {}}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${
            activeSubTab === 'playlists'
              ? 'text-white shadow-md'
              : 'bg-white/5 text-white/60 hover:text-white'
          }`}
        >
          Playlists ({devicePlaylists.length})
        </button>
      </div>

      {/* Breadcrumb if drilling down into Artist or Album */}
      {(selectedArtist || selectedAlbum) && (
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => { setSelectedArtist(null); setSelectedAlbum(null); }}
            className="font-bold hover:underline flex items-center gap-1"
            style={{ color: activeColor }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
            All {selectedArtist ? 'Artists' : 'Albums'}
          </button>
          <span className="text-white/30">/</span>
          <span className="text-white font-bold truncate">{selectedArtist || selectedAlbum}</span>
        </div>
      )}

      {/* Controls: Search, Sort, Play All & Shuffle */}
      {deviceSongs.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search local tracks, artists, albums..."
              className="w-full bg-white/[0.04] border rounded-xl py-2 pl-10 pr-4 text-xs font-medium text-white placeholder-white/40 outline-none transition-colors"
              style={{ borderColor: `${activeColor}33` }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-[#070e1f] border rounded-xl px-3 py-2 text-xs font-medium text-white/85 outline-none cursor-pointer"
              style={{ borderColor: `${activeColor}33` }}
            >
              <option value="title" className="bg-[#070e1f] text-white">Title (A-Z)</option>
              <option value="artist" className="bg-[#070e1f] text-white">Artist (A-Z)</option>
              <option value="album" className="bg-[#070e1f] text-white">Album (A-Z)</option>
              <option value="duration" className="bg-[#070e1f] text-white">Duration</option>
            </select>

            {processedTracks.length > 0 && (
              <>
                <button
                  onClick={() => onPlay(processedTracks[0], processedTracks)}
                  className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold hover:bg-opacity-30 active:scale-95 transition-all shadow-sm"
                  style={{ backgroundColor: `${activeColor}26`, borderColor: `${activeColor}66`, color: activeColor }}
                  title="Play all filtered tracks"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  Play
                </button>
                <button
                  onClick={() => handleShufflePlay(processedTracks)}
                  className="flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 active:scale-95 transition-all"
                  title="Shuffle all filtered tracks"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Subtab Content */}
      {/* 1. TRACKS VIEW */}
      {(activeSubTab === 'tracks' || selectedArtist || selectedAlbum) && (
        <div className="space-y-2">
          {processedTracks.map((song, idx) => {
            const isCurrentPlaying = currentSong?.id === song.id;
            return (
              <div
                key={song.id}
                onClick={() => onPlay(song, processedTracks)}
                className={`flex items-center gap-3.5 p-3 rounded-[20px] border transition-all group cursor-pointer active:scale-[0.99] ${
                  isCurrentPlaying
                    ? 'shadow-lg'
                    : 'bg-[#070e1f]/60 hover:bg-[#070e1f] border-blue-500/10 hover:border-blue-500/25'
                }`}
                style={isCurrentPlaying ? { backgroundColor: `${activeColor}26`, borderColor: `${activeColor}80` } : {}}
              >
                <span className="text-xs font-bold text-white/40 w-5 text-center shrink-0">
                  {isCurrentPlaying && isPlaying ? (
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full animate-ping"
                      style={{ backgroundColor: activeColor }}
                    />
                  ) : (
                    idx + 1
                  )}
                </span>

                <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-md bg-white/5 border border-white/10">
                  <img
                    src={song.artwork}
                    alt={song.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = 'https://picsum.photos/seed/audio/400/400';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p
                      className={`text-sm font-bold truncate transition-colors ${
                        isCurrentPlaying ? '' : 'text-white group-hover:text-blue-300'
                      }`}
                      style={isCurrentPlaying ? { color: activeColor } : {}}
                    >
                      {song.title}
                    </p>
                    {song.embeddedLyrics && (
                      <span 
                        className="shrink-0 text-[8px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded border"
                        style={{ backgroundColor: `${activeColor}26`, color: activeColor, borderColor: `${activeColor}4D` }}
                      >
                        Lyrics
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/50 truncate mt-0.5">
                    {song.artist} · {song.album}
                  </p>
                </div>

                {song.duration ? (
                  <span className="text-xs text-white/40 hidden sm:block shrink-0">{formatDuration(song.duration)}</span>
                ) : null}

                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => onAddClick(song)}
                    title="Add to playlist"
                    className="p-2 text-white/30 hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
                  </button>
                  <button
                    onClick={() => onDownload(song)}
                    title="Export / Download with metadata"
                    className="p-2 text-white/30 hover:text-blue-400 transition-colors"
                    style={{ '--hover-color': activeColor } as any}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3"/></svg>
                  </button>
                  <button
                    onClick={e => handleRemoveTrack(song.id, e)}
                    title="Remove from device library"
                    className="p-2 text-white/20 hover:text-rose-400 active:scale-90 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}

          {deviceSongs.length > 0 && processedTracks.length === 0 && (
            <div className="py-12 text-center text-xs text-white/40">
              No matching tracks found for "{searchQuery}".
            </div>
          )}
        </div>
      )}

      {/* 2. ARTISTS VIEW */}
      {activeSubTab === 'artists' && !selectedArtist && !selectedAlbum && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {artistsMap.map(item => (
            <div
              key={item.artist}
              onClick={() => { setSelectedArtist(item.artist); setActiveSubTab('tracks'); }}
              className="group relative overflow-hidden rounded-[20px] bg-[#070e1f]/70 border border-blue-500/15 hover:border-blue-500/50 p-3.5 flex flex-col items-center text-center cursor-pointer transition-all hover:bg-[#0c1633] active:scale-[0.98]"
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden mb-3 shadow-lg border border-blue-500/20 group-hover:scale-105 transition-transform bg-white/5">
                <img
                  src={item.artwork}
                  alt={item.artist}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = 'https://picsum.photos/seed/artist/400/400';
                  }}
                />
              </div>
              <h4 className="text-sm font-bold text-white group-hover:text-blue-300 truncate w-full transition-colors">
                {item.artist}
              </h4>
              <p className="text-[11px] text-white/50 mt-0.5">{item.songs.length} Tracks</p>
            </div>
          ))}
          {artistsMap.length === 0 && (
            <div className="col-span-full py-12 text-center text-xs text-white/40">No artists detected yet. Scan a folder to import music.</div>
          )}
        </div>
      )}

      {/* 3. ALBUMS VIEW */}
      {activeSubTab === 'albums' && !selectedArtist && !selectedAlbum && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
          {albumsMap.map(item => (
            <div
              key={item.album}
              onClick={() => { setSelectedAlbum(item.album); setActiveSubTab('tracks'); }}
              className="group relative overflow-hidden rounded-[20px] bg-[#070e1f]/70 border border-blue-500/15 hover:border-blue-500/50 p-2.5 flex flex-col cursor-pointer transition-all hover:bg-[#0c1633] active:scale-[0.98]"
            >
              <div className="relative aspect-square w-full rounded-[14px] overflow-hidden mb-2.5 shadow-md bg-white/5 border border-white/10">
                <img
                  src={item.artwork}
                  alt={item.album}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = 'https://picsum.photos/seed/album/400/400';
                  }}
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                  <div
                    style={{ backgroundColor: activeColor }}
                    className="w-10 h-10 rounded-full text-white flex items-center justify-center shadow-lg"
                  >
                    <svg className="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                </div>
              </div>
              <p className="text-xs font-bold truncate text-white group-hover:text-blue-300 transition-colors">{item.album}</p>
              <p className="text-[10px] text-white/50 truncate mt-0.5">{item.artist} · {item.songs.length} Tracks</p>
            </div>
          ))}
          {albumsMap.length === 0 && (
            <div className="col-span-full py-12 text-center text-xs text-white/40">No albums detected yet. Scan a folder to import music.</div>
          )}
        </div>
      )}

      {/* 4. DEVICE PLAYLISTS VIEW */}
      {activeSubTab === 'playlists' && !selectedArtist && !selectedAlbum && (
        <div className="space-y-4">
          <form
            onSubmit={e => {
              e.preventDefault();
              const name = newPlaylistName.trim();
              if (name) {
                const newPl: Playlist = {
                  id: `dev_pl_${Date.now()}`,
                  name,
                  songs: [],
                  artwork: 'https://picsum.photos/seed/playlist/400/400'
                };
                setDevicePlaylists(prev => [...prev, newPl]);
                setNewPlaylistName('');
              }
            }}
            className="flex gap-2"
          >
            <input
              value={newPlaylistName}
              onChange={e => setNewPlaylistName(e.target.value)}
              placeholder="Name a new device playlist..."
              className="min-w-0 flex-1 rounded-[16px] border bg-[#070e1f] px-4 py-3 text-xs sm:text-sm text-white placeholder-white/40 outline-none transition-colors"
              style={{ borderColor: `${activeColor}33` }}
            />
            <button
              type="submit"
              disabled={!newPlaylistName.trim()}
              style={{ backgroundColor: activeColor }}
              className="rounded-[16px] px-5 text-xs sm:text-sm font-bold text-white disabled:opacity-40 hover:brightness-110 active:scale-95 transition-all shadow-md"
            >
              Create
            </button>
          </form>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {devicePlaylists.map(pl => (
              <div 
                key={pl.id} 
                className="group relative rounded-[20px] bg-[#070e1f] border p-3 flex flex-col justify-between"
                style={{ borderColor: `${activeColor}33` }}
              >
                <div>
                  <h4 className="text-sm font-bold text-white truncate">{pl.name}</h4>
                  <p className="text-xs text-white/50 mt-1">{pl.songs.length} Tracks</p>
                </div>
                <div className="mt-3 flex gap-2">
                  {pl.songs.length > 0 && (
                    <button
                      onClick={() => onPlay(pl.songs[0], pl.songs)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-opacity-30 transition-colors"
                      style={{ backgroundColor: `${activeColor}26`, color: activeColor }}
                    >
                      Play
                    </button>
                  )}
                  <button
                    onClick={() => setDevicePlaylists(prev => prev.filter(p => p.id !== pl.id))}
                    className="p-1.5 text-white/30 hover:text-rose-400 ml-auto"
                    title="Delete playlist"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            {devicePlaylists.length === 0 && (
              <div className="col-span-full py-12 text-center text-xs text-white/40">
                No custom device playlists created yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceMusicView;
