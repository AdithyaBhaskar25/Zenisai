import React, { useRef, useState } from 'react';
import { Song, AppView } from '../types';
import Visualizer from './Visualizer';

interface FloatingHubProps {
  song: Song | null;
  isPlaying: boolean;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  progress: number;
  duration: number;
  lyrics: string;
  plainLyrics: string;
  onOpenPlayer: () => void;
  analyser: AnalyserNode | null;
  dominantColor: string;
  onOpenChat: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  repeatMode: 'off' | 'one' | 'all';
  onToggleRepeat: () => void;
}

const FloatingHub: React.FC<FloatingHubProps> = ({ 
  song, isPlaying, onToggle, onNext, onPrev, activeView, setActiveView, progress, duration, lyrics, plainLyrics, onOpenPlayer, analyser, dominantColor, onOpenChat,
  isFavorite, onToggleFavorite, isShuffle, onToggleShuffle, repeatMode, onToggleRepeat
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const touchStartYRef = useRef<number | null>(null);

  const percent = Math.max(0, Math.min(100, (progress / (duration || 1)) * 100));
  const activeLyric = lyrics.split('\n').reverse().find(line => {
    const match = line.match(/\[(\d+):(\d+(?:\.\d+)?)\]/);
    return match ? progress >= Number(match[1]) * 60 + Number(match[2]) : false;
  })?.replace(/\[[^\]]+\]/g, '').trim();
  const dockLyric = activeLyric || plainLyrics.split('\n').find(line => line.trim()) || song?.title || 'Ready to play';

  const tabs = [
    { id: 'home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', label: 'Explore' },
    { id: 'search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', label: 'Search' },
    { id: 'library', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', label: 'Library' },
  ];

  const snappedTransition = "transition-all duration-200 ease-out";

  return (
    <div 
      className={`fixed z-[100] left-1/2 -translate-x-1/2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] ${snappedTransition}`}
      style={{ 
        width: 'calc(100% - 24px)',
        maxWidth: '720px'
      }}
      onTouchStart={event => { touchStartYRef.current = event.touches[0].clientY; }}
      onTouchEnd={event => {
        if (touchStartYRef.current === null) return;
        if (touchStartYRef.current - event.changedTouches[0].clientY > 60) onOpenPlayer();
        touchStartYRef.current = null;
      }}
    >
      <div 
        style={{ background: 'color-mix(in srgb, var(--color-surface) 92%, var(--color-primary) 8%)' }} 
        className={`relative border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.65)] backdrop-blur-2xl overflow-hidden rounded-[22px] ${snappedTransition} ${isExpanded ? 'p-3 sm:p-4 flex flex-col gap-3' : 'px-3 py-2.5 flex items-center hover:border-white/20'}`}
        onClick={() => !isExpanded && setIsExpanded(true)}
      >
        {!isExpanded ? (
          <div className="flex w-full min-w-0 items-center justify-between gap-3">
            {/* Touching the body expands the mini player to show nav tabs */}
            <div className="flex min-w-0 flex-1 items-center gap-3 cursor-pointer py-1" onClick={() => setIsExpanded(true)}>
              {/* Cover Art as a rotating vinyl disc: clicking opens full player directly */}
              <button 
                type="button"
                onClick={e => { e.stopPropagation(); onOpenPlayer(); }}
                aria-label="Open full player"
                title="Open full player"
                className="relative h-12 w-12 shrink-0 cursor-pointer group active:scale-90 transition-transform focus:outline-none"
              >
                <div 
                  className="relative h-12 w-12 rounded-full overflow-hidden border-2 border-white/25 shadow-xl ring-2 ring-black/40 animate-[spin_8s_linear_infinite]"
                  style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
                >
                  <img 
                    src={song?.artwork || 'https://picsum.photos/seed/zenisai/200/200'} 
                    alt={song?.title || 'Track'} 
                    className="h-full w-full object-cover" 
                  />
                  {/* Vinyl grooves and central spindle hole */}
                  <div className="absolute inset-0 rounded-full border-[3px] border-black/30 pointer-events-none" />
                  <div className="absolute inset-0 m-auto w-2.5 h-2.5 rounded-full bg-zinc-950 border border-white/50 shadow-inner z-10" />
                </div>
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-xs font-bold text-white">{song?.title || 'Zenisai'}</p>
                  <span className="text-[10px] text-white/40 truncate">· {song?.artist || 'Ready to Play'}</span>
                </div>
                {/* Complete wrapped lyrics line - shows whole line without truncation */}
                <p className="mt-0.5 whitespace-normal break-words text-wrap text-[11px] font-medium text-white/90 leading-tight">
                  {dockLyric}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Play / Pause */}
              <button 
                onClick={e => { e.stopPropagation(); onToggle(); }} 
                aria-label={isPlaying ? 'Pause' : 'Play'} 
                className="grid h-9 w-9 place-items-center rounded-full bg-accent text-[#06101e] shadow-md active:scale-90 transition-transform"
              >
                {isPlaying ? (
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                ) : (
                  <svg className="h-4 w-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                )}
              </button>
              {/* Direct Full Player button from closed state */}
              <button 
                onClick={e => { e.stopPropagation(); onOpenPlayer(); }} 
                aria-label="Open full screen player" 
                title="Open full player"
                className="grid h-9 w-9 place-items-center rounded-full bg-accent-tint text-accent hover:bg-accent hover:text-[#06101e] active:scale-90 transition-all"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
              </button>
              {/* Expand to show nav tabs */}
              <button 
                onClick={e => { e.stopPropagation(); setIsExpanded(true); }} 
                aria-label="Show navigation tabs" 
                title="Show navigation tabs"
                className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-white/60 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" /></svg>
              </button>
            </div>
            
            {/* Progress line for collapsed mode */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
              <div className="h-full bg-accent transition-all duration-300" style={{ width: `${percent}%` }} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:gap-4 transition-opacity duration-200">
            {/* Top Row: Song Info with rotating vinyl disc */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onOpenPlayer}
                aria-label="Open full player"
                title="Open full player"
                className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0 cursor-pointer shadow-lg border-2 border-white/25 ring-2 ring-black/40 group active:scale-90 transition-transform focus:outline-none"
              >
                <div 
                  className="w-full h-full animate-[spin_8s_linear_infinite]"
                  style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
                >
                  <img src={song?.artwork || 'https://picsum.photos/seed/music/200/200'} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 rounded-full border-[3px] border-black/30 pointer-events-none" />
                  <div className="absolute inset-0 m-auto w-2.5 h-2.5 rounded-full bg-zinc-950 border border-white/50 shadow-inner z-10" />
                </div>
              </button>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpenPlayer}>
                <p className="text-sm font-bold truncate text-white leading-tight">{song?.title || 'Zenisai'}</p>
                <p className="text-[11px] text-white/50 font-medium truncate mt-0.5">{song?.artist || 'Ready to Play'}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }} aria-label="Collapse player dock" className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-all active:scale-90">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
              </button>
            </div>

            {/* Lyrics banner: completely wraps the whole lyrics line */}
            <button onClick={onOpenPlayer} className="flex w-full min-w-0 items-start gap-2.5 rounded-[14px] border border-accent-tint bg-accent-tint/40 px-3.5 py-2.5 text-left transition-colors hover:bg-accent-tint/60">
              <svg className="h-4 w-4 mt-0.5 shrink-0 text-accent" viewBox="0 0 24 24" fill="currentColor"><path d="M9 18V5l12-2v13M9 9l12-2M5 19c0 1.1-1.1 2-2.5 2S0 20.1 0 19s1.1-2 2.5-2S5 17.9 5 19zm16-3c0 1.1-1.1 2-2.5 2S16 16.9 16 16s1.1-2 2.5-2S21 14.9 21 16z" /></svg>
              <span className="whitespace-normal break-words text-wrap flex-1 text-xs font-medium text-white/90 leading-relaxed">
                {activeLyric || plainLyrics.split('\n').find(line => line.trim()) || 'Lyrics appear with playback'}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-accent shrink-0 pt-0.5">Lyrics</span>
            </button>

            {/* Middle Row: Navigation Tabs */}
            <div className="flex bg-white/[0.04] rounded-[14px] p-1 gap-1 border border-white/[0.06]">
              {tabs.map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveView(tab.id as AppView)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-[10px] transition-all duration-150 active:scale-95 ${activeView === tab.id ? 'bg-accent text-[#06101e] font-bold shadow-md shadow-accent/20' : 'text-white/50 hover:text-white/80 font-medium'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon}></path></svg>
                  <span className="text-[11px]">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Bottom Row: Controls */}
            <div className="flex items-center justify-between px-1 gap-2 pt-0.5">
              <div className="flex items-center gap-2">
                <button onClick={onOpenChat} aria-label="Open Zenisai assistant" className="p-2 rounded-full bg-white/5 text-white/60 border border-white/5 active:scale-90 transition-all hover:text-accent hover:bg-white/10">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                </button>
                <button onClick={onToggleShuffle} className={`p-2 rounded-full transition-all active:scale-90 ${isShuffle ? 'bg-accent/15 text-accent shadow-accent' : 'text-white/35 hover:text-white/60'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={onPrev} aria-label="Previous track" className="text-white/60 p-1.5 active:scale-90 transition-all hover:text-white"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"></path></svg></button>
                <button onClick={onToggle} aria-label={isPlaying ? 'Pause' : 'Play'} className="w-10 h-10 flex items-center justify-center bg-accent text-[#06101e] rounded-full active:scale-90 transition-all shadow-md shadow-accent/25">
                  {isPlaying ? <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg> : <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>}
                </button>
                <button onClick={onNext} aria-label="Next track" className="text-white/60 p-1.5 active:scale-90 transition-all hover:text-white"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"></path></svg></button>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={onToggleRepeat} aria-label={`Repeat ${repeatMode}`} className={`p-2 rounded-full transition-all active:scale-90 ${repeatMode !== 'off' ? 'bg-accent/15 text-accent' : 'text-white/35 hover:text-white/60'}`}>
                  <div className="relative">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    {repeatMode === 'one' && <span className="absolute -top-1.5 -right-1.5 text-[7px] bg-accent text-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-black">1</span>}
                  </div>
                </button>
                <button onClick={onToggleFavorite} aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'} className={`p-2 rounded-full transition-all active:scale-90 ${isFavorite ? 'bg-rose-500/15 text-rose-400' : 'text-white/35 hover:text-white/60'}`}>
                  <svg className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                </button>
              </div>
            </div>

            {/* Progress line */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
              <div className="h-full bg-accent transition-all duration-300" style={{ width: `${percent}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FloatingHub;