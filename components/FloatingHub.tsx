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
  onSeek: (time: number) => void; // Added onSeek prop
}

const FloatingHub: React.FC<FloatingHubProps> = ({ 
  song, isPlaying, onToggle, onNext, onPrev, activeView, setActiveView, progress, duration, onOpenPlayer, analyser, dominantColor, onOpenChat,
  isFavorite, onToggleFavorite, isShuffle, onToggleShuffle, repeatMode, onToggleRepeat, onSeek
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const percent = (progress / (duration || 1)) * 100;

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsExpanded(false); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const tabs = [
    { id: 'home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', label: 'Explore' },
    { id: 'search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', label: 'Search' },
    { id: 'library', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', label: 'Library' },
  ];

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className={`fixed z-[100] left-1/2 -translate-x-1/2 bottom-6 sm:bottom-10 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${
        isExpanded ? 'w-[92vw] max-w-[480px]' : 'w-[88px]'
      }`}
    >
      <div 
        className={`relative bg-[#000000] border border-white/10 shadow-[0_30px_60px_-12px_rgba(0,0,0,1)] overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${
          isExpanded ? 'rounded-[40px] p-6' : 'rounded-full h-[88px] cursor-pointer hover:scale-105 active:scale-95'
        }`}
        onClick={() => !isExpanded && setIsExpanded(true)}
      >
        {!isExpanded ? (
          /* --- COMPACT MODE: ROTATING DISC WITH RING --- */
          <div className="w-full h-full flex items-center justify-center animate-in fade-in duration-300 relative">
            <svg className="absolute inset-0 w-full h-full -rotate-90 p-1">
              <circle cx="44" cy="44" r="41" fill="transparent" stroke="rgba(255,255,255,0.03)" strokeWidth="4" />
              <circle 
                cx="44" cy="44" r="41" fill="transparent" stroke={dominantColor || 'var(--color-primary)'} strokeWidth="4" 
                strokeDasharray={257.6} 
                strokeDashoffset={257.6 - (257.6 * percent) / 100}
                strokeLinecap="round"
                className="transition-all duration-500 shadow-[0_0_10px_rgba(255,255,255,0.3)]"
              />
            </svg>
            
            <div className="relative w-[72px] h-[72px] rounded-full overflow-hidden flex items-center justify-center border border-white/5">
              <div className="absolute inset-0 z-0 opacity-20 scale-150 blur-sm">
                <Visualizer analyser={analyser} color={dominantColor} className="w-full h-full" />
              </div>
              <img 
                src={song?.artwork || 'https://picsum.photos/seed/zen/200/200'} 
                className={`w-full h-full object-cover z-10 transition-transform duration-700 ${isPlaying ? 'animate-[spin_12s_linear_infinite]' : 'grayscale opacity-60'}`} 
                alt="Disc"
              />
            </div>
          </div>
        ) : (
          /* --- EXPANDED MODE --- */
          <div className="flex flex-col gap-6 animate-in zoom-in-95 fade-in duration-300">
            {/* Header */}
            <div className="flex items-center gap-5">
              <div onClick={(e) => { e.stopPropagation(); onOpenPlayer(); }} className="w-16 h-16 rounded-3xl overflow-hidden shadow-2xl flex-shrink-0 cursor-pointer active:scale-90 transition-transform">
                <img src={song?.artwork} className="w-full h-full object-cover" alt="Art" />
              </div>
              <div className="flex-1 min-w-0" onClick={onOpenPlayer}>
                <h3 className="text-white font-black truncate text-xl tracking-tighter leading-none mb-1">{song?.title || 'Zenisai AI'}</h3>
                <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.25em]">{song?.artist || 'Ready to Sync'}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }} className="w-11 h-11 rounded-full bg-white/5 flex items-center justify-center text-white/30 hover:text-white transition-all active:scale-75">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
              </button>
            </div>

            {/* Navigation */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-white/[0.03] rounded-[24px] border border-white/5 shadow-inner">
              {tabs.map(tab => (
                <button 
                  key={tab.id}
                  onClick={(e) => { e.stopPropagation(); setActiveView(tab.id as AppView); }}
                  className={`flex flex-col items-center justify-center py-3.5 rounded-[20px] transition-all duration-500 ${
                    activeView === tab.id ? 'bg-white text-black shadow-[0_10px_20px_rgba(255,255,255,0.1)] scale-100' : 'text-white/20 hover:text-white/40 scale-[0.97]'
                  }`}
                >
                  <svg className="w-5 h-5 mb-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={tab.icon}/></svg>
                  <span className="text-[9px] font-black uppercase tracking-widest">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                <IconButton onClick={onOpenChat} icon="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                <IconButton onClick={onToggleShuffle} active={isShuffle} icon="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </div>

              <div className="flex items-center gap-6">
                <button onClick={onPrev} className="text-white/30 hover:text-white active:scale-75 transition-all"><svg className="w-9 h-9" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg></button>
                <button onClick={onToggle} className="w-16 h-16 flex items-center justify-center bg-white text-black rounded-full shadow-2xl active:scale-90 transition-transform hover:scale-[1.03]">
                  {isPlaying ? <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
                </button>
                <button onClick={onNext} className="text-white/30 hover:text-white active:scale-75 transition-all"><svg className="w-9 h-9" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg></button>
              </div>

              <div className="flex gap-1.5">
                <IconButton onClick={onToggleRepeat} active={repeatMode !== 'off'} badge={repeatMode === 'one' ? '1' : undefined} icon="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                <IconButton onClick={onToggleFavorite} active={isFavorite} colorClass={isFavorite ? 'text-red-500 bg-red-500/10 border-red-500/20' : ''} icon="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" isHeart />
              </div>
            </div>

            {/* SEEKABLE PROGRESS BAR */}
            <div className="space-y-3 px-1">
              <div className="relative group/seek h-6 flex items-center">
                <input 
                  type="range"
                  min="0"
                  max={duration || 1}
                  value={progress}
                  onChange={(e) => onSeek(parseFloat(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute inset-0 w-full z-20 cursor-pointer accent-white opacity-0 group-hover/seek:opacity-100 transition-opacity"
                />
                <div className="absolute inset-x-0 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="absolute inset-y-0 left-0 bg-white transition-all duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
              <div className="flex justify-between px-0.5">
                <span className="text-[10px] font-black text-white/20 tabular-nums uppercase">{formatTime(progress)}</span>
                <span className="text-[10px] font-black text-white/20 tabular-nums uppercase">{formatTime(duration)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        /* Custom styling for the seekable range input thumb */
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 14px;
          width: 14px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(0,0,0,0.5);
          border: 2px solid black;
        }
      `}} />
    </div>
  );
};

const IconButton = ({ icon, onClick, active, badge, colorClass, isHeart }: any) => (
  <button 
    onClick={(e) => { e.stopPropagation(); onClick(); }} 
    className={`w-11 h-11 flex items-center justify-center rounded-2xl transition-all active:scale-75 border border-transparent ${colorClass} ${active && !colorClass ? 'text-white bg-white/10 border-white/5' : 'text-white/20 hover:text-white/40'}`}
  >
    <div className="relative">
      <svg className="w-5 h-5" fill={isHeart && active ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={icon}/>
      </svg>
      {badge && <span className="absolute -top-2 -right-2 w-4 h-4 bg-white text-black text-[8px] font-black rounded-full flex items-center justify-center border-2 border-black">{badge}</span>}
    </div>
  </button>
);

export default FloatingHub;
