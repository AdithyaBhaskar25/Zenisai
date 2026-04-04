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

  // --- LYRIC FETCHING ---
  useEffect(() => {
    const fetchLyrics = async () => {
      if (!song.title) return;
      setIsLoadingLyrics(true);
      const cleanTitleStr = song.title.replace(/\s*[\(\[].*?[\)\]]\s*/g, '').trim();
      const artist = encodeURIComponent(song.artist);
      const title = encodeURIComponent(song.title);
      const dur = Math.round(duration);

      const processData = (data: any): boolean => {
        if (data && (data.syncedLyrics || data.plainLyrics)) {
          if (data.syncedLyrics) {
            setSyncedLyrics(data.syncedLyrics.split('\n').map((line: string) => ({
              time: parseTimestamp(line), text: line.replace(/\[.*\]/, '').trim()
            })).filter((l: any) => l.text.length > 0));
          } else if (data.plainLyrics) {
            setPlainLyrics(data.plainLyrics.split('\n'));
          }
          return true;
        }
        return false;
      };

      try {
        const res = await fetch(`https://lrclib.net/api/get?artist_name=${artist}&track_name=${title}&duration=${dur}`);
        if (res.ok && processData(await res.json())) return;
        if (propLyrics) setPlainLyrics(propLyrics.split('\n'));
      } catch (e) {
        if (propLyrics) setPlainLyrics(propLyrics.split('\n'));
      } finally { setIsLoadingLyrics(false); }
    };
    fetchLyrics();
  }, [song.id, duration]);

  const currentLineIndex = useMemo(() => {
    for (let i = syncedLyrics.length - 1; i >= 0; i--) {
      if (progress >= syncedLyrics[i].time) return i;
    }
    return -1;
  }, [syncedLyrics, progress]);

  // --- QUEUE GESTURES ---
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
    <div className="fixed inset-0 z-[200] flex flex-col bg-black overflow-hidden animate-in slide-in-from-bottom duration-700">
      <div className="absolute inset-0 opacity-40 blur-[150px]" style={{ background: `radial-gradient(circle at center, ${dominantColor}, transparent 80%)` }} />

      <div className="relative z-10 flex flex-col h-full px-6 pt-12 pb-6">
        <header className="flex justify-between items-center h-12">
          <button onClick={onClose} className="p-3 bg-white/5 rounded-full text-white/70 active:scale-90 transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg></button>
          <div className="text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Zenisai</p>
            <p className="text-[11px] font-bold text-white/80 truncate max-w-[180px]">{song.album}</p>
          </div>
          <div className="relative">
            <button onClick={() => { setShowDropdown(!showDropdown); setShowSleepTimerMenu(false); }} className="p-3 bg-white/5 rounded-full text-white/70"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg></button>
            {showDropdown && (
              <div className="absolute right-0 top-14 w-52 bg-zinc-900/95 backdrop-blur-3xl border border-white/10 rounded-[32px] p-2 shadow-2xl z-50">
                {!showSleepTimerMenu ? (
                  <div className="space-y-1">
                    <button onClick={() => { onDownload(); setShowDropdown(false); }} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/10 text-[10px] font-black uppercase text-white/70">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> Download
                    </button>
                    <button onClick={() => { onShowPlaylistModal(); setShowDropdown(false); }} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/10 text-[10px] font-black uppercase text-white/70">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg> Add to Playlist
                    </button>
                    <button onClick={() => setShowSleepTimerMenu(true)} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/10 text-[10px] font-black uppercase text-white/70">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Sleep Timer
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <button onClick={() => setShowSleepTimerMenu(false)} className="w-full p-2 text-[9px] font-black uppercase text-white/30 text-center border-b border-white/5 mb-1">Back</button>
                    {[15, 30, 60].map(m => (
                      <button key={m} onClick={() => { setSleepTimer(m * 60); setShowDropdown(false); }} className="w-full p-3 rounded-2xl text-[10px] font-black uppercase text-white/70 hover:bg-white/10">{m} Minutes</button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 flex flex-col min-h-0 py-6">
          {activeTab === 'player' && (
            <div className="h-full flex flex-col justify-between">
              {/* Artwork Section (Flexible but Prominent) */}
              <div className="flex-[4] flex items-center justify-center min-h-0">
                <div className="relative aspect-square w-full max-w-[280px] bg-white/[0.03] backdrop-blur-2xl rounded-[56px] p-4 border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.7)]">
                  <img src={song.artwork} className={`w-full h-full rounded-[42px] object-cover transition-all duration-1000 ${isPlaying ? 'scale-100' : 'scale-90 opacity-40'}`} alt="" />
                  <button onClick={onToggleFavorite} className={`absolute top-8 right-8 p-3 rounded-full transition-all ${isFavorite ? 'bg-accent text-white' : 'bg-black/50 text-white/40'}`}><svg className="w-5 h-5" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg></button>
                </div>
              </div>

              {/* Info & Lyrics Section (Balanced middle) */}
              <div className="flex-[3] flex flex-col items-center justify-center text-center px-4">
                <h2 className="text-3xl font-black tracking-tight text-white line-clamp-1 mb-1">{song.title}</h2>
                <p className="text-[11px] text-white/40 font-black uppercase tracking-[0.5em] mb-8">{song.artist}</p>

                <button onClick={() => setActiveTab('lyrics')} className="w-full bg-white/[0.04] border border-white/5 rounded-[40px] p-7 min-h-[160px] flex items-center justify-center relative group active:scale-[0.98] transition-all">
                  <div className="absolute inset-0 opacity-20 transition-opacity" style={{ background: `radial-gradient(circle at center, ${dominantColor}, transparent 160%)` }} />
                  <div className="relative z-10">
                    {syncedLyrics.length > 0 && currentLineIndex !== -1 ? (
                      <p key={currentLineIndex} className="text-xl font-bold text-white leading-tight animate-in fade-in slide-in-from-bottom-2 duration-500 line-clamp-3">{syncedLyrics[currentLineIndex].text}</p>
                    ) : plainLyrics.length > 0 ? (
                      <div className="opacity-50 text-base font-bold text-white space-y-1"><p>{plainLyrics[0]}</p><p className="text-sm opacity-50">{plainLyrics[1]}</p></div>
                    ) : (
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Lyrics</p>
                    )}
                  </div>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'queue' && (
            <div className="h-full overflow-y-auto no-scrollbar" onTouchMove={handleQueueTouchMove} onTouchEnd={() => dragItemRef.current = null}>
              <div className="space-y-3 pb-20">
                {queue.map((qs, i) => (
                  <div key={qs.id} data-queue-index={i} className={`flex items-center gap-4 p-4 rounded-[32px] border transition-all ${qs.id === song.id ? 'bg-white/10 border-white/20' : 'bg-white/[0.03] border-white/5'}`}>
                    <div className="p-2 text-white/20 touch-none" onTouchStart={() => dragItemRef.current = i}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 8h16M4 16h16" /></svg></div>
                    <img src={qs.artwork} className="w-12 h-12 rounded-xl object-cover" alt="" />
                    <div className="flex-1 min-w-0" onClick={() => onPlayFromQueue(qs)}>
                      <p className={`text-sm font-black truncate ${qs.id === song.id ? 'text-accent' : 'text-white'}`}>{qs.title}</p>
                      <p className="text-[10px] text-white/30 font-black uppercase tracking-widest">{qs.artist}</p>
                    </div>
                    <button onClick={() => onRemoveQueueItem(qs.id)} className="p-2 text-white/10 hover:text-red-500 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Main Lyrics Tab Logic (Keep existing) */}
          {activeTab === 'lyrics' && (
             <div className="h-full overflow-y-auto no-scrollbar text-center py-10">
               <div className="space-y-10 px-10 pb-40">
                 {syncedLyrics.length > 0 ? syncedLyrics.map((l, i) => (
                   <p key={i} onClick={() => onSeek(l.time)} className={`text-2xl font-black transition-all duration-700 ${i === currentLineIndex ? 'text-white scale-110' : 'text-white/20'}`}>{l.text}</p>
                 )) : plainLyrics.map((l, i) => <p key={i} className="text-xl font-bold text-white/40 py-2">{l}</p>)}
               </div>
             </div>
          )}
        </main>

        <footer className="mt-4 space-y-6 bg-zinc-900/40 backdrop-blur-3xl rounded-[48px] p-6 border border-white/5 shadow-2xl">
          <div className="relative h-12 w-full bg-white/5 rounded-[22px] overflow-hidden border border-white/5">
            <div className="absolute h-full transition-all duration-300" style={{ width: `${(progress / (duration || 1)) * 100}%`, backgroundColor: `${dominantColor}33` }} />
            <input type="range" min="0" max={duration || 100} value={progress} onChange={(e) => onSeek(Number(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer" />
            <div className="absolute inset-0 flex items-center justify-between px-6 pointer-events-none text-[10px] font-black text-white/30 tracking-[0.2em]">
              <span>{formatTime(progress)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between px-2">
            <button onClick={onToggleShuffle} className={`p-2 ${isShuffle ? 'text-accent' : 'text-white/20'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg></button>
            <div className="flex items-center gap-6">
              <button onClick={onPrev} className="text-white/30 p-2 active:scale-90 transition-all"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg></button>
              <button onClick={onToggle} className="w-16 h-16 flex items-center justify-center bg-white text-black rounded-full active:scale-95 transition-all shadow-xl">{isPlaying ? <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg> : <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>}</button>
              <button onClick={onNext} className="text-white/30 p-2 active:scale-90 transition-all"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg></button>
            </div>
            <button onClick={onToggleRepeat} className={`p-2 ${repeatMode !== 'off' ? 'text-accent' : 'text-white/20'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
          </div>

          <div className="flex bg-white/5 rounded-[28px] p-1.5 border border-white/5">
            {['player', 'lyrics', 'queue'].map(t => (
              <button key={t} onClick={() => setActiveTab(t as any)} className={`flex-1 py-3 rounded-[22px] text-[10px] font-black uppercase tracking-[0.3em] transition-all ${activeTab === t ? 'bg-white text-black shadow-lg' : 'text-white/20'}`}>{t}</button>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
};

export default PlayerFull;
