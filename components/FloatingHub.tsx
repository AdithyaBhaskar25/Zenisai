import React, { useState, useEffect } from 'react';
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
  song, isPlaying, onToggle, onNext, onPrev, activeView, setActiveView, progress, duration, onOpenPlayer, analyser, dominantColor, onOpenChat,
  isFavorite, onToggleFavorite, isShuffle, onToggleShuffle, repeatMode, onToggleRepeat
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Progress Ring Calculation (No libraries)
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const percent = (progress / (duration || 1)) * 100;
  const offset = circumference - (percent / 100) * circumference;

  // AUTO-SEEK LOGIC: Finds the audio tag in the document so you don't have to pass new props
  const handleInternalSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    const audioEl = document.querySelector('audio');
    if (audioEl) {
      audioEl.currentTime = newTime;
    }
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsExpanded(false); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const tabs = [
    { id: 'home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', label: 'Home' },
    { id: 'search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', label: 'Search' },
    { id: 'library', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', label: 'Library' },
  ];

  const formatTime = (s: number) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;

  return (
    <div 
      className={`fixed z-[100] left-1/2 -translate-x-1/2 bottom-6 transition-all duration-700 ease-[cubic-bezier(0.19,1,0.22,1)] ${
        isExpanded ? 'w-[92vw] max-w-[440px]' : 'w-[88px]'
      }`}
    >
      <div 
        className={`relative bg-black border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,1)] transition-all duration-700 ease-[cubic-bezier(0.19,1,0.22,1)] ${
          isExpanded ? 'rounded-[36px] p-5' : 'rounded-full h-[88px] cursor-pointer hover:scale-105 active:scale-95'
        }`}
        onClick={() => !isExpanded && setIsExpanded(true)}
      >
        {!isExpanded ? (
          /* --- COMPACT MODE: PROGRESS RING VISIBLE --- */
          <div className="w-full h-full flex items-center justify-center relative">
            <svg className="absolute inset-0 w-full h-full -rotate-90 p-1">
              <circle cx="44" cy="44" r={radius} fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
              <circle 
                cx="44" cy="44" r={radius} fill="transparent" 
                stroke={dominantColor || '#fff'} strokeWidth="4" 
                strokeDasharray={circumference} 
                strokeDashoffset={isNaN(offset) ? circumference : offset}
                strokeLinecap="round"
                className="transition-all duration-300 ease-linear"
              />
            </svg>
            <div className="relative w-[68px] h-[68px] rounded-full overflow-hidden border border-white/5">
               <img 
                src={song?.artwork || 'https://picsum.photos/seed/music/200/200'} 
                className={`w-full h-full object-cover transition-opacity duration-500 ${isPlaying ? 'animate-[spin_12s_linear_infinite]' : 'opacity-40 grayscale'}`} 
                alt="disc"
              />
            </div>
          </div>
        ) : (
          /* --- EXPANDED MODE: PORTRAIT OPTIMIZED --- */
          <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Area */}
            <div className="flex items-center gap-4">
              <div onClick={(e) => { e.stopPropagation(); onOpenPlayer(); }} className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 shadow-2xl cursor-pointer">
                <img src={song?.artwork} className="w-full h-full object-cover" alt="art" />
              </div>
              <div className="flex-1 min-w-0" onClick={onOpenPlayer}>
                <h3 className="text-white font-black truncate text-[15px] leading-tight mb-0.5">{song?.title || 'Zenisai AI'}</h3>
                <p className="text-white/30 text-[9px] font-bold uppercase tracking-widest truncate">{song?.artist || 'Ready'}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 bg-white/[0.04] p-1 rounded-2xl">
              {tabs.map(tab => (
                <button 
                  key={tab.id}
                  onClick={(e) => { e.stopPropagation(); setActiveView(tab.id as AppView); }}
                  className={`flex-1 flex flex-col items-center py-2.5 rounded-xl transition-all ${activeView === tab.id ? 'bg-white text-black' : 'text-white/20'}`}
                >
                  <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={tab.icon}/></svg>
                  <span className="text-[8px] font-black uppercase">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Seekable Progress (Self-contained) */}
            <div className="px-1 group">
              <div className="relative w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-white absolute top-0 left-0" style={{ width: `${percent}%` }} />
                <input 
                  type="range" min="0" max={duration || 1} value={progress}
                  step="1"
                  onChange={handleInternalSeek}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
              </div>
              <div className="flex justify-between px-0.5">
                <span className="text-[9px] font-bold text-white/20 tabular-nums">{formatTime(progress)}</span>
                <span className="text-[9px] font-bold text-white/20 tabular-nums">{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls (Fixed for Portrait clipping) */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                <IconButton onClick={onOpenChat} icon="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                <IconButton onClick={onToggleShuffle} active={isShuffle} icon="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </div>

              <div className="flex items-center gap-3 sm:gap-5">
                <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className="text-white/30 active:scale-75"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg></button>
                <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center active:scale-90 shadow-xl">
                  {isPlaying ? <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg className="w-7 h-7 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
                </button>
                <button onClick={(e) => { e.stopPropagation(); onNext(); }} className="text-white/30 active:scale-75"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg></button>
              </div>

              <div className="flex gap-1">
                <IconButton onClick={onToggleRepeat} active={repeatMode !== 'off'} badge={repeatMode === 'one' ? '1' : undefined} icon="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                <IconButton onClick={onToggleFavorite} active={isFavorite} colorClass={isFavorite ? 'text-red-500 bg-red-500/10' : ''} icon="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" isHeart />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const IconButton = ({ icon, onClick, active, badge, colorClass, isHeart }: any) => (
  <button 
    onClick={(e) => { e.stopPropagation(); onClick(); }} 
    className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all active:scale-75 ${colorClass} ${active && !colorClass ? 'text-white bg-white/10' : 'text-white/20'}`}
  >
    <div className="relative">
      <svg className="w-5 h-5" fill={isHeart && active ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={icon}/>
      </svg>
      {badge && <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white text-black text-[7px] font-black rounded-full flex items-center justify-center border-2 border-black">{badge}</span>}
    </div>
  </button>
);

export default FloatingHub;
