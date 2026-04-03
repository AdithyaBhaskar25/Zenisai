import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Song, Playlist } from '../types';

// Helper to parse [mm:ss.xx] or [mm:ss] into seconds
const parseTimestamp = (lrcTimestamp: string): number => {
  const match = lrcTimestamp.match(/\[(\d+):(\d+(?:\.\d+)?)\]/);
  if (!match) return 0;
  const minutes = parseInt(match[1]);
  const seconds = parseFloat(match[2]);
  return minutes * 60 + seconds;
};

interface LyricLine { time: number; text: string; }

interface PlayerFullProps {
  song: Song; isPlaying: boolean; onToggle: () => void; onNext: () => void; onPrev: () => void;
  onClose: () => void; dominantColor: string; progress: number; duration: number;
  onSeek: (val: number) => void; analyser: AnalyserNode | null; sleepTimer: number | null;
  setSleepTimer: (val: number | null) => void; queue: Song[]; onPlayFromQueue: (song: Song) => void;
  lyrics: string; onRemoveFromQueue: (id: string) => void; onMoveQueueItem: (from: number, to: number) => void;
  playlists: Playlist[]; onAddToPlaylist: (song: Song, playlistId: string) => void;
  isFavorite: boolean; onToggleFavorite: () => void; onDownload: () => void; onShare: () => void;
  isShuffle: boolean; onToggleShuffle: () => void; repeatMode: 'off' | 'one' | 'all';
  onToggleRepeat: () => void; onShowPlaylistModal: () => void;
}

