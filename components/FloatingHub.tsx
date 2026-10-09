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

  const silkyTransition = "transition-all duration-[750ms] cubic-bezier(0.23, 1, 0.32, 1)";

  return (
    <div 
      className={`fixed z-[100] left-1/2 -translate-x-1/2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] ${silkyTransition}`}
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
      <div style={{ background: 'color-mix(in srgb, var(--color-surface) 88%, var(--color-primary) 12%)' }} className={`relative border border-white/10 shadow-[0_18px_56px_rgba(0,0,0,0.72)] overflow-hidden ${silkyTransition} ${isExpanded ? 'rounded-[24px] p-3 sm:p-4 flex flex-col gap-3' : 'min-h-[68px] rounded-full px-2 py-2 flex items-center hover:shadow-accent'}`} onClick={() => !isExpanded && setIsExpanded(true)}>

        {!isExpanded ? (
          <div className="flex w-full min-w-0 items-center gap-3 px-1">
            <div className="relative h-12 w-12 shrink-0">
              <svg className="absolute inset-0 h-full w-full -rotate-90">
                <circle cx="24" cy="24" r="21.5" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2.5" />
                <circle cx="24" cy="24" r="21.5" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeDasharray={135.1} strokeDashoffset={135.1 * (1 - percent / 100)} strokeLinecap="round" className="transition-all duration-300" />
              </svg>
              <img src={song?.artwork || 'https://picsum.photos/seed/zenisai/200/200'} className={`absolute left-[5px] top-[5px] h-[38px] w-[38px] rounded-full object-cover shadow-lg ${isPlaying ? 'animate-[spin_12s_linear_infinite]' : ''}`} />
            </div>
            <div className="min-w-0 flex-1 py-1">
              <p className="line-clamp-1 text-xs font-semibold text-white">{dockLyric}</p>
              <p className="mt-1 truncate text-[10px] text-white/45">{song ? `${song.title} · ${song.artist}` : 'Tap to explore'}</p>
            </div>
            <button onClick={event => { event.stopPropagation(); onOpenPlayer(); }} aria-label="Open full player" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-tint text-accent"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></button>
          </div>
        ) : (
          <div className="flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-700">
            {/* Top Row: Song Info */}
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-[16px] overflow-hidden flex-shrink-0 cursor-pointer shadow-xl border border-accent-tint group active:scale-[0.85] transition-all" onClick={onOpenPlayer}>
                <img src={song?.artwork || 'https://picsum.photos/seed/music/200/200'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              </div>
              <div className="flex-1 min-w-0" onClick={onOpenPlayer}>
                <p className="text-sm font-bold truncate text-white leading-tight mb-1">{song?.title || 'Zenisai'}</p>
                <p className="text-[10px] text-white/40 font-medium truncate">{song?.artist || 'Ready to Play'}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }} aria-label="Collapse player dock" className="p-2 bg-white/5 rounded-full text-white/40 hover:text-white transition-all active:scale-[0.8]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
              </button>
            </div>

            <button onClick={onOpenPlayer} className="flex w-full min-w-0 items-center gap-2 rounded-[12px] border border-accent-tint bg-accent-tint px-3 py-2 text-left">
              <svg className="h-4 w-4 shrink-0 text-accent" viewBox="0 0 24 24" fill="currentColor"><path d="M9 18V5l12-2v13M9 9l12-2M5 19c0 1.1-1.1 2-2.5 2S0 20.1 0 19s1.1-2 2.5-2S5 17.9 5 19zm16-3c0 1.1-1.1 2-2.5 2S16 16.9 16 16s1.1-2 2.5-2S21 14.9 21 16z" /></svg>
              <span className="line-clamp-1 flex-1 text-xs font-medium text-white/85">{activeLyric || plainLyrics.split('\n').find(line => line.trim()) || 'Lyrics appear with playback'}</span>
              <span className="text-[9px] font-semibold uppercase text-accent">Lyrics</span>
            </button>

            {/* Middle Row: Navigation Tabs */}
            <div className="flex bg-white/[0.035] rounded-[16px] p-1 gap-1 border border-white/[0.07]">
              {tabs.map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveView(tab.id as AppView)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[12px] transition-all duration-300 active:scale-95 ${activeView === tab.id ? 'bg-accent text-[#06101e] shadow-lg shadow-accent/20' : 'text-white/45 hover:text-white/80'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon}></path></svg>
                  <span className="text-[10px] font-semibold">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Bottom Row: Controls */}
            <div className="flex items-center justify-between px-1 gap-2">
              <div className="flex items-center gap-2.5">
                <button onClick={onOpenChat} aria-label="Open Zenisai assistant" className="p-2 rounded-full bg-white/5 text-white/55 border border-white/5 active:scale-90 transition-all hover:text-accent">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                </button>
                <button onClick={onToggleShuffle} className={`p-3 rounded-full transition-all duration-500 active:scale-90 ${isShuffle ? 'bg-accent/10 text-accent shadow-accent' : 'text-white/20'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={onPrev} aria-label="Previous track" className="text-white/55 p-1 active:scale-[0.8] transition-all hover:text-white"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"></path></svg></button>
                <button onClick={onToggle} aria-label={isPlaying ? 'Pause' : 'Play'} className="w-11 h-11 flex items-center justify-center bg-accent text-[#06101e] rounded-full active:scale-[0.85] transition-all shadow-lg shadow-accent/20">
                  {isPlaying ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg> : <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>}
                </button>
                <button onClick={onNext} aria-label="Next track" className="text-white/55 p-1 active:scale-[0.8] transition-all hover:text-white"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"></path></svg></button>
              </div>

              <div className="flex items-center gap-2.5">
                <button onClick={onToggleRepeat} aria-label={`Repeat ${repeatMode}`} className={`p-2 rounded-full transition-all active:scale-90 ${repeatMode !== 'off' ? 'bg-accent/10 text-accent' : 'text-white/35'}`}>
                  <div className="relative">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    {repeatMode === 'one' && <span className="absolute -top-1.5 -right-1.5 text-[7px] bg-accent text-white rounded-full w-4 h-4 flex items-center justify-center border-2 border-zinc-900 font-black shadow-lg">1</span>}
                  </div>
                </button>
                <button onClick={onToggleFavorite} aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'} className={`p-2 rounded-full transition-all active:scale-90 ${isFavorite ? 'bg-rose-400/10 text-rose-300' : 'text-white/35'}`}>
                  <svg className="w-5 h-5" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                </button>
              </div>
            </div>

            {/* Silky Progress integrated at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/5">
              <div className="h-full bg-accent rounded-full transition-all duration-500 shadow-accent" style={{ width: `${percent}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FloatingHub;