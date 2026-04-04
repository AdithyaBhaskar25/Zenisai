import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
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

  // Closes expanded view on "Escape" key for desktop accessibility
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

  return (
    <motion.div 
      layout
      className="fixed z-[100] left-1/2 -translate-x-1/2 bottom-6 sm:bottom-10 touch-none"
      style={{ 
        width: isExpanded ? 'min(500px, 92vw)' : '88px',
      }}
    >
      <motion.div 
        layout
        drag={isExpanded ? "y" : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => {
          if (info.offset.y > 100) setIsExpanded(false);
        }}
        className="relative bg-zinc-950/90 backdrop-blur-3xl border border-white/10 shadow-2xl overflow-hidden"
        style={{ 
          borderRadius: isExpanded ? '32px' : '44px',
          maxHeight: '85vh' 
        }}
      >
        <AnimatePresence mode="wait">
          {!isExpanded ? (
            /* --- COMPACT MODE --- */
            <motion.div 
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsExpanded(true)}
              className="w-[88px] h-[88px] flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
            >
              <svg className="absolute inset-0 w-full h-full -rotate-90 p-2">
                <circle cx="44" cy="44" r="40" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                <motion.circle 
                  cx="44" cy="44" r="40" fill="transparent" stroke={dominantColor || '#fff'} strokeWidth="3" 
                  strokeDasharray={251} 
                  animate={{ strokeDashoffset: 251 - (251 * percent) / 100 }}
                  strokeLinecap="round"
                />
              </svg>
              
              <div className="relative w-[68px] h-[68px] rounded-full overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 z-0 opacity-30">
                  <Visualizer analyser={analyser} color={dominantColor} className="w-full h-full" />
                </div>
                <img 
                  src={song?.artwork || 'https://picsum.photos/seed/music/200/200'} 
                  className={`w-full h-full object-cover z-10 ${isPlaying ? 'animate-[spin_15s_linear_infinite]' : 'grayscale opacity-50'}`} 
                />
              </div>
            </motion.div>
          ) : (
            /* --- EXPANDED MODE (Mobile/Tablet Friendly) --- */
            <motion.div 
              key="expanded"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-6"
            >
              {/* Drag Handle (Mobile UX) */}
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-1 sm:hidden" />

              {/* Header */}
              <div className="flex items-center gap-4">
                <motion.div 
                   whileTap={{ scale: 0.9 }}
                   onClick={onOpenPlayer}
                   className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg flex-shrink-0"
                >
                   <img src={song?.artwork} className="w-full h-full object-cover" />
                </motion.div>
                
                <div className="flex-1 min-w-0" onClick={onOpenPlayer}>
                  <h3 className="text-white font-bold truncate text-lg tracking-tight leading-tight">{song?.title || 'Zenisai'}</h3>
                  <p className="text-white/40 text-xs font-semibold truncate uppercase tracking-widest mt-0.5">{song?.artist || 'Ready to Sync'}</p>
                </div>

                <button 
                  onClick={() => setIsExpanded(false)}
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:bg-white/10 active:scale-90"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>

              {/* Navigation Grid (Touch-optimized) */}
              <div className="grid grid-cols-3 gap-2 p-1.5 bg-white/[0.04] rounded-[24px] border border-white/5">
                {tabs.map(tab => (
                  <button 
                    key={tab.id}
                    onClick={() => setActiveView(tab.id as AppView)}
                    className={`flex flex-col items-center justify-center py-3 rounded-[18px] transition-all relative ${activeView === tab.id ? 'bg-white text-black shadow-xl' : 'text-white/30 active:bg-white/5'}`}
                  >
                    <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon}/></svg>
                    <span className="text-[9px] font-black uppercase tracking-widest">{tab.label}</span>
                    {activeView === tab.id && <motion.div layoutId="tab-pill" className="absolute inset-0 bg-white rounded-[18px] -z-10" />}
                  </button>
                ))}
              </div>

              {/* Player Controls */}
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between px-2">
                  <div className="flex gap-2">
                    <IconButton onClick={onOpenChat} icon="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    <IconButton onClick={onToggleShuffle} active={isShuffle} icon="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </div>

                  <div className="flex items-center gap-6">
                    <button onClick={onPrev} className="text-white/40 active:scale-75 transition-transform"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg></button>
                    <button onClick={onToggle} className="w-16 h-16 flex items-center justify-center bg-white text-black rounded-full shadow-white/10 shadow-2xl active:scale-90 transition-transform">
                      {isPlaying ? <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
                    </button>
                    <button onClick={onNext} className="text-white/40 active:scale-75 transition-transform"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg></button>
                  </div>

                  <div className="flex gap-2">
                    <IconButton onClick={onToggleRepeat} active={repeatMode !== 'off'} badge={repeatMode === 'one' ? '1' : undefined} icon="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    <IconButton onClick={onToggleFavorite} active={isFavorite} colorClass={isFavorite ? 'text-red-500 bg-red-500/10' : ''} icon="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" isHeart />
                  </div>
                </div>

                {/* Scannable Progress Bar */}
                <div className="px-2">
                  <div className="relative h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      className="absolute inset-y-0 left-0 bg-white"
                      animate={{ width: `${percent}%` }}
                      transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 px-0.5">
                    <span className="text-[10px] font-bold text-white/20 tabular-nums">0:00</span>
                    <span className="text-[10px] font-bold text-white/20 tabular-nums">3:45</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

// Generic Icon Button for consistent touch targets
const IconButton = ({ icon, onClick, active, badge, colorClass, isHeart }: any) => (
  <button 
    onClick={onClick} 
    className={`w-11 h-11 flex items-center justify-center rounded-full transition-all active:scale-75 ${colorClass} ${active && !colorClass ? 'text-white bg-white/10' : 'text-white/20'}`}
  >
    <div className="relative">
      <svg className="w-5 h-5" fill={isHeart && active ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d={icon}/>
      </svg>
      {badge && <span className="absolute -top-2 -right-2 w-4 h-4 bg-white text-black text-[8px] font-black rounded-full flex items-center justify-center border-2 border-black">{badge}</span>}
    </div>
  </button>
);

export default FloatingHub;
