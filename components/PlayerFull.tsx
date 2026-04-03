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
        } else { setPlainLyrics((data.plainLyrics || propLyrics).split('\n')); }
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
  }, [currentLineIndex, showLyricsModal, activeTab]);

  // --- HORIZON WAVE VISUALIZER (The Progress is the Wave) ---
  useEffect(() => {
    if (!waveCanvasRef.current) return;
    const canvas = waveCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let frame = 0;
    let animationId: number;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { width, height } = canvas;
      const progressPercent = progress / (duration || 1);
      const progressWidth = progressPercent * width;

      // Glow Effect
      ctx.shadowBlur = isPlaying ? 20 : 5;
      ctx.shadowColor = dominantColor;

      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += 2) {
        // Wave frequency and amplitude based on playing state
        const amplitude = isPlaying ? 14 : 4;
        const y = (height / 2) + Math.sin(x * 0.04 + frame) * amplitude;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);

      // Background Part (Unplayed)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fill();

      // Played Part (The Glowing Wave)
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, progressWidth, height);
      ctx.clip();
      ctx.fillStyle = dominantColor;
      ctx.fill();
      // White top edge for the wave "crest"
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      frame += isPlaying ? 0.08 : 0.02;
      animationId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, progress, duration, dominantColor]);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black text-white flex flex-col landscape:flex-row overflow-hidden font-sans select-none">
      
      {/* Immersive Background */}
      <div className="absolute inset-0 opacity-30 transition-all duration-1000" style={{ background: `linear-gradient(135deg, ${dominantColor} 0%, #000 50%, ${dominantColor} 100%)` }} />
      <div className="absolute inset-0 backdrop-blur-[120px]" />

      {/* --- LEFT COLUMN: COMPACT PRECISION PLAYER --- */}
      <section className="relative flex-1 flex flex-col h-full z-10 landscape:max-w-[320px] lg:landscape:max-w-[380px] landscape:border-r border-white/5 overflow-hidden">
        
        <header className="flex items-center justify-between p-6 shrink-0">
          <button onClick={onClose} className="p-2.5 bg-white/5 rounded-full hover:bg-white/10 active:scale-90 transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M15 19l-7-7 7-7"/></svg>
          </button>
          
          <div className="landscape:hidden flex gap-2">
             <button onClick={onDownload} className="p-2.5 bg-white/5 rounded-full"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m4 4V4"/></svg></button>
             <button onClick={() => setSleepTimer(sleepTimer ? null : 1800)} className={`p-2.5 rounded-full ${sleepTimer ? 'bg-white text-black' : 'bg-white/5'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></button>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-4 landscape:gap-6 min-h-0">
          {/* Smaller Landscape Art */}
          <div className="relative w-full max-w-[260px] landscape:max-w-[160px] aspect-square shrink-0">
            <img src={song.artwork} className={`w-full h-full object-cover rounded-[32px] shadow-2xl border border-white/5 transition-all duration-700 ${isPlaying ? 'scale-100' : 'scale-90 opacity-40'}`} />
            <button onClick={onToggleFavorite} className="absolute bottom-3 left-3 p-2.5 rounded-xl backdrop-blur-2xl transition-all active:scale-75 shadow-lg" style={{ backgroundColor: `${dominantColor}dd` }}>
              <svg className="w-5 h-5" fill={isFavorite ? "currentColor" : "none"} stroke="white" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
            </button>
          </div>

          <div className="text-center w-full space-y-1">
            <h2 className="text-xl landscape:text-lg font-black truncate leading-tight px-4">{song.title}</h2>
            <p className="text-[10px] landscape:text-[9px] font-bold opacity-30 uppercase tracking-[0.3em]">{song.artist}</p>
          </div>

          <div onClick={() => setShowLyricsModal(true)} className="landscape:hidden w-full bg-white/5 p-4 rounded-[24px] border border-white/5 active:scale-95 transition-all">
             <p className="text-[7px] font-black uppercase opacity-20 mb-1 tracking-widest text-center italic">Lyrics Preview</p>
             <p className="text-xs font-bold text-center truncate">{syncedLyrics[currentLineIndex]?.text || "•••"}</p>
          </div>
        </div>

        {/* COMPACT DOCK: Controls Aligned Left */}
        <div className="p-8 landscape:p-6 space-y-6 shrink-0 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center landscape:justify-start justify-center gap-4 landscape:gap-3">
            {/* Play/Prev/Next Group */}
            <div className="flex items-center gap-3">
              <button onClick={onPrev} className="p-2 opacity-60 active:scale-75"><svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg></button>
              <button onClick={onToggle} className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all">
                {isPlaying ? <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
              </button>
              <button onClick={onNext} className="p-2 opacity-60 active:scale-75"><svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg></button>
            </div>
            
            {/* Divider */}
            <div className="w-[1px] h-6 bg-white/10 mx-2 landscape:block hidden" />

            {/* Shuffle/Repeat Group */}
            <div className="flex items-center gap-2">
              <button onClick={onToggleShuffle} className={`p-2 transition-all ${isShuffle ? 'text-white' : 'opacity-20'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg></button>
              <button onClick={onToggleRepeat} className={`p-2 transition-all ${repeatMode !== 'off' ? 'text-white' : 'opacity-20'}`}>
                <div className="relative">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  {repeatMode === 'one' && <span className="absolute -top-1.5 -right-1.5 text-[6px] font-black bg-white text-black rounded-full w-3 h-3 flex items-center justify-center">1</span>}
                </div>
              </button>
            </div>
          </div>
          
          <button onClick={() => setShowQueueModal(true)} className="landscape:hidden w-full py-2 text-[9px] font-black uppercase tracking-[0.4em] opacity-20 border-t border-white/5 mt-4 pt-4">Queue</button>
        </div>
      </section>

      {/* --- RIGHT PANEL: DASHBOARD (UTILITIES TOP RIGHT) --- */}
      <section className="hidden landscape:flex flex-1 flex-col h-full bg-black/20 backdrop-blur-3xl relative">
        <nav className="flex items-center justify-between px-10 py-8 shrink-0">
          <div className="flex gap-8">
            {(['lyrics', 'queue'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`text-[10px] font-black uppercase tracking-[0.4em] transition-all ${activeTab === t ? 'text-white border-b-2 border-white pb-1' : 'opacity-20'}`}>{t}</button>
            ))}
          </div>
          
          <div className="flex gap-3 items-center">
             <button onClick={onDownload} className="p-2.5 bg-white/5 rounded-full hover:bg-white/10"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m4 4V4"/></svg></button>
             <button onClick={onShowPlaylistModal} className="p-2.5 bg-white/5 rounded-full hover:bg-white/10"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg></button>
             <div className="relative">
                <button onClick={() => setShowSleepDropdown(!showSleepDropdown)} className={`p-2.5 rounded-full ${sleepTimer ? 'bg-white text-black' : 'bg-white/5'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></button>
                {showSleepDropdown && (
                  <div className="absolute right-0 mt-3 w-40 bg-zinc-900 border border-white/10 rounded-2xl p-1 shadow-2xl z-50">
                    {[null, 60, 900, 1800].map(v => (
                      <button key={String(v)} onClick={() => {setSleepTimer(v); setShowSleepDropdown(false)}} className="w-full text-left p-3 hover:bg-white/5 rounded-xl text-[9px] font-bold uppercase tracking-widest">{v ? (v===60?'1 Min':v/60+' Min') : 'Off'}</button>
                    ))}
                  </div>
                )}
             </div>
          </div>
        </nav>

        <div className="flex-1 overflow-y-auto no-scrollbar px-10 pb-20">
          {activeTab === 'lyrics' ? (
            <div className="space-y-8 py-4">
              {syncedLyrics.length > 0 ? syncedLyrics.map((l, i) => (
                <p key={i} ref={i === currentLineIndex ? activeLyricRef : null} onClick={() => onSeek(l.time)} className={`text-3xl font-black transition-all cursor-pointer ${i === currentLineIndex ? 'text-white scale-105' : 'text-white/5'}`}>{l.text || "•••"}</p>
              )) : plainLyrics.map((l, i) => <p key={i} className="text-lg font-bold opacity-10 leading-relaxed">{l}</p>)}
            </div>
          ) : (
             <div className="space-y-2 py-4">
               {queue.map((qs, i) => (
                 <div key={qs.id} onDragStart={() => (dragItemRef.current = i)} onDragOver={(e) => { e.preventDefault(); if (dragItemRef.current !== null && dragItemRef.current !== i) { onMoveQueueItem(dragItemRef.current, i); dragItemRef.current = i; } }} className={`flex items-center gap-4 p-4 rounded-3xl transition-all border ${qs.id === song.id ? 'bg-white/10 border-white/20' : 'bg-white/5 border-transparent'}`}>
                   <img src={qs.artwork} className="w-10 h-10 rounded-xl" />
                   <div className="flex-1 min-w-0" onClick={() => onPlayFromQueue(qs)}><p className={`text-xs font-black truncate ${qs.id === song.id ? 'text-accent' : ''}`}>{qs.title}</p></div>
                   <button onClick={() => onRemoveFromQueue(qs.id)} className="p-2 opacity-20 hover:opacity-100"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6"/></svg></button>
                 </div>
               ))}
             </div>
          )}
        </div>
      </section>

      {/* --- GLOBAL HORIZON WAVE VISUALIZER (Progress Indicator) --- */}
      <div 
        className="fixed bottom-0 left-0 w-full h-4 landscape:h-6 z-[250] bg-white/[0.02] cursor-pointer overflow-hidden"
        onClick={(e) => onSeek(((e.clientX - e.currentTarget.getBoundingClientRect().left) / e.currentTarget.offsetWidth) * duration)}
      >
        <canvas ref={waveCanvasRef} className="w-full h-full" width={1200} height={40} />
      </div>

      {/* --- PORTRAIT MODALS --- */}
      {showLyricsModal && (
        <div className="fixed inset-0 z-[300] bg-black animate-in slide-in-from-bottom duration-500 landscape:hidden">
          <div className="absolute inset-0 opacity-40" style={{ background: `linear-gradient(to bottom, ${dominantColor}, #000)` }} />
          <div className="relative h-full flex flex-col p-8 pt-20">
            <button onClick={() => setShowLyricsModal(false)} className="absolute top-10 right-10 p-3 bg-white/10 rounded-full"><svg className="w-6 h-6" strokeWidth="3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6"/></svg></button>
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-8 pb-32">
                {syncedLyrics.length > 0 ? syncedLyrics.map((l, i) => (
                  <p key={i} ref={i === currentLineIndex ? activeLyricRef : null} onClick={() => onSeek(l.time)} className={`text-4xl font-black leading-tight transition-all ${i === currentLineIndex ? 'text-white' : 'text-white/10'}`}>{l.text || "•••"}</p>
                )) : plainLyrics.map((l, i) => <p key={i} className="text-xl font-bold opacity-10 leading-relaxed">{l}</p>)}
            </div>
          </div>
        </div>
      )}

      {showQueueModal && (
        <div className="fixed inset-0 z-[300] bg-[#080808] animate-in slide-in-from-bottom duration-500 landscape:hidden">
           <div className="relative h-full flex flex-col p-8 pt-20">
              <header className="flex justify-between items-center mb-8 px-4"><h3 className="text-[10px] font-black uppercase tracking-[0.5em] opacity-30">Queue</h3><button onClick={() => setShowQueueModal(false)} className="p-3 bg-white/10 rounded-full"><svg className="w-6 h-6" strokeWidth="3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6"/></svg></button></header>
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pb-32">
                {queue.map((qs, i) => (
                  <div key={qs.id} className="flex items-center gap-4 p-5 bg-white/5 rounded-[32px] border border-white/5">
                    <img src={qs.artwork} className="w-12 h-12 rounded-2xl" />
                    <div className="flex-1 min-w-0" onClick={() => {onPlayFromQueue(qs); setShowQueueModal(false);}}><p className="text-sm font-black truncate">{qs.title}</p></div>
                    <button onClick={() => onRemoveFromQueue(qs.id)} className="p-3 opacity-20"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6"/></svg></button>
                  </div>
                ))}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PlayerFull;