const PlayerFull: React.FC<PlayerFullProps> = ({ 
  song, isPlaying, onToggle, onNext, onPrev, onClose, dominantColor, progress, duration, onSeek, analyser,
  sleepTimer, setSleepTimer, queue, onPlayFromQueue, lyrics: propLyrics, onRemoveFromQueue, onMoveQueueItem, 
  isFavorite, onToggleFavorite, onDownload, onShare, isShuffle, onToggleShuffle, repeatMode, onToggleRepeat, onShowPlaylistModal
}) => {
  const [activeTab, setActiveTab] = useState<'player' | 'lyrics' | 'queue'>('player');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSleepTimerMenu, setShowSleepTimerMenu] = useState(false);
  
  const [syncedLyrics, setSyncedLyrics] = useState<LyricLine[]>([]);
  const [plainLyrics, setPlainLyrics] = useState<string[]>([]);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  
  const lyricsScrollRef = useRef<HTMLDivElement>(null);
  const activeLyricRef = useRef<HTMLParagraphElement>(null);
  const visualizerCanvasRef = useRef<HTMLCanvasElement>(null);

  // --- ROBUST LYRIC FETCHING ---
  useEffect(() => {
    const fetchLyrics = async () => {
      if (!song.title) return;
      setIsLoadingLyrics(true);
      const cleanTitle = song.title.replace(/\s*[\(\[].*?[\)\]]\s*/g, '').trim();
      const artist = encodeURIComponent(song.artist);
      const title = encodeURIComponent(song.title);
      const simpleTitle = encodeURIComponent(cleanTitle);
      const dur = Math.round(duration);

      const process = (data: any) => {
        if (data?.syncedLyrics) {
          setSyncedLyrics(data.syncedLyrics.split('\n').map((l: string) => ({
            time: parseTimestamp(l), text: l.replace(/\[.*\]/, '').trim()
          })).filter((l: any) => l.text || l.text === ""));
          return true;
        } else if (data?.plainLyrics) {
          setPlainLyrics(data.plainLyrics.split('\n'));
          return true;
        }
        return false;
      };

      try {
        const getRes = await fetch(`https://lrclib.net/api/get?artist_name=${artist}&track_name=${title}&duration=${dur}`);
        if (getRes.ok && process(await getRes.json())) return;

        const searchRes = await fetch(`https://lrclib.net/api/search?q=${simpleTitle}`);
        if (searchRes.ok) {
          const results = await searchRes.json();
          if (results.length > 0) {
            const best = results.sort((a: any, b: any) => (a.syncedLyrics ? -1 : 1))[0];
            process(best);
          }
        }
      } catch (e) { if (propLyrics) setPlainLyrics(propLyrics.split('\n')); }
      finally { setIsLoadingLyrics(false); }
    };
    fetchLyrics();
  }, [song.id, duration]);

  const currentLineIndex = useMemo(() => {
    for (let i = syncedLyrics.length - 1; i >= 0; i--) {
      if (progress >= syncedLyrics[i].time) return i;
    }
    return -1;
  }, [syncedLyrics, progress]);

  useEffect(() => {
    if (activeLyricRef.current) activeLyricRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentLineIndex]);

  // --- VISUALIZER ---
  useEffect(() => {
    if (!analyser || !visualizerCanvasRef.current) return;
    const canvas = visualizerCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let animationId: number;
    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillStyle = dominantColor;
        ctx.globalAlpha = 0.2;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };
    draw();
    return () => cancelAnimationFrame(animationId);
  }, [analyser, dominantColor]);

  // --- QUEUE TOUCH REORDER ---
  const dragItemRef = useRef<number | null>(null);
  const handleQueueTouchMove = (e: React.TouchEvent) => {
    if (dragItemRef.current === null) return;
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const row = target?.closest('[data-queue-index]');
    if (row) {
      const targetIndex = parseInt(row.getAttribute('data-queue-index') || '-1');
      if (targetIndex !== -1 && targetIndex !== dragItemRef.current) {
        onMoveQueueItem(dragItemRef.current, targetIndex);
        dragItemRef.current = targetIndex; 
      }
    }
  };

  const formatTime = (time: number) => {
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black text-white flex flex-col overflow-hidden font-sans select-none animate-in fade-in duration-500">
      
      {/* Dynamic Glass Background */}
      <div className="absolute inset-0 opacity-30 transition-all duration-1000" style={{ background: `radial-gradient(circle at 50% 50%, ${dominantColor} 0%, transparent 100%)` }} />
      <div className="absolute inset-0 backdrop-blur-[100px]" />

      <div className="relative z-10 flex flex-col h-full w-full overflow-hidden">
        
        {/* TOP NAV */}
        <header className="flex items-center justify-between p-4 md:p-6 shrink-0">
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M19 9l-7 7-7-7"/></svg></button>
          <div className="text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Zenisai</p>
            <p className="text-[11px] font-bold opacity-80 uppercase truncate max-w-[150px]">{song.album}</p>
          </div>
          <div className="relative">
            <button onClick={() => setShowDropdown(!showDropdown)} className="p-2 rounded-full hover:bg-white/10 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M12 5v.01M12 12v.01M12 19v.01"/></svg></button>
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-[#181818] border border-white/10 rounded-xl p-2 shadow-2xl z-50">
                {!showSleepTimerMenu ? (
                  <>
                    <button onClick={onDownload} className="w-full text-left p-3 text-xs font-bold hover:bg-white/5 rounded-lg flex gap-3"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> Download</button>
                    <button onClick={() => setShowSleepTimerMenu(true)} className="w-full text-left p-3 text-xs font-bold hover:bg-white/5 rounded-lg flex gap-3"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Sleep Timer</button>
                  </>
                ) : (
                  <div>
                    <button onClick={() => setShowSleepTimerMenu(false)} className="p-2 text-[10px] opacity-40 uppercase font-black">← Back</button>
                    {[15, 30, 45, 60].map(m => (
                      <button key={m} onClick={() => {setSleepTimer(m*60); setShowDropdown(false)}} className="w-full text-left p-3 text-xs hover:bg-white/5 rounded-lg">{m} Min</button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* CONTENT GRID: RESPONSIVE LANDSCAPE VS PORTRAIT */}
        <main className="flex-1 flex flex-col landscape:flex-row overflow-hidden px-6 lg:px-20 gap-6 lg:gap-16 items-center">
          
          {/* Left Side: Artwork & Info */}
          <div className="flex-1 flex flex-col items-center landscape:items-start justify-center w-full max-w-[400px] landscape:max-w-[45%]">
            <div className="relative group w-full aspect-square max-h-[300px] md:max-h-[450px]">
              <img src={song.artwork} className={`w-full h-full object-cover rounded-2xl shadow-2xl transition-transform duration-700 ${isPlaying ? 'scale-100' : 'scale-90 opacity-60'}`} />
              <button onClick={onToggleFavorite} className={`absolute bottom-4 right-4 p-3 rounded-full backdrop-blur-xl ${isFavorite ? 'bg-accent text-white' : 'bg-black/40 text-white'}`}>
                <svg className="w-6 h-6" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
              </button>
            </div>
            <div className="mt-6 landscape:mt-8 w-full text-center landscape:text-left">
              <h2 className="text-2xl md:text-4xl font-black tracking-tight truncate">{song.title}</h2>
              <p className="text-sm md:text-lg font-bold text-white/40 mt-1 uppercase tracking-widest">{song.artist}</p>
            </div>
          </div>

          {/* Right Side: Lyrics / Queue / Tab Content */}
          <div className={`flex-1 w-full h-full flex flex-col overflow-hidden transition-all duration-300 ${activeTab === 'player' ? 'hidden landscape:flex opacity-20' : 'flex'}`}>
            <div className="flex-1 overflow-y-auto no-scrollbar py-6">
              {activeTab === 'lyrics' || (activeTab === 'player' && syncedLyrics.length > 0) ? (
                <div className="space-y-6 md:space-y-10 px-2 pb-20">
                  {isLoadingLyrics ? <p className="animate-pulse opacity-20 text-center font-black">FETCHING LYRICS...</p> : 
                    syncedLyrics.length > 0 ? syncedLyrics.map((l, i) => (
                      <p key={i} ref={i === currentLineIndex ? activeLyricRef : null} onClick={() => onSeek(l.time)} className={`text-xl md:text-3xl font-black transition-all duration-500 cursor-pointer ${i === currentLineIndex ? 'text-white scale-105 opacity-100' : 'text-white/10 hover:text-white/30'}`}>{l.text || "•••"}</p>
                    )) : plainLyrics.map((l, i) => <p key={i} className="text-lg md:text-xl font-bold opacity-30">{l}</p>)
                  }
                </div>
              ) : activeTab === 'queue' ? (
                <div className="space-y-2 pb-20" onTouchMove={handleQueueTouchMove} onTouchEnd={() => dragItemRef.current = null}>
                  {queue.map((qs, i) => (
                    <div key={qs.id} data-queue-index={i} className={`flex items-center gap-4 p-3 rounded-xl border ${qs.id === song.id ? 'bg-white/10 border-white/20' : 'border-transparent hover:bg-white/5'}`}>
                      <div className="p-2 text-white/20 touch-none" onTouchStart={() => dragItemRef.current = i}><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M7 7h2v2H7V7zm0 4h2v2H7v-2zm4-4h2v2h-2V7zm0 4h2v2h-2v-2z" /></svg></div>
                      <img src={qs.artwork} className="w-10 h-10 rounded-lg" />
                      <div className="flex-1 min-w-0" onClick={() => onPlayFromQueue(qs)}>
                        <p className={`text-sm font-bold truncate ${qs.id === song.id ? 'text-accent' : 'text-white'}`}>{qs.title}</p>
                        <p className="text-[10px] opacity-40 truncate">{qs.artist}</p>
                      </div>
                      <button onClick={() => onRemoveFromQueue(qs.id)} className="p-2 opacity-20 hover:opacity-100 text-red-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </main>

        {/* BOTTOM SECTION: CONTROLS & TIMELINE */}
        <footer className="w-full shrink-0 p-6 md:px-20 lg:px-32 bg-gradient-to-t from-black via-black/80 to-transparent">
          
          {/* Timeline */}
          <div className="mb-6 group">
            <div className="relative h-1 w-full bg-white/10 rounded-full overflow-hidden">
               <canvas ref={visualizerCanvasRef} width={800} height={40} className="absolute inset-0 w-full h-full opacity-40 pointer-events-none" />
               <div className="absolute h-full bg-white" style={{ width: `${(progress/duration)*100}%` }} />
            </div>
            <input type="range" min="0" max={duration || 100} value={progress} onChange={(e) => onSeek(Number(e.target.value))} className="absolute w-full h-2 -translate-y-1.5 opacity-0 cursor-pointer z-20" />
            <div className="flex justify-between mt-2 text-[10px] font-black opacity-40 tracking-widest uppercase">
              <span>{formatTime(progress)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between landscape:max-w-[80%] landscape:mx-auto">
            <button onClick={onToggleShuffle} className={`p-2 transition-colors ${isShuffle ? 'text-accent' : 'opacity-20 hover:opacity-100'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg></button>
            
            <div className="flex items-center gap-8 md:gap-12">
              <button onClick={onPrev} className="opacity-40 hover:opacity-100 active:scale-90 transition-all"><svg className="w-8 h-8 md:w-10 md:h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg></button>
              <button onClick={onToggle} className="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 active:scale-95 transition-all shadow-xl">
                {isPlaying ? <svg className="w-8 h-8 md:w-10 md:h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg className="w-8 h-8 md:w-10 md:h-10 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
              </button>
              <button onClick={onNext} className="opacity-40 hover:opacity-100 active:scale-90 transition-all"><svg className="w-8 h-8 md:w-10 md:h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg></button>
            </div>

            <button onClick={onToggleRepeat} className={`p-2 transition-colors ${repeatMode !== 'off' ? 'text-accent' : 'opacity-20 hover:opacity-100'}`}>
              <div className="relative">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                {repeatMode === 'one' && <span className="absolute -top-1 -right-1 text-[8px] font-black bg-accent text-white rounded-full w-3 h-3 flex items-center justify-center">1</span>}
              </div>
            </button>
          </div>

          {/* Tab Switcher - Now more Spotify-like (compact pills) */}
          <div className="mt-8 flex justify-center">
            <div className="flex bg-white/5 p-1 rounded-full backdrop-blur-md">
              {(['player', 'lyrics', 'queue'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-full transition-all
                    ${activeTab === tab ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white/60'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default PlayerFull;
