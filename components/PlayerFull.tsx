import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Song, Playlist } from '../types';

// --- HELPERS ---
const parseTimestamp = (lrc: string): number => {
  const match = lrc.match(/\[(\d+):(\d+(?:\.\d+)?)\]/);
  if (!match) return 0;
  return parseInt(match[1]) * 60 + parseFloat(match[2]);
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
  const [showLyricsModal, setShowLyricsModal] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);
  
  const [syncedLyrics, setSyncedLyrics] = useState<LyricLine[]>([]);
  const [plainLyrics, setPlainLyrics] = useState<string[]>([]);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  
  const activeLyricRef = useRef<HTMLParagraphElement>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);

  // --- LYRIC ENGINE ---
  useEffect(() => {
    const fetchLyrics = async () => {
      if (!song.title) return;
      setIsLoadingLyrics(true);
      try {
        const res = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(song.artist)}&track_name=${encodeURIComponent(song.title)}&duration=${Math.round(duration)}`);
        const data = await res.json();
        if (data.syncedLyrics) {
          setSyncedLyrics(data.syncedLyrics.split('\n').map((l: string) => ({
            time: parseTimestamp(l), text: l.replace(/\[.*\]/, '').trim()
          })).filter((l: any) => l.text !== undefined));
        } else {
            setPlainLyrics((data.plainLyrics || propLyrics).split('\n'));
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

  // --- WAVE PROGRESS VISUALIZER ---
  useEffect(() => {
    if (!waveCanvasRef.current) return;
    const canvas = waveCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let offset = 0;
    let animationId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { width, height } = canvas;
      const progressWidth = (progress / (duration || 1)) * width;
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x++) {
        const y = Math.sin(x * 0.02 + offset) * (isPlaying ? 6 : 2) + height / 2;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, progressWidth, height);
      ctx.clip();
      ctx.fillStyle = dominantColor;
      ctx.fill();
      ctx.restore();
      offset += 0.05;
      animationId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, progress, duration, dominantColor]);

  // --- GESTURE QUEUE HANDLING ---
  const dragItemRef = useRef<number | null>(null);
  const touchStartPos = useRef<{x: number, y: number} | null>(null);

  const handleQueueTouchStart = (e: React.TouchEvent, index: number) => {
    dragItemRef.current = index;
    touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleQueueTouchEnd = (e: React.TouchEvent, id: string) => {
    if (!touchStartPos.current) return;
    const deltaX = e.changedTouches[0].clientX - touchStartPos.current.x;
    if (Math.abs(deltaX) > 120) onRemoveFromQueue(id); // Swipe to delete
    dragItemRef.current = null;
    touchStartPos.current = null;
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black text-white flex flex-col landscape:flex-row overflow-hidden select-none font-sans">
      
      {/* Glossy Gradient Background */}
      <div className="absolute inset-0 opacity-30" style={{ background: `linear-gradient(135deg, ${dominantColor} 0%, #000 50%, ${dominantColor} 100%)` }} />
      <div className="absolute inset-0 backdrop-blur-[120px]" />

      {/* --- PORTRAIT / LEFT COLUMN (LANDSCAPE) --- */}
      <section className="relative flex-1 flex flex-col h-full z-10 landscape:max-w-[45%] landscape:border-r border-white/5 overflow-y-auto no-scrollbar">
        
        {/* Header Controls */}
        <header className="flex items-center justify-between p-6 shrink-0">
          <button onClick={onClose} className="p-3 bg-white/5 rounded-full hover:bg-white/10 active:scale-90 transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div className="flex gap-2">
             <button onClick={onDownload} className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg></button>
             <button onClick={onShowPlaylistModal} className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M12 4v16m8-8H4"/></svg></button>
             <button onClick={() => setSleepTimer(sleepTimer ? null : 1800)} className={`p-3 rounded-full transition-all ${sleepTimer ? 'bg-white text-black' : 'bg-white/5 text-white'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></button>
          </div>
        </header>

        {/* Hero Section (Artwork + Mini Lyrics) */}
        <div className="flex-1 flex flex-col px-8 gap-8 justify-center min-h-0">
          <div className="relative mx-auto w-full max-w-[340px] aspect-square group">
            <img src={song.artwork} className={`w-full h-full object-cover rounded-[40px] shadow-2xl transition-all duration-700 ${isPlaying ? 'scale-100 rotate-0' : 'scale-90 -rotate-2 opacity-40 blur-sm'}`} />
            {/* Controls Overlayed on Art (Landscape Friendly) */}
            <button 
              onClick={onToggleFavorite} 
              className="absolute bottom-6 left-6 p-4 rounded-3xl backdrop-blur-3xl shadow-2xl transition-all active:scale-75"
              style={{ backgroundColor: `${dominantColor}cc`, color: '#fff' }}
            >
              <svg className="w-6 h-6" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
            </button>
          </div>

          <div className="space-y-1 text-center landscape:text-left">
            <h2 className="text-3xl font-black tracking-tighter truncate">{song.title}</h2>
            <p className="text-sm font-bold opacity-30 uppercase tracking-[0.3em]">{song.artist}</p>
          </div>

          {/* Mini Lyrics Trigger */}
          <div 
            onClick={() => setShowLyricsModal(true)}
            className="bg-white/5 hover:bg-white/10 backdrop-blur-xl p-5 rounded-[32px] cursor-pointer transition-all active:scale-95 border border-white/5"
          >
            <p className="text-[9px] font-black uppercase opacity-30 mb-2 tracking-widest">Synced Lyrics</p>
            <p className="text-sm font-bold truncate leading-relaxed">
              {syncedLyrics[currentLineIndex]?.text || "No synced lyrics found..."}
            </p>
          </div>
        </div>

        {/* Persistent Controls Block */}
        <div className="p-8 space-y-6 shrink-0">
          <div className="relative">
            <div className="h-10 w-full bg-white/5 rounded-2xl overflow-hidden cursor-pointer" onClick={(e) => onSeek(((e.clientX - e.currentTarget.getBoundingClientRect().left) / e.currentTarget.offsetWidth) * duration)}>
              <canvas ref={waveCanvasRef} className="w-full h-full" />
            </div>
            <div className="flex justify-between mt-2 text-[10px] font-black opacity-30 px-1">
              <span>{formatTime(progress)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between px-2">
            <button onClick={onToggleShuffle} className={`p-2 ${isShuffle ? 'text-white' : 'opacity-20'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg></button>
            <div className="flex items-center gap-6">
              <button onClick={onPrev} className="active:scale-75 transition-all opacity-80"><svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg></button>
              <button onClick={onToggle} className="w-20 h-20 bg-white text-black rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all">
                {isPlaying ? <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg className="w-10 h-10 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
              </button>
              <button onClick={onNext} className="active:scale-75 transition-all opacity-80"><svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg></button>
            </div>
            <button onClick={() => setShowQueueModal(true)} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-all">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M4 6h16M4 12h16m-7 6h7"/></svg>
            </button>
          </div>
        </div>
      </section>

      {/* --- RIGHT COLUMN (LANDSCAPE) / MODAL SYSTEM --- */}
      <section className="hidden landscape:flex flex-1 flex-col h-full bg-black/20 backdrop-blur-md">
        <nav className="flex gap-8 p-10 pb-4 shrink-0">
          {(['lyrics', 'queue'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`text-sm font-black uppercase tracking-[0.3em] transition-all ${activeTab === t ? 'text-white' : 'opacity-20 hover:opacity-50'}`}>{t}</button>
          ))}
        </nav>
        <div className="flex-1 overflow-y-auto no-scrollbar px-10 pb-20">
          {activeTab === 'lyrics' ? (
            <div className="space-y-8 py-6">
              {syncedLyrics.length > 0 ? syncedLyrics.map((l, i) => (
                <p key={i} ref={i === currentLineIndex ? activeLyricRef : null} onClick={() => onSeek(l.time)} className={`text-4xl font-black transition-all cursor-pointer ${i === currentLineIndex ? 'text-white' : 'text-white/5 hover:text-white/20'}`}>{l.text || "•••"}</p>
              )) : plainLyrics.map((l, i) => <p key={i} className="text-xl font-bold opacity-20">{l}</p>)}
            </div>
          ) : (
             <div className="space-y-3 py-6">
               {queue.map((qs, i) => (
                 <div key={qs.id} data-queue-index={i} onTouchStart={(e) => handleQueueTouchStart(e, i)} onTouchEnd={(e) => handleQueueTouchEnd(e, qs.id)} className={`flex items-center gap-4 p-4 rounded-[32px] transition-all border ${qs.id === song.id ? 'bg-white/10 border-white/20' : 'border-transparent bg-white/5'}`}>
                   <img src={qs.artwork} className="w-12 h-12 rounded-xl object-cover" />
                   <div className="flex-1 min-w-0" onClick={() => onPlayFromQueue(qs)}>
                     <p className={`text-sm font-black truncate ${qs.id === song.id ? 'text-accent' : ''}`}>{qs.title}</p>
                     <p className="text-[10px] font-bold opacity-30 uppercase">{qs.artist}</p>
                   </div>
                 </div>
               ))}
             </div>
          )}
        </div>
      </section>

      {/* --- UNIVERSAL GESTURE MODALS --- */}
      {showLyricsModal && (
        <div className="fixed inset-0 z-[300] bg-black animate-in slide-in-from-bottom duration-500">
          <div className="absolute inset-0 opacity-40" style={{ background: `linear-gradient(to bottom, ${dominantColor}, #000)` }} />
          <div className="relative h-full flex flex-col px-8 pt-20 pb-10">
            <button onClick={() => setShowLyricsModal(false)} className="absolute top-8 right-8 p-3 bg-white/10 rounded-full"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg></button>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <div className="space-y-10 pb-32">
                {syncedLyrics.length > 0 ? syncedLyrics.map((l, i) => (
                  <p key={i} ref={i === currentLineIndex ? activeLyricRef : null} onClick={() => onSeek(l.time)} className={`text-4xl md:text-6xl font-black leading-tight transition-all ${i === currentLineIndex ? 'text-white' : 'text-white/10'}`}>{l.text || "•••"}</p>
                )) : plainLyrics.map((l, i) => <p key={i} className="text-2xl font-bold opacity-30">{l}</p>)}
              </div>
            </div>
          </div>
        </div>
      )}

      {showQueueModal && (
        <div className="fixed inset-0 z-[300] bg-zinc-950/90 backdrop-blur-3xl animate-in slide-in-from-bottom duration-500">
           <div className="relative h-full flex flex-col p-8">
              <header className="flex justify-between items-center mb-10">
                <h3 className="text-xs font-black uppercase tracking-[0.5em] opacity-40">Coming Up Next</h3>
                <button onClick={() => setShowQueueModal(false)} className="p-3 bg-white/5 rounded-full"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg></button>
              </header>
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-4">
                {queue.map((qs, i) => (
                  <div 
                    key={qs.id} 
                    data-queue-index={i}
                    onTouchStart={(e) => handleQueueTouchStart(e, i)}
                    onTouchEnd={(e) => handleQueueTouchEnd(e, qs.id)}
                    className="flex items-center gap-4 p-5 bg-white/5 rounded-[32px] border border-white/5 active:scale-95 transition-all"
                  >
                    <img src={qs.artwork} className="w-14 h-14 rounded-2xl" />
                    <div className="flex-1 min-w-0" onClick={() => { onPlayFromQueue(qs); setShowQueueModal(false); }}>
                      <p className="text-sm font-black truncate">{qs.title}</p>
                      <p className="text-[10px] font-bold opacity-30 uppercase">{qs.artist}</p>
                    </div>
                  </div>
                ))}
                <p className="text-center py-10 text-[9px] font-black opacity-20 uppercase tracking-widest">Swipe Left/Right to remove from queue</p>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default PlayerFull;
