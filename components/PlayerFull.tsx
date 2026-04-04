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

interface LyricLine {
  time: number;
  text: string;
}

interface PlayerFullProps {
  song: Song;
  isPlaying: boolean;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  dominantColor: string;
  progress: number;
  duration: number;
  onSeek: (val: number) => void;
  analyser: AnalyserNode | null;
  sleepTimer: number | null;
  setSleepTimer: (val: number | null) => void;
  queue: Song[];
  onPlayFromQueue: (song: Song) => void;
  lyrics: string;
  onRemoveFromQueue: (id: string) => void;
  onMoveQueueItem: (from: number, to: number) => void;
  playlists: Playlist[];
  onAddToPlaylist: (song: Song, playlistId: string) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onDownload: () => void;
  onShare: () => void;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  repeatMode: 'off' | 'one' | 'all';
  onToggleRepeat: () => void;
  onShowPlaylistModal: () => void;
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
  const touchStartRef = useRef<number | null>(null);

  useEffect(() => {
    const fetchLyrics = async () => {
      if (!song.title) return;
      setIsLoadingLyrics(true);
      setSyncedLyrics([]);
      setPlainLyrics([]);

      const cleanTitleStr = song.title.replace(/\s*[\(\[].*?[\)\]]\s*/g, '').trim();
      const artist = encodeURIComponent(song.artist);
      const title = encodeURIComponent(song.title);
      const simpleTitle = encodeURIComponent(cleanTitleStr);
      const dur = Math.round(duration);

      const processData = (data: any): boolean => {
        if (data && (data.syncedLyrics || data.plainLyrics || data.instrumental)) {
          if (data.syncedLyrics) {
            const lines = data.syncedLyrics.split('\n')
              .map((line: string) => ({
                time: parseTimestamp(line),
                text: line.replace(/\[.*\]/, '').trim()
              }))
              .filter((l: any) => l.text.length > 0 || l.text === "");
            setSyncedLyrics(lines);
          } else if (data.plainLyrics) {
            setPlainLyrics(data.plainLyrics.split('\n'));
          } else if (data.instrumental) {
            setPlainLyrics(["◆ Instrumental ◆"]);
          }
          return true;
        }
        return false;
      };

      try {
        const getRes = await fetch(`https://lrclib.net/api/get?artist_name=${artist}&track_name=${title}&duration=${dur}`);
        if (getRes.ok && processData(await getRes.json())) return;

        const searchRes = await fetch(`https://lrclib.net/api/search?track_name=${title}&artist_name=${artist}`);
        if (searchRes.ok) {
          const results = await searchRes.json();
          if (results?.length > 0) {
            const bestMatch = results.sort((a: any, b: any) => {
              if (a.syncedLyrics && !b.syncedLyrics) return -1;
              return Math.abs(a.duration - dur) - Math.abs(b.duration - dur);
            })[0];
            if (processData(bestMatch)) return;
          }
        }

        const broadRes = await fetch(`https://lrclib.net/api/search?q=${simpleTitle}`);
        if (broadRes.ok) {
          const broadResults = await broadRes.json();
          if (broadResults?.length > 0) {
            const bestBroadMatch = broadResults.sort((a: any, b: any) => {
              if (a.syncedLyrics && !b.syncedLyrics) return -1;
              return Math.abs(a.duration - dur) - Math.abs(b.duration - dur);
            })[0];
            if (processData(bestBroadMatch)) return;
          }
        }
        if (propLyrics) setPlainLyrics(propLyrics.split('\n'));
      } catch (e) {
        if (propLyrics) setPlainLyrics(propLyrics.split('\n'));
      } finally {
        setIsLoadingLyrics(false);
      }
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
    if (activeTab === 'lyrics' && activeLyricRef.current) {
      activeLyricRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentLineIndex, activeTab]);

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
      const barWidth = (canvas.width / bufferLength) * 2.2;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const val = dataArray[i];
        const barHeight = (val / 255) * canvas.height;
        const grad = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        grad.addColorStop(0, dominantColor.replace('rgb', 'rgba').replace(')', ', 0.1)'));
        grad.addColorStop(1, dominantColor.replace('rgb', 'rgba').replace(')', `, ${0.4 + (val/255) * 0.6})`));
        ctx.fillStyle = grad;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1.5;
      }
    };
    draw();
    return () => cancelAnimationFrame(animationId);
  }, [analyser, dominantColor]);

  const handleTouchStart = (e: React.TouchEvent) => touchStartRef.current = e.touches[0].clientX;
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return;
    const diff = touchStartRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 70) { diff > 0 ? onNext() : onPrev(); }
    touchStartRef.current = null;
  };

  const formatTime = (time: number) => {
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const progressPercent = (progress / (duration || 1)) * 100;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black overflow-hidden animate-in slide-in-from-bottom duration-700 cubic-bezier(0.23, 1, 0.32, 1)">
      <div className="absolute inset-0 opacity-40 blur-[200px] transition-all duration-1000 animate-pulse" style={{ background: `radial-gradient(circle at center, ${dominantColor}, transparent 80%)` }} />

      <div className="relative z-10 flex flex-col h-full px-6 pt-10 pb-4">
        <header className="flex justify-between items-center mb-4">
          <button onClick={onClose} className="p-2.5 bg-white/5 rounded-full text-white/70 active:scale-[0.85] transition-all hover:bg-white/10 shadow-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
          </button>
          <div className="flex-1 text-center">
            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-white/30 mb-0.5 leading-none">Zenisai</p>
            <p className="text-[10px] font-bold text-white/80 truncate max-w-[150px] mx-auto uppercase tracking-widest">{song.album}</p>
          </div>
          <div className="relative">
            <button onClick={() => { setShowDropdown(!showDropdown); setShowSleepTimerMenu(false); }} className={`p-2.5 bg-white/5 rounded-full text-white/70 active:scale-[0.85] transition-all hover:bg-white/10 ${showDropdown ? 'text-accent' : ''} shadow-lg`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
            </button>
            {showDropdown && (
              <div className="absolute right-0 top-12 w-44 bg-zinc-900/95 backdrop-blur-3xl border border-white/10 rounded-[28px] p-2 shadow-2xl z-50">
                {!showSleepTimerMenu ? (
                  <div className="space-y-1">
                    <button onClick={() => { onDownload(); setShowDropdown(false); }} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/10 text-[9px] font-black uppercase tracking-widest text-white/70">
                       Save
                    </button>
                    <button onClick={() => { onShowPlaylistModal(); setShowDropdown(false); }} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/10 text-[9px] font-black uppercase tracking-widest text-white/70">
                       Add
                    </button>
                    <button onClick={() => setShowSleepTimerMenu(true)} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/10 text-[9px] font-black uppercase tracking-widest text-white/70">
                       Sleep Timer
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <button onClick={() => setShowSleepTimerMenu(false)} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/10 text-[8px] font-black uppercase text-white/30 border-b border-white/5 mb-1">
                      Back
                    </button>
                    {[null, 900, 1800, 3600].map(val => (
                      <button key={String(val)} onClick={() => { setSleepTimer(val); setShowDropdown(false); }} className="w-full text-left p-2.5 rounded-xl hover:bg-white/10 text-[9px] font-black uppercase text-white/70">
                        {val === null ? 'Off' : `${val/60} Min`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative flex flex-col items-center">
          {activeTab === 'player' && (
            <div className="flex-1 flex flex-col w-full animate-in fade-in zoom-in-95 duration-700">
              {/* Artwork - Optimized Size */}
              <div className="flex-[4] flex items-center justify-center min-h-0 px-10">
                <div 
                  className="relative aspect-square w-full max-w-[210px] bg-white/[0.03] backdrop-blur-2xl rounded-[40px] p-3 border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.6)] select-none" 
                  onTouchStart={handleTouchStart} 
                  onTouchEnd={handleTouchEnd}
                >
                  <img 
                    src={song.artwork} 
                    className={`w-full h-full rounded-[28px] object-cover transition-all duration-1000 pointer-events-none ${isPlaying ? 'scale-100' : 'opacity-40 grayscale scale-95'}`} 
                    alt={song.title}
                  />
                  <button 
                    onClick={onToggleFavorite} 
                    className={`absolute top-6 right-6 p-2 rounded-full transition-all duration-500 shadow-lg ${isFavorite ? 'bg-accent text-white' : 'bg-black/50 text-white/40'}`}
                  >
                    <svg className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Dynamic Content Section - More Space Here */}
              <div className="flex-[5] flex flex-col items-center text-center px-8 w-full">
                <div className="mb-4">
                  <h2 className="text-2xl font-black tracking-tight truncate leading-tight text-white mb-0.5">
                    {song.title}
                  </h2>
                  <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.4em] truncate">
                    {song.artist}
                  </p>
                </div>

                {/* Lyric Card - Primary Focus */}
                <button 
                  onClick={() => setActiveTab('lyrics')}
                  className="w-full group relative overflow-hidden bg-white/[0.04] border border-white/5 rounded-[32px] p-6 transition-all duration-300 active:scale-[0.98] min-h-[140px] flex items-center justify-center"
                >
                  <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity" style={{ background: `radial-gradient(circle at center, ${dominantColor}, transparent 150%)` }} />
                  <div className="relative z-10 w-full">
                    {syncedLyrics.length > 0 && currentLineIndex !== -1 ? (
                      <p key={`synced-${currentLineIndex}`} className="text-xl font-bold text-white leading-tight break-words animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {syncedLyrics[currentLineIndex].text}
                      </p>
                    ) : plainLyrics.length > 0 ? (
                      <div className="space-y-1.5 opacity-60">
                        <p className="text-base font-bold text-white line-clamp-2">{plainLyrics[0]}</p>
                        {plainLyrics[1] && <p className="text-sm font-bold text-white/50 line-clamp-1">{plainLyrics[1]}</p>}
                      </div>
                    ) : (
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Lyrics</p>
                    )}
                  </div>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'lyrics' && (
            <div ref={lyricsScrollRef} className="h-full w-full overflow-y-auto no-scrollbar text-center py-16 animate-in slide-in-from-bottom-8 duration-700 select-none">
              <div className="space-y-10 px-10 pb-40">
                {isLoadingLyrics ? (
                   <p className="text-white/20 text-[10px] font-black uppercase animate-pulse tracking-widest">Searching...</p>
                ) : syncedLyrics.length > 0 ? (
                  syncedLyrics.map((line, i) => (
                    <p key={i} ref={i === currentLineIndex ? activeLyricRef : null} onClick={() => onSeek(line.time)} className={`text-2xl font-black transition-all duration-700 leading-tight cursor-pointer ${i === currentLineIndex ? 'text-white scale-110 opacity-100' : 'text-white/20 hover:text-white/40'}`}>
                      {line.text || "•••"}
                    </p>
                  ))
                ) : plainLyrics.length > 0 ? (
                  plainLyrics.map((l, i) => <p key={i} className="text-xl font-bold text-white/40 leading-relaxed py-2">{l}</p>)
                ) : (
                  <p className="text-white/20 text-[10px] font-black uppercase tracking-widest">Lyrics not found</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'queue' && (
            <div className="h-full w-full overflow-y-auto no-scrollbar py-4 animate-in slide-in-from-bottom-8 duration-700">
              <div className="space-y-2.5 pb-32 px-2">
                {queue.map((qs, i) => (
                    <div key={qs.id} data-queue-index={i} className={`flex items-center gap-4 p-3 rounded-[24px] border transition-all duration-300 ${qs.id === song.id ? 'bg-white/10 border-white/20' : 'bg-white/[0.02] border-white/5'}`}>
                      <img src={qs.artwork} className="w-10 h-10 rounded-lg object-cover" />
                      <div className="flex-1 min-w-0" onClick={() => onPlayFromQueue(qs)}>
                        <p className={`text-[12px] font-black truncate ${qs.id === song.id ? 'text-accent' : 'text-white'}`}>{qs.title}</p>
                        <p className="text-[8px] text-white/30 uppercase font-black tracking-widest">{qs.artist}</p>
                      </div>
                    </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer - Reduced Size Component */}
        <footer className="mt-4 space-y-4 bg-zinc-900/40 backdrop-blur-3xl rounded-[36px] p-3.5 border border-white/5 shadow-2xl">
          <div className="relative h-10 w-full bg-white/5 rounded-[16px] overflow-hidden group border border-white/5">
             <canvas ref={visualizerCanvasRef} width={400} height={40} className="absolute inset-0 w-full h-full opacity-30 pointer-events-none" />
             <div className="absolute h-full transition-all duration-300" style={{ width: `${progressPercent}%`, backgroundColor: dominantColor.replace('rgb', 'rgba').replace(')', ', 0.15)') }} />
             <input type="range" min="0" max={duration || 100} value={progress} onChange={(e) => onSeek(Number(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer" />
             <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none text-[9px] font-black text-white/25 uppercase tracking-widest">
               <span>{formatTime(progress)}</span>
               <span>{formatTime(duration)}</span>
             </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <button onClick={onToggleShuffle} className={`p-2 transition-all ${isShuffle ? 'text-accent' : 'text-white/20'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
            </button>
            <div className="flex items-center gap-5">
              <button onClick={onPrev} className="text-white/30 p-2 active:scale-90 transition-all"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg></button>
              <button onClick={onToggle} className="w-12 h-12 flex items-center justify-center bg-white text-black rounded-full active:scale-90 transition-all shadow-xl">
                {isPlaying ? <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg> : <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>}
              </button>
              <button onClick={onNext} className="text-white/30 p-2 active:scale-90 transition-all"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg></button>
            </div>
            <button onClick={onToggleRepeat} className={`p-2 transition-all ${repeatMode !== 'off' ? 'text-accent' : 'text-white/20'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          </div>

          <div className="flex bg-white/5 rounded-[22px] p-1 border border-white/5">
            {['player', 'lyrics', 'queue'].map(t => (
              <button key={t} onClick={() => setActiveTab(t as any)} className={`flex-1 py-2 rounded-[18px] text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-white text-black' : 'text-white/20'}`}>
                {t}
              </button>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
};

export default PlayerFull;
