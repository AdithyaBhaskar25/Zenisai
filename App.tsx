
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Song, AppView, Playlist } from './types';
import { saavnService } from './services/saavnService';
import PlayerFull from './components/PlayerFull';
import FloatingHub from './components/FloatingHub';
import HomeView from './components/HomeView';
import SearchView from './components/SearchView';
import LibraryView from './components/LibraryView';
import ChatBotView from './components/ChatBotView';

const App: React.FC = () => {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeView, setActiveView] = useState<AppView>('home');
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [queue, setQueue] = useState<Song[]>([]);
  const [originalQueue, setOriginalQueue] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    const saved = localStorage.getItem('zenisai_v10_playlists');
    const parsed = saved ? JSON.parse(saved) : [
      { id: 'favs', name: 'Favorites', songs: [], artwork: 'https://picsum.photos/seed/heart/400/400' }
    ];
    return parsed.filter((p: Playlist) => p.songs.length > 0 || p.id === 'favs');
  });
  
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [sleepTimer, setSleepTimer] = useState<number | null>(null);
  const [currentLyrics, setCurrentLyrics] = useState<string>('');
  const [dominantColor, setDominantColor] = useState('#a855f7');
  const [songToAddToPlaylist, setSongToAddToPlaylist] = useState<Song | null>(null);

  const [repeatMode, setRepeatMode] = useState<'off' | 'one' | 'all'>('off');
  const [isShuffle, setIsShuffle] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sleepTimerRef = useRef<any>(null);

  useEffect(() => {
    localStorage.setItem('zenisai_v10_playlists', JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    if (sleepTimer !== null) {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = setTimeout(() => {
        if (audioRef.current) audioRef.current.pause();
        setIsPlaying(false);
        setSleepTimer(null);
      }, sleepTimer * 1000);
    }
    return () => clearTimeout(sleepTimerRef.current);
  }, [sleepTimer]);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = "anonymous";
    }
    const audio = audioRef.current;
    const updateProgress = () => {
      setProgress(audio.currentTime);
      setDuration(audio.duration || 0);
    };
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', handleTrackEnded);
    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('ended', handleTrackEnded);
    };
  }, [queue, currentSong, repeatMode]);
  
  const handleTrackEnded = () => {
    if (repeatMode === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else {
      handleNext();
    }
  };

  const updateThemeFromImage = (imageUrl: string) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 1; canvas.height = 1;
      try {
        ctx?.drawImage(img, 0, 0, 1, 1);
        const data = ctx?.getImageData(0, 0, 1, 1).data;
        if (data) {
          const color = `rgb(${data[0]},${data[1]},${data[2]})`;
          const glowColor = `rgba(${data[0]},${data[1]},${data[2]}, 0.3)`;
          const bgColor = `rgb(${Math.floor(data[0] * 0.03)}, ${Math.floor(data[1] * 0.03)}, ${Math.floor(data[2] * 0.03)})`;
          
          setDominantColor(color);
          document.documentElement.style.setProperty('--color-primary', color);
          document.documentElement.style.setProperty('--color-glow', glowColor);
          document.documentElement.style.setProperty('--color-bg', bgColor);
        }
      } catch (e) { 
          setDominantColor('#a855f7'); 
      }
    };
  };

  const fetchLyrics = async (songId: string) => {
    setCurrentLyrics('Fetching poetry...');
    try {
      const res = await fetch(`https://jiosaavn-api.vercel.app/lyrics?id=${songId}`);
      const data = await res.json();
      setCurrentLyrics(data.lyrics ? data.lyrics.replace(/<br>/g, '\n') : 'No lyrics available.');
    } catch (e) { setCurrentLyrics('Lyrics unavailable.'); }
  };

  const handlePlaySong = async (song: Song, newQueue?: Song[]) => {
    if (!audioRef.current) return;
    let playSong = { ...song };
    if (!playSong.url) {
      try {
        const details = await saavnService.getSongDetails(song.id);
        playSong = saavnService.mapSong(details);
      } catch (e) { return; }
    }
    if (!analyserRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      analyserRef.current = ctx.createAnalyser();
      analyserRef.current.fftSize = 128; // Higher res for silky bars
      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyserRef.current);
      analyserRef.current.connect(ctx.destination);
    }
    if (currentSong?.id === playSong.id) {
      togglePlay();
      return;
    }
    setCurrentSong(playSong);
    updateThemeFromImage(playSong.artwork);
    fetchLyrics(playSong.id);
    audioRef.current.src = playSong.url;
    audioRef.current.play().catch(() => setIsPlaying(false));
    setIsPlaying(true);

    if (newQueue) {
      setOriginalQueue(newQueue);
      setQueue(isShuffle ? [...newQueue].sort(() => Math.random() - 0.5) : newQueue);
    } else if (!queue.some(s => s.id === playSong.id)) {
      setQueue(prev => [playSong, ...prev]);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current?.src) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play().catch(console.error);
    setIsPlaying(!isPlaying);
  };

  const handleNext = useCallback(() => {
    if (queue.length === 0 || !currentSong) return;
    const idx = queue.findIndex(s => s.id === currentSong.id);
    if (idx !== -1 && idx < queue.length - 1) {
      handlePlaySong(queue[idx + 1]);
    } else if (repeatMode === 'all') {
      handlePlaySong(queue[0]);
    } else {
      setIsPlaying(false);
    }
  }, [queue, currentSong, repeatMode]);

  const handlePrev = useCallback(() => {
    if (queue.length === 0 || !currentSong) return;
    const idx = queue.findIndex(s => s.id === currentSong.id);
    if (idx > 0) {
      handlePlaySong(queue[idx - 1]);
    } else if (repeatMode === 'all') {
      handlePlaySong(queue[queue.length - 1]);
    }
  }, [queue, currentSong, repeatMode]);

  const toggleShuffle = () => {
    const newState = !isShuffle;
    setIsShuffle(newState);
    if (newState) {
      setQueue([...queue].sort(() => Math.random() - 0.5));
    } else {
      setQueue(originalQueue.length > 0 ? originalQueue : queue);
    }
  };

  const toggleRepeat = () => {
    setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off');
  };

  const toggleFavorite = (song: Song) => {
    setPlaylists(prev => prev.map(p => {
      if (p.id === 'favs') {
        const isFav = p.songs.some(s => s.id === song.id);
        if (isFav) return { ...p, songs: p.songs.filter(s => s.id !== song.id) };
        return { ...p, songs: [...p.songs, song], artwork: song.artwork };
      }
      return p;
    }));
  };

  const removeFromFavorites = (song: Song) => {
    setPlaylists(prev => prev.map(p => {
      if (p.id === 'favs') {
        return { ...p, songs: p.songs.filter(s => s.id !== song.id) };
      }
      return p;
    }));
  };

  const downloadSong = async (song: Song) => {
    if (!song.url) {
      const details = await saavnService.getSongDetails(song.id);
      song = saavnService.mapSong(details);
    }
    if (!song.url) return;
    try {
      const response = await fetch(song.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${song.title}.mp3`;
      a.click();
    } catch (e) { console.error("Download failed", e); }
  };

  const searchAndPlay = async (query: string) => {
    const results = await saavnService.searchSongs(query, 0, 1);
    if (results && results.length > 0) {
      handlePlaySong(saavnService.mapSong(results[0]));
    }
  };

  const createPlaylist = (name: string) => {
    const newP: Playlist = { id: Date.now().toString(), name, songs: [], artwork: `https://picsum.photos/seed/${name}/400/400` };
    setPlaylists(prev => [...prev, newP]);
    return newP;
  };
  // --- MEDIA SESSION API INTEGRATION ---
  useEffect(() => {
    if (!currentSong || !('mediaSession' in navigator)) return;

    // 1. Update Metadata (Title, Artist, Artwork)
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title,
      artist: currentSong.artist,
      album: currentSong.album || 'Unknown Album',
      artwork: [
        { src: currentSong.artwork, sizes: '96x96', type: 'image/png' },
        { src: currentSong.artwork, sizes: '128x128', type: 'image/png' },
        { src: currentSong.artwork, sizes: '192x192', type: 'image/png' },
        { src: currentSong.artwork, sizes: '512x512', type: 'image/png' },
      ],
    });

    // 2. Update Playback State (Playing/Paused)
    // This tells the browser which button (Play vs Pause) to show in the notification
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    // 3. Set Action Handlers (Notification Buttons)
    navigator.mediaSession.setActionHandler('play', () => togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => togglePlay());
    navigator.mediaSession.setActionHandler('previoustrack', () => handlePrev());
    navigator.mediaSession.setActionHandler('nexttrack', () => handleNext());
    
    // Optional: Add seeking support
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime && audioRef.current) {
        audioRef.current.currentTime = details.seekTime;
        setProgress(details.seekTime); // Update your local UI state
      }
    });

    // Cleanup when component unmounts or dependencies change
    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
    };

  }, [currentSong, isPlaying, togglePlay, handlePrev, handleNext]); // Re-run when these change

  return (
    <div className="flex flex-col h-[100dvh] bg-black relative overflow-hidden transition-colors duration-1000">
      <div className="fixed inset-0 pointer-events-none glow-overlay z-0" />
      
      <main className="flex-1 overflow-y-auto no-scrollbar pb-32 relative z-10">
        {activeView === 'home' && (
          <div className="animate-in fade-in duration-1000">
            <HomeView onPlay={handlePlaySong} currentSong={currentSong} isPlaying={isPlaying} onAddClick={setSongToAddToPlaylist} onDownload={downloadSong} />
          </div>
        )}
        {activeView === 'search' && (
          <div className="animate-in fade-in slide-in-from-right duration-700">
            <SearchView onPlay={handlePlaySong} onAddClick={setSongToAddToPlaylist} onDownload={downloadSong} />
          </div>
        )}
        {activeView === 'library' && (
          <div className="animate-in fade-in slide-in-from-right duration-700">
            <LibraryView playlists={playlists} setPlaylists={setPlaylists} onPlay={handlePlaySong} onRemoveFromPlaylist={(sid, pid) => setPlaylists(prev => prev.map(pl => pl.id === pid ? {...pl, songs: pl.songs.filter(s => s.id !== sid)} : pl))} onAddClick={setSongToAddToPlaylist} onDownload={downloadSong} />
          </div>
        )}
      </main>

      <FloatingHub 
        song={currentSong} isPlaying={isPlaying} onToggle={togglePlay} activeView={activeView} setActiveView={setActiveView}
        progress={progress} duration={duration} onOpenPlayer={() => setIsPlayerOpen(true)}
        analyser={analyserRef.current} dominantColor={dominantColor} onOpenChat={() => setIsChatOpen(true)}
        isFavorite={playlists.find(p => p.id === 'favs')?.songs.some(s => s.id === currentSong?.id) || false}
        onToggleFavorite={() => currentSong && toggleFavorite(currentSong)}
        isShuffle={isShuffle} onToggleShuffle={toggleShuffle}
        repeatMode={repeatMode} onToggleRepeat={toggleRepeat}
        onNext={handleNext} onPrev={handlePrev}
      />

      {isPlayerOpen && currentSong && (
        <PlayerFull 
          song={currentSong} isPlaying={isPlaying} onToggle={togglePlay} onNext={handleNext} onPrev={handlePrev} 
          onClose={() => setIsPlayerOpen(false)} dominantColor={dominantColor} progress={progress} duration={duration}
          onSeek={(val) => { if(audioRef.current) audioRef.current.currentTime = val; }}
          analyser={analyserRef.current} sleepTimer={sleepTimer} setSleepTimer={setSleepTimer}
          queue={queue} onPlayFromQueue={(s) => handlePlaySong(s)} lyrics={currentLyrics}
          onRemoveFromQueue={(id) => setQueue(q => q.filter(s => s.id !== id))} 
          onMoveQueueItem={(f, t) => setQueue(prev => { const n = [...prev]; const [i] = n.splice(f, 1); n.splice(t, 0, i); return n; })} 
          playlists={playlists} 
          onAddToPlaylist={(s, pid) => {
            setPlaylists(prev => prev.map(p => p.id === pid ? {...p, songs: [...p.songs, s], artwork: s.artwork} : p));
            setSongToAddToPlaylist(null);
          }}
          isFavorite={playlists.find(p => p.id === 'favs')?.songs.some(s => s.id === currentSong.id) || false}
          onToggleFavorite={() => toggleFavorite(currentSong)}
          onDownload={() => downloadSong(currentSong)}
          onShare={() => navigator.share?.({ title: currentSong.title, url: currentSong.url }).catch(() => {})}
          isShuffle={isShuffle} onToggleShuffle={toggleShuffle}
          repeatMode={repeatMode} onToggleRepeat={toggleRepeat}
          onShowPlaylistModal={() => setSongToAddToPlaylist(currentSong)}
        />
      )}

      {isChatOpen && (
        <ChatBotView 
          onClose={() => setIsChatOpen(false)} 
          dominantColor={dominantColor} 
          playbackControls={{ 
            toggle: togglePlay, 
            next: handleNext, 
            prev: handlePrev,
            searchAndPlay,
            addToFavorites: () => currentSong && toggleFavorite(currentSong),
            removeFromFavorites: () => currentSong && removeFromFavorites(currentSong),
            createPlaylist: (name: string) => createPlaylist(name),
            clearQueue: () => setQueue([currentSong!])
          }} 
        />
      )}

      {songToAddToPlaylist && (
        <div className="fixed inset-0 z-[400] bg-black/95 backdrop-blur-3xl flex items-end animate-in fade-in slide-in-from-bottom duration-500" onClick={() => setSongToAddToPlaylist(null)}>
          <div className="w-full bg-zinc-900/60 rounded-t-[48px] p-8 space-y-6 border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.8)]" onClick={e => e.stopPropagation()}>
             <div className="flex justify-between items-center px-2">
                <h3 className="text-2xl font-black tracking-tight">Add to Collection</h3>
                <button onClick={() => setSongToAddToPlaylist(null)} className="p-3 bg-white/5 rounded-full text-white/40"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg></button>
             </div>
             <div className="space-y-4">
                <div className="relative group">
                  <input id="newPName" type="text" placeholder="New Playlist Name..." className="w-full bg-white/[0.03] rounded-3xl py-5 pl-7 pr-16 outline-none border border-white/5 focus:border-accent/40 transition-all font-bold" />
                  <button onClick={() => {
                    const el = document.getElementById('newPName') as HTMLInputElement;
                    if (el.value.trim()) {
                      const p = createPlaylist(el.value.trim());
                      setPlaylists(prev => prev.map(pl => pl.id === p.id ? {...pl, songs: [songToAddToPlaylist], artwork: songToAddToPlaylist.artwork} : pl));
                      setSongToAddToPlaylist(null);
                    }
                  }} className="absolute right-2 top-2 bottom-2 aspect-square bg-accent rounded-2xl flex items-center justify-center text-white shadow-accent active:scale-90 transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"></path></svg></button>
                </div>
                <div className="max-h-[40vh] overflow-y-auto space-y-3 no-scrollbar pb-6 px-1">
                  {playlists.map(p => (
                     <button key={p.id} onClick={() => {
                        setPlaylists(prev => prev.map(pl => pl.id === p.id ? {...pl, songs: [...pl.songs, songToAddToPlaylist], artwork: songToAddToPlaylist.artwork} : pl));
                        setSongToAddToPlaylist(null);
                     }} className="w-full flex items-center gap-5 p-4 rounded-[28px] bg-white/[0.02] hover:bg-white/[0.06] transition-all border border-white/5 group">
                       <img src={p.artwork} className="w-14 h-14 rounded-2xl object-cover shadow-lg group-hover:scale-105 transition-transform" />
                       <div className="text-left flex-1">
                        <span className="font-black text-sm block">{p.name}</span>
                        <span className="text-[10px] text-white/20 uppercase font-black tracking-widest">{p.songs.length} Tracks</span>
                       </div>
                       <svg className="w-5 h-5 text-white/10 group-hover:text-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"></path></svg>
                     </button>
                  ))}
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
