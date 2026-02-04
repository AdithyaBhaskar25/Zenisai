
import React, { useState } from 'react';
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

  const percent = (progress / (duration || 1)) * 100;

  const tabs = [
    { id: 'home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', label: 'Explore' },
    { id: 'search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', label: 'Search' },
    { id: 'library', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', label: 'Library' },
  ];

  const silkyTransition = "transition-all duration-[750ms] cubic-bezier(0.23, 1, 0.32, 1)";

  return (
    <div 
      className={`fixed z-[100] left-1/2 -translate-x-1/2 bottom-10 ${silkyTransition}`}
      style={{ 
        width: isExpanded ? 'calc(100% - 40px)' : '92px',
        maxWidth: isExpanded ? '480px' : '92px'
      }}
    >
      <div className={`relative bg-zinc-900/80 backdrop-blur-[60px] border border-white/10 shadow-[0_40px_100px_-20px_rgba(0,0,0,1)] overflow-hidden ${silkyTransition} ${isExpanded ? 'rounded-[48px] p-6 flex flex-col gap-6' : 'rounded-full h-[92px] w-[92px] items-center justify-center flex hover:scale-105 cursor-pointer hover:shadow-accent'}`} onClick={() => !isExpanded && setIsExpanded(true)}>
        
        {!isExpanded ? (
          <div className="w-full h-full p-2 relative flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none scale-[1.08]">
              <circle cx="46" cy="46" r="42" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
              <circle 
                cx="46" cy="46" r="42" fill="transparent" stroke="var(--color-primary)" strokeWidth="5" 
                strokeDasharray={264} strokeDashoffset={264 - (264 * percent) / 100}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden rounded-full">
                <Visualizer analyser={analyser} color={dominantColor} className="w-[60px] h-[30px] rounded-full opacity-30 blur-sm" />
            </div>
            <img 
              src={song?.artwork || 'https://picsum.photos/seed/zenisai/200/200'} 
              className={`w-[68px] h-[68px] rounded-full object-cover shadow-2xl z-10 transition-all duration-1000 ${isPlaying ? 'animate-[spin_12s_linear_infinite]' : 'opacity-40 grayscale scale-95'}`} 
            />
          </div>
        ) : (
          <div className="flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-700">
            {/* Top Row: Song Info */}
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-[24px] overflow-hidden flex-shrink-0 cursor-pointer shadow-2xl border border-white/10 group active:scale-[0.85] transition-all" onClick={onOpenPlayer}>
                <img src={song?.artwork || 'https://picsum.photos/seed/music/200/200'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              </div>
              <div className="flex-1 min-w-0" onClick={onOpenPlayer}>
                <p className="text-lg font-black truncate text-white tracking-tighter leading-none mb-1">{song?.title || 'Zenisai'}</p>
                <p className="text-[10px] text-white/30 font-black truncate uppercase tracking-[0.2em]">{song?.artist || 'Ready to Play'}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }} className="p-3.5 bg-white/5 rounded-full text-white/30 hover:text-white transition-all active:scale-[0.8]">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
              </button>
            </div>

            {/* Middle Row: Navigation Tabs */}
            <div className="flex bg-white/[0.03] rounded-[36px] p-2 gap-1.5 border border-white/5 shadow-inner">
              {tabs.map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveView(tab.id as AppView)}
                  className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-[28px] transition-all duration-500 active:scale-95 ${activeView === tab.id ? 'bg-white text-black shadow-2xl scale-100' : 'text-white/20 hover:text-white/40 scale-[0.97]'}`}
                >
                  <svg className={`w-6 h-6 ${activeView === tab.id ? 'fill-accent' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d={tab.icon}></path></svg>
                  <span className="text-[9px] font-black uppercase tracking-[0.1em]">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Bottom Row: Controls */}
            <div className="flex items-center justify-between px-2 gap-3">
              <div className="flex items-center gap-2.5">
                <button onClick={onOpenChat} className="p-3 rounded-full bg-white/5 text-white/40 border border-white/5 active:scale-90 transition-all hover:text-accent shadow-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                </button>
                <button onClick={onToggleShuffle} className={`p-3 rounded-full transition-all duration-500 active:scale-90 ${isShuffle ? 'bg-accent/10 text-accent shadow-accent' : 'text-white/20'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                </button>
              </div>

              <div className="flex items-center gap-5">
                <button onClick={onPrev} className="text-white/40 active:scale-[0.8] transition-all hover:text-white"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"></path></svg></button>
                <button onClick={onToggle} className="w-16 h-16 flex items-center justify-center bg-white text-black rounded-full active:scale-[0.85] transition-all shadow-white/20 shadow-2xl hover:scale-[1.02]">
                  {isPlaying ? <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg> : <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>}
                </button>
                <button onClick={onNext} className="text-white/40 active:scale-[0.8] transition-all hover:text-white"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"></path></svg></button>
              </div>

              <div className="flex items-center gap-2.5">
                <button onClick={onToggleRepeat} className={`p-3 rounded-full transition-all duration-500 active:scale-90 ${repeatMode !== 'off' ? 'bg-accent/10 text-accent shadow-accent' : 'text-white/20'}`}>
                  <div className="relative">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    {repeatMode === 'one' && <span className="absolute -top-1.5 -right-1.5 text-[7px] bg-accent text-white rounded-full w-4 h-4 flex items-center justify-center border-2 border-zinc-900 font-black shadow-lg">1</span>}
                  </div>
                </button>
                <button onClick={onToggleFavorite} className={`p-3 rounded-full transition-all duration-700 active:scale-90 ${isFavorite ? 'bg-red-500/10 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'text-white/20'}`}>
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
