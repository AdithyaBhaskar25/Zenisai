import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Song, Playlist } from '../types';

const parseTimestamp = (lrcTimestamp: string): number => {
  const match = lrcTimestamp.match(/\[(\d+):(\d+(?:\.\d+)?)\]/);
  if (!match) return 0;
  const minutes = parseInt(match[1]);
  const seconds = parseFloat(match[2]);
  return minutes * 60 + seconds;
};

interface LyricLine { time: number; text: string; }

interface PlayerFullProps {
  song: Song; isPlaying: boolean; onToggle: () => void; onNext: () => void; onPrev: () => void; onClose: () => void;
  dominantColor: string; progress: number; duration: number; onSeek: (val: number) => void; analyser: AnalyserNode | null;
  sleepTimer: number | null; setSleepTimer: (val: number | null) => void; queue: Song[]; onPlayFromQueue: (song: Song) => void;
  lyrics: string; onRemoveFromQueue: (id: string) => void; onMoveQueueItem: (from: number, to: number) => void;
  playlists: Playlist[]; onAddToPlaylist: (song: Song, playlistId: string) => void; isFavorite: boolean;
  onToggleFavorite: () => void; onDownload: () => void; onShare: () => void; isShuffle: boolean;
  onToggleShuffle: () => void; repeatMode: 'off' | 'one' | 'all'; onToggleRepeat: () => void; onShowPlaylistModal: () => void;
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
  const dragItemRef = useRef<number | null>(null);
  const touchStartRef = useRef<number | null>(null);

