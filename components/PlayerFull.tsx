import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Song, Playlist } from '../types';

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
  const [showSleepDropdown, setShowSleepDropdown] = useState(false);
  
  const [syncedLyrics, setSyncedLyrics] = useState<LyricLine[]>([]);
  const [plainLyrics, setPlainLyrics] = useState<string[]>([]);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  
  const activeLyricRef = useRef<HTMLParagraphElement>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragItemRef = useRef<number | null>(null);

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

  // --- REACTIVE WAVE VISUALIZER ---
  useEffect(() => {
    if (!waveCanvasRef.current) return;
    const canvas = waveCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animationId: number;
    let frame = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { width, height } = canvas;
      const progressWidth = (progress / (duration || 1)) * width;
      
      ctx.beginPath();
      ctx.moveTo(0, height);
      // Generate a more complex "jagged" wave
      for (let x = 0; x <= width; x += 5) {
        const amp = isPlaying ? 12 : 3;
        const noise = Math.sin(x * 0.05 + frame) * amp;
        const y = height / 2 + noise + Math.cos(x * 0.02 - frame) * (amp / 2);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, progressWidth, height);
      ctx.clip();
      ctx.fillStyle = dominantColor;
      ctx.fill();
      // Wave Glow
      ctx.shadowBlur = 15;
      ctx.shadowColor = dominantColor;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      frame += isPlaying ? 0.08 : 0.02;
      animationId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, progress, duration, dominantColor]);

  // --- DRAG & SWIPE QUEUE LOGIC ---
  const handleDragStart = (index: number) => { dragItemRef.current = index; };
  const handleDragOver = (index: number) => {
    if (dragItemRef.current === null || dragItemRef.current === index) return;
    onMoveQueueItem(dragItemRef.current, index);
    dragItemRef.current = index;
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black text-white flex flex-col landscape:flex-row overflow-hidden font-sans select-none">
      
      {/* Premium Glass Background */}
      <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at 0% 100%, ${dominantColor} 0%, transparent 50%), radial-gradient(circle at 100% 0%, ${dominantColor} 0%, transparent 50%)` }} />
      <div className="absolute inset-0 backdrop-blur-[150px]" />

      {/* LEFT COLUMN: FIXED PLAYER (PORTRAIT & LANDSCAPE) */}
      <section className="relative flex-1 flex flex-col h-full z-10 landscape:max-w-[40%] landscape:border-r border-white/5 overflow-hidden">
        
        {/* Header: Back & Title */}
        <header className="flex items-center justify-between p-6 shrink-0">
          <button onClick={onClose} className="p-3 bg-white/5 rounded-full active:scale-90 transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div className="landscape:hidden flex gap-2">
             <button onClick={() => setShowQueueModal(true)} className="p-3 bg-white/5 rounded-full"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M4 6h16M4 12h16m-7 6h7"/></svg></button>
          </div>
        </header>

        {/* Hero: Artwork & Metadata */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6 min-h-0">
          <div className="relative w-full max-w-[280px] landscape:max-w-[240px] aspect-square">
            <img src={song.artwork} className={`w-full h-full object-cover rounded-[48px] shadow-2xl transition-all duration-1000 ${isPlaying ? 'scale-100' : 'scale-90 opacity-40 grayscale'}`} />
            <button 
              onClick={onToggleFavorite} 
              className="absolute bottom-4 left-4 p-4 rounded-3xl backdrop-blur-2xl transition-all active:scale-75 shadow-lg"
              style={{ backgroundColor: `${dominantColor}dd`, color: '#fff' }}
            >
              <svg className="w-6 h-6" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
            </button>
          </div>

          <div className="text-center w-full">
            <h2 className="text-2xl font-black truncate px-4">{song.title}</h2>
            <p className="text-xs font-bold opacity-30 uppercase tracking-[0.4em] mt-1">{song.artist}</p>
          </div>

          {/* Portrait Lyrics Trigger */}
          <div onClick={() => setShowLyricsModal(true)} className="landscape:hidden w-full bg-white/5 p-4 rounded-[28px] border border-white/5 active:scale-95 transition-all">
             <p className="text-[8px] font-black uppercase opacity-20 mb-1 tracking-widest text-center">Lyrics Preview</p>
             <p className="text-sm font-bold text-center truncate">{syncedLyrics[currentLineIndex]?.text || "Taps to see lyrics..."}</p>
          </div>
        </div>

        {/* Bottom Dock: Universal Controls */}
        <div className="p-8 space-y-6 shrink-0 bg-gradient-to-t from-black/40 to-transparent">
          {/* Progress Bar */}
          <div className="relative h-12 w-full bg-white/5 rounded-2xl overflow-hidden cursor-pointer" onClick={(e) => onSeek(((e.clientX - e.currentTarget.getBoundingClientRect().left) / e.currentTarget.offsetWidth) * duration)}>
            <canvas ref={waveCanvasRef} className="w-full h-full" />
            <div className="absolute inset-0 flex justify-between items-center px-4 pointer-events-none text-[9px] font-black opacity-40">
              <span>{formatTime(progress)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button onClick={onToggleShuffle} className={`p-2 transition-all ${isShuffle ? 'text-white' : 'opacity-20'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg></button>
            <div className="flex items-center gap-6">
              <button onClick={onPrev} className="opacity-60 active:scale-75 transition-all"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg></button>
              <button onClick={onToggle} className="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all">
                {isPlaying ? <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
              </button>
              <button onClick={onNext} className="opacity-60 active:scale-75 transition-all"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg></button>
            </div>
            <button onClick={onToggleRepeat} className={`p-2 transition-all ${repeatMode !== 'off' ? 'text-white' : 'opacity-20'}`}>
              <div className="relative">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                {repeatMode === 'one' && <span className="absolute -top-1 -right-1 text-[7px] font-black bg-white text-black rounded-full w-3.5 h-3.5 flex items-center justify-center">1</span>}
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* --- RIGHT COLUMN: LANDSCAPE DASHBOARD --- */}
      <section className="hidden landscape:flex flex-1 flex-col h-full bg-black/20 backdrop-blur-xl">
        <nav className="flex items-center justify-between p-8 shrink-0">
          <div className="flex gap-8">
            {(['lyrics', 'queue'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`text-xs font-black uppercase tracking-[0.4em] transition-all ${activeTab === t ? 'text-white' : 'opacity-20'}`}>{t}</button>
            ))}
          </div>
          
          <div className="flex gap-4 items-center">
             <button onClick={onDownload} className="p-3 bg-white/5 rounded-full hover:bg-white/10"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg></button>
             <button onClick={onShowPlaylistModal} className="p-3 bg-white/5 rounded-full hover:bg-white/10"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M12 4v16m8-8H4"/></svg></button>
             
             <div className="relative">
                <button onClick={() => setShowSleepDropdown(!showSleepDropdown)} className={`p-3 rounded-full transition-all ${sleepTimer ? 'bg-white text-black' : 'bg-white/5 text-white'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></button>
                {showSleepDropdown && (
                  <div className="absolute right-0 mt-3 w-40 bg-zinc-900 border border-white/10 rounded-2xl p-2 shadow-2xl z-50">
                    {[null, 60, 900, 1800].map(val => (
                      <button key={String(val)} onClick={() => {setSleepTimer(val); setShowSleepDropdown(false)}} className="w-full text-left p-3 hover:bg-white/5 rounded-xl text-[10px] font-bold uppercase tracking-widest">
                        {val === null ? 'Off' : val === 60 ? '60 Sec' : `${val/60} Min`}
                      </button>
                    ))}
                  </div>
                )}
             </div>
          </div>
        </nav>

        <div className="flex-1 overflow-y-auto no-scrollbar px-10 pb-10">
          {activeTab === 'lyrics' ? (
            <div className="space-y-8">
              {syncedLyrics.length > 0 ? syncedLyrics.map((l, i) => (
                <p key={i} ref={i === currentLineIndex ? activeLyricRef : null} onClick={() => onSeek(l.time)} className={`text-4xl font-black transition-all cursor-pointer ${i === currentLineIndex ? 'text-white' : 'text-white/5 hover:text-white/15'}`}>{l.text || "•••"}</p>
              )) : plainLyrics.map((l, i) => <p key={i} className="text-xl font-bold opacity-10 leading-relaxed">{l}</p>)}
            </div>
          ) : (
             <div className="space-y-2">
               {queue.map((qs, i) => (
                 <div 
                   key={qs.id} 
                   draggable 
                   onDragStart={() => handleDragStart(i)} 
                   onDragOver={() => handleDragOver(i)}
                   className={`flex items-center gap-4 p-4 rounded-3xl transition-all cursor-move border ${qs.id === song.id ? 'bg-white/10 border-white/20' : 'bg-white/5 border-transparent'}`}
                 >
                   <img src={qs.artwork} className="w-10 h-10 rounded-xl" />
                   <div className="flex-1 min-w-0" onClick={() => onPlayFromQueue(qs)}>
                     <p className={`text-sm font-black truncate ${qs.id === song.id ? 'text-accent' : ''}`}>{qs.title}</p>
                     <p className="text-[10px] font-bold opacity-30 uppercase">{qs.artist}</p>
                   </div>
                   <button onClick={() => onRemoveFromQueue(qs.id)} className="p-2 opacity-20 hover:opacity-100 hover:text-red-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg></button>
                 </div>
               ))}
             </div>
          )}
        </div>
      </section>

      {/* --- MODALS --- */}
      {showLyricsModal && (
        <div className="fixed inset-0 z-[300] bg-black animate-in slide-in-from-bottom duration-500 landscape:hidden">
          <div className="absolute inset-0 opacity-40" style={{ background: `linear-gradient(to bottom, ${dominantColor}, #000)` }} />
          <div className="relative h-full flex flex-col p-8 pt-20">
            <button onClick={() => setShowLyricsModal(false)} className="absolute top-8 right-8 p-3 bg-white/10 rounded-full"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M6 18L18 6"/></svg></button>
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-8">
                {syncedLyrics.length > 0 ? syncedLyrics.map((l, i) => (
                  <p key={i} ref={i === currentLineIndex ? activeLyricRef : null} onClick={() => onSeek(l.time)} className={`text-4xl font-black transition-all ${i === currentLineIndex ? 'text-white' : 'text-white/10'}`}>{l.text || "•••"}</p>
                )) : plainLyrics.map((l, i) => <p key={i} className="text-xl font-bold opacity-10 leading-relaxed">{l}</p>)}
            </div>
          </div>
        </div>
      )}

      {showQueueModal && (
        <div className="fixed inset-0 z-[300] bg-zinc-950 animate-in slide-in-from-bottom duration-500 landscape:hidden">
           <div className="h-full flex flex-col p-8">
              <header className="flex justify-between items-center mb-8">
                <h3 className="text-xs font-black uppercase tracking-widest opacity-30 text-white">Up Next</h3>
                <button onClick={() => setShowQueueModal(false)} className="p-3 bg-white/10 rounded-full"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M6 18L18 6"/></svg></button>
              </header>
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pb-10">
                {queue.map((qs, i) => (
                  <div key={qs.id} draggable onDragStart={() => handleDragStart(i)} onDragOver={() => handleDragOver(i)} className="flex items-center gap-4 p-4 bg-white/5 rounded-3xl active:scale-95 transition-all">
                    <img src={qs.artwork} className="w-12 h-12 rounded-xl" />
                    <div className="flex-1 min-w-0" onClick={() => {onPlayFromQueue(qs); setShowQueueModal(false);}}>
                      <p className="text-sm font-black truncate">{qs.title}</p>
                    </div>
                    <button onClick={() => onRemoveFromQueue(qs.id)} className="p-2 opacity-20"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M6 18L18 6"/></svg></button>
                  </div>
                ))}
                <p className="text-center opacity-10 text-[8px] font-black uppercase mt-10">Press and hold to reorder</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PlayerFull;
