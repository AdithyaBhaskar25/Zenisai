import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Song, AppView, Playlist } from './types';
import { saavnService } from './services/saavnService';
import { lyricsService, ParsedLyricLine } from './services/lyricsService';
import PlayerFull from './components/PlayerFull';
import FloatingHub from './components/FloatingHub';
import HomeView from './components/HomeView';
import SearchView from './components/SearchView';
import LibraryView from './components/LibraryView';
import ChatBotView from './components/ChatBotView';

const App: React.FC = () => {
  const [currentSong, setCurrentSong] = useState<Song | null>(() => {
    try {
      const saved = localStorage.getItem('zenisai_current_song');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeView, setActiveView] = useState<AppView>('home');
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [queue, setQueue] = useState<Song[]>(() => {
    try {
      const saved = localStorage.getItem('zenisai_queue');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [originalQueue, setOriginalQueue] = useState<Song[]>(() => {
    try {
      const saved = localStorage.getItem('zenisai_orig_queue');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    const saved = localStorage.getItem('zenisai_v10_playlists');
    const parsed = saved ? JSON.parse(saved) : [
      { id: 'favs', name: 'Favorites', songs: [], artwork: 'https://picsum.photos/seed/heart/400/400' }
    ];
    return parsed.filter((p: Playlist) => p.songs.length > 0 || p.id === 'favs');
  });
  
  const [progress, setProgress] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('zenisai_playback_time');
      return saved ? parseFloat(saved) || 0 : 0;
    } catch { return 0; }
  });
  const [duration, setDuration] = useState(0);
  const [sleepTimer, setSleepTimer] = useState<number | null>(null);
  const [currentLyrics, setCurrentLyrics] = useState<string>('');
  const [currentSyncedLyrics, setCurrentSyncedLyrics] = useState<string>('');
  const [currentParsedLyrics, setCurrentParsedLyrics] = useState<ParsedLyricLine[]>([]);
  const [currentPlainLyrics, setCurrentPlainLyrics] = useState<string[]>([]);
  const [dominantColor, setDominantColor] = useState('#3b82f6');
  const [songToAddToPlaylist, setSongToAddToPlaylist] = useState<Song | null>(null);

  const [repeatMode, setRepeatMode] = useState<'off' | 'one' | 'all'>(() => {
    try {
      const saved = localStorage.getItem('zenisai_repeat_mode');
      return (saved as any) || 'off';
    } catch { return 'off'; }
  });
  const [isShuffle, setIsShuffle] = useState<boolean>(() => {
    try {
      return localStorage.getItem('zenisai_shuffle') === 'true';
    } catch { return false; }
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sleepTimerRef = useRef<any>(null);
  const handleTrackEndedRef = useRef<() => void>(() => {});
  const mediaActionsRef = useRef({ play: () => {}, pause: () => {}, next: () => {}, prev: () => {} });
  const pageTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastSavedTimeRef = useRef<number>(0);
  const wakeLockSentinelRef = useRef<any>(null);

  // Screen Wake Lock API for background & active playback persistence
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator && !wakeLockSentinelRef.current) {
        wakeLockSentinelRef.current = await (navigator as any).wakeLock.request('screen');
        wakeLockSentinelRef.current.addEventListener('release', () => {
          wakeLockSentinelRef.current = null;
        });
      }
    } catch {}
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockSentinelRef.current) {
      try {
        wakeLockSentinelRef.current.release();
      } catch {}
      wakeLockSentinelRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isPlaying) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
  }, [isPlaying, requestWakeLock, releaseWakeLock]);

  useEffect(() => {
    localStorage.setItem('zenisai_v10_playlists', JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    if (currentSong) {
      localStorage.setItem('zenisai_current_song', JSON.stringify(currentSong));
    }
  }, [currentSong]);

  useEffect(() => {
    localStorage.setItem('zenisai_queue', JSON.stringify(queue));
  }, [queue]);

  useEffect(() => {
    localStorage.setItem('zenisai_orig_queue', JSON.stringify(originalQueue));
  }, [originalQueue]);

  useEffect(() => {
    localStorage.setItem('zenisai_repeat_mode', repeatMode);
  }, [repeatMode]);

  useEffect(() => {
    localStorage.setItem('zenisai_shuffle', String(isShuffle));
  }, [isShuffle]);

  // Keep native loop property synchronized for 100% reliable hardware repeat one
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = (repeatMode === 'one');
    }
  }, [repeatMode]);

  useEffect(() => {
    const saveCurrentTime = () => {
      if (audioRef.current && audioRef.current.currentTime > 0) {
        localStorage.setItem('zenisai_playback_time', String(audioRef.current.currentTime));
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        saveCurrentTime();
        // Keep web audio context alive when tab is in background
        if (analyserRef.current?.context && analyserRef.current.context.state === 'suspended') {
          analyserRef.current.context.resume().catch(() => {});
        }
      } else if (document.visibilityState === 'visible') {
        if (isPlaying) {
          requestWakeLock();
          if (analyserRef.current?.context && analyserRef.current.context.state === 'suspended') {
            analyserRef.current.context.resume().catch(() => {});
          }
        }
      }
    };

    window.addEventListener('beforeunload', saveCurrentTime);
    window.addEventListener('pagehide', saveCurrentTime);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('beforeunload', saveCurrentTime);
      window.removeEventListener('pagehide', saveCurrentTime);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isPlaying, requestWakeLock]);

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
      audioRef.current.preload = 'auto';
      audioRef.current.setAttribute('playsinline', 'true');
      try {
        if ('audioSession' in navigator) {
          (navigator as any).audioSession.type = 'playback';
        }
      } catch { /* Audio Session is not available in every browser. */ }
    }
    const audio = audioRef.current;
    const updateProgress = () => {
      const cur = audio.currentTime;
      setProgress(cur);
      setDuration(audio.duration || 0);
      if (Math.abs(cur - lastSavedTimeRef.current) > 1.2) {
        lastSavedTimeRef.current = cur;
        localStorage.setItem('zenisai_playback_time', String(cur));
      }
    };
    const updatePlaying = () => {
      const active = !audio.paused && !audio.ended;
      setIsPlaying(active);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = active ? 'playing' : 'paused';
      }
    };
    const handleEnded = () => handleTrackEndedRef.current();
    const handleError = (e: any) => {
      console.warn('Audio playback recovery notice:', e);
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateProgress);
    audio.addEventListener('durationchange', updateProgress);
    audio.addEventListener('play', updatePlaying);
    audio.addEventListener('pause', updatePlaying);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('loadedmetadata', updateProgress);
      audio.removeEventListener('durationchange', updateProgress);
      audio.removeEventListener('play', updatePlaying);
      audio.removeEventListener('pause', updatePlaying);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  useEffect(() => {
    const restorePlayback = async () => {
      const savedSongStr = localStorage.getItem('zenisai_current_song');
      if (!savedSongStr) return;
      try {
        const savedSong: Song = JSON.parse(savedSongStr);
        if (!savedSong?.url) return;
        const savedTime = parseFloat(localStorage.getItem('zenisai_playback_time') || '0');

        if (audioRef.current) {
          audioRef.current.src = savedSong.url;
          audioRef.current.currentTime = savedTime > 0 ? savedTime : 0;
          updateThemeFromImage(savedSong.artwork);
          fetchLyrics(savedSong);

          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => setIsPlaying(true))
              .catch(() => {
                const startOnInteraction = () => {
                  if (audioRef.current && audioRef.current.paused) {
                    playAudio();
                  }
                  window.removeEventListener('pointerdown', startOnInteraction);
                  window.removeEventListener('keydown', startOnInteraction);
                };
                window.addEventListener('pointerdown', startOnInteraction, { once: true });
                window.addEventListener('keydown', startOnInteraction, { once: true });
              });
          }
        }
      } catch (err) {
        console.warn('Playback restoration notice:', err);
      }
    };

    restorePlayback();
  }, []);

  const playAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const context = analyserRef.current?.context;
    if (context?.state === 'suspended') context.resume().catch(() => {});
    audio.play().catch(() => setIsPlaying(false));
  };
  
  const handleTrackEnded = () => {
    if (repeatMode === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        playAudio();
      }
    } else {
      handleNext();
    }
  };
  handleTrackEndedRef.current = handleTrackEnded;

  // Background Preloader: Resolves upcoming song URLs so background track changes are synchronous & unkillable
  useEffect(() => {
    if (!currentSong || queue.length === 0) return;
    const currentIndex = queue.findIndex(s => s.id === currentSong.id);
    const nextIndex = currentIndex >= 0 && currentIndex < queue.length - 1 ? currentIndex + 1 : (repeatMode === 'all' ? 0 : -1);
    if (nextIndex >= 0 && queue[nextIndex] && !queue[nextIndex].url) {
      const nextSong = queue[nextIndex];
      saavnService.getSongDetails(nextSong.id).then(details => {
        const mapped = saavnService.mapSong(details);
        if (mapped?.url) {
          setQueue(prev => prev.map(s => s.id === mapped.id ? { ...s, url: mapped.url } : s));
          setOriginalQueue(prev => prev.map(s => s.id === mapped.id ? { ...s, url: mapped.url } : s));
        }
      }).catch(() => {});
    }
  }, [currentSong?.id, queue.length, repeatMode]);

  const updateThemeFromImage = (imageUrl: string) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 24; canvas.height = 24;
      try {
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pixels = ctx?.getImageData(0, 0, canvas.width, canvas.height).data;
        if (pixels) {
          let red = 0, green = 0, blue = 0, totalWeight = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i + 3] < 128) continue;
            const pixelRed = pixels[i], pixelGreen = pixels[i + 1], pixelBlue = pixels[i + 2];
            const brightness = (pixelRed + pixelGreen + pixelBlue) / 3;
            if (brightness < 28 || brightness > 242) continue;
            const chroma = Math.max(pixelRed, pixelGreen, pixelBlue) - Math.min(pixelRed, pixelGreen, pixelBlue);
            const weight = 0.35 + chroma / 85;
            red += pixelRed * weight; green += pixelGreen * weight; blue += pixelBlue * weight;
            totalWeight += weight;
          }
          if (totalWeight === 0) throw new Error('Artwork has no usable colors.');
          const average = [red / totalWeight, green / totalWeight, blue / totalWeight];
          const luminance = average[0] * 0.3 + average[1] * 0.59 + average[2] * 0.11;
          const chroma = Math.max(...average) - Math.min(...average);
          const saturation = chroma < 20 ? 1 : 1.28;
          let vivid = average.map(channel => Math.max(0, Math.min(255, Math.round(luminance + (channel - luminance) * saturation))));
          const vividLuminance = vivid[0] * 0.3 + vivid[1] * 0.59 + vivid[2] * 0.11;
          if (vividLuminance < 88) {
            const lift = (88 - vividLuminance) / (255 - vividLuminance);
            vivid = vivid.map(channel => Math.round(channel + (255 - channel) * lift));
          } else if (vividLuminance > 190) {
            const dim = 190 / vividLuminance;
            vivid = vivid.map(channel => Math.round(channel * dim));
          }
          const [vividRed, vividGreen, vividBlue] = vivid;
          const color = `rgb(${vividRed},${vividGreen},${vividBlue})`;
          const glowColor = `rgba(${vividRed},${vividGreen},${vividBlue}, 0.3)`;
          const bgColor = `rgb(${Math.max(2, Math.round(vividRed * 0.035))},${Math.max(6, Math.round(vividGreen * 0.045))},${Math.max(14, Math.round(vividBlue * 0.065))})`;
          const surfaceColor = `rgb(${Math.max(7, Math.round(vividRed * 0.08))},${Math.max(14, Math.round(vividGreen * 0.085))},${Math.max(26, Math.round(vividBlue * 0.12))})`;
          const tintColor = `rgba(${vividRed},${vividGreen},${vividBlue},0.12)`;
          
          setDominantColor(color);
          document.documentElement.style.setProperty('--color-primary', color);
          document.documentElement.style.setProperty('--color-glow', glowColor);
          document.documentElement.style.setProperty('--color-bg', bgColor);
          document.documentElement.style.setProperty('--color-surface', surfaceColor);
          document.documentElement.style.setProperty('--color-tint', tintColor);
          document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bgColor);
        }
      } catch (e) { 
          setDominantColor('#3b82f6');
      }
    };
  };

  // Requirement 6: Centralized lyrics fetch shared reliably across mini player and full player
  const fetchLyrics = async (song: Song) => {
    setCurrentLyrics('Fetching lyrics...');
    setCurrentSyncedLyrics('');
    try {
      const res = await lyricsService.fetchLyrics(song);
      setCurrentParsedLyrics(res.syncedLyrics);
      setCurrentPlainLyrics(res.plainLyrics);
      setCurrentSyncedLyrics(res.rawSynced);
      setCurrentLyrics(res.plainLyrics.join('\n'));
    } catch {
      setCurrentLyrics('Lyrics unavailable.');
      setCurrentParsedLyrics([]);
      setCurrentPlainLyrics([]);
      setCurrentSyncedLyrics('');
    }
  };

  const setQueueForSelection = (selectedSong: Song, songs: Song[]) => {
    const orderedQueue = [selectedSong, ...songs.filter(item => item.id !== selectedSong.id)];
    setOriginalQueue(orderedQueue);
    if (isShuffle) {
      const upcoming = orderedQueue.slice(1);
      for (let index = upcoming.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [upcoming[index], upcoming[swapIndex]] = [upcoming[swapIndex], upcoming[index]];
      }
      setQueue([selectedSong, ...upcoming]);
    } else {
      setQueue(orderedQueue);
    }
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
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        analyserRef.current = ctx.createAnalyser();
        analyserRef.current.fftSize = 64;
        const source = ctx.createMediaElementSource(audioRef.current);
        source.connect(analyserRef.current);
        analyserRef.current.connect(ctx.destination);
      } catch (e) {
        console.warn('Analyser setup notice:', e);
      }
    }
    if (currentSong?.id === playSong.id) {
      if (newQueue) setQueueForSelection(playSong, newQueue);
      togglePlay();
      return;
    }
    setCurrentSong(playSong);
    updateThemeFromImage(playSong.artwork);
    fetchLyrics(playSong);
    audioRef.current.src = playSong.url;
    audioRef.current.loop = (repeatMode === 'one');
    playAudio();

    if (newQueue) {
      setQueueForSelection(playSong, newQueue);
    } else if (!queue.some(s => s.id === playSong.id)) {
      setQueue(prev => [playSong, ...prev]);
      setOriginalQueue(prev => [playSong, ...prev]);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current?.src) return;
    if (audioRef.current.paused) {
      playAudio();
    } else {
      audioRef.current.pause();
    }
  };

  // Requirement 2 & 7: Reliable Bluetooth and Media controls for Next and Previous
  const handleNext = useCallback(() => {
    if (queue.length === 0 || !currentSong) return;
    const idx = queue.findIndex(s => s.id === currentSong.id);
    if (idx !== -1 && idx < queue.length - 1) {
      handlePlaySong(queue[idx + 1]);
    } else if (repeatMode === 'all' || repeatMode === 'one') {
      // User or Bluetooth Next during repeat one advances forward or wraps around
      if (queue.length === 1 && audioRef.current) {
        audioRef.current.currentTime = 0;
        playAudio();
      } else {
        handlePlaySong(queue[0]);
      }
    } else {
      setIsPlaying(false);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    }
  }, [queue, currentSong, repeatMode]);

  const handlePrev = useCallback(() => {
    if (queue.length === 0 || !currentSong) return;
    // Standard Bluetooth / Headphone Back UX: if played > 3 seconds, restart current track
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      setProgress(0);
      playAudio();
      return;
    }
    const idx = queue.findIndex(s => s.id === currentSong.id);
    if (idx > 0) {
      handlePlaySong(queue[idx - 1]);
    } else if (repeatMode === 'all' || repeatMode === 'one') {
      handlePlaySong(queue[queue.length - 1]);
    }
  }, [queue, currentSong, repeatMode]);

  useEffect(() => {
    mediaActionsRef.current = {
      play: playAudio,
      pause: () => {
        if (audioRef.current) audioRef.current.pause();
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
      },
      next: () => handleNext(),
      prev: () => handlePrev(),
    };
  }, [handleNext, handlePrev]);

  const toggleShuffle = () => {
    const newState = !isShuffle;
    setIsShuffle(newState);
    if (newState) {
      setOriginalQueue(queue);
      const currentIndex = queue.findIndex(song => song.id === currentSong?.id);
      const played = currentIndex >= 0 ? queue.slice(0, currentIndex) : [];
      const upcoming = currentIndex >= 0 ? queue.slice(currentIndex + 1) : [...queue];
      for (let index = upcoming.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [upcoming[index], upcoming[swapIndex]] = [upcoming[swapIndex], upcoming[index]];
      }
      setQueue(currentSong ? [...played, currentSong, ...upcoming] : upcoming);
    } else {
      const restored = originalQueue.length > 0 ? originalQueue : queue;
      const currentIndex = restored.findIndex(song => song.id === currentSong?.id);
      setQueue(currentIndex >= 0 ? [...restored.slice(currentIndex), ...restored.slice(0, currentIndex)] : restored);
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

  const findSong = async (query: string) => {
    const results = await saavnService.searchSongs(query, 0, 1);
    return results?.length ? saavnService.mapSong(results[0]) : null;
  };

  const recommendSongs = async (query: string) => {
    const results = await saavnService.searchSongs(query, 0, 5);
    const songs = results.map(saavnService.mapSong);
    return songs.length ? songs.map((song, index) => `${index + 1}. ${song.title} - ${song.artist}`).join('\n') : 'No matching recommendations found.';
  };

  const favoriteSong = async (query: string) => {
    const song = await findSong(query);
    if (!song) return;
    setPlaylists(prev => prev.map(playlist => {
      if (playlist.id !== 'favs' || playlist.songs.some(item => item.id === song.id)) return playlist;
      return { ...playlist, songs: [...playlist.songs, song], artwork: song.artwork };
    }));
  };

  const addCurrentToFavorites = () => {
    if (!currentSong) return;
    setPlaylists(prev => prev.map(playlist => {
      if (playlist.id !== 'favs' || playlist.songs.some(item => item.id === currentSong.id)) return playlist;
      return { ...playlist, songs: [...playlist.songs, currentSong], artwork: currentSong.artwork };
    }));
  };

  const addSongToPlaylist = async (query: string, playlistName: string) => {
    const song = await findSong(query);
    if (!song) return;
    const name = playlistName.trim() || 'New Playlist';
    setPlaylists(prev => {
      const existing = prev.find(playlist => playlist.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        return prev.map(playlist => playlist.id !== existing.id || playlist.songs.some(item => item.id === song.id)
          ? playlist
          : { ...playlist, songs: [...playlist.songs, song], artwork: song.artwork });
      }
      return [...prev, { id: Date.now().toString(), name, songs: [song], artwork: song.artwork }];
    });
  };

  const createPlaylist = (name: string) => {
    const newP: Playlist = { id: Date.now().toString(), name, songs: [], artwork: `https://picsum.photos/seed/${name}/400/400` };
    setPlaylists(prev => [...prev, newP]);
    return newP;
  };

  // Requirement 2 & 7: Comprehensive Web Media Session & Bluetooth Hardware Media Key Integration
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    const setHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try { session.setActionHandler(action, handler); } catch { /* Action is unsupported by this browser. */ }
    };

    setHandler('play', () => mediaActionsRef.current.play());
    setHandler('pause', () => mediaActionsRef.current.pause());
    setHandler('stop', () => mediaActionsRef.current.pause());
    setHandler('previoustrack', () => mediaActionsRef.current.prev());
    setHandler('nexttrack', () => mediaActionsRef.current.next());
    setHandler('seekto', details => {
      if (details.seekTime !== undefined && audioRef.current) {
        audioRef.current.currentTime = details.seekTime;
        setProgress(details.seekTime);
      }
    });
    setHandler('seekbackward', details => {
      if (!audioRef.current) return;
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - (details.seekOffset ?? 10));
      setProgress(audioRef.current.currentTime);
    });
    setHandler('seekforward', details => {
      if (!audioRef.current) return;
      audioRef.current.currentTime = Math.min(audioRef.current.duration || Infinity, audioRef.current.currentTime + (details.seekOffset ?? 10));
      setProgress(audioRef.current.currentTime);
    });

    // Hardware Bluetooth headset media keys fallback
    const handleHardwareMediaKeys = (e: KeyboardEvent) => {
      if (e.key === 'MediaPlayPause') {
        togglePlay();
      } else if (e.key === 'MediaTrackNext') {
        mediaActionsRef.current.next();
      } else if (e.key === 'MediaTrackPrevious') {
        mediaActionsRef.current.prev();
      } else if (e.key === 'MediaStop') {
        mediaActionsRef.current.pause();
      }
    };
    window.addEventListener('keydown', handleHardwareMediaKeys);

    return () => {
      window.removeEventListener('keydown', handleHardwareMediaKeys);
      setHandler('play', null);
      setHandler('pause', null);
      setHandler('stop', null);
      setHandler('previoustrack', null);
      setHandler('nexttrack', null);
      setHandler('seekto', null);
      setHandler('seekbackward', null);
      setHandler('seekforward', null);
    };
  }, []);

  // Update Media Session Notification Artwork & Metadata reliably for AVRCP Bluetooth & Lock Screen
  useEffect(() => {
    if (!currentSong || !('mediaSession' in navigator)) return;
    const artworkUrl = currentSong.artwork || '/icons/android-chrome-512x512.png';
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: currentSong.artist,
        album: currentSong.album || 'Zenisai Music',
        artwork: [
          { src: artworkUrl, sizes: '96x96', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '128x128', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '192x192', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '384x384', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '512x512', type: 'image/jpeg' },
        ],
      });
    } catch {}
  }, [currentSong]);

  // Update Playback State and Position State
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      const audio = audioRef.current;
      if (audio && Number.isFinite(audio.duration) && audio.duration > 0 && Number.isFinite(progress)) {
        navigator.mediaSession.setPositionState({
          duration: audio.duration,
          playbackRate: audio.playbackRate || 1,
          position: Math.min(Math.max(0, progress), audio.duration)
        });
      }
    } catch { /* Position state is optional. */ }
  }, [isPlaying, progress]);

  const handlePageTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    const target = event.target;
    if (target instanceof Element && target.closest('button, input, textarea, select, a, .overflow-x-auto')) {
      pageTouchStartRef.current = null;
      return;
    }
    pageTouchStartRef.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  };

  const handlePageTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    if (!pageTouchStartRef.current) return;
    const deltaX = pageTouchStartRef.current.x - event.changedTouches[0].clientX;
    const deltaY = pageTouchStartRef.current.y - event.changedTouches[0].clientY;
    pageTouchStartRef.current = null;
    if (Math.abs(deltaX) < 90 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    const views: AppView[] = ['home', 'search', 'library'];
    const nextIndex = Math.min(views.length - 1, Math.max(0, views.indexOf(activeView) + (deltaX > 0 ? 1 : -1)));
    setActiveView(views[nextIndex]);
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[var(--color-bg)] relative overflow-hidden transition-colors duration-1000">
      <div className="fixed inset-0 pointer-events-none glow-overlay z-0" />
      
      <main onTouchStart={handlePageTouchStart} onTouchEnd={handlePageTouchEnd} className="flex-1 overflow-y-auto no-scrollbar pb-[220px] compact-landscape:pb-[130px] w-full max-w-5xl mx-auto relative z-10">
        {activeView === 'home' && (
          <div className="animate-in fade-in duration-200">
            <HomeView
              onPlay={handlePlaySong}
              currentSong={currentSong}
              isPlaying={isPlaying}
              onAddClick={setSongToAddToPlaylist}
              onDownload={downloadSong}
              progress={progress}
              isFavorite={songId => playlists.find(p => p.id === 'favs')?.songs.some(song => song.id === songId) || false}
              onToggleFavorite={toggleFavorite}
              onTogglePlay={togglePlay}
            />
          </div>
        )}
        {activeView === 'search' && (
          <div className="animate-in fade-in duration-200">
            <SearchView
              onPlay={handlePlaySong}
              onAddClick={setSongToAddToPlaylist}
              onDownload={downloadSong}
              isFavorite={songId => playlists.find(playlist => playlist.id === 'favs')?.songs.some(song => song.id === songId) || false}
              onToggleFavorite={toggleFavorite}
            />
          </div>
        )}
        {activeView === 'library' && (
          <div className="animate-in fade-in duration-200">
            <LibraryView 
              playlists={playlists} 
              setPlaylists={setPlaylists} 
              onPlay={handlePlaySong} 
              onRemoveFromPlaylist={(sid, pid) => setPlaylists(prev => prev.map(pl => pl.id === pid ? {...pl, songs: pl.songs.filter(s => s.id !== sid)} : pl))} 
              onAddClick={setSongToAddToPlaylist} 
              onDownload={downloadSong} 
              onCreatePlaylist={createPlaylist} 
            />
          </div>
        )}
      </main>

      <FloatingHub 
        song={currentSong} 
        isPlaying={isPlaying} 
        onToggle={togglePlay} 
        activeView={activeView} 
        setActiveView={setActiveView}
        progress={progress} 
        duration={duration} 
        lyrics={currentSyncedLyrics} 
        plainLyrics={currentLyrics} 
        onOpenPlayer={() => setIsPlayerOpen(true)}
        analyser={analyserRef.current} 
        dominantColor={dominantColor} 
        onOpenChat={() => setIsChatOpen(true)}
        isFavorite={playlists.find(p => p.id === 'favs')?.songs.some(s => s.id === currentSong?.id) || false}
        onToggleFavorite={() => currentSong && toggleFavorite(currentSong)}
        isShuffle={isShuffle} 
        onToggleShuffle={toggleShuffle}
        repeatMode={repeatMode} 
        onToggleRepeat={toggleRepeat}
        onNext={handleNext} 
        onPrev={handlePrev}
      />

      {isPlayerOpen && currentSong && (
        <PlayerFull 
          song={currentSong} 
          isPlaying={isPlaying} 
          onToggle={togglePlay} 
          onNext={handleNext} 
          onPrev={handlePrev} 
          onClose={() => setIsPlayerOpen(false)} 
          dominantColor={dominantColor} 
          progress={progress} 
          duration={duration}
          onSeek={(val) => { if(audioRef.current) audioRef.current.currentTime = val; }}
          analyser={analyserRef.current} 
          sleepTimer={sleepTimer} 
          setSleepTimer={setSleepTimer}
          queue={queue} 
          onPlayFromQueue={(s) => handlePlaySong(s)} 
          lyrics={currentLyrics}
          syncedLyricsList={currentParsedLyrics}
          plainLyricsList={currentPlainLyrics}
          onRemoveFromQueue={(id) => setQueue(q => q.filter(s => s.id !== id))} 
          onMoveQueueItem={(f, t) => setQueue(prev => { const n = [...prev]; const [i] = n.splice(f, 1); n.splice(t, 0, i); return n; })} 
          playlists={playlists} 
          onAddToPlaylist={(s, pid) => {
            setPlaylists(prev => prev.map(p => p.id === pid && !p.songs.some(item => item.id === s.id) ? {...p, songs: [...p.songs, s], artwork: s.artwork} : p));
            setSongToAddToPlaylist(null);
          }}
          isFavorite={songId => playlists.find(p => p.id === 'favs')?.songs.some(s => s.id === songId) || false}
          onToggleFavorite={toggleFavorite}
          onDownload={downloadSong}
          onShare={shareSong => navigator.share?.({ title: shareSong.title, url: shareSong.url }).catch(() => {})}
          isShuffle={isShuffle} 
          onToggleShuffle={toggleShuffle}
          repeatMode={repeatMode} 
          onToggleRepeat={toggleRepeat}
          onShowPlaylistModal={setSongToAddToPlaylist}
        />
      )}

      {isChatOpen && (
        <ChatBotView 
          onClose={() => setIsChatOpen(false)} 
          dominantColor={dominantColor} 
          currentSong={currentSong}
          playbackControls={{ 
            toggle: togglePlay, 
            next: handleNext, 
            prev: handlePrev,
            searchAndPlay,
            recommendSongs,
            addToFavorites: addCurrentToFavorites,
            favoriteSong,
            addSongToPlaylist,
            removeFromFavorites: () => currentSong && removeFromFavorites(currentSong),
            createPlaylist: (name: string) => createPlaylist(name),
            clearQueue: () => setQueue([currentSong!])
          }} 
        />
      )}

      {songToAddToPlaylist && (
        <div className="fixed inset-0 z-[400] flex items-end justify-center bg-black/60 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom duration-300 sm:items-center" onClick={() => setSongToAddToPlaylist(null)}>
          <div className="w-full max-w-lg max-h-[88dvh] overflow-y-auto rounded-[24px] border border-accent-tint bg-[var(--color-surface)] p-5 shadow-2xl sm:p-6" onClick={e => e.stopPropagation()}>
             <div className="flex justify-between items-center px-2">
                <h3 className="text-xl font-bold tracking-tight">Add to playlist</h3>
                <button onClick={() => setSongToAddToPlaylist(null)} className="p-3 bg-white/5 rounded-full text-white/40"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg></button>
             </div>
             <div className="space-y-4">
                <div className="relative group">
                  <input id="newPName" type="text" placeholder="New playlist name" className="w-full bg-white/[0.04] rounded-[14px] py-4 pl-4 pr-14 outline-none border border-white/[0.08] focus:border-accent/40 transition-all font-medium" />
                  <button onClick={() => {
                    const el = document.getElementById('newPName') as HTMLInputElement;
                    if (el.value.trim()) {
                      const p = createPlaylist(el.value.trim());
                      setPlaylists(prev => prev.map(pl => pl.id === p.id ? {...pl, songs: [songToAddToPlaylist], artwork: songToAddToPlaylist.artwork} : pl));
                      setSongToAddToPlaylist(null);
                    }
                  }} aria-label="Create playlist" className="absolute right-2 top-2 bottom-2 aspect-square bg-accent rounded-[10px] flex items-center justify-center text-[#06101e] shadow-accent active:scale-90 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg></button>
                </div>
                <div className="max-h-[40vh] overflow-y-auto space-y-3 no-scrollbar pb-6 px-1">
                  {playlists.map(p => (
                     <button key={p.id} onClick={() => {
                        setPlaylists(prev => prev.map(pl => pl.id === p.id ? {...pl, songs: [...pl.songs, songToAddToPlaylist], artwork: songToAddToPlaylist.artwork} : pl));
                        setSongToAddToPlaylist(null);
                     }} className="w-full flex items-center gap-4 p-3 rounded-[16px] bg-white/[0.035] hover:bg-white/[0.07] transition-all border border-white/[0.07] group">
                       <img src={p.artwork} className="w-12 h-12 rounded-xl object-cover shadow-lg" />
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
