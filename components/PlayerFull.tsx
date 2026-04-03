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
  const [activeTab, setActiveTab] = useState<'lyrics' | 'queue'>('lyrics');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSleepTimerMenu, setShowSleepTimerMenu] = useState(false);
  const [showLyricsModal, setShowLyricsModal] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);
  
  const [syncedLyrics, setSyncedLyrics] = useState<LyricLine[]>([]);
  const [plainLyrics, setPlainLyrics] = useState<string[]>([]);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  
  const activeLyricRef = useRef<HTMLParagraphElement>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);

  // --- ROBUST LYRIC FETCHING ---
  useEffect(() => {
    const fetchLyrics = async () => {
      if (!song.title) return;
      setIsLoadingLyrics(true);
      const cleanTitle = song.title.replace(/\s*[\(\[].*?[\)\]]\s*/g, '').trim();
      try {
        const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(song.artist)}&track_name=${encodeURIComponent(song.title)}&duration=${Math.round(duration)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.syncedLyrics) {
          setSyncedLyrics(data.syncedLyrics.split('\n').map((l: string) => ({
            time: parseTimestamp(l), text: l.replace(/\[.*\]/, '').trim()
          })).filter((l: any) => l.text !== undefined));
        } else if (data.plainLyrics) {
          setPlainLyrics(data.plainLyrics.split('\n'));
        }
      } catch (e) { setPlainLyrics(propLyrics.split('\n')); }
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
  }, [currentLineIndex, showLyricsModal]);

  // --- SEA WAVE VISUALIZER ---
  useEffect(() => {
    if (!waveCanvasRef.current) return;
    const canvas = waveCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let offset = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const progressWidth = (progress / (duration || 1)) * width;

      // Draw Wave
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x++) {
        const amplitude = isPlaying ? 8 : 2;
        const frequency = 0.02;
        const y = Math.sin(x * frequency + offset) * amplitude + height / 2;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.closePath();

      // Background Track
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fill();

      // Progress Fill with dominant color
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, progressWidth, height);
      ctx.clip();
      ctx.fillStyle = dominantColor;
      ctx.globalAlpha = 0.8;
      ctx.fill();
      ctx.restore();

      offset += isPlaying ? 0.08 : 0.02;
      animationId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, progress, duration, dominantColor]);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#080808] text-white flex flex-col landscape:flex-row overflow-hidden font-sans">
      
      {/* Dynamic Glow */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: `radial-gradient(circle at 20% 50%, ${dominantColor} 0%, transparent 50%)` }} />

      {/* LEFT COLUMN: PLAYER & ARTWORK */}
      <section className="relative flex-1 flex flex-col h-full p-6 landscape:max-w-[40%] border-r border-white/5 z-10">
        <header className="flex items-center justify-between landscape:hidden mb-6">
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-white"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M19 9l-7 7-7-7"/></svg></button>
          <p className="text-[10px] font-black tracking-[0.4em] opacity-40 uppercase">Zenisai</p>
          <div className="w-10" /> 
        </header>

        <div className="flex-1 flex flex-col justify-center gap-8">
          {/* Album Art with Fav Icon */}
          <div className="relative group mx-auto w-full max-w-[320px] aspect-square">
            <img src={song.artwork} className={`w-full h-full object-cover rounded-3xl shadow-2xl transition-all duration-700 ${isPlaying ? 'scale-100' : 'scale-95 opacity-50'}`} />
            <button onClick={onToggleFavorite} className={`absolute bottom-4 left-4 p-3 rounded-2xl backdrop-blur-xl transition-all active:scale-75 ${isFavorite ? 'bg-accent text-white shadow-lg' : 'bg-black/40 text-white/70'}`}>
              <svg className="w-6 h-6" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
            </button>
          </div>

          <div className="text-center landscape:text-left">
            <h2 className="text-2xl md:text-3xl font-black truncate leading-tight">{song.title}</h2>
            <p className="text-sm font-bold opacity-40 uppercase tracking-widest mt-1">{song.artist}</p>
          </div>

          {/* Player Controls Docked Left (Landscape) */}
          <div className="space-y-6">
            <div className="flex items-center justify-center landscape:justify-start gap-8">
              <button onClick={onToggleShuffle} className={`p-2 transition-colors ${isShuffle ? 'text-accent' : 'opacity-20'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg></button>
              <button onClick={onPrev} className="opacity-40 hover:opacity-100 transition-all"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg></button>
              <button onClick={onToggle} className="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center shadow-xl active:scale-90 transition-all">
                {isPlaying ? <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
              </button>
              <button onClick={onNext} className="opacity-40 hover:opacity-100 transition-all"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg></button>
              <button onClick={onToggleRepeat} className={`p-2 transition-colors ${repeatMode !== 'off' ? 'text-accent' : 'opacity-20'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
            </div>

            {/* Wave Progress Bar */}
            <div className="relative group pt-4">
              <div className="relative h-12 w-full bg-white/5 rounded-2xl overflow-hidden cursor-pointer" onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                onSeek(((e.clientX - rect.left) / rect.width) * duration);
              }}>
                <canvas ref={waveCanvasRef} className="w-full h-full" />
              </div>
              <div className="flex justify-between mt-2 px-1 text-[10px] font-bold opacity-30 tracking-tighter">
                <span>{formatTime(progress)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>
          
          {/* Portrait-only Lyrics Preview */}
          <div className="landscape:hidden mt-4 bg-white/5 p-4 rounded-2xl cursor-pointer" onClick={() => setShowLyricsModal(true)}>
             <p className="text-[10px] font-black uppercase opacity-30 mb-2">Lyrics</p>
             <p className="text-sm font-bold line-clamp-1">{syncedLyrics[currentLineIndex]?.text || "Open lyrics..."}</p>
          </div>
        </div>
      </section>

      {/* RIGHT COLUMN: LYRICS & QUEUE (LANDSCAPE) / MODALS (PORTRAIT) */}
      <section className="relative flex-1 flex flex-col h-full bg-black/40 landscape:flex hidden">
        {/* Top Right Controls Dropdown */}
        <div className="absolute top-8 right-8 z-50">
          <button onClick={() => setShowDropdown(!showDropdown)} className="p-3 bg-white/5 rounded-full text-white shadow-xl hover:bg-white/10">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01"/></svg>
          </button>
          {showDropdown && (
            <div className="absolute right-0 mt-3 w-56 bg-zinc-900 border border-white/10 rounded-3xl p-2 shadow-2xl animate-in fade-in zoom-in-95">
              {!showSleepTimerMenu ? (
                <>
                  <button onClick={() => {onShowPlaylistModal(); setShowDropdown(false)}} className="w-full text-left p-4 hover:bg-white/5 rounded-2xl text-xs font-bold flex gap-3"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg> Add to Playlist</button>
                  <button onClick={() => {onDownload(); setShowDropdown(false)}} className="w-full text-left p-4 hover:bg-white/5 rounded-2xl text-xs font-bold flex gap-3"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> Download</button>
                  <button onClick={() => setShowSleepTimerMenu(true)} className="w-full text-left p-4 hover:bg-white/5 rounded-2xl text-xs font-bold flex gap-3"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Sleep Timer</button>
                </>
              ) : (
                <div className="p-2">
                  <button onClick={() => setShowSleepTimerMenu(false)} className="mb-2 text-[10px] font-black opacity-30 px-2 uppercase">← Back</button>
                  {[15, 30, 45, 60].map(m => (
                    <button key={m} onClick={() => {setSleepTimer(m*60); setShowDropdown(false)}} className="w-full text-left p-3 hover:bg-white/5 rounded-xl text-xs font-bold">{m} Minutes</button>
                  ))}
                  <button onClick={() => {setSleepTimer(null); setShowDropdown(false)}} className="w-full text-left p-3 hover:bg-white/5 rounded-xl text-xs font-bold text-red-500">Off</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tab Selection */}
        <div className="flex gap-8 px-10 pt-10 pb-6 shrink-0">
          <button onClick={() => setActiveTab('lyrics')} className={`text-sm font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'lyrics' ? 'text-white' : 'text-white/20'}`}>Lyrics</button>
          <button onClick={() => setActiveTab('queue')} className={`text-sm font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'queue' ? 'text-white' : 'text-white/20'}`}>Queue</button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-10 pb-20">
          {activeTab === 'lyrics' ? (
            <div className="space-y-10">
              {isLoadingLyrics ? <p className="opacity-20 animate-pulse font-black uppercase tracking-widest text-center mt-20">Syncing...</p> : 
                syncedLyrics.length > 0 ? syncedLyrics.map((l, i) => (
                  <p key={i} ref={i === currentLineIndex ? activeLyricRef : null} onClick={() => onSeek(l.time)} className={`text-3xl font-black transition-all cursor-pointer ${i === currentLineIndex ? 'text-white scale-105 opacity-100' : 'text-white/10 hover:text-white/30'}`}>{l.text || "•••"}</p>
                )) : plainLyrics.map((l, i) => <p key={i} className="text-xl font-bold text-white/30">{l}</p>)
              }
            </div>
          ) : (
            <div className="space-y-4">
              {queue.map((qs, i) => (
                <div key={qs.id} data-queue-index={i} className={`flex items-center gap-4 p-4 rounded-3xl border transition-all ${qs.id === song.id ? 'bg-white/10 border-white/20' : 'border-transparent hover:bg-white/5'}`}>
                  <img src={qs.artwork} className="w-12 h-12 rounded-xl object-cover shadow-lg" />
                  <div className="flex-1 min-w-0" onClick={() => onPlayFromQueue(qs)}>
                    <p className={`text-sm font-black truncate ${qs.id === song.id ? 'text-accent' : 'text-white'}`}>{qs.title}</p>
                    <p className="text-[10px] font-bold text-white/30 uppercase mt-0.5">{qs.artist}</p>
                  </div>
                  <button onClick={() => onRemoveFromQueue(qs.id)} className="p-2 opacity-20 hover:opacity-100 hover:text-red-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* PORTRAIT OVERLAY MODALS */}
      {/* LYRICS MODAL */}
      {showLyricsModal && (
        <div className="fixed inset-0 z-[300] bg-black animate-in slide-in-from-bottom duration-500 landscape:hidden">
          <div className="absolute inset-0 opacity-40 blur-[100px]" style={{ backgroundColor: dominantColor }} />
          <div className="relative h-full flex flex-col p-8">
             <header className="flex justify-between items-center mb-10">
                <h3 className="text-sm font-black uppercase tracking-widest text-white/40">Lyrics</h3>
                <button onClick={() => setShowLyricsModal(false)} className="p-2 bg-white/10 rounded-full"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg></button>
             </header>
             <div className="flex-1 overflow-y-auto no-scrollbar">
                <div className="space-y-8 pb-20">
                  {syncedLyrics.length > 0 ? syncedLyrics.map((l, i) => (
                    <p key={i} ref={i === currentLineIndex ? activeLyricRef : null} onClick={() => onSeek(l.time)} className={`text-3xl font-black transition-all ${i === currentLineIndex ? 'text-white' : 'text-white/10'}`}>{l.text || "•••"}</p>
                  )) : plainLyrics.map((l, i) => <p key={i} className="text-xl font-bold opacity-30">{l}</p>)}
                </div>
             </div>
          </div>
        </div>
      )}

      {/* QUEUE MODAL (Triggered via FAB/Swipe on Portrait) */}
      <button 
        onClick={() => setShowQueueModal(true)} 
        className="fixed bottom-8 right-8 z-[150] p-4 bg-white text-black rounded-full shadow-2xl active:scale-90 transition-all landscape:hidden"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M4 6h16M4 12h16m-7 6h7"/></svg>
      </button>

      {showQueueModal && (
        <div className="fixed inset-0 z-[300] bg-zinc-950 animate-in slide-in-from-bottom duration-500 landscape:hidden">
           <div className="h-full flex flex-col p-8">
             <header className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-white/40">Queue</h3>
                <button onClick={() => setShowQueueModal(false)} className="p-2 bg-white/10 rounded-full"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg></button>
             </header>
             <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
               {queue.map((qs, i) => (
                 <div key={qs.id} className="flex items-center gap-4 p-3 bg-white/5 rounded-2xl">
                    <img src={qs.artwork} className="w-10 h-10 rounded-lg" />
                    <div className="flex-1 min-w-0" onClick={() => {onPlayFromQueue(qs); setShowQueueModal(false)}}>
                       <p className="text-xs font-black truncate">{qs.title}</p>
                    </div>
                 </div>
               ))}
             </div>
           </div>
        </div>
      )}
      
      {/* Universal Close Trigger */}
      <button onClick={onClose} className="fixed top-8 left-8 hidden landscape:block p-3 bg-white/5 rounded-full hover:bg-white/10 transition-all z-[210]">
         <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
      </button>

    </div>
  );
};

export default PlayerFull;