  // --- SWIPE NAVIGATION ---
  const handleTouchStart = (e: React.TouchEvent) => { touchStartRef.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return;
    const diff = touchStartRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 70) { diff > 0 ? onNext() : onPrev(); }
    touchStartRef.current = null;
  };

  // --- VISUALIZER LOGIC (Restored) ---
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
        ctx.fillStyle = dominantColor.replace('rgb', 'rgba').replace(')', `, ${0.2 + (dataArray[i]/255) * 0.4})`);
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };
    draw();
    return () => cancelAnimationFrame(animationId);
  }, [analyser, dominantColor]);

  // --- LYRIC FETCHING ---
  useEffect(() => {
    const fetchLyrics = async () => {
      if (!song.title) return;
      setIsLoadingLyrics(true);
      try {
        const res = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(song.artist)}&track_name=${encodeURIComponent(song.title)}&duration=${Math.round(duration)}`);
        const data = await res.json();
        if (data.syncedLyrics) {
          setSyncedLyrics(data.syncedLyrics.split('\n').map((line: string) => ({
            time: parseTimestamp(line), text: line.replace(/\[.*\]/, '').trim()
          })).filter((l: any) => l.text.length > 0));
        } else if (data.plainLyrics) {
          setPlainLyrics(data.plainLyrics.split('\n'));
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

  const formatTime = (t: number) => `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}`;

  return (
    <div 
      className="fixed inset-0 z-[200] flex flex-col bg-black overflow-hidden animate-in slide-in-from-bottom duration-700"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="absolute inset-0 opacity-30 blur-[120px]" style={{ background: `radial-gradient(circle at center, ${dominantColor}, transparent 70%)` }} />

      <div className="relative z-10 flex flex-col h-full px-6 pt-10 pb-4">
        <header className="flex justify-between items-center h-10 mb-4">
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full"><svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" /></svg></button>
          <div className="text-center flex-1 px-4"><p className="text-[10px] font-bold text-white/70 truncate uppercase tracking-widest">{song.album || 'Zenisai'}</p></div>
          <div className="relative">
            <button onClick={() => { setShowDropdown(!showDropdown); setShowSleepTimerMenu(false); }} className="p-2 bg-white/5 rounded-full"><svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v.01M12 12v.01M12 19v.01" /></svg></button>
            {showDropdown && (
              <div className="absolute right-0 top-12 w-52 bg-zinc-900 border border-white/10 rounded-2xl p-2 shadow-2xl z-50">
                {!showSleepTimerMenu ? (
                  <div className="space-y-1">
                    <button onClick={() => { onDownload(); setShowDropdown(false); }} className="w-full flex items-center gap-3 p-3 text-[10px] font-bold uppercase text-white/70 hover:bg-white/5 rounded-xl"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> Save Track</button>
                    <button onClick={() => { onShowPlaylistModal(); setShowDropdown(false); }} className="w-full flex items-center gap-3 p-3 text-[10px] font-bold uppercase text-white/70 hover:bg-white/5 rounded-xl"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg> Add to Playlist</button>
                    <button onClick={() => setShowSleepTimerMenu(true)} className={`w-full flex items-center gap-3 p-3 text-[10px] font-bold uppercase rounded-xl transition-colors ${sleepTimer ? 'text-accent bg-accent/10' : 'text-white/70 hover:bg-white/5'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0" /></svg> Sleep Timer</button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <button onClick={() => setShowSleepTimerMenu(false)} className="w-full p-2 text-[8px] font-black uppercase text-white/30 border-b border-white/5 mb-1">Back</button>
                    {[null, 60, 900, 1800, 3600].map((v) => (
                      <button key={String(v)} onClick={() => { setSleepTimer(v); setShowDropdown(false); }} className={`w-full text-left p-3 text-[10px] font-bold uppercase rounded-xl ${sleepTimer === v ? 'text-accent' : 'text-white/70 hover:bg-white/5'}`}>{v === null ? 'Off' : v === 60 ? '60 Seconds' : `${v/60} Minutes`}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 flex flex-col min-h-0">
          {activeTab === 'player' && (
            <div className="h-full flex flex-col">
              <div className="flex-[5] flex items-center justify-center min-h-0">
                <div className="relative aspect-square w-full max-w-[240px] bg-white/[0.03] rounded-[48px] p-3 border border-white/10">
                  <img src={song.artwork} className={`w-full h-full rounded-[36px] object-cover transition-all duration-700 ${isPlaying ? 'scale-100' : 'scale-95 opacity-50'}`} alt="" />
                  <button onClick={onToggleFavorite} className={`absolute top-6 right-6 p-2.5 rounded-full transition-all ${isFavorite ? 'bg-accent text-white' : 'bg-black/50 text-white/40'}`}><svg className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg></button>
                </div>
              </div>

              <div className="flex-[4] flex flex-col items-center justify-center text-center px-4 min-h-0">
                <div className="mb-4 w-full">
                  <h2 className="text-xl font-black tracking-tight text-white truncate px-2">{song.title}</h2>
                  <p className="text-[9px] text-white/40 font-black uppercase tracking-[0.3em] truncate">{song.artist}</p>
                </div>
                <button onClick={() => setActiveTab('lyrics')} className="w-full bg-white/[0.04] border border-white/5 rounded-[32px] p-5 h-28 flex items-center justify-center relative active:scale-95 transition-all">
                   <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at center, ${dominantColor}, transparent 120%)` }} />
                   <div className="relative z-10 w-full px-2">
                    {syncedLyrics.length > 0 && currentLineIndex !== -1 ? (
                      <p key={currentLineIndex} className="text-base font-bold text-white leading-tight animate-in fade-in slide-in-from-bottom-2 line-clamp-2">{syncedLyrics[currentLineIndex].text}</p>
                    ) : plainLyrics.length > 0 ? (
                      <p className="text-sm font-bold text-white/40 line-clamp-2">{plainLyrics[0]}</p>
                    ) : (
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Lyrics Unavailable</p>
                    )}
                   </div>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'queue' && (
            <div className="h-full overflow-y-auto no-scrollbar" onTouchMove={(e) => {
              if (dragItemRef.current === null) return;
              const target = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
              const row = target?.closest('[data-queue-index]');
              if (row) {
                const targetIndex = parseInt(row.getAttribute('data-queue-index') || '-1');
                if (targetIndex !== -1 && targetIndex !== dragItemRef.current) {
                  onMoveQueueItem(dragItemRef.current, targetIndex);
                  dragItemRef.current = targetIndex; 
                }
              }
            }} onTouchEnd={() => dragItemRef.current = null}>
              <div className="space-y-2 pb-10">
                {queue.map((qs, i) => (
                  <div key={qs.id} data-queue-index={i} className={`flex items-center gap-3 p-3 rounded-[24px] border transition-all ${qs.id === song.id ? 'bg-white/10 border-white/20' : 'bg-white/[0.03] border-white/5'}`}>
                    <div className="p-1.5 text-white/20 touch-none" onTouchStart={() => dragItemRef.current = i}><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M4 8h16M4 16h16" /></svg></div>
                    <img src={qs.artwork} className="w-10 h-10 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0" onClick={() => onPlayFromQueue(qs)}>
                      <p className={`text-xs font-black truncate ${qs.id === song.id ? 'text-accent' : 'text-white'}`}>{qs.title}</p>
                      <p className="text-[8px] text-white/30 font-black uppercase truncate">{qs.artist}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); onRemoveFromQueue(qs.id); }} className="p-2 text-white/20 hover:text-red-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'lyrics' && (
             <div className="h-full overflow-y-auto no-scrollbar text-center py-6">
               <div className="space-y-8 px-6 pb-20">
                 {syncedLyrics.length > 0 ? syncedLyrics.map((l, i) => (
                   <p key={i} onClick={() => onSeek(l.time)} className={`text-xl font-black transition-all ${i === currentLineIndex ? 'text-white scale-110' : 'text-white/20'}`}>{l.text}</p>
                 )) : plainLyrics.map((l, i) => <p key={i} className="text-lg font-bold text-white/30 py-1">{l}</p>)}
               </div>
             </div>
          )}
        </main>

        <footer className="mt-4 space-y-4 bg-zinc-900/40 backdrop-blur-2xl rounded-[36px] p-5 border border-white/5 shadow-2xl">
          <div className="relative h-9 w-full bg-white/5 rounded-[18px] overflow-hidden">
            <canvas ref={visualizerCanvasRef} width={400} height={36} className="absolute inset-0 w-full h-full opacity-40 pointer-events-none" />
            <div className="absolute h-full transition-all duration-300" style={{ width: `${(progress / (duration || 1)) * 100}%`, backgroundColor: `${dominantColor}33` }} />
            <input type="range" min="0" max={duration || 100} value={progress} onChange={(e) => onSeek(Number(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer" />
            <div className="absolute inset-0 flex items-center justify-between px-5 pointer-events-none text-[8px] font-black text-white/30 uppercase tracking-widest">
              <span>{formatTime(progress)}</span><span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <button onClick={onToggleShuffle} className={`p-2 transition-all ${isShuffle ? 'text-accent' : 'text-white/20'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg></button>
            <div className="flex items-center gap-6">
              <button onClick={onPrev} className="text-white/30 p-1.5 active:scale-75 transition-all"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg></button>
              <button onClick={onToggle} className="w-12 h-12 flex items-center justify-center bg-white text-black rounded-full active:scale-90 transition-all shadow-xl">{isPlaying ? <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg> : <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>}</button>
              <button onClick={onNext} className="text-white/30 p-1.5 active:scale-75 transition-all"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg></button>
            </div>
            <button onClick={onToggleRepeat} className={`p-2 transition-all ${repeatMode !== 'off' ? 'text-accent' : 'text-white/20'}`}>
              <div className="relative">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                {repeatMode === 'one' && <span className="absolute -top-1 -right-1 text-[7px] font-bold bg-accent text-white rounded-full w-3 h-3 flex items-center justify-center border border-zinc-900">1</span>}
              </div>
            </button>
          </div>

          <div className="flex bg-white/5 rounded-[20px] p-1 border border-white/5">
            {['player', 'lyrics', 'queue'].map(t => (
              <button key={t} onClick={() => setActiveTab(t as any)} className={`flex-1 py-2 rounded-[16px] text-[8px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === t ? 'bg-white text-black shadow-lg' : 'text-white/20'}`}>{t}</button>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
};

export default PlayerFull;
